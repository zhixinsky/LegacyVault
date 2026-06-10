import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminOnly, Public } from '../../common/decorators/metadata.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { getRequestMeta } from '../../common/utils/request-meta';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/admin.dto';
import { ListAdminAuditLogsQueryDto } from './dto/admin-query.dto';
import { AddIpBlacklistDto } from './dto/ip-blacklist.dto';

@Controller('admin')
@AdminOnly()
@Public()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers(@Query() query: PaginationDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateUserStatus(id, dto.status, getRequestMeta(req));
  }

  @Get('audit-logs')
  listAuditLogs(@Query() query: ListAdminAuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }

  @Get('security-alerts')
  listSecurityAlerts(@Query() query: PaginationDto) {
    return this.adminService.listSecurityAlerts(query);
  }

  @Get('inheritance-events')
  listInheritanceEvents(@Query() query: PaginationDto) {
    return this.adminService.listInheritanceEvents(query);
  }

  @Post('inheritance/scan')
  runInheritanceScan() {
    return this.adminService.runInheritanceScan();
  }

  @Get('notification-logs')
  listNotificationLogs(@Query() query: PaginationDto) {
    return this.adminService.listNotificationLogs(query);
  }

  @Get('ip-blacklist')
  listIpBlacklist() {
    return this.adminService.listIpBlacklist();
  }

  @Post('ip-blacklist')
  addIpBlacklist(@Body() dto: AddIpBlacklistDto) {
    return this.adminService.addIpBlacklist(dto.ip, dto.reason);
  }

  @Delete('ip-blacklist/:ip')
  removeIpBlacklist(@Param('ip') ip: string) {
    return this.adminService.removeIpBlacklist(ip);
  }
}
