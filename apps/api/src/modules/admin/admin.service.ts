import { Injectable } from '@nestjs/common';
import { AuditRiskLevel, UserStatus } from '@prisma/client';
import { getPagination, PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { InheritanceSchedulerService } from '../inheritance/inheritance-scheduler.service';
import { IpBlacklistService } from '../security/ip-blacklist.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly inheritanceSchedulerService: InheritanceSchedulerService,
    private readonly ipBlacklistService: IpBlacklistService,
  ) {}

  async getStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [users, activeEvents, highRiskToday] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.inheritanceEvent.count({
        where: {
          status: {
            notIn: ['cancelled', 'completed'],
          },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          riskLevel: { in: [AuditRiskLevel.high, AuditRiskLevel.critical] },
          createdAt: { gte: startOfToday },
        },
      }),
    ]);

    return { users, activeEvents, highRiskToday };
  }

  async listUsers(query: PaginationDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          email: true,
          status: true,
          lastLoginAt: true,
          mfaEnabled: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async updateUserStatus(userId: string, status: UserStatus, meta: { ip?: string; device?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, status: true },
    });

    await this.auditLogService.log({
      userId,
      actorType: 'admin',
      action: `admin.user.status.${status}`,
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return user;
  }

  async listAuditLogs(query: PaginationDto & { riskLevel?: AuditRiskLevel }) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const riskLevels = query.riskLevel ? [query.riskLevel] : undefined;
    const result = await this.auditLogService.listAll(skip, take, { riskLevels });
    return { ...result, page, pageSize };
  }

  async listSecurityAlerts(query: PaginationDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const result = await this.auditLogService.listAll(skip, take, {
      riskLevels: [AuditRiskLevel.high, AuditRiskLevel.critical],
    });
    return { ...result, page, pageSize };
  }

  async listInheritanceEvents(query: PaginationDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inheritanceEvent.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, phone: true, email: true, status: true } },
        },
      }),
      this.prisma.inheritanceEvent.count(),
    ]);

    return { items, total, page, pageSize };
  }

  runInheritanceScan() {
    return this.inheritanceSchedulerService.runScan('manual');
  }

  async listNotificationLogs(query: PaginationDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, phone: true, email: true } },
        },
      }),
      this.prisma.notificationLog.count(),
    ]);

    return { items, total, page, pageSize };
  }

  listIpBlacklist() {
    return this.ipBlacklistService.list();
  }

  addIpBlacklist(ip: string, reason?: string) {
    return this.ipBlacklistService.add(ip, reason);
  }

  removeIpBlacklist(ip: string) {
    return this.ipBlacklistService.remove(ip);
  }
}
