import { Module } from '@nestjs/common';
import { InheritanceModule } from '../inheritance/inheritance.module';
import { SecurityModule } from '../security/security.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [InheritanceModule, SecurityModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
