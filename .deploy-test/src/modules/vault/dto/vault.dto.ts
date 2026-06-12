import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { VaultItemType } from '@prisma/client';

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
