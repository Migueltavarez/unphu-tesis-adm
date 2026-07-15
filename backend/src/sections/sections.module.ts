import { Module } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { SectionsController, SectionsDocumentController } from './sections.controller';

@Module({
  providers: [SectionsService],
  controllers: [SectionsController, SectionsDocumentController],
  exports: [SectionsService],
})
export class SectionsModule {}
