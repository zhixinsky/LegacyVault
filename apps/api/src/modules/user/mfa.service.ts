import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditRiskLevel } from '@prisma/client';
import { authenticator } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  createSetupPayload(userId: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userId, 'VaultPass', secret);
    return { secret, otpauthUrl };
  }

  async enableMfa(
    userId: string,
    secret: string,
    code: string,
    meta: { ip?: string; device?: string },
  ) {
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('验证码错误');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: true },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'user.mfa.enable',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { enabled: true };
  }

  async disableMfa(
    userId: string,
    code: string,
    meta: { ip?: string; device?: string },
  ) {
    await this.verifyUserCode(userId, code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'user.mfa.disable',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { enabled: false };
  }

  async verifyUserCode(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('未启用二次验证');
    }

    const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!valid) {
      throw new UnauthorizedException('二次验证码错误');
    }

    return true;
  }

  async assertMfaIfEnabled(userId: string, code: string | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      return;
    }

    if (!code) {
      throw new UnauthorizedException('此操作需要二次验证码');
    }

    await this.verifyUserCode(userId, code);
  }
}
