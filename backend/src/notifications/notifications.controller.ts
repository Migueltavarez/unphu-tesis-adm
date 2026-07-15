import { Controller, Get, Patch, Param, Query, Sse, UseGuards, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('stream')
  @ApiOperation({ summary: 'Stream de notificaciones en tiempo real (SSE)' })
  stream(@CurrentUser('id') userId: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      const listener = (notification: any) => {
        if (notification.userId === userId) {
          observer.next({ data: notification } as MessageEvent);
        }
      };
      this.eventEmitter.on('notification.push', listener);
      return () => {
        this.eventEmitter.off('notification.push', listener);
      };
    });
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las notificaciones (paginadas)' })
  getAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.service.getAll(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      type,
    );
  }

  @Get('unread')
  @ApiOperation({ summary: 'Obtener notificaciones no leídas' })
  getUnread(@CurrentUser('id') userId: string) {
    return this.service.getUnread(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.markRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.service.markAllRead(userId);
  }
}
