import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditRiskLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getPagination } from '../../common/dto/pagination.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MfaService } from '../user/mfa.service';
import {
  CreateVaultItemDto,
  CreateVaultDto,
  ListVaultItemsQueryDto,
  UpdateVaultItemDto,
} from './dto/vault.dto';

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly mfaService: MfaService,
  ) {}

  async createVault(
    userId: string,
    dto: CreateVaultDto,
    meta: { ip?: string; device?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hasVault: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (user.hasVault) {
      throw new ConflictException('保险箱已创建');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        hasVault: true,
        encryptedVaultKey: dto.encryptedVaultKey,
        encryptedVaultKeyByRecovery: dto.encryptedVaultKeyByRecovery,
        passwordSalt: dto.passwordSalt,
        recoverySalt: dto.recoverySalt,
        kdfParams: dto.kdfParams as unknown as Prisma.InputJsonValue,
        vaultCreatedAt: new Date(),
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.create',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return { created: true, hasVault: true };
  }

  async list(userId: string, query: ListVaultItemsQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const where = {
      userId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vaultItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vaultItem.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(userId: string, id: string) {
    const item = await this.prisma.vaultItem.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException('保险箱条目不存在');
    }

    return item;
  }

  async create(
    userId: string,
    dto: CreateVaultItemDto,
    meta: { ip?: string; device?: string },
  ) {
    const item = await this.prisma.vaultItem.create({
      data: {
        userId,
        type: dto.type,
        titleCiphertext: dto.titleCiphertext,
        encryptedPayload: dto.encryptedPayload,
        encryptedMetadata: dto.encryptedMetadata,
        favorite: dto.favorite ?? false,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.item.create',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return item;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateVaultItemDto,
    meta: { ip?: string; device?: string },
  ) {
    await this.getById(userId, id);

    const item = await this.prisma.vaultItem.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.item.update',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return item;
  }

  async remove(userId: string, id: string, meta: { ip?: string; device?: string }) {
    await this.getById(userId, id);

    const item = await this.prisma.vaultItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.item.delete',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return item;
  }

  async listTrash(userId: string, query: ListVaultItemsQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const where = {
      userId,
      deletedAt: { not: null },
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vaultItem.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vaultItem.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private async getTrashItem(userId: string, id: string) {
    const item = await this.prisma.vaultItem.findFirst({
      where: { id, userId, deletedAt: { not: null } },
    });

    if (!item) {
      throw new NotFoundException('回收站条目不存在');
    }

    return item;
  }

  async restore(userId: string, id: string, meta: { ip?: string; device?: string }) {
    await this.getTrashItem(userId, id);

    const item = await this.prisma.vaultItem.update({
      where: { id },
      data: { deletedAt: null },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.item.restore',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return item;
  }

  async permanentDelete(
    userId: string,
    id: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);
    await this.getTrashItem(userId, id);

    await this.prisma.vaultItem.delete({ where: { id } });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.item.purge',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { id, deleted: true };
  }

  async revealPassword(
    userId: string,
    id: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);
    const item = await this.getById(userId, id);

    if (item.type !== 'password') {
      throw new BadRequestException('仅支持查看账号密码条目');
    }

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'vault.password.reveal',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return { verified: true };
  }
}
