import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { CreateBlockDto, UpdateBlockDto, SaveVersionDto, ReorderBlocksDto } from './dto/block.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ─── Bloques anidados bajo sección ──────────────────────────
@ApiTags('blocks')
@ApiBearerAuth('JWT')
@Controller('sections/:sectionId/blocks')
export class BlocksSectionController {
  constructor(private readonly service: BlocksService) {}

  @Get()
  @ApiOperation({ summary: 'Listar bloques de la sección' })
  findAll(@Param('sectionId') sectionId: string) {
    return this.service.findBySection(sectionId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nuevo bloque' })
  create(
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(sectionId, dto, userId);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reordenar bloques' })
  reorder(@Body() dto: ReorderBlocksDto) {
    return this.service.reorder(dto.items);
  }
}

// ─── Operaciones sobre bloque individual ────────────────────
@ApiTags('blocks')
@ApiBearerAuth('JWT')
@Controller('blocks')
export class BlocksController {
  constructor(private readonly service: BlocksService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener bloque por ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar contenido del bloque (auto-save)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar bloque (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.softDelete(id, userId);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Listar versiones del bloque' })
  listVersions(@Param('id') id: string) {
    return this.service.listVersions(id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Guardar versión manual del bloque' })
  saveVersion(
    @Param('id') id: string,
    @Body() dto: SaveVersionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.saveVersion(id, dto, userId);
  }

  @Patch(':id/restore/:versionNum')
  @ApiOperation({ summary: 'Restaurar bloque a una versión anterior' })
  restore(
    @Param('id') id: string,
    @Param('versionNum') versionNum: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.restoreVersion(id, parseInt(versionNum, 10), userId);
  }
}
