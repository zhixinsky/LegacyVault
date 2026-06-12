import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MfaModule } from '../mfa/mfa.module';
import { TrustedContactController } from './trusted-contact.controller';
import { TrustedContactService } from './trusted-contact.service';

@Module({
  imports: [AuditLogModule, MfaModule],
  controllers: [TrustedContactController],
  providers: [TrustedContactService],
})
export class TrustedContactModule {}
