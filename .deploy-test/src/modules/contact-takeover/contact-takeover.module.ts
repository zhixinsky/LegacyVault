import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { FileModule } from '../file/file.module';
import { NotificationModule } from '../notification/notification.module';
import { ContactTakeoverController } from './contact-takeover.controller';
import { ContactTakeoverService } from './contact-takeover.service';

@Module({
  imports: [NotificationModule, AuditLogModule, FileModule],
  controllers: [ContactTakeoverController],
  providers: [ContactTakeoverService],
  exports: [ContactTakeoverService],
})
export class ContactTakeoverModule {}
