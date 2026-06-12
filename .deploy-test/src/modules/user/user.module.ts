import { Module } from '@nestjs/common';
import { InheritanceModule } from '../inheritance/inheritance.module';
import { MfaModule } from '../mfa/mfa.module';
import { NotificationModule } from '../notification/notification.module';
import { DeviceService } from './device.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [InheritanceModule, MfaModule, NotificationModule],
  controllers: [UserController],
  providers: [UserService, DeviceService],
  exports: [UserService, DeviceService],
})
export class UserModule {}
