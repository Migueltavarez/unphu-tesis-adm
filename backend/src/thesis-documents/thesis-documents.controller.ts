import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
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
    @CurrentUser('role') role: UserRole,
    @Query('docType') docType?: string,
  ) {
    return this.service.findOrCreate(thesisWorkId, userId, role, docType ?? 'THESIS');
  }

  @Get('stats')
  getStats(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('docType') docType?: string,
  ) {
    return this.service.getStats(thesisWorkId, userId, role, docType ?? 'THESIS');
  }

  @Get('list')
  findAll(
    @Param('thesisWorkId') thesisWorkId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('docType') docType?: string,
  ) {
    return this.service.findByThesisWork(thesisWorkId, userId, role, docType);
  }
}
