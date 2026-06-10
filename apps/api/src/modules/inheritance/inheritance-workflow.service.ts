import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  AuditRiskLevel,
  InheritanceEventStatus,
  NotificationChannel,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ContactTakeoverService } from '../contact-takeover/contact-takeover.service';
import { NotificationDeliveryService } from '../notification/notification-delivery.service';
import { evaluateInheritanceWorkflow } from './inheritance-workflow.util';

export interface ProcessUserResult {
  userId: string;
  action: string;
  stage?: string;
  contacts?: number;
}

@Injectable()
export class InheritanceWorkflowService {
  private readonly logger = new Logger(InheritanceWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationDelivery: NotificationDeliveryService,
    private readonly auditLogService: AuditLogService,
    private readonly contactTakeoverService: ContactTakeoverService,
    private readonly config: ConfigService,
  ) {}

  async scanAllUsers(now = new Date()) {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        inheritanceRules: { some: { status: 'active' } },
      },
      include: {
        inheritanceRules: {
          where: { status: 'active' },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        inheritanceEvents: {
          where: {
            status: {
              notIn: [InheritanceEventStatus.cancelled, InheritanceEventStatus.completed],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const results: ProcessUserResult[] = [];
    for (const user of users) {
      const rule = user.inheritanceRules[0];
      if (!rule) continue;

      results.push(
        await this.processUser({
          userId: user.id,
          email: user.email ?? undefined,
          phone: user.phone ?? undefined,
          lastLoginAt: user.lastLoginAt ?? user.createdAt,
          inheritancePausedUntil: user.inheritancePausedUntil,
          rule: {
            inactiveYears: rule.inactiveYears,
            gracePeriodMonths: rule.gracePeriodMonths,
            reminderFrequency: rule.reminderFrequency,
          },
          event: user.inheritanceEvents[0] ?? null,
          now,
        }),
      );
    }

    return {
      scanned: users.length,
      processed: results.filter((item) => item.action !== 'noop').length,
      results,
    };
  }

  async processUser(params: {
    userId: string;
    email?: string;
    phone?: string;
    lastLoginAt: Date;
    inheritancePausedUntil?: Date | null;
    rule: { inactiveYears: number; gracePeriodMonths: number; reminderFrequency?: string };
    event: {
      id: string;
      status: InheritanceEventStatus;
      lastReminderAt: Date | null;
      graceEndsAt: Date | null;
      cooldownEndsAt: Date | null;
      contactsNotifiedAt: Date | null;
    } | null;
    now: Date;
  }): Promise<ProcessUserResult> {
    const action = evaluateInheritanceWorkflow({
      now: params.now,
      lastLoginAt: params.lastLoginAt,
      inheritancePausedUntil: params.inheritancePausedUntil,
      rule: params.rule,
      event: params.event,
    });

    switch (action.type) {
      case 'noop':
        return { userId: params.userId, action: 'noop' };

      case 'start_reminding': {
        await this.prisma.inheritanceEvent.create({
          data: {
            userId: params.userId,
            eventType: 'inactivity_monitor',
            triggerAt: params.now,
            status: InheritanceEventStatus.reminding,
            currentStage: 'reminding',
            lastReminderAt: params.now,
          },
        });
        await this.notifyUser(params, 'inheritance.reminder.start', '您的 VaultPass 账户长期未活动，请登录确认。');
        return { userId: params.userId, action: 'start_reminding' };
      }

      case 'send_user_reminder': {
        if (!params.event) break;
        await this.prisma.inheritanceEvent.update({
          where: { id: params.event.id },
          data: { lastReminderAt: params.now, currentStage: action.stage },
        });
        await this.notifyUser(
          params,
          `inheritance.reminder.${action.stage}`,
          '您的数字遗产交接流程正在进行，如仍在使用请尽快登录确认。',
        );
        return { userId: params.userId, action: 'send_user_reminder', stage: action.stage };
      }

      case 'enter_grace_period': {
        if (!params.event) break;
        await this.prisma.inheritanceEvent.update({
          where: { id: params.event.id },
          data: {
            status: InheritanceEventStatus.grace_period,
            currentStage: 'grace_period',
            graceEndsAt: action.graceEndsAt,
            lastReminderAt: params.now,
          },
        });
        await this.notifyUser(
          params,
          'inheritance.grace_period',
          '您已进入数字遗产验证期，请在验证期内登录确认账户仍在使用。',
        );
        return { userId: params.userId, action: 'enter_grace_period' };
      }

      case 'notify_contacts': {
        if (!params.event) break;
        const contacts = await this.prisma.trustedContact.findMany({
          where: { userId: params.userId, status: 'active' },
          select: {
            id: true,
            notifyPhone: true,
            notifyEmail: true,
          },
        });

        const invites = await this.contactTakeoverService.createInvitesForEvent(
          params.userId,
          params.event.id,
          params.now,
        );
        const inviteMap = new Map(invites.map((item) => [item.contactId, item.token]));

        for (const contact of contacts) {
          const token = inviteMap.get(contact.id);
          if (token) {
            await this.notifyContact(params.userId, contact, token);
          } else {
            await this.notificationDelivery.send({
              userId: params.userId,
              channel: NotificationChannel.system,
              notificationType: 'inheritance.contact.notice',
              subject: '安全联系人通知',
              message: `联系人 ${contact.id} 无接管权限，已跳过令牌发放`,
            });
          }
        }

        await this.prisma.inheritanceEvent.update({
          where: { id: params.event.id },
          data: {
            contactsNotifiedAt: params.now,
            status: InheritanceEventStatus.contact_verification,
            currentStage: 'contact_notification',
          },
        });

        return { userId: params.userId, action: 'notify_contacts', contacts: contacts.length };
      }

      case 'enter_cooldown': {
        if (!params.event) break;
        await this.prisma.inheritanceEvent.update({
          where: { id: params.event.id },
          data: {
            cooldownEndsAt: action.cooldownEndsAt,
            currentStage: 'cooldown',
            lastReminderAt: params.now,
          },
        });
        await this.notifyUser(
          params,
          'inheritance.cooldown',
          '数字遗产流程进入冷静期，原账户持有人仍可在冷静期内取消交接。',
        );
        return { userId: params.userId, action: 'enter_cooldown' };
      }

      case 'open_contact_verification': {
        if (!params.event) break;
        await this.prisma.inheritanceEvent.update({
          where: { id: params.event.id },
          data: {
            status: InheritanceEventStatus.completed,
            currentStage: 'contact_verification_open',
          },
        });

        await this.auditLogService.log({
          userId: params.userId,
          actorType: AuditActorType.system,
          action: 'inheritance.contact_verification.open',
          riskLevel: AuditRiskLevel.critical,
        });

        return { userId: params.userId, action: 'open_contact_verification' };
      }

      default:
        return { userId: params.userId, action: 'noop' };
    }

    return { userId: params.userId, action: 'noop' };
  }

  async onUserActivity(userId: string, now = new Date()) {
    const activeEvent = await this.prisma.inheritanceEvent.findFirst({
      where: {
        userId,
        status: {
          in: [
            InheritanceEventStatus.reminding,
            InheritanceEventStatus.grace_period,
            InheritanceEventStatus.contact_verification,
            InheritanceEventStatus.cooldown,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeEvent) {
      return null;
    }

    return this.cancelEvent(userId, activeEvent.id, 'user.activity', now);
  }

  async respondToEvent(
    userId: string,
    eventId: string,
    action: 'cancel' | 'pause' | 'allow_takeover',
    meta: { ip?: string; device?: string },
  ) {
    const event = await this.prisma.inheritanceEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!event) {
      throw new NotFoundException('交接事件不存在');
    }

    if (action === 'cancel') {
      return this.cancelEvent(userId, eventId, 'user.response.cancel', undefined, meta);
    }

    if (action === 'pause') {
      const pausedUntil = new Date();
      pausedUntil.setFullYear(pausedUntil.getFullYear() + 1);

      await this.prisma.user.update({
        where: { id: userId },
        data: { inheritancePausedUntil: pausedUntil },
      });

      await this.cancelEvent(userId, eventId, 'user.response.pause', undefined, meta);
      return { status: 'paused', pausedUntil };
    }

    await this.prisma.inheritanceEvent.update({
      where: { id: eventId },
      data: {
        status: InheritanceEventStatus.completed,
        currentStage: 'user_allowed_takeover',
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: userId,
      action: 'inheritance.user.allow_takeover',
      ip: meta.ip,
      device: meta.device,
      riskLevel: AuditRiskLevel.critical,
    });

    return { status: 'allow_takeover' };
  }

  private async cancelEvent(
    userId: string,
    eventId: string,
    reason: string,
    now = new Date(),
    meta?: { ip?: string; device?: string },
  ) {
    const event = await this.prisma.inheritanceEvent.update({
      where: { id: eventId },
      data: {
        status: InheritanceEventStatus.cancelled,
        currentStage: reason,
        updatedAt: now,
      },
    });

    await this.auditLogService.log({
      userId,
      actorId: meta ? userId : undefined,
      actorType: meta ? AuditActorType.user : AuditActorType.system,
      action: `inheritance.event.cancelled.${reason}`,
      ip: meta?.ip,
      device: meta?.device,
      riskLevel: AuditRiskLevel.high,
    });

    return event;
  }

  private async notifyContact(
    userId: string,
    contact: { id: string; notifyPhone?: string | null; notifyEmail?: string | null },
    token: string,
  ) {
    const webAppUrl = this.config.get<string>('WEB_APP_URL')?.trim().replace(/\/$/, '');
    const takeoverUrl = webAppUrl
      ? `${webAppUrl}/contact-takeover?token=${encodeURIComponent(token)}`
      : '';
    const smsMessage = `VaultPass通知：账户持有人长期未活动，数字遗产流程已启动。您的接管令牌为${token}，请按指引完成身份验证。`;
    const emailLines = [
      '您好，',
      '',
      '您被登记为 VaultPass 账户的安全联系人。账户持有人长期未活动，数字遗产交接流程已启动。',
      '',
      `接管令牌：${token}`,
    ];
    if (takeoverUrl) {
      emailLines.push(`在线验证：${takeoverUrl}`, '');
    } else {
      emailLines.push('请在 VaultPass 小程序「安全联系人接管」页面输入上述令牌完成验证。', '');
    }
    emailLines.push('如不了解此流程，请忽略本邮件。');
    const emailMessage = emailLines.join('\n');

    let delivered = false;

    if (contact.notifyPhone) {
      await this.notificationDelivery.send({
        userId,
        channel: NotificationChannel.sms,
        notificationType: 'inheritance.contact.notice',
        target: contact.notifyPhone,
        subject: 'VaultPass 安全联系人通知',
        message: smsMessage,
      });
      delivered = true;
    }

    if (contact.notifyEmail) {
      await this.notificationDelivery.send({
        userId,
        channel: NotificationChannel.email,
        notificationType: 'inheritance.contact.notice',
        target: contact.notifyEmail,
        subject: 'VaultPass 数字遗产联系人通知',
        message: emailMessage,
      });
      delivered = true;
    }

    if (!delivered) {
      await this.notificationDelivery.send({
        userId,
        channel: NotificationChannel.system,
        notificationType: 'inheritance.contact.notice',
        subject: '安全联系人通知（未配置送达地址）',
        message: `联系人 ${contact.id} 未配置 notifyPhone/notifyEmail，接管令牌：${token}${takeoverUrl ? `，链接：${takeoverUrl}` : ''}`,
      });
    }
  }

  private async notifyUser(
    params: { userId: string; email?: string; phone?: string },
    notificationType: string,
    message: string,
  ) {
    if (params.email) {
      await this.notificationDelivery.send({
        userId: params.userId,
        channel: NotificationChannel.email,
        notificationType,
        target: params.email,
        subject: 'VaultPass 数字遗产提醒',
        message,
      });
    }

    if (params.phone) {
      await this.notificationDelivery.send({
        userId: params.userId,
        channel: NotificationChannel.sms,
        notificationType,
        target: params.phone,
        subject: 'VaultPass 短信提醒',
        message,
      });
    }

    await this.notificationDelivery.send({
      userId: params.userId,
      channel: NotificationChannel.system,
      notificationType,
      subject: 'VaultPass 系统通知',
      message,
    });
  }
}
