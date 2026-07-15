import { Module } from '@nestjs/common';
import { ThesisWorksService } from './thesis-works.service';
import { ThesisWorksController } from './thesis-works.controller';

@Module({
  providers: [ThesisWorksService],
  controllers: [ThesisWorksController],
  exports: [ThesisWorksService],
})
export class ThesisWorksModule {}
