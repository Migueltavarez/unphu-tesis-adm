import {
  Controller, Get, Post, Delete, Param, Body, ParseUUIDPipe,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DocumentType, UserRole } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth('JWT')
@Controller('thesis-works/:thesisWorkId/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  // El límite de multer corta archivos enormes antes de cargarlos en memoria.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir documento al trabajo de grado' })
  upload(
    @Param('thesisWorkId', ParseUUIDPipe) thesisWorkId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: DocumentType,
    @Body('isPublic') isPublic: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.upload(thesisWorkId, file, type, userId, role, isPublic === 'true');
  }

  @Get()
  @ApiOperation({ summary: 'Listar documentos del trabajo' })
  findByThesis(
    @Param('thesisWorkId', ParseUUIDPipe) thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.findByThesis(thesisWorkId, userId, role);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Obtener URL firmada para descarga' })
  getDownloadUrl(
    @Param('thesisWorkId', ParseUUIDPipe) thesisWorkId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.getSignedDownloadUrl(id, thesisWorkId, userId, role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar documento' })
  delete(
    @Param('thesisWorkId', ParseUUIDPipe) thesisWorkId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.service.delete(id, thesisWorkId, userId, role);
  }
}
