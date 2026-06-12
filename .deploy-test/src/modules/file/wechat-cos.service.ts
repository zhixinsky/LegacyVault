import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { basename } from 'node:path';

interface TcbUploadMeta {
  errcode?: number;
  errmsg?: string;
  url: string;
  token: string;
  authorization: string;
  cos_file_id: string;
  file_id: string;
}

interface TcbDownloadRow {
  fileid: string;
  download_url?: string;
  tempFileURL?: string;
  status?: number;
  errcode?: number;
  errmsg?: string;
}

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class WechatCosService {
  private readonly logger = new Logger(WechatCosService.name);
  private accessTokenCache: AccessTokenCache = { token: '', expiresAt: 0 };

  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return this.config.get<string>('STORAGE_PROVIDER') === 'wechat_cos';
  }

  async upload(relativePath: string, data: Buffer): Promise<string> {
    const cloudPath = this.toCloudPath(relativePath);
    const meta = await this.requestTcb<TcbUploadMeta>('/tcb/uploadfile', {
      env: this.getEnvId(),
      path: cloudPath,
    });

    if (!meta.url || !meta.file_id) {
      throw new Error(meta.errmsg || 'COS 上传凭证获取失败');
    }

    const form = this.buildMultipartForm({
      key: cloudPath,
      signature: meta.authorization,
      token: meta.token,
      cosFileId: meta.cos_file_id,
      fileBuffer: data,
      filename: basename(cloudPath),
      contentType: 'application/octet-stream',
    });

    const response = await fetch(meta.url, {
      method: 'POST',
      headers: { 'Content-Type': form.contentType },
      body: new Uint8Array(form.body),
    });

    if (response.status < 200 || response.status >= 300) {
      const text = await response.text();
      throw new Error(`COS 上传失败 HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    this.logger.log(`COS uploaded ${cloudPath}`);
    return meta.file_id;
  }

  async read(storagePath: string): Promise<Buffer> {
    if (!storagePath.startsWith('cloud://')) {
      throw new Error('非云存储 file_id，无法从 COS 读取');
    }

    const data = await this.requestTcb<{ file_list?: TcbDownloadRow[] }>(
      '/tcb/batchdownloadfile',
      {
        env: this.getEnvId(),
        file_list: [{ fileid: storagePath, max_age: 600 }],
      },
    );

    const row = data.file_list?.[0];
    const downloadUrl = row?.download_url || row?.tempFileURL;
    if (!downloadUrl) {
      throw new Error(row?.errmsg || 'COS 下载地址获取失败');
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`COS 下载失败 HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async remove(storagePath: string) {
    if (!storagePath.startsWith('cloud://')) {
      return;
    }

    await this.requestTcb('/tcb/deletefile', {
      env: this.getEnvId(),
      fileid_list: [storagePath],
    });
  }

  private toCloudPath(relativePath: string) {
    const prefix = this.config.get<string>('COS_PREFIX') || 'vaultpass/';
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return `${normalizedPrefix}${relativePath.replace(/^\/+/, '')}`;
  }

  private getEnvId() {
    const configured = this.config.get<string>('TCB_ENV_ID')?.trim();
    if (configured) {
      return configured;
    }

    const bucket = this.config.get<string>('COS_BUCKET') || '';
    const match = bucket.match(/^7072-(.+)-\d+$/);
    if (match?.[1]) {
      return match[1];
    }

    throw new Error('未配置 TCB_ENV_ID，且无法从 COS_BUCKET 推导环境 ID');
  }

  private buildMultipartForm(input: {
    key: string;
    signature: string;
    token: string;
    cosFileId: string;
    fileBuffer: Buffer;
    filename: string;
    contentType: string;
  }) {
    const boundary = `----VaultPass${Date.now()}${Math.random().toString(16).slice(2)}`;
    const fields: Array<[string, string]> = [
      ['key', input.key],
      ['Signature', input.signature],
      ['x-cos-security-token', input.token],
      ['x-cos-meta-fileid', input.cosFileId],
    ];

    let header = '';
    for (const [name, value] of fields) {
      header += `--${boundary}\r\n`;
      header += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
      header += `${value}\r\n`;
    }
    header += `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="file"; filename="${input.filename}"\r\n`;
    header += `Content-Type: ${input.contentType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    return {
      body: Buffer.concat([
        Buffer.from(header, 'utf8'),
        input.fileBuffer,
        Buffer.from(footer, 'utf8'),
      ]),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  private async requestTcb<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const viaCloudOpenApi = this.useCloudOpenApi();
    const errors: string[] = [];

    if (viaCloudOpenApi) {
      try {
        return await this.postJson<T>(path, body, true);
      } catch (error) {
        errors.push(`cloud-openapi: ${this.describeError(error)}`);
      }
    }

    const secret = this.getAppSecret();
    if (secret) {
      try {
        const accessToken = await this.getStableAccessToken(false);
        const urlPath = `${path}?access_token=${encodeURIComponent(accessToken)}`;
        return await this.postJson<T>(urlPath, body, false);
      } catch (error) {
        errors.push(`access-token: ${this.describeError(error)}`);
      }
    }

    throw new Error(errors.join(' ; ') || '微信 COS 接口未配置');
  }

  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    viaCloudOpenApi: boolean,
  ): Promise<T> {
    const baseUrl = viaCloudOpenApi
      ? this.config.get<string>('WX_OPEN_API_BASE') || 'http://api.weixin.qq.com'
      : 'https://api.weixin.qq.com';
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: T & { errcode?: number; errmsg?: string };
    try {
      data = JSON.parse(text) as T & { errcode?: number; errmsg?: string };
    } catch {
      throw new Error(`微信 COS 接口响应解析失败: ${text.slice(0, 200)}`);
    }

    if (typeof data.errcode === 'number' && data.errcode !== 0) {
      throw new Error(data.errmsg || `微信 COS 接口错误(${data.errcode})`);
    }

    return data;
  }

  private async getStableAccessToken(forceRefresh: boolean) {
    const appId = this.config.get<string>('WX_APPID');
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

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      errmsg?: string;
    };

    if (!data.access_token) {
      throw new Error(data.errmsg || '获取微信 access_token 失败');
    }

    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000,
    };

    return data.access_token;
  }

  private useCloudOpenApi() {
    return ['1', 'true', 'yes'].includes(
      String(this.config.get<string>('WX_USE_OPENAPI') ?? '').toLowerCase(),
    );
  }

  private getAppSecret() {
    return (
      this.config.get<string>('WX_APP_SECRET') ||
      this.config.get<string>('WX_APPSECRET') ||
      ''
    );
  }

  private describeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
