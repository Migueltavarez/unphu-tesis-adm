import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MeetingsService, CreateMeetingDto } from './meetings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('meetings')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: '', version: '1' })
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @Post('thesis-works/:thesisWorkId/meetings')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Programar una reunión' })
  create(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: CreateMeetingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(thesisWorkId, dto);
  }

  @Get('thesis-works/:thesisWorkId/meetings')
  @ApiOperation({ summary: 'Listar reuniones de un trabajo' })
  list(@Param('thesisWorkId') thesisWorkId: string) {
    return this.service.list(thesisWorkId);
  }

  @Patch('meetings/:id/complete')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Marcar reunión como completada' })
  complete(@Param('id') id: string, @Body('notes') notes?: string) {
    return this.service.complete(id, notes);
  }

  @Delete('meetings/:id')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancelar reunión' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
