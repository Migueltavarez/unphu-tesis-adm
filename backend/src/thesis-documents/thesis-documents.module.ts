import { Module } from '@nestjs/common';
import { ThesisDocumentsService } from './thesis-documents.service';
import { ThesisDocumentsController } from './thesis-documents.controller';

@Module({
  providers: [ThesisDocumentsService],
  controllers: [ThesisDocumentsController],
  exports: [ThesisDocumentsService],
})
export class ThesisDocumentsModule {}
