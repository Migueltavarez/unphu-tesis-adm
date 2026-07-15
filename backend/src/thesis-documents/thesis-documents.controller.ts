import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThesisDocumentsService } from './thesis-documents.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('thesis-documents')
@ApiBearerAuth('JWT')
@Controller('thesis-works/:thesisWorkId/document')
export class ThesisDocumentsController {
  constructor(private readonly service: ThesisDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener o crear documento de tesis' })
  findOrCreate(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.findOrCreate(thesisWorkId, userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas de progreso del documento' })
  getStats(@Param('thesisWorkId') thesisWorkId: string) {
    return this.service.getStats(thesisWorkId);
  }
}
