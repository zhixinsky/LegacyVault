import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { VaultItemType } from '@prisma/client';

class VaultKdfParamsDto {
  @IsString()
  algorithm!: 'argon2id';

  @IsNotEmpty()
  memory!: number;

  @IsNotEmpty()
  iterations!: number;

  @IsNotEmpty()
  parallelism!: number;
}

export class CreateVaultDto {
  @IsString()
  @IsNotEmpty()
  encryptedVaultKey!: string;

  @IsString()
  @IsNotEmpty()
  encryptedVaultKeyByRecovery!: string;

  @IsString()
  @IsNotEmpty()
  passwordSalt!: string;

  @IsString()
  @IsNotEmpty()
  recoverySalt!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => VaultKdfParamsDto)
  kdfParams!: VaultKdfParamsDto;
}

export class CreateVaultItemDto {
  @IsEnum(VaultItemType)
  type!: VaultItemType;

  @IsString()
  @IsNotEmpty()
  titleCiphertext!: string;

  @IsString()
  @IsNotEmpty()
  encryptedPayload!: string;

  @IsOptional()
  @IsString()
  encryptedMetadata?: string;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class UpdateVaultItemDto {
  @IsOptional()
  @IsEnum(VaultItemType)
  type?: VaultItemType;

  @IsOptional()
  @IsString()
  titleCiphertext?: string;

  @IsOptional()
  @IsString()
  encryptedPayload?: string;

  @IsOptional()
  @IsString()
  encryptedMetadata?: string;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class ListVaultItemsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsEnum(VaultItemType)
  type?: VaultItemType;
}
