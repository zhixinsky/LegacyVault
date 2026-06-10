import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { getPagination, PaginationDto } from '../../common/dto/pagination.dto';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    const { page, pageSize, skip, take } = getPagination(query.page, query.pageSize);
    const result = await this.auditLogService.listForUser(user.userId, skip, take);

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
    };
  }
}
