import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditRiskLevel } from '@prisma/client';
import { getPagination } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateAlbumDto, ListAlbumsQueryDto, UpdateAlbumDto } from './dto/album.dto';

@Injectable()
export class AlbumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(userId: string, query: ListAlbumsQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const where = { userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.album.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { files: true } } },
      }),
      this.prisma.album.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(userId: string, id: string) {
    const album = await this.prisma.album.findFirst({
      where: { id, userId },
      include: { files: true },
    });

    if (!album) {
      throw new NotFoundException('相册不存在');
    }

    return album;
  }

  async create(
    userId: string,
    dto: CreateAlbumDto,
    meta: { ip?: string; device?: string },
  ) {
    const album = await this.prisma.album.create({
      data: {
        userId,
        encryptedName: dto.encryptedName,
        encryptedDescription: dto.encryptedDescription,
        encryptedCoverFileId: dto.encryptedCoverFileId,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'album.create',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return album;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAlbumDto,
    meta: { ip?: string; device?: string },
  ) {
    await this.getById(userId, id);

    const album = await this.prisma.album.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'album.update',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return album;
  }

  async remove(userId: string, id: string, meta: { ip?: string; device?: string }) {
    await this.getById(userId, id);

    await this.prisma.album.delete({ where: { id } });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'album.delete',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return { id, deleted: true };
  }
}
