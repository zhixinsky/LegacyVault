import { Module } from '@nestjs/common';
import { EmaySmsService } from './emay/emay-sms.service';
import { NotificationController } from './notification.controller';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDeliveryService, EmaySmsService],
  exports: [NotificationDeliveryService, NotificationService, EmaySmsService],
})
export class NotificationModule {}
