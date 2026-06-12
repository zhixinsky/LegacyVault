import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { IpBlacklistService } from './ip-blacklist.service';

@Module({
  imports: [AuditLogModule],
  providers: [IpBlacklistService],
  exports: [IpBlacklistService],
})
export class SecurityModule {}
