import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditRiskLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { InheritanceWorkflowService } from '../inheritance/inheritance-workflow.service';
import { MfaService } from './mfa.service';
import { SetupRecoveryKeyDto } from './dto/recovery-key.dto';
import { UpdateUserDto } from './dto/user.dto';
import { DeviceService } from './device.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly inheritanceWorkflowService: InheritanceWorkflowService,
    private readonly mfaService: MfaService,
    private readonly deviceService: DeviceService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        status: true,
        mfaEnabled: true,
        recoveryKeyHint: true,
        encryptedVaultKeyByRecovery: true,
        wxOpenid: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      id: user.id,
      username: user.username ?? undefined,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      recoveryKeyConfigured: Boolean(user.encryptedVaultKeyByRecovery),
      recoveryKeyHint: user.recoveryKeyHint ?? undefined,
      encryptedVaultKeyByRecovery: user.encryptedVaultKeyByRecovery ?? undefined,
      wxBound: Boolean(user.wxOpenid),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
    meta: { ip?: string; device?: string },
  ) {
    if (dto.phone || dto.email) {
      throw new BadRequestException('手机号和邮箱请通过验证绑定流程修改');
    }

    if (dto.phone) {
      const exists = await this.prisma.user.findFirst({
        where: { phone: dto.phone, NOT: { id: userId } },
      });
      if (exists) {
        throw new ConflictException('手机号已被占用');
      }
    }

    if (dto.email) {
      const exists = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (exists) {
        throw new ConflictException('邮箱已被占用');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        phone: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'user.profile.update',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return {
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async heartbeat(userId: string, meta?: { ip?: string; device?: string; deviceId?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: { lastLoginAt: true },
    });

    await this.inheritanceWorkflowService.onUserActivity(userId);
    if (meta) {
      await this.deviceService.touchDevice(userId, meta);
    }

    return { lastLoginAt: user.lastLoginAt?.toISOString() };
  }

  async setupRecoveryKey(
    userId: string,
    dto: SetupRecoveryKeyDto,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        encryptedVaultKeyByRecovery: dto.encryptedVaultKeyByRecovery,
        recoveryKeyHint: dto.recoveryKeyHint,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'user.recovery_key.setup',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { configured: true };
  }

  listDevices(userId: string) {
    return this.deviceService.listDevices(userId);
  }

  revokeDevice(
    userId: string,
    deviceId: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    return this.deviceService.revokeDevice(userId, deviceId, meta);
  }

  async logDataExport(
    userId: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'export.data',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { logged: true };
  }
}
