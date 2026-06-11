import { Module } from '@nestjs/common';
import { MfaModule } from '../mfa/mfa.module';
import { VaultController, VaultSetupController } from './vault.controller';
import { VaultService } from './vault.service';

@Module({
  imports: [MfaModule],
  controllers: [VaultSetupController, VaultController],
  providers: [VaultService],
})
export class VaultModule {}
