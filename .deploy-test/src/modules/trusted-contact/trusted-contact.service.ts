import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditRiskLevel } from '@prisma/client';
import { getPagination } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MfaService } from '../user/mfa.service';
import {
  CreateContactChallengeDto,
  CreateTrustedContactDto,
  ListTrustedContactsQueryDto,
  UpdateTrustedContactDto,
} from './dto/trusted-contact.dto';

@Injectable()
export class TrustedContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly mfaService: MfaService,
  ) {}

  async list(userId: string, query: ListTrustedContactsQueryDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const where = { userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.trustedContact.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: { challenges: true },
      }),
      this.prisma.trustedContact.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(userId: string, id: string) {
    const contact = await this.prisma.trustedContact.findFirst({
      where: { id, userId },
      include: { challenges: true },
    });

    if (!contact) {
      throw new NotFoundException('安全联系人不存在');
    }

    return contact;
  }

  async create(
    userId: string,
    dto: CreateTrustedContactDto,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);

    const contact = await this.prisma.trustedContact.create({
      data: {
        userId,
        nameCiphertext: dto.nameCiphertext,
        phoneCiphertext: dto.phoneCiphertext,
        emailCiphertext: dto.emailCiphertext,
        relationCiphertext: dto.relationCiphertext,
        permissionScope: dto.permissionScope,
        priority: dto.priority ?? 0,
        encryptedVaultKeyForContact: dto.encryptedVaultKeyForContact,
        phoneLookupHash: dto.phoneLookupHash,
        emailLookupHash: dto.emailLookupHash,
        notifyPhone: dto.notifyPhone?.trim() || null,
        notifyEmail: dto.notifyEmail?.trim().toLowerCase() || null,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'trusted_contact.create',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return contact;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTrustedContactDto,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);
    await this.getById(userId, id);

    const contact = await this.prisma.trustedContact.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'trusted_contact.update',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return contact;
  }

  async remove(
    userId: string,
    id: string,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);
    await this.getById(userId, id);
    await this.prisma.trustedContact.delete({ where: { id } });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'trusted_contact.delete',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { id, deleted: true };
  }

  async addChallenge(
    userId: string,
    dto: CreateContactChallengeDto,
    meta: { ip?: string; device?: string; mfaCode?: string },
  ) {
    await this.mfaService.assertMfaIfEnabled(userId, meta.mfaCode);
    await this.getById(userId, dto.contactId);

    const challenge = await this.prisma.contactChallenge.create({
      data: {
        userId,
        contactId: dto.contactId,
        encryptedQuestion: dto.encryptedQuestion,
        encryptedAnswerHash: dto.encryptedAnswerHash,
        questionLabel: dto.questionLabel,
        required: dto.required ?? true,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'trusted_contact.challenge.create',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.high,
    });

    return challenge;
  }
}
