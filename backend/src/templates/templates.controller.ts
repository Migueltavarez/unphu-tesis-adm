import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller({ path: 'templates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  findAll(
    @Query('careerId') careerId?: string,
    @Query('docType') docType?: string,
  ) {
    return this.service.findAll(careerId, docType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  create(@Body() dto: any, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.update(id, dto, userId, userRole);
  }

  @Delete(':id')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.remove(id, userId, userRole);
  }

  @Patch(':id/set-default')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  setDefault(@Param('id') id: string, @Body('careerId') careerId: string) {
    return this.service.setDefault(id, careerId);
  }

  @Post(':id/nodes')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  addNode(@Param('id') templateId: string, @Body() dto: any) {
    return this.service.addNode(templateId, dto);
  }

  @Patch(':id/nodes/reorder')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  reorderNodes(@Param('id') _id: string, @Body('items') items: any[]) {
    return this.service.reorderNodes(items);
  }

  @Patch('nodes/:nodeId')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  updateNode(@Param('nodeId') nodeId: string, @Body() dto: any) {
    return this.service.updateNode(nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  removeNode(@Param('nodeId') nodeId: string) {
    return this.service.removeNode(nodeId);
  }
}
