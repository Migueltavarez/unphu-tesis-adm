import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller({ path: 'templates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll(@Query('careerId') careerId?: string) {
    return this.templatesService.findAll(careerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  create(@Body() dto: CreateTemplateDto, @CurrentUser('id') userId: string) {
    return this.templatesService.create(dto, userId);
  }

  @Patch(':id')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.templatesService.update(id, dto, userId, userRole);
  }

  @Delete(':id')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.templatesService.remove(id, userId, userRole);
  }

  @Patch(':id/set-default')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  setDefault(@Param('id') id: string, @Body('careerId') careerId: string) {
    return this.templatesService.setDefault(id, careerId);
  }
}
