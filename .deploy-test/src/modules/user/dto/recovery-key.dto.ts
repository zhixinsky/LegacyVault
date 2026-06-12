import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetupRecoveryKeyDto {
  @IsString()
  @IsNotEmpty()
  encryptedVaultKeyByRecovery!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recoveryKeyHint?: string;
}
