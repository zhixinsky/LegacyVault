import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { EmaySmsService } from './emay/emay-sms.service';
import { sendAliyunSms } from './sms-delivery.util';

export interface SendNotificationInput {
  userId: string;
  channel: NotificationChannel;
  notificationType: string;
  target?: string;
  subject: string;
  message: string;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emaySmsService: EmaySmsService,
  ) {}

  async send(input: SendNotificationInput) {
    try {
      if (input.channel === NotificationChannel.email) {
        await this.sendEmail(input.target, input.subject, input.message);
      } else if (input.channel === NotificationChannel.sms) {
        await this.sendSms(input.target, input.message, input.notificationType);
      } else {
        this.logger.log(`[system] ${input.subject}: ${input.message.slice(0, 120)}`);
      }

      return this.createLog(input, NotificationStatus.sent);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'notification failed';
      this.logger.warn(`Notification failed: ${message}`);
      return this.createLog(input, NotificationStatus.failed, message);
    }
  }

  private async createLog(
    input: SendNotificationInput,
    status: NotificationStatus,
    errorMessage?: string,
  ) {
    return this.prisma.notificationLog.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        notificationType: input.notificationType,
        target: input.target,
        status,
        errorMessage,
      },
    });
  }

  private getMailTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpHost = this.config.get<string>('SMTP_HOST');
    if (!smtpHost) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: Number(this.config.get<string>('SMTP_PORT') ?? 587) === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    return this.transporter;
  }

  private async sendEmail(to: string | undefined, subject: string, message: string) {
    if (!to) {
      throw new Error('缺少邮件地址');
    }

    const transporter = this.getMailTransporter();
    if (!transporter) {
      this.logger.log(`[email:dev] to=${this.mask(to)} subject=${subject}`);
      return;
    }

    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') || this.config.get<string>('SMTP_USER'),
      to,
      subject,
      text: message,
    });
  }

  private async sendSms(to: string | undefined, message: string, notificationType: string) {
    if (!to) {
      throw new Error('缺少手机号');
    }

    const provider = this.config.get<string>('SMS_PROVIDER');
    if (!provider) {
      this.logger.log(`[sms:dev] to=${this.mask(to)} message=${message.slice(0, 80)}...`);
      return;
    }

    if (provider === 'emay') {
      await this.emaySmsService.send(notificationType, to, message);
      return;
    }

    if (provider === 'aliyun') {
      const accessKey = this.config.get<string>('SMS_ACCESS_KEY');
      const secretKey = this.config.get<string>('SMS_SECRET_KEY');
      const signName = this.config.get<string>('SMS_SIGN_NAME');
      const templateCode = this.config.get<string>('SMS_TEMPLATE_CODE');

      if (!accessKey || !secretKey || !signName || !templateCode) {
        throw new Error('阿里云短信配置不完整');
      }

      const codeMatch = message.match(/\d{6}/);
      await sendAliyunSms({
        phone: to,
        message,
        accessKey,
        secretKey,
        signName,
        templateCode,
        templateParam: { code: codeMatch?.[0] ?? '000000' },
      });
      return;
    }

    this.logger.log(`[sms] provider=${provider} to=${this.mask(to)}`);
  }

  private mask(value: string) {
    if (value.includes('@')) {
      const [name, domain] = value.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    }
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  }

  async listForUser(userId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notificationLog.count({ where: { userId } }),
    ]);

    return { items, total };
  }
}
