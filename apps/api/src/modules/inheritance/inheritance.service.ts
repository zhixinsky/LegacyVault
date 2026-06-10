import { Injectable } from '@nestjs/common';
import { AuditRiskLevel, InheritanceEventStatus, Prisma } from '@prisma/client';
import { getPagination } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MfaService } from '../user/mfa.service';
import { ListInheritanceEventsQueryDto, UpsertInheritanceRuleDto } from './dto/inheritance.dto';

@Injectable()
export class InheritanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly mfaService: MfaService,
  ) {}

  async getRule(userId: string) {
    return this.prisma.inheritanceRule.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertRule(
    userId: string,
    dto: UpsertInheritanceRuleDto,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);

    const existing = await this.getRule(userId);
    const ruleData = {
      inactiveYears: dto.inactiveYears,
      reminderFrequency: dto.reminderFrequency,
      gracePeriodMonths: dto.gracePeriodMonths,
      requireMultiContact: dto.requireMultiContact ?? false,
      unlockPolicy: dto.unlockPolicy as Prisma.InputJsonValue | undefined,
      status: dto.status ?? 'active',
    };

    const rule = existing
      ? await this.prisma.inheritanceRule.update({
          where: { id: existing.id },
          data: ruleData,
        })
      : await this.prisma.inheritanceRule.create({
          data: {
            userId,
            ...ruleData,
          },
        });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'inheritance.rule.upsert',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return rule;
  }

  async disableRule(
    userId: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);

    const existing = await this.getRule(userId);
    if (!existing) {
      return { disabled: true };
    }

    const rule = await this.prisma.inheritanceRule.update({
      where: { id: existing.id },
      data: { status: 'inactive' },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'inheritance.rule.disable',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return rule;
  }

  async listEvents(userId: string, query: ListInheritanceEventsQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const where = { userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inheritanceEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.inheritanceEvent.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getActiveEvent(userId: string) {
    return this.prisma.inheritanceEvent.findFirst({
      where: {
        userId,
        status: {
          notIn: [InheritanceEventStatus.cancelled, InheritanceEventStatus.completed],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
