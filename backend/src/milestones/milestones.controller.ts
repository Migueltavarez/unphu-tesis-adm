import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MilestonesService } from './milestones.service';
import { UpdateMilestonePlanDto } from './milestones.dto';

@ApiTags('milestones')
@ApiBearerAuth('JWT')
@Controller()
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get('careers/:careerId/milestone-plan')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Plan de hitos y duración del programa' })
  getPlan(@Param('careerId', ParseUUIDPipe) careerId: string) {
    return this.milestones.getPlan(careerId);
  }

  @Put('careers/:careerId/milestone-plan')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @ApiOperation({ summary: 'Actualizar el plan de hitos (aplica a trabajos nuevos)' })
  updatePlan(
    @Param('careerId', ParseUUIDPipe) careerId: string,
    @Body() dto: UpdateMilestonePlanDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.milestones.updatePlan(careerId, dto, userId);
  }

  @Get('thesis-works/:id/milestones')
  @ApiOperation({ summary: 'Hitos del trabajo con su estado (al día, por vencer, vencido, cumplido)' })
  listForWork(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.milestones.listForWork(id, userId, role);
  }

  @Patch('milestones/:id/complete')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Marcar como cumplido un hito manual' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.milestones.setManualCompletion(id, true, userId, role);
  }

  @Patch('milestones/:id/reopen')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ADVISOR)
  @ApiOperation({ summary: 'Reabrir un hito manual marcado por error' })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.milestones.setManualCompletion(id, false, userId, role);
  }
}
