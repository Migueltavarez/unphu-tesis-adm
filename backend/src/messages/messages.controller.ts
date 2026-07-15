import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

class SendMessageDto {
  @ApiProperty({ example: 'Hola, ¿puedes revisar el capítulo 2?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

@ApiTags('messages')
@ApiBearerAuth('JWT')
@Controller('thesis-works/:thesisWorkId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Listar mensajes del chat del trabajo' })
  findAll(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.messagesService.findAll(thesisWorkId, userId, role);
  }

  @Post()
  @Roles(UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enviar mensaje en el chat del trabajo' })
  send(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('firstName') firstName: string,
    @CurrentUser('lastName') lastName: string,
  ) {
    const senderName = `${firstName} ${lastName}`.trim();
    return this.messagesService.send(thesisWorkId, userId, role, dto.content, senderName);
  }

  @Patch('read')
  @Roles(UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Marcar mensajes como leídos' })
  markRead(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.messagesService.markRead(thesisWorkId, userId, role);
  }

  @Get('unread')
  @Roles(UserRole.STUDENT, UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Contar mensajes no leídos' })
  unread(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.unreadCount(thesisWorkId, userId);
  }
}
