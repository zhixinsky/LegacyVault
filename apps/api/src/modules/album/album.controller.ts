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
import { getRequestMeta } from '../../common/utils/request-meta';
import { CreateAlbumDto, ListAlbumsQueryDto, UpdateAlbumDto } from './dto/album.dto';
import { AlbumService } from './album.service';

@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAlbumsQueryDto) {
    return this.albumService.list(user.userId, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.albumService.getById(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAlbumDto,
    @Req() req: Request,
  ) {
    return this.albumService.create(user.userId, dto, getRequestMeta(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAlbumDto,
    @Req() req: Request,
  ) {
    return this.albumService.update(user.userId, id, dto, getRequestMeta(req));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.albumService.remove(user.userId, id, getRequestMeta(req));
  }
}
