import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { WechatAuthService } from './wechat-auth.service';

interface WxBindSession {
  userId: string;
  status: 'pending' | 'confirmed';
  expiresAt: number;
}

@Injectable()
export class WxBindScanService {
  private readonly logger = new Logger(WxBindScanService.name);
  private readonly sessions = new Map<string, WxBindSession>();
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly wechatAuthService: WechatAuthService,
    private readonly authService: AuthService,
  ) {}

  async createSession(userId: string) {
    this.cleanupExpired();

    const bindId = randomBytes(12).toString('base64url');
    const expiresAt = Date.now() + this.ttlMs;

    this.sessions.set(bindId, {
      userId,
      status: 'pending',
      expiresAt,
    });

    const page =
      this.config.get<string>('WX_WX_BIND_PAGE') || 'pages/wx-bind-scan/wx-bind-scan';

    let qrImageBase64: string | undefined;
    try {
      const image = await this.wechatAuthService.generateMiniProgramQrCode(bindId, page);
      qrImageBase64 = `data:image/png;base64,${image.toString('base64')}`;
    } catch (error) {
      this.logger.warn(
        `生成微信绑定小程序码失败: ${error instanceof Error ? error.message : error}`,
      );
    }

    return {
      bindId,
      qrImageBase64,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async getStatus(bindId: string, userId: string) {
    const session = this.sessions.get(bindId);
    if (!session) {
      throw new NotFoundException('绑定会话不存在');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('无权查看该绑定会话');
    }
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(bindId);
      return { status: 'expired' as const };
    }
    if (session.status === 'confirmed') {
      this.sessions.delete(bindId);
      return { status: 'confirmed' as const };
    }
    return { status: 'pending' as const };
  }

  async confirmWithCode(
    bindId: string,
    code: string,
    meta: { ip?: string; device?: string },
  ) {
    const session = this.getPendingSession(bindId);
    await this.authService.bindWechat(session.userId, code, meta);
    session.status = 'confirmed';
    return { success: true };
  }

  private getPendingSession(bindId: string) {
    const session = this.sessions.get(bindId);
    if (!session) {
      throw new NotFoundException('绑定会话不存在或已过期');
    }
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(bindId);
      throw new GoneException('绑定会话已过期，请在网页端刷新二维码');
    }
    if (session.status !== 'pending') {
      throw new GoneException('绑定会话已处理');
    }
    return session;
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }
}
