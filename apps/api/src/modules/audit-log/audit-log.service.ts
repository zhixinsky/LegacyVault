import { Injectable } from '@nestjs/common';
import { AuditActorType, AuditRiskLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
      action: input.action,
      actorType: input.actorType ?? AuditActorType.user,
      actorId: input.actorId,
      ip: input.ip,
      device: input.device,
      riskLevel: input.riskLevel ?? AuditRiskLevel.low,
    };

    if (input.userId) {
      data.user = { connect: { id: input.userId } };
    }

    return this.prisma.auditLog.create({ data });
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
