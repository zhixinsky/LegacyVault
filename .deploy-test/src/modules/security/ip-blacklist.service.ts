import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditRiskLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class IpBlacklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getEnvBlockedIps(): string[] {
    const raw = this.config.get<string>('IP_BLACKLIST', '');
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async isBlocked(ip?: string): Promise<boolean> {
    if (!ip) {
      return false;
    }
    if (this.getEnvBlockedIps().includes(ip)) {
      return true;
    }
    const row = await this.prisma.ipBlacklist.findUnique({ where: { ip } });
    return Boolean(row);
  }

  async assertAllowed(ip?: string, userId?: string): Promise<void> {
    if (!ip || !(await this.isBlocked(ip))) {
      return;
    }

    await this.auditLogService.log({
      userId,
      actorType: 'system',
      action: 'auth.login.blocked_ip',
      ip,
      riskLevel: AuditRiskLevel.critical,
    });

    throw new ForbiddenException('当前网络环境不允许登录');
  }

  async list() {
    const envBlocked = this.getEnvBlockedIps().map((ip) => ({
      ip,
      reason: '环境变量 IP_BLACKLIST',
      source: 'env' as const,
      createdAt: null as string | null,
    }));

    const rows = await this.prisma.ipBlacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: [
        ...envBlocked,
        ...rows.map((row) => ({
          ip: row.ip,
          reason: row.reason,
          source: 'database' as const,
          createdAt: row.createdAt.toISOString(),
        })),
      ],
    };
  }

  async add(ip: string, reason?: string) {
    const normalized = ip.trim();
    if (!normalized) {
      throw new BadRequestException('IP 不能为空');
    }

    return this.prisma.ipBlacklist.upsert({
      where: { ip: normalized },
      create: { ip: normalized, reason },
      update: { reason },
    });
  }

  async remove(ip: string) {
    const normalized = decodeURIComponent(ip).trim();
    try {
      await this.prisma.ipBlacklist.delete({ where: { ip: normalized } });
    } catch {
      throw new NotFoundException('IP 不在黑名单中');
    }

    return { success: true };
  }
}
