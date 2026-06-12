import { Injectable } from '@nestjs/common';
import { getPagination, PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationDeliveryService } from './notification-delivery.service';

@Injectable()
export class NotificationService {
  constructor(private readonly deliveryService: NotificationDeliveryService) {}

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const { page: safePage, pageSize: safePageSize, skip, take } = getPagination(page, pageSize);
    const result = await this.deliveryService.listForUser(userId, skip, take);
    return { ...result, page: safePage, pageSize: safePageSize };
  }
}
