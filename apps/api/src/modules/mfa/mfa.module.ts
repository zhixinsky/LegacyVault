import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MfaService } from '../user/mfa.service';

@Module({
  imports: [AuditLogModule],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
