import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RegisterFileDto {
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @IsString()
  @IsNotEmpty()
  encryptedFileKey!: string;

  @IsString()
  @IsNotEmpty()
  fileHash!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsOptional()
  @IsString()
  encryptedMetadata?: string;
}

export class ListFilesQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  albumId?: string;
}
