import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAlbumDto {
  @IsString()
  @IsNotEmpty()
  encryptedName!: string;

  @IsOptional()
  @IsString()
  encryptedDescription?: string;

  @IsOptional()
  @IsString()
  encryptedCoverFileId?: string;
}

export class UpdateAlbumDto {
  @IsOptional()
  @IsString()
  encryptedName?: string;

  @IsOptional()
  @IsString()
  encryptedDescription?: string;

  @IsOptional()
  @IsString()
  encryptedCoverFileId?: string;
}

export class ListAlbumsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
