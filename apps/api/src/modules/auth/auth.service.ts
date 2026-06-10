import {

  BadRequestException,

  ConflictException,

  ForbiddenException,

  GoneException,

  Injectable,

  Logger,

  NotFoundException,

  UnauthorizedException,

  HttpException,

  HttpStatus,

} from '@nestjs/common';

import { randomBytes } from 'crypto';

import { JwtService } from '@nestjs/jwt';

import { AuditRiskLevel, Prisma, UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { AuditLogService } from '../audit-log/audit-log.service';

import { EmaySmsService } from '../notification/emay/emay-sms.service';

import { InheritanceWorkflowService } from '../inheritance/inheritance-workflow.service';

import { IpBlacklistService } from '../security/ip-blacklist.service';
import { DeviceService } from '../user/device.service';
import { MfaService } from '../user/mfa.service';

import {

  LoginDto,

  LoginWithCodeDto,

  RegisterDto,

  SendCodeDto,

  WechatPhoneDto,

  WxLoginDto,

} from './dto/auth.dto';

import { WechatAuthService } from './wechat-auth.service';



interface LoginAttemptState {

  count: number;

  lockUntil?: number;

}



interface CodeEntry {

  code: string;

  expiresAt: number;

}

interface PendingMfaLogin {
  userId: string;
  meta: { ip?: string; device?: string; deviceId?: string };
  action: string;
  expiresAt: number;
}

export type AuthLoginResult =

  | Awaited<ReturnType<AuthService['buildAuthResponse']>>

  | { registered: false; phone?: string }

  | { mfaRequired: true; pendingId: string };



@Injectable()

export class AuthService {

  private readonly logger = new Logger(AuthService.name);

  private readonly loginAttempts = new Map<string, LoginAttemptState>();

  private readonly codeStore = new Map<string, CodeEntry>();

  private readonly pendingMfaLogins = new Map<string, PendingMfaLogin>();

  constructor(

    private readonly prisma: PrismaService,

    private readonly jwtService: JwtService,

    private readonly auditLogService: AuditLogService,

    private readonly inheritanceWorkflowService: InheritanceWorkflowService,

    private readonly deviceService: DeviceService,

    private readonly emaySmsService: EmaySmsService,

    private readonly wechatAuthService: WechatAuthService,

    private readonly mfaService: MfaService,

    private readonly ipBlacklistService: IpBlacklistService,

  ) {}



  /**

   * 注册：只接收 encryptedVaultKey，禁止接收用户主密码明文。

   */

  async register(dto: RegisterDto, meta: { ip?: string; device?: string }) {
    await this.ipBlacklistService.assertAllowed(meta.ip);

    if (!dto.phone && !dto.email) {

      throw new BadRequestException('手机号或邮箱至少填写一项');

    }



    if (dto.phone) {

      const exists = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

      if (exists) {

        throw new ConflictException('手机号已注册');

      }

    }



    if (dto.email) {

      const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });

      if (exists) {

        throw new ConflictException('邮箱已注册');

      }

    }



    let wxOpenid: string | undefined;

    if (dto.wxCode) {

      const session = await this.wechatAuthService.code2Session(dto.wxCode);

      wxOpenid = session.openid;

      const wxTaken = await this.prisma.user.findUnique({ where: { wxOpenid } });

      if (wxTaken) {

        throw new ConflictException('该微信已绑定其他账户');

      }

    }



    const user = await this.prisma.user.create({

      data: {

        phone: dto.phone,

        email: dto.email,

        wxOpenid,

        encryptedVaultKey: dto.encryptedVaultKey,

        kdfSalt: dto.kdfSalt,

        kdfParams: dto.kdfParams as unknown as Prisma.InputJsonValue,

        status: UserStatus.active,

        lastLoginAt: new Date(),

      },

    });



    await this.auditLogService.log({

      userId: user.id,

      actorId: user.id,

      action: 'auth.register',

      ip: meta.ip,

      device: meta.device,

      riskLevel: AuditRiskLevel.medium,

    });



    await this.deviceService.trackLogin(user.id, meta);



    return this.buildAuthResponse(user.id);

  }



  async sendCode(dto: SendCodeDto, meta: { ip?: string } = {}) {
    await this.ipBlacklistService.assertAllowed(meta.ip);

    const existing = this.codeStore.get(dto.phone);

    if (existing && existing.expiresAt - Date.now() > 4.5 * 60 * 1000) {

      throw new BadRequestException('发送过于频繁，请稍后再试');

    }



    const code = this.generateOtpCode();

    await this.emaySmsService.sendLoginOtp(dto.phone, code);



    this.codeStore.set(dto.phone, {

      code,

      expiresAt: Date.now() + 10 * 60 * 1000,

    });



    this.logger.log(`Login OTP sent to ${this.maskPhone(dto.phone)}`);

    return { success: true };

  }



  async loginWithCode(dto: LoginWithCodeDto, meta: { ip?: string; device?: string; deviceId?: string }) {

    this.verifyOtp(dto.phone, dto.code);

    return this.loginByPhone(dto.phone, meta, 'auth.login.sms');

  }



  async login(dto: LoginDto, meta: { ip?: string; device?: string; deviceId?: string }) {

    if (!dto.phone && !dto.email) {

      throw new BadRequestException('手机号或邮箱至少填写一项');

    }



    if (dto.phone) {

      if (!dto.code) {

        throw new BadRequestException('请使用短信验证码登录，或调用 /auth/login-with-code');

      }

      this.verifyOtp(dto.phone, dto.code);

      return this.loginByPhone(dto.phone, meta, 'auth.login');

    }



    const attemptKey = dto.email ?? '';

    this.assertLoginAllowed(attemptKey);



    const user = await this.prisma.user.findFirst({

      where: { email: dto.email },

    });



    if (!user) {

      this.recordFailedLogin(attemptKey, meta);

      throw new NotFoundException('用户不存在');

    }



    return this.loginUserById(user.id, meta, 'auth.login');

  }



  async wxLogin(

    dto: WxLoginDto,

    meta: { ip?: string; device?: string; deviceId?: string },

    headerOpenid?: string,

  ): Promise<AuthLoginResult> {

    let openid = headerOpenid?.trim();



    if (!openid) {

      const session = await this.wechatAuthService.code2Session(dto.code);

      openid = session.openid;

    }



    const user = await this.prisma.user.findUnique({ where: { wxOpenid: openid } });

    if (!user) {

      return { registered: false };

    }



    if (user.status === UserStatus.suspended) {

      throw new ForbiddenException('账号已被停用');

    }



    return this.loginUserById(user.id, meta, 'auth.login.wx');

  }



  async wechatPhoneLogin(

    dto: WechatPhoneDto,

    meta: { ip?: string; device?: string; deviceId?: string },

  ): Promise<AuthLoginResult> {

    const phone = await this.wechatAuthService.resolvePhoneNumber(dto.code);

    const user = await this.prisma.user.findUnique({ where: { phone } });



    if (!user) {

      return { registered: false, phone };

    }



    if (user.status === UserStatus.suspended) {

      throw new ForbiddenException('账号已被停用');

    }



    return this.loginUserById(user.id, meta, 'auth.login.wechat_phone');

  }



  async resolveWechatPhone(dto: WechatPhoneDto) {

    const phone = await this.wechatAuthService.resolvePhoneNumber(dto.code);

    return { phone };

  }



  private async loginByPhone(

    phone: string,

    meta: { ip?: string; device?: string; deviceId?: string },

    action: string,

  ) {
    await this.ipBlacklistService.assertAllowed(meta.ip);

    const attemptKey = phone;

    this.assertLoginAllowed(attemptKey);



    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {

      this.recordFailedLogin(attemptKey, meta);

      throw new NotFoundException('用户不存在，请先注册');

    }



    if (user.status === UserStatus.suspended) {

      throw new ForbiddenException('账号已被停用');

    }



    return this.loginUserById(user.id, meta, action);

  }

  async verifyPendingMfa(
    pendingId: string,
    code: string,
  ) {
    const pending = this.pendingMfaLogins.get(pendingId);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.pendingMfaLogins.delete(pendingId);
      throw new GoneException('登录验证已过期，请重新登录');
    }

    await this.mfaService.verifyUserCode(pending.userId, code);
    this.pendingMfaLogins.delete(pendingId);

    return this.completeLogin(pending.userId, pending.meta, pending.action);
  }

  async loginUserById(
    userId: string,
    meta: { ip?: string; device?: string; deviceId?: string },
    action: string,
  ): Promise<AuthLoginResult> {
    await this.ipBlacklistService.assertAllowed(meta.ip, userId);

    const mfaGate = await this.createPendingMfaIfNeeded(userId, meta, action);
    if (mfaGate) {
      return mfaGate;
    }
    return this.completeLogin(userId, meta, action);
  }

  private async createPendingMfaIfNeeded(
    userId: string,
    meta: { ip?: string; device?: string; deviceId?: string },
    action: string,
  ): Promise<{ mfaRequired: true; pendingId: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      return null;
    }

    const known = await this.deviceService.isKnownDevice(userId, meta.deviceId);
    if (known) {
      return null;
    }

    const pendingId = randomBytes(12).toString('base64url');
    this.pendingMfaLogins.set(pendingId, {
      userId,
      meta,
      action,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return { mfaRequired: true, pendingId };
  }

  async bindWechat(userId: string, code: string, meta: { ip?: string; device?: string }) {
    const session = await this.wechatAuthService.code2Session(code);
    const taken = await this.prisma.user.findFirst({
      where: {
        wxOpenid: session.openid,
        NOT: { id: userId },
      },
    });

    if (taken) {
      throw new ConflictException('该微信已绑定其他账户');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { wxOpenid: session.openid },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'user.wechat.bind',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return { bound: true };
  }

  async unbindWechat(userId: string, meta: { ip?: string; device?: string }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { wxOpenid: null },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'user.wechat.unbind',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return { bound: false };
  }

  private async completeLogin(

    userId: string,

    meta: { ip?: string; device?: string; deviceId?: string },

    action: string,

  ) {

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const attemptKey = user.phone ?? user.email ?? userId;

    this.loginAttempts.delete(attemptKey);



    await this.prisma.user.update({

      where: { id: userId },

      data: { lastLoginAt: new Date() },

    });



    await this.inheritanceWorkflowService.onUserActivity(userId);



    await this.auditLogService.log({

      userId,

      actorId: userId,

      action,

      ip: meta.ip,

      device: meta.device,

      riskLevel: AuditRiskLevel.medium,

    });



    await this.deviceService.trackLogin(userId, meta);



    return this.buildAuthResponse(userId);

  }



  private verifyOtp(phone: string, code: string) {

    const entry = this.codeStore.get(phone);

    if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {

      throw new UnauthorizedException('验证码错误或已过期');

    }

    this.codeStore.delete(phone);

  }



  private generateOtpCode() {

    return Math.floor(100000 + Math.random() * 900000).toString();

  }



  private maskPhone(phone: string) {

    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;

  }



  private assertLoginAllowed(key: string) {

    const state = this.loginAttempts.get(key);

    if (state?.lockUntil && state.lockUntil > Date.now()) {

      throw new HttpException('登录尝试过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);

    }

  }



  private recordFailedLogin(

    key: string,

    meta: { ip?: string; device?: string },

  ) {

    const state = this.loginAttempts.get(key) ?? { count: 0 };

    state.count += 1;



    if (state.count >= 5) {

      state.lockUntil = Date.now() + 15 * 60 * 1000;

      state.count = 0;

    }



    this.loginAttempts.set(key, state);



    void this.auditLogService.log({

      action: 'auth.login.failed',

      ip: meta.ip,

      device: meta.device,

      riskLevel: AuditRiskLevel.high,

    });

  }



  private async buildAuthResponse(userId: string) {

    const user = await this.prisma.user.findUniqueOrThrow({

      where: { id: userId },

      select: {

        id: true,

        phone: true,

        email: true,

        status: true,

        mfaEnabled: true,

        lastLoginAt: true,

        createdAt: true,

        encryptedVaultKey: true,

        encryptedVaultKeyByRecovery: true,

        recoveryKeyHint: true,

        kdfSalt: true,

        kdfParams: true,

      },

    });



    const accessToken = await this.jwtService.signAsync({ sub: user.id });



    return {

      accessToken,

      user: {

        id: user.id,

        phone: user.phone ?? undefined,

        email: user.email ?? undefined,

        status: user.status,

        mfaEnabled: user.mfaEnabled,

        recoveryKeyConfigured: Boolean(user.encryptedVaultKeyByRecovery),

        recoveryKeyHint: user.recoveryKeyHint ?? undefined,

        lastLoginAt: user.lastLoginAt?.toISOString(),

        createdAt: user.createdAt.toISOString(),

      },

      vaultKeyBundle: {

        encryptedVaultKey: user.encryptedVaultKey,

        kdfSalt: user.kdfSalt,

        kdfParams: user.kdfParams,

      },

      encryptedVaultKeyByRecovery: user.encryptedVaultKeyByRecovery ?? undefined,

    };

  }

}


