import { Module } from '@nestjs/common';
import { PresentationsService } from './presentations.service';
import { PresentationsController } from './presentations.controller';

@Module({
  providers: [PresentationsService],
  controllers: [PresentationsController],
  exports: [PresentationsService],
})
export class PresentationsModule {}
