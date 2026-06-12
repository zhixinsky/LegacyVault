import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditRiskLevel, NotificationChannel } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationDeliveryService } from '../notification/notification-delivery.service';



export interface DeviceMeta {

  ip?: string;

  device?: string;

  deviceId?: string;

}



@Injectable()

export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}



  async isKnownDevice(userId: string, deviceId?: string) {
    if (!deviceId) {
      return true;
    }

    const device = await this.prisma.loginDevice.findUnique({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
    });

    return Boolean(device && !device.revokedAt);
  }

  async trackLogin(userId: string, meta: DeviceMeta) {

    if (!meta.deviceId) {

      return null;

    }



    const existing = await this.prisma.loginDevice.findUnique({

      where: {

        userId_deviceId: {

          userId,

          deviceId: meta.deviceId,

        },

      },

    });



    const now = new Date();

    const device = await this.prisma.loginDevice.upsert({

      where: {

        userId_deviceId: {

          userId,

          deviceId: meta.deviceId,

        },

      },

      create: {

        userId,

        deviceId: meta.deviceId,

        deviceName: this.parseDeviceName(meta.device),

        ip: meta.ip,

        userAgent: meta.device,

        lastActiveAt: now,

      },

      update: {

        ip: meta.ip,

        userAgent: meta.device,

        lastActiveAt: now,

        revokedAt: null,

      },

    });



    if (!existing) {
      await this.auditLogService.log({
        userId,
        actorId: userId,
        action: 'auth.new_device',
        ip: meta.ip,
        device: meta.device,
        riskLevel: AuditRiskLevel.high,
      });
      void this.notifyLoginSecurityAlert(userId, 'new_device', meta);
    } else if (meta.ip && existing.ip && existing.ip !== meta.ip) {
      await this.auditLogService.log({
        userId,
        actorId: userId,
        action: 'auth.login.new_ip',
        ip: meta.ip,
        device: meta.device,
        riskLevel: AuditRiskLevel.high,
      });
      void this.notifyLoginSecurityAlert(userId, 'new_ip', meta);
    }

    return device;

  }



  async touchDevice(userId: string, meta: DeviceMeta) {

    if (!meta.deviceId) {

      return;

    }



    await this.prisma.loginDevice.updateMany({

      where: {

        userId,

        deviceId: meta.deviceId,

        revokedAt: null,

      },

      data: { lastActiveAt: new Date(), ip: meta.ip },

    });

  }



  async listDevices(userId: string) {

    const items = await this.prisma.loginDevice.findMany({

      where: { userId, revokedAt: null },

      orderBy: { lastActiveAt: 'desc' },

    });



    return {

      items: items.map((item) => ({

        id: item.id,

        deviceId: item.deviceId,

        deviceName: item.deviceName,

        ip: item.ip,

        lastActiveAt: item.lastActiveAt.toISOString(),

        createdAt: item.createdAt.toISOString(),

      })),

    };

  }



  async revokeDevice(userId: string, id: string, meta: DeviceMeta) {

    const device = await this.prisma.loginDevice.findFirst({

      where: { id, userId, revokedAt: null },

    });



    if (!device) {

      throw new NotFoundException('设备不存在');

    }



    await this.prisma.loginDevice.update({

      where: { id },

      data: { revokedAt: new Date() },

    });



    await this.auditLogService.log({

      userId,

      actorId: userId,

      action: 'auth.device.revoke',

      ip: meta.ip,

      device: meta.device,

      riskLevel: AuditRiskLevel.high,

    });



    return { id, revoked: true };

  }



  private async notifyLoginSecurityAlert(
    userId: string,
    alertType: 'new_device' | 'new_ip',
    meta: DeviceMeta,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, email: true },
      });
      if (!user) return;

      const deviceName = this.parseDeviceName(meta.device);
      const ip = meta.ip ?? '未知';
      const message =
        alertType === 'new_device'
          ? `检测到新设备登录：${deviceName}，IP ${ip}。如非本人操作请立即启用二次验证并检查登录设备。`
          : `检测到异地登录：您的账户从 IP ${ip} 登录，设备 ${deviceName}。如非本人操作请及时处理。`;

      if (user.phone) {
        await this.notificationDelivery.send({
          userId,
          channel: NotificationChannel.sms,
          notificationType: 'auth.security.alert',
          target: user.phone,
          subject: 'VaultPass 安全提醒',
          message,
        });
      }

      if (user.email) {
        await this.notificationDelivery.send({
          userId,
          channel: NotificationChannel.email,
          notificationType: 'auth.security.alert',
          target: user.email,
          subject: 'VaultPass 安全提醒',
          message,
        });
      }
    } catch (error) {
      this.logger.warn(
        `安全告警通知失败: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private parseDeviceName(userAgent?: string) {

    if (!userAgent) {

      return '未知设备';

    }

    if (userAgent.includes('MicroMessenger')) {

      return '微信小程序';

    }

    if (userAgent.includes('Mobile')) {

      return '移动浏览器';

    }

    if (userAgent.includes('Windows')) {

      return 'Windows 电脑';

    }

    if (userAgent.includes('Mac OS')) {

      return 'Mac 电脑';

    }

    return userAgent.slice(0, 80);

  }

}

