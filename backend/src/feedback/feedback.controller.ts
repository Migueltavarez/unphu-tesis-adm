import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, FeedbackNoteDto } from './feedback.dto';

@ApiTags('feedback')
@ApiBearerAuth('JWT')
@Controller()
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get('thesis-works/:id/feedback')
  @ApiOperation({ summary: 'Checklist de retroalimentación del trabajo' })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.feedback.list(id, userId, role);
  }

  @Post('thesis-works/:thesisWorkId/advances/:advanceId/feedback')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Agregar observaciones a un avance' })
  add(
    @Param('thesisWorkId', ParseUUIDPipe) thesisWorkId: string,
    @Param('advanceId', ParseUUIDPipe) advanceId: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.feedback.addToAdvance(thesisWorkId, advanceId, dto.items, userId, role);
  }

  @Patch('feedback/:id/resolve')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'El estudiante marca la observación como resuelta' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeedbackNoteDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.feedback.transition(id, 'resolve', dto.note, userId, role);
  }

  @Patch('feedback/:id/verify')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'El asesor confirma la corrección' })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.feedback.transition(id, 'verify', undefined, userId, role);
  }

  @Patch('feedback/:id/reopen')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'El asesor reabre una observación' })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeedbackNoteDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.feedback.transition(id, 'reopen', dto.note, userId, role);
  }

  @Delete('feedback/:id')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar una observación aún no atendida' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.feedback.remove(id, userId, role);
  }
}
