import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ThesisDocumentsService } from './thesis-documents.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller({ path: 'thesis-works/:thesisWorkId/document', version: '1' })
@UseGuards(JwtAuthGuard)
export class ThesisDocumentsController {
  constructor(private readonly service: ThesisDocumentsService) {}

  @Get()
  findOrCreate(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @Query('docType') docType?: string,
  ) {
    return this.service.findOrCreate(thesisWorkId, userId, docType ?? 'THESIS');
  }

  @Get('stats')
  getStats(
    @Param('thesisWorkId') thesisWorkId: string,
    @Query('docType') docType?: string,
  ) {
    return this.service.getStats(thesisWorkId, docType ?? 'THESIS');
  }

  @Get('list')
  findAll(
    @Param('thesisWorkId') thesisWorkId: string,
    @Query('docType') docType?: string,
  ) {
    return this.service.findByThesisWork(thesisWorkId, docType);
  }
}
