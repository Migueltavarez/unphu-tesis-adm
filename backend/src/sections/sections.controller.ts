import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, SectionStatus } from '@prisma/client';
import { SectionsService } from './sections.service';
import {
  CreateSectionDto,
  UpdateSectionDto,
  SectionActionDto,
  ReorderSectionsDto,
} from './dto/section.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

// ─── Secciones anidadas bajo documento ──────────────────────
@ApiTags('sections')
@ApiBearerAuth('JWT')
@Controller('thesis-documents/:documentId/sections')
export class SectionsDocumentController {
  constructor(private readonly service: SectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar secciones del documento' })
  findAll(@Param('documentId') documentId: string) {
    return this.service.findByDocument(documentId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva sección' })
  create(
    @Param('documentId') documentId: string,
    @Body() dto: CreateSectionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(documentId, dto, userId);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reordenar secciones' })
  reorder(@Body() dto: ReorderSectionsDto) {
    return this.service.reorder(dto.items);
  }
}

// ─── Operaciones sobre sección individual ───────────────────
@ApiTags('sections')
@ApiBearerAuth('JWT')
@Controller('sections')
export class SectionsController {
  constructor(private readonly service: SectionsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sección con bloques y comentarios' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar título / notas de la sección' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Marcar sección como En progreso' })
  start(
    @Param('id') id: string,
    @Body() dto: SectionActionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.transition(id, SectionStatus.IN_PROGRESS, dto, userId, role);
  }

  @Patch(':id/submit')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Estudiante envía sección a revisión' })
  submit(
    @Param('id') id: string,
    @Body() dto: SectionActionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.transition(id, SectionStatus.PENDING_REVIEW, dto, userId, role);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Asesor aprueba la sección' })
  approve(
    @Param('id') id: string,
    @Body() dto: SectionActionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.transition(id, SectionStatus.APPROVED, dto, userId, role);
  }

  @Patch(':id/return')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Asesor devuelve la sección con comentarios' })
  returnSection(
    @Param('id') id: string,
    @Body() dto: SectionActionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.transition(id, SectionStatus.RETURNED, dto, userId, role);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Agregar comentario a la sección' })
  addComment(
    @Param('id') id: string,
    @Body() body: { content: string; blockId?: string; parentId?: string },
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
  ) {
    const name = `${user.firstName} ${user.lastName}`;
    return this.service.addComment(id, body.content, userId, name, body.blockId, body.parentId);
  }

  @Patch('comments/:commentId/resolve')
  @ApiOperation({ summary: 'Resolver comentario' })
  resolveComment(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.resolveComment(commentId, userId);
  }
}
