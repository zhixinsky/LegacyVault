import { IsEnum, IsOptional } from 'class-validator';
import { AuditRiskLevel } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListAdminAuditLogsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AuditRiskLevel)
  riskLevel?: AuditRiskLevel;
}
