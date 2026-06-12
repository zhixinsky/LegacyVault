import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WeChatSessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WeChatPhoneResponse {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber?: string;
  };
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class WechatAuthService {
  private readonly logger = new Logger(WechatAuthService.name);
  private accessTokenCache: AccessTokenCache = { token: '', expiresAt: 0 };

  constructor(private readonly config: ConfigService) {}

  async code2Session(code: string): Promise<{ openid: string; sessionKey?: string; unionid?: string }> {
    const appId = this.getAppId();
    const appSecret = this.getAppSecret();
    if (!appId) {
      throw new Error('未配置 WX_APPID');
    }

    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret ?? '',
      js_code: code,
      grant_type: 'authorization_code',
    });
    const fromAppId = this.config.get<string>('WX_OPENAPI_FROM_APPID')?.trim();
    if (fromAppId) {
      params.set('from_appid', fromAppId);
    }

    const path = `/sns/jscode2session?${params.toString()}`;
    const errors: string[] = [];

    if (this.useCloudOpenApi()) {
      try {
        return this.parseSession(await this.requestWeChat('GET', path, true));
      } catch (error) {
        errors.push(`cloud-openapi: ${this.describeError(error)}`);
      }
    }

    if (appSecret) {
      try {
        return this.parseSession(await this.requestWeChat('GET', path, false));
      } catch (error) {
        errors.push(`direct: ${this.describeError(error)}`);
      }
    }

    throw new Error(errors.join(' ; ') || '微信登录未配置 WX_APP_SECRET');
  }

  async resolvePhoneNumber(code: string): Promise<string> {
    // 云托管方案 B：仅走容器内 HTTP 开放接口，不用 AppSecret 换 access_token
    if (this.useCloudOpenApi() || this.getPhoneApiMode() === 'open') {
      this.logger.log('resolvePhoneNumber 使用云托管开放接口服务');
      return this.fetchPhoneByOpenHttp(code);
    }

    if (!this.getAppSecret()) {
      throw new Error(
        '未配置手机号获取方式：云托管请设 WX_USE_OPENAPI=true；本地开发请设 WX_APP_SECRET',
      );
    }

    try {
      return await this.fetchPhoneBySecret(code, false);
    } catch (error) {
      if (this.isAccessTokenError(error)) {
        this.accessTokenCache = { token: '', expiresAt: 0 };
        return this.fetchPhoneBySecret(code, true);
      }
      throw error;
    }
  }

  private parseSession(data: WeChatSessionResponse) {
    if (data.errcode) {
      throw new Error(data.errmsg || `微信登录失败(${data.errcode})`);
    }
    if (!data.openid) {
      throw new Error('微信未返回 openid');
    }
    return {
      openid: data.openid,
      sessionKey: data.session_key,
      unionid: data.unionid,
    };
  }

  private async fetchPhoneByOpenHttp(code: string): Promise<string> {
    const data = await this.requestWeChat<WeChatPhoneResponse>(
      'POST',
      '/wxa/business/getuserphonenumber',
      true,
      { code },
    );
    return this.extractPhone(data);
  }

  private async fetchPhoneBySecret(code: string, forceRefresh: boolean): Promise<string> {
    const accessToken = await this.getStableAccessToken(forceRefresh);
    const data = await this.requestWeChat<WeChatPhoneResponse>(
      'POST',
      `/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`,
      false,
      { code },
    );
    if (this.isWechatApiFailure(data)) {
      const err = new Error(data.errmsg || '获取手机号失败');
      (err as Error & { wechatPayload?: WeChatPhoneResponse }).wechatPayload = data;
      throw err;
    }
    return this.extractPhone(data);
  }

  private extractPhone(data: WeChatPhoneResponse) {
    if (this.isWechatApiFailure(data)) {
      throw new Error(data.errmsg || '获取手机号失败');
    }
    const phone = data.phone_info?.phoneNumber;
    if (!phone) {
      throw new Error('微信未返回手机号');
    }
    return phone;
  }

  private async getStableAccessToken(forceRefresh: boolean) {
    const appId = this.getAppId();
    const secret = this.getAppSecret();
    if (!appId || !secret) {
      throw new Error('未配置 WX_APPID / WX_APP_SECRET');
    }

    if (!forceRefresh && this.accessTokenCache.token && Date.now() < this.accessTokenCache.expiresAt) {
      return this.accessTokenCache.token;
    }

    const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credential',
        appid: appId,
        secret,
        force_refresh: forceRefresh,
      }),
    });
    const data = (await response.json()) as { access_token?: string; expires_in?: number; errmsg?: string };
    if (!data.access_token) {
      throw new Error(data.errmsg || '获取微信 access_token 失败');
    }

    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000,
    };
    return data.access_token;
  }

  private async requestWeChat<T>(
    method: 'GET' | 'POST',
    path: string,
    viaCloudOpenApi: boolean,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const baseUrl = viaCloudOpenApi
      ? this.config.get<string>('WX_OPEN_API_BASE') || 'http://api.weixin.qq.com'
      : 'https://api.weixin.qq.com';
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`微信接口响应解析失败: ${text.slice(0, 200)}`);
    }
  }

  private useCloudOpenApi() {
    return ['1', 'true', 'yes'].includes(
      String(this.config.get<string>('WX_USE_OPENAPI') ?? '').toLowerCase(),
    );
  }

  private getPhoneApiMode() {
    return String(this.config.get<string>('WX_PHONE_API_MODE') ?? 'auto').toLowerCase();
  }

  private getAppId() {
    return this.config.get<string>('WX_APPID') || this.config.get<string>('WECHAT_APPID') || '';
  }

  private getAppSecret() {
    return (
      this.config.get<string>('WX_APP_SECRET') ||
      this.config.get<string>('WX_APPSECRET') ||
      this.config.get<string>('WECHAT_APPSECRET') ||
      ''
    );
  }

  private isWechatApiFailure(data: { errcode?: number }) {
    return typeof data.errcode === 'number' && data.errcode !== 0;
  }

  private isAccessTokenError(error: unknown) {
    const payload = (error as { wechatPayload?: WeChatPhoneResponse })?.wechatPayload;
    const errcode = Number(payload?.errcode);
    return errcode === 40001 || errcode === 42001 || errcode === 40014;
  }

  async generateScanQrCode(scene: string): Promise<Buffer> {
    const page =
      this.config.get<string>('WX_SCAN_LOGIN_PAGE') || 'pages/scan-login/scan-login';
    return this.generateMiniProgramQrCode(scene, page);
  }

  async generateMiniProgramQrCode(scene: string, page: string): Promise<Buffer> {
    const envVersion = this.config.get<string>('WX_QRCODE_ENV_VERSION') || 'release';
    const checkPath = ['1', 'true', 'yes'].includes(
      String(this.config.get<string>('WX_QRCODE_CHECK_PATH') ?? 'false').toLowerCase(),
    );
    const body = {
      scene,
      page,
      check_path: checkPath,
      width: 280,
      env_version: envVersion,
    };

    if (this.useCloudOpenApi()) {
      return this.postBinary('/wxa/getwxacodeunlimit', true, body);
    }

    const accessToken = await this.getStableAccessToken(false);
    return this.postBinary(
      `/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`,
      false,
      body,
    );
  }

  private async postBinary(
    path: string,
    viaCloudOpenApi: boolean,
    body: Record<string, unknown>,
  ): Promise<Buffer> {
    const baseUrl = viaCloudOpenApi
      ? this.config.get<string>('WX_OPEN_API_BASE') || 'http://api.weixin.qq.com'
      : 'https://api.weixin.qq.com';
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 512 && buffer[0] === 0x7b) {
      let message = '生成小程序码失败';
      try {
        const parsed = JSON.parse(buffer.toString('utf8')) as { errmsg?: string };
        message = parsed.errmsg || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return buffer;
  }

  private describeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
