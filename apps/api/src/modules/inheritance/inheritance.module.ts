import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ContactTakeoverModule } from '../contact-takeover/contact-takeover.module';
import { MfaModule } from '../mfa/mfa.module';
import { NotificationModule } from '../notification/notification.module';
import { InheritanceController } from './inheritance.controller';
import { InheritanceSchedulerService } from './inheritance-scheduler.service';
import { InheritanceService } from './inheritance.service';
import { InheritanceWorkflowService } from './inheritance-workflow.service';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationModule, ContactTakeoverModule, MfaModule],
  controllers: [InheritanceController],
  providers: [InheritanceService, InheritanceWorkflowService, InheritanceSchedulerService],
  exports: [InheritanceService, InheritanceWorkflowService, InheritanceSchedulerService],
})
export class InheritanceModule {}
