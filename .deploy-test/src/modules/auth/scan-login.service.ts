import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { WechatAuthService } from './wechat-auth.service';

interface ScanSession {
  status: 'pending' | 'confirmed';
  userId?: string;
  mfaPendingId?: string;
  expiresAt: number;
}

@Injectable()
export class ScanLoginService {
  private readonly logger = new Logger(ScanLoginService.name);
  private readonly sessions = new Map<string, ScanSession>();
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatAuthService: WechatAuthService,
    private readonly authService: AuthService,
  ) {}

  async createSession() {
    this.cleanupExpired();

    const scanId = randomBytes(12).toString('base64url');
    const expiresAt = Date.now() + this.ttlMs;

    this.sessions.set(scanId, {
      status: 'pending',
      expiresAt,
    });

    let qrImageBase64: string | undefined;
    try {
      const image = await this.wechatAuthService.generateScanQrCode(scanId);
      qrImageBase64 = `data:image/png;base64,${image.toString('base64')}`;
    } catch (error) {
      this.logger.warn(
        `生成扫码登录小程序码失败: ${error instanceof Error ? error.message : error}`,
      );
    }

    return {
      scanId,
      qrImageBase64,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async confirmWithCode(
    scanId: string,
    code: string,
    meta: { ip?: string; device?: string; deviceId?: string },
  ) {
    const session = this.getPendingSession(scanId);
    const { openid } = await this.wechatAuthService.code2Session(code);
    const user = await this.prisma.user.findUnique({ where: { wxOpenid: openid } });

    if (!user) {
      throw new NotFoundException('未找到绑定该微信的账户，请先在安全中心绑定微信');
    }

    session.status = 'confirmed';
    session.userId = user.id;

    return { success: true };
  }

  async approveByUser(
    scanId: string,
    userId: string,
    meta: { ip?: string; device?: string; deviceId?: string },
  ) {
    const session = this.getPendingSession(scanId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    session.status = 'confirmed';
    session.userId = user.id;

    return { success: true };
  }

  async getStatus(
    scanId: string,
    meta: { ip?: string; device?: string; deviceId?: string },
  ) {
    this.cleanupExpired();

    const session = this.sessions.get(scanId);
    if (!session) {
      return { status: 'expired' as const };
    }

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(scanId);
      return { status: 'expired' as const };
    }

    if (session.status !== 'confirmed' || !session.userId) {
      return { status: 'pending' as const };
    }

    if (session.mfaPendingId) {
      return { status: 'mfa_required' as const };
    }

    const auth = await this.authService.loginUserById(
      session.userId,
      meta,
      'auth.login.scan',
    );

    if ('mfaRequired' in auth && auth.mfaRequired) {
      session.mfaPendingId = auth.pendingId;
      return { status: 'mfa_required' as const };
    }

    this.sessions.delete(scanId);

    return {
      status: 'confirmed' as const,
      ...auth,
    };
  }

  async verifyMfa(
    scanId: string,
    code: string,
  ) {
    const session = this.sessions.get(scanId);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(scanId);
      throw new GoneException('扫码会话已过期，请刷新二维码');
    }

    if (!session.mfaPendingId) {
      throw new BadRequestException('当前会话不需要二次验证');
    }

    const auth = await this.authService.verifyPendingMfa(session.mfaPendingId, code);
    this.sessions.delete(scanId);

    return {
      status: 'confirmed' as const,
      ...auth,
    };
  }

  private getPendingSession(scanId: string) {
    this.cleanupExpired();

    const session = this.sessions.get(scanId);
    if (!session) {
      throw new GoneException('扫码会话已过期，请刷新二维码');
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(scanId);
      throw new GoneException('扫码会话已过期，请刷新二维码');
    }
    if (session.status === 'confirmed') {
      throw new BadRequestException('该二维码已被确认');
    }
    return session;
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [scanId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(scanId);
      }
    }
  }
}
