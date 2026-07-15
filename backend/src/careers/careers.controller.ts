import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CareersService, CreateCareerDto, UpdateCareerDto } from './careers.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('careers')
@Controller('careers')
export class CareersController {
  constructor(private readonly service: CareersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar carreras' })
  findAll(@Query('all') all?: string) {
    return this.service.findAll(all !== 'true');
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Obtener carrera por ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Crear carrera' })
  create(@Body() dto: CreateCareerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Actualizar carrera' })
  update(@Param('id') id: string, @Body() dto: UpdateCareerDto) {
    return this.service.update(id, dto);
  }
}
