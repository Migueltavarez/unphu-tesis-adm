import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExtensionsService } from './extensions.service';
import { CreateExtensionDto, ExtensionDecisionDto } from './extensions.dto';

@ApiTags('extensions')
@ApiBearerAuth('JWT')
@Controller()
export class ExtensionsController {
  constructor(private readonly extensions: ExtensionsService) {}

  @Get('thesis-works/:id/extensions')
  @ApiOperation({ summary: 'Prórrogas del trabajo y acciones disponibles' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.list(id, userId, role);
  }

  @Post('thesis-works/:id/extensions')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Solicitar una prórroga (estudiante)' })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateExtensionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.extensions.create(id, dto, userId, role);
  }

  @Get('extensions/pending')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Prórrogas esperando mi decisión' })
  pending(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.pendingForMe(userId, role);
  }

  @Patch('extensions/:id/cancel')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Cancelar una solicitud en trámite' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.cancel(id, userId, role);
  }

  @Patch('extensions/:id/endorse')
  @Roles(UserRole.ADVISOR)
  @ApiOperation({ summary: 'El asesor avala la prórroga' })
  endorse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtensionDecisionDto, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.advisorDecision(id, true, dto, userId, role);
  }

  @Patch('extensions/:id/advisor-reject')
  @Roles(UserRole.ADVISOR)
  @ApiOperation({ summary: 'El asesor no avala la prórroga' })
  advisorReject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtensionDecisionDto, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.advisorDecision(id, false, dto, userId, role);
  }

  @Patch('extensions/:id/approve')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Coordinación aprueba la prórroga (corre los hitos pendientes)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtensionDecisionDto, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.coordinatorDecision(id, true, dto, userId, role);
  }

  @Patch('extensions/:id/reject')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Coordinación rechaza la prórroga' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtensionDecisionDto, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.extensions.coordinatorDecision(id, false, dto, userId, role);
  }
}
