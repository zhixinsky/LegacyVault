import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  AuditRiskLevel,
  ContactPermissionScope,
  ContactTakeoverSessionStatus,
  InheritanceEventStatus,
  NotificationChannel,
  Prisma,
  VaultItemType,
} from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationDeliveryService } from '../notification/notification-delivery.service';
import { StorageService } from '../file/storage.service';
import { getPagination } from '../../common/dto/pagination.dto';
import {
  canAccessFiles,
  canAccessVault,
  getAllowedVaultTypes,
} from './contact-vault.util';
import {
  SendContactTakeoverOtpDto,
  VerifyContactTakeoverChallengesDto,
} from './dto/contact-takeover.dto';

@Injectable()
export class ContactTakeoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationDelivery: NotificationDeliveryService,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  hashLookupValue(value: string) {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('base64');
  }

  async createInvitesForEvent(userId: string, eventId: string, now = new Date()) {
    const event = await this.prisma.inheritanceEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!event) {
      return [];
    }

    const contacts = await this.prisma.trustedContact.findMany({
      where: {
        userId,
        status: 'active',
        permissionScope: {
          in: [
            ContactPermissionScope.request_takeover,
            ContactPermissionScope.view_all,
            ContactPermissionScope.inactive_only,
            ContactPermissionScope.export,
          ],
        },
      },
    });

    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invites: Array<{ contactId: string; token: string }> = [];

    for (const contact of contacts) {
      const token = `${eventId.slice(0, 8)}-${randomInt(100000, 999999)}-${randomInt(100000, 999999)}`;
      await this.prisma.contactTakeoverInvite.create({
        data: {
          userId,
          contactId: contact.id,
          eventId,
          tokenHash: this.hashToken(token),
          expiresAt,
        },
      });
      invites.push({ contactId: contact.id, token });
    }

    return invites;
  }

  async startSession(token: string) {
    const invite = await this.prisma.contactTakeoverInvite.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        event: true,
        contact: { select: { id: true, permissionScope: true, status: true } },
      },
    });

    if (!invite || invite.usedAt) {
      throw new NotFoundException('接管邀请无效或已使用');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('接管邀请已过期');
    }

    const openStages = ['contact_verification_open', 'user_allowed_takeover', 'contact_notification'];
    if (!openStages.includes(invite.event.currentStage)) {
      throw new ForbiddenException('当前交接阶段尚未开放联系人验证');
    }

    if (
      invite.event.status !== InheritanceEventStatus.contact_verification &&
      invite.event.status !== InheritanceEventStatus.completed
    ) {
      throw new ForbiddenException('交接事件状态不允许接管');
    }

    const session = await this.prisma.contactTakeoverSession.create({
      data: {
        userId: invite.userId,
        contactId: invite.contactId,
        eventId: invite.eventId,
        inviteId: invite.id,
      },
    });

    await this.prisma.contactTakeoverInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return {
      sessionId: session.id,
      contactId: invite.contactId,
      permissionScope: invite.contact.permissionScope,
      eventStage: invite.event.currentStage,
    };
  }

  async sendOtp(sessionId: string, dto: SendContactTakeoverOtpDto) {
    const session = await this.getActiveSession(sessionId);
    const contact = await this.prisma.trustedContact.findUnique({
      where: { id: session.contactId },
    });

    if (!contact) {
      throw new NotFoundException('安全联系人不存在');
    }

    const lookupHash =
      dto.channel === 'sms'
        ? this.hashLookupValue(dto.target)
        : this.hashLookupValue(dto.target);

    const expectedHash = dto.channel === 'sms' ? contact.phoneLookupHash : contact.emailLookupHash;
    if (!expectedHash || expectedHash !== lookupHash) {
      throw new ForbiddenException('联系方式与预设记录不匹配');
    }

    const code = String(randomInt(100000, 999999));
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.contactTakeoverSession.update({
      where: { id: sessionId },
      data: {
        otpHash: createHash('sha256').update(code).digest('hex'),
        otpExpiresAt,
        otpChannel: dto.channel,
        otpTarget: dto.target,
      },
    });

    const message = `VaultPass 安全联系人验证码：${code}，10 分钟内有效。`;
    await this.notificationDelivery.send({
      userId: session.userId,
      channel: dto.channel === 'sms' ? NotificationChannel.sms : NotificationChannel.email,
      notificationType: 'contact_takeover.otp',
      target: dto.target,
      subject: 'VaultPass 联系人验证码',
      message,
    });

    return { sent: true, expiresAt: otpExpiresAt };
  }

  async verifyOtp(sessionId: string, code: string) {
    const session = await this.getActiveSession(sessionId);

    if (!session.otpHash || !session.otpExpiresAt) {
      throw new BadRequestException('请先发送验证码');
    }

    if (session.otpExpiresAt < new Date()) {
      throw new BadRequestException('验证码已过期');
    }

    const hash = createHash('sha256').update(code).digest('hex');
    if (hash !== session.otpHash) {
      throw new ForbiddenException('验证码错误');
    }

    await this.prisma.contactTakeoverSession.update({
      where: { id: sessionId },
      data: { status: ContactTakeoverSessionStatus.otp_verified },
    });

    return { verified: true };
  }

  async listChallenges(sessionId: string) {
    const session = await this.getActiveSession(sessionId);
    await this.requireOtpVerified(sessionId);

    const challenges = await this.prisma.contactChallenge.findMany({
      where: { contactId: session.contactId, required: true },
      select: {
        id: true,
        questionLabel: true,
        encryptedQuestion: true,
        required: true,
      },
    });

    return {
      items: challenges.map((item) => ({
        id: item.id,
        questionLabel: item.questionLabel ?? '预设安全问题',
        encryptedQuestion: item.encryptedQuestion,
        required: item.required,
      })),
    };
  }

  async verifyChallenges(sessionId: string, dto: VerifyContactTakeoverChallengesDto) {
    const session = await this.getActiveSession(sessionId);
    await this.requireOtpVerified(sessionId);

    const challenges = await this.prisma.contactChallenge.findMany({
      where: { contactId: session.contactId, required: true },
    });

    if (challenges.length === 0) {
      throw new BadRequestException('该联系人尚未配置验证问题');
    }

    const answerMap = new Map(dto.answers.map((item) => [item.challengeId, item.answer]));
    const { verifyChallengeAnswer } = await import('@vaultpass/crypto');

    for (const challenge of challenges) {
      const answer = answerMap.get(challenge.id);
      if (!answer) {
        throw new BadRequestException('请回答所有必填验证问题');
      }

      let stored: { salt: string; hash: string };
      try {
        stored = JSON.parse(challenge.encryptedAnswerHash) as { salt: string; hash: string };
      } catch {
        throw new BadRequestException('验证问题配置无效');
      }

      if (!verifyChallengeAnswer(answer, stored)) {
        throw new ForbiddenException('验证问题回答不正确');
      }
    }

    const now = new Date();
    await this.prisma.contactTakeoverSession.update({
      where: { id: sessionId },
      data: {
        status: ContactTakeoverSessionStatus.challenges_verified,
        challengesPassedAt: now,
      },
    });

    await this.auditLogService.log({
      userId: session.userId,
      actorType: AuditActorType.contact,
      actorId: session.contactId,
      action: 'contact_takeover.challenges.verified',
      riskLevel: AuditRiskLevel.critical,
    });

    return { verified: true };
  }

  async completeSession(sessionId: string) {
    const session = await this.getActiveSession(sessionId);

    if (session.status !== ContactTakeoverSessionStatus.challenges_verified) {
      throw new BadRequestException('请先完成验证码与安全问题验证');
    }

    const contact = await this.prisma.trustedContact.findUnique({
      where: { id: session.contactId },
      select: {
        encryptedVaultKeyForContact: true,
        permissionScope: true,
      },
    });

    if (!contact?.encryptedVaultKeyForContact) {
      throw new BadRequestException('账户持有人尚未配置联系人密钥包');
    }

    const requireMultiContact = await this.isMultiContactRequired(session.userId);
    if (requireMultiContact) {
      const eligibleContactIds = await this.getEligibleTakeoverContactIds(session.userId);
      const verifiedSessions = await this.prisma.contactTakeoverSession.findMany({
        where: {
          eventId: session.eventId,
          contactId: { in: eligibleContactIds },
          status: {
            in: [
              ContactTakeoverSessionStatus.challenges_verified,
              ContactTakeoverSessionStatus.completed,
            ],
          },
        },
        select: { contactId: true },
      });
      const verifiedContactIds = new Set(verifiedSessions.map((item) => item.contactId));

      if (verifiedContactIds.size < eligibleContactIds.length) {
        return {
          pendingMultiContact: true,
          completedCount: verifiedContactIds.size,
          requiredCount: eligibleContactIds.length,
        };
      }
    }

    const now = new Date();
    if (requireMultiContact) {
      await this.prisma.contactTakeoverSession.updateMany({
        where: {
          eventId: session.eventId,
          status: ContactTakeoverSessionStatus.challenges_verified,
        },
        data: {
          status: ContactTakeoverSessionStatus.completed,
          completedAt: now,
        },
      });
    } else {
      await this.prisma.contactTakeoverSession.update({
        where: { id: sessionId },
        data: {
          status: ContactTakeoverSessionStatus.completed,
          completedAt: now,
        },
      });
    }

    await this.auditLogService.log({
      userId: session.userId,
      actorType: AuditActorType.contact,
      actorId: session.contactId,
      action: 'contact_takeover.completed',
      riskLevel: AuditRiskLevel.critical,
    });

    return {
      permissionScope: contact.permissionScope,
      encryptedVaultKeyForContact: contact.encryptedVaultKeyForContact,
    };
  }

  private async isMultiContactRequired(userId: string) {
    const rule = await this.prisma.inheritanceRule.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { requireMultiContact: true },
    });
    return rule?.requireMultiContact ?? false;
  }

  private async getEligibleTakeoverContactIds(userId: string) {
    const contacts = await this.prisma.trustedContact.findMany({
      where: {
        userId,
        status: 'active',
        permissionScope: {
          in: [
            ContactPermissionScope.request_takeover,
            ContactPermissionScope.view_all,
            ContactPermissionScope.inactive_only,
            ContactPermissionScope.export,
          ],
        },
      },
      select: { id: true },
    });
    return contacts.map((item) => item.id);
  }

  async listVaultItems(sessionId: string, type?: string, page = 1, pageSize = 50) {
    const { session, scope } = await this.getCompletedSession(sessionId);
    if (!canAccessVault(scope)) {
      throw new ForbiddenException('当前权限不允许查看保险箱内容');
    }

    const allowedTypes = getAllowedVaultTypes(scope);
    const { skip, take } = getPagination(page, pageSize);
    const where: Prisma.VaultItemWhereInput = {
      userId: session.userId,
      deletedAt: null,
    };

    if (type) {
      if (allowedTypes && !allowedTypes.includes(type as VaultItemType)) {
        throw new ForbiddenException('无权查看该类型数据');
      }
      where.type = type as VaultItemType;
    } else if (allowedTypes) {
      where.type = { in: allowedTypes };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vaultItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vaultItem.count({ where }),
    ]);

    await this.auditLogService.log({
      userId: session.userId,
      actorType: AuditActorType.contact,
      actorId: session.contactId,
      action: 'contact_takeover.vault.list',
      riskLevel: AuditRiskLevel.critical,
    });

    return { items, total, page, pageSize, permissionScope: scope };
  }

  async listFiles(sessionId: string, page = 1, pageSize = 50) {
    const { session, scope } = await this.getCompletedSession(sessionId);
    if (!canAccessFiles(scope)) {
      throw new ForbiddenException('当前权限不允许查看文件');
    }

    const { skip, take } = getPagination(page, pageSize);
    const where = { userId: session.userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vaultFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          fileType: true,
          fileSize: true,
          mimeType: true,
          encryptedFileKey: true,
          createdAt: true,
        },
      }),
      this.prisma.vaultFile.count({ where }),
    ]);

    return { items, total, page, pageSize, permissionScope: scope };
  }

  async downloadFile(sessionId: string, fileId: string) {
    const { session, scope } = await this.getCompletedSession(sessionId);
    if (!canAccessFiles(scope)) {
      throw new ForbiddenException('当前权限不允许下载文件');
    }

    const file = await this.prisma.vaultFile.findFirst({
      where: { id: fileId, userId: session.userId },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    const buffer = await this.storage.read(file.storagePath);

    await this.auditLogService.log({
      userId: session.userId,
      actorType: AuditActorType.contact,
      actorId: session.contactId,
      action: 'contact_takeover.file.download',
      riskLevel: AuditRiskLevel.critical,
    });

    return {
      file,
      stream: new StreamableFile(buffer, {
        type: 'application/octet-stream',
        disposition: `attachment; filename="${file.id}.enc"`,
      }),
    };
  }

  async getSessionStatus(sessionId: string) {
    const session = await this.prisma.contactTakeoverSession.findUnique({
      where: { id: sessionId },
      include: {
        contact: { select: { permissionScope: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    return {
      sessionId: session.id,
      status: session.status,
      permissionScope: session.contact.permissionScope,
      otpVerified: session.status !== ContactTakeoverSessionStatus.started,
      challengesVerified:
        session.status === ContactTakeoverSessionStatus.challenges_verified ||
        session.status === ContactTakeoverSessionStatus.completed,
      completed: session.status === ContactTakeoverSessionStatus.completed,
    };
  }

  private async getActiveSession(sessionId: string) {
    const session = await this.prisma.contactTakeoverSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    if (
      session.status === ContactTakeoverSessionStatus.completed ||
      session.status === ContactTakeoverSessionStatus.expired
    ) {
      throw new BadRequestException('会话已结束');
    }

    return session;
  }

  private async requireOtpVerified(sessionId: string) {
    const session = await this.getActiveSession(sessionId);
    if (session.status === ContactTakeoverSessionStatus.started) {
      throw new BadRequestException('请先完成验证码验证');
    }
  }

  private async getCompletedSession(sessionId: string) {
    const session = await this.prisma.contactTakeoverSession.findUnique({
      where: { id: sessionId },
      include: {
        contact: { select: { permissionScope: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    if (session.status !== ContactTakeoverSessionStatus.completed) {
      throw new BadRequestException('请先完成接管验证');
    }

    return { session, scope: session.contact.permissionScope };
  }
}
