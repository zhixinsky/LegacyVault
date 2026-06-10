import { Injectable } from '@nestjs/common';
import { AuditActorType, AuditRiskLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_MYSQL_STRING_LIMIT = 191;

export interface AuditLogInput {
  userId?: string;
  actorType?: AuditActorType;
  actorId?: string;
  action: string;
  ip?: string;
  device?: string;
  riskLevel?: AuditRiskLevel;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    const data: Prisma.AuditLogCreateInput = {
      action: truncate(input.action, DEFAULT_MYSQL_STRING_LIMIT),
      actorType: input.actorType ?? AuditActorType.user,
      actorId: truncateOptional(input.actorId, DEFAULT_MYSQL_STRING_LIMIT),
      ip: truncateOptional(input.ip, DEFAULT_MYSQL_STRING_LIMIT),
      device: truncateOptional(input.device, DEFAULT_MYSQL_STRING_LIMIT),
      riskLevel: input.riskLevel ?? AuditRiskLevel.low,
    };

    if (input.userId) {
      data.user = { connect: { id: input.userId } };
    }

    try {
      return await this.prisma.auditLog.create({ data });
    } catch (error) {
      console.warn('[audit-log] 审计日志写入失败，已忽略', error);
      return null;
    }
  }

  async listForUser(userId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    return { items, total };
  }

  async listAll(
    skip: number,
    take: number,
    options?: { riskLevels?: AuditRiskLevel[] },
  ) {
    const where = options?.riskLevels?.length
      ? { riskLevel: { in: options.riskLevels } }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { id: true, phone: true, email: true, status: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function truncateOptional(value: string | undefined, maxLength: number) {
  return value ? truncate(value, maxLength) : undefined;
}
