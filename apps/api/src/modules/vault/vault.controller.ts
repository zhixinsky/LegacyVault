import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MfaCode } from '../../common/decorators/mfa-code.decorator';
import { getRequestMeta } from '../../common/utils/request-meta';
import {
  CreateVaultItemDto,
  CreateVaultDto,
  ListVaultItemsQueryDto,
  UpdateVaultItemDto,
} from './dto/vault.dto';
import { VaultService } from './vault.service';

@Controller('vault')
export class VaultSetupController {
  constructor(private readonly vaultService: VaultService) {}

  @Post('create')
  createVault(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVaultDto,
    @Req() req: Request,
  ) {
    return this.vaultService.createVault(user.userId, dto, getRequestMeta(req));
  }
}

@Controller('vault/items')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListVaultItemsQueryDto) {
    return this.vaultService.list(user.userId, query);
  }

  @Get('trash')
  listTrash(@CurrentUser() user: AuthUser, @Query() query: ListVaultItemsQueryDto) {
    return this.vaultService.listTrash(user.userId, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vaultService.getById(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVaultItemDto,
    @Req() req: Request,
  ) {
    return this.vaultService.create(user.userId, dto, getRequestMeta(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateVaultItemDto,
    @Req() req: Request,
  ) {
    return this.vaultService.update(user.userId, id, dto, getRequestMeta(req));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.vaultService.remove(user.userId, id, getRequestMeta(req));
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.vaultService.restore(user.userId, id, getRequestMeta(req));
  }

  @Delete(':id/permanent')
  permanentDelete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.vaultService.permanentDelete(user.userId, id, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Post(':id/reveal')
  revealPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.vaultService.revealPassword(user.userId, id, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }
}
