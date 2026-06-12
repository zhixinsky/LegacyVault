import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MfaCode } from '../../common/decorators/mfa-code.decorator';
import { getRequestMeta } from '../../common/utils/request-meta';
import { ListInheritanceEventsQueryDto, UpsertInheritanceRuleDto } from './dto/inheritance.dto';
import { RespondInheritanceEventDto } from './dto/respond-inheritance.dto';
import { InheritanceService } from './inheritance.service';
import { InheritanceWorkflowService } from './inheritance-workflow.service';

@Controller('inheritance')
export class InheritanceController {
  constructor(
    private readonly inheritanceService: InheritanceService,
    private readonly workflowService: InheritanceWorkflowService,
  ) {}

  @Get('rule')
  getRule(@CurrentUser() user: AuthUser) {
    return this.inheritanceService.getRule(user.userId);
  }

  @Put('rule')
  upsertRule(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertInheritanceRuleDto,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.inheritanceService.upsertRule(user.userId, dto, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Post('rule')
  createRule(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertInheritanceRuleDto,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.inheritanceService.upsertRule(user.userId, dto, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Post('rule/disable')
  disableRule(
    @CurrentUser() user: AuthUser,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.inheritanceService.disableRule(user.userId, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Get('events')
  listEvents(@CurrentUser() user: AuthUser, @Query() query: ListInheritanceEventsQueryDto) {
    return this.inheritanceService.listEvents(user.userId, query);
  }

  @Get('events/active')
  getActiveEvent(@CurrentUser() user: AuthUser) {
    return this.inheritanceService.getActiveEvent(user.userId);
  }

  @Post('events/:id/respond')
  respondToEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondInheritanceEventDto,
    @Req() req: Request,
  ) {
    return this.workflowService.respondToEvent(user.userId, id, dto.action, getRequestMeta(req));
  }
}
