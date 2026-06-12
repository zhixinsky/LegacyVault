import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertInheritanceRuleDto {
  @IsInt()
  @Min(1)
  @Max(10)
  inactiveYears!: number;

  @IsString()
  @IsNotEmpty()
  reminderFrequency!: string;

  @IsInt()
  @Min(1)
  @Max(24)
  gracePeriodMonths!: number;

  @IsOptional()
  @IsBoolean()
  requireMultiContact?: boolean;

  @IsOptional()
  unlockPolicy?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ListInheritanceEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
