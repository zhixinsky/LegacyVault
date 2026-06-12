import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { AuditRiskLevel } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getPagination } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MfaService } from '../user/mfa.service';
import { ListFilesQueryDto, RegisterFileDto } from './dto/file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { StorageService } from './storage.service';

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly mfaService: MfaService,
  ) {}

  async list(userId: string, query: ListFilesQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const where = {
      userId,
      ...(query.albumId ? { albumId: query.albumId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vaultFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vaultFile.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(userId: string, id: string) {
    const file = await this.prisma.vaultFile.findFirst({
      where: { id, userId },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    return file;
  }

  /**
   * 上传已加密文件二进制，服务器只存密文。
   */
  async uploadEncrypted(
    userId: string,
    dto: RegisterFileDto,
    encryptedBuffer: Buffer,
    meta: { ip?: string; device?: string },
  ) {
    if (encryptedBuffer.length !== dto.fileSize) {
      throw new BadRequestException('文件大小与声明不一致');
    }

    if (dto.albumId) {
      const album = await this.prisma.album.findFirst({
        where: { id: dto.albumId, userId },
      });
      if (!album) {
        throw new NotFoundException('相册不存在');
      }
    }

    const fileId = randomUUID();
    const storagePath = await this.storage.save(`${userId}/${fileId}.enc`, encryptedBuffer);

    const file = await this.prisma.vaultFile.create({
      data: {
        id: fileId,
        userId,
        albumId: dto.albumId,
        fileType: dto.fileType,
        storagePath,
        encryptedFileKey: dto.encryptedFileKey,
        fileHash: dto.fileHash,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        encryptedMetadata: dto.encryptedMetadata,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'file.upload',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return file;
  }

  async download(
    userId: string,
    id: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);
    const file = await this.getById(userId, id);
    const buffer = await this.storage.read(file.storagePath);

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'file.download',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return {
      file,
      stream: new StreamableFile(buffer, {
        type: 'application/octet-stream',
        disposition: `attachment; filename="${file.id}.enc"`,
      }),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFileDto,
    meta: { ip?: string; device?: string },
  ) {
    await this.getById(userId, id);

    const file = await this.prisma.vaultFile.update({
      where: { id },
      data: {
        encryptedMetadata: dto.encryptedMetadata,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'file.update',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.medium,
    });

    return file;
  }

  async remove(userId: string, id: string, meta: { ip?: string; device?: string }) {
    const file = await this.getById(userId, id);

    await this.storage.remove(file.storagePath).catch(() => undefined);
    await this.prisma.vaultFile.delete({ where: { id } });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'file.delete',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return { id, deleted: true };
  }
}
