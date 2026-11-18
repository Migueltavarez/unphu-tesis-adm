import { Module } from '@nestjs/common';
import { ThesisWorksService } from './thesis-works.service';
import { ThesisWorksController } from './thesis-works.controller';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [RiskModule],
  providers: [ThesisWorksService],
  controllers: [ThesisWorksController],
  exports: [ThesisWorksService],
})
export class ThesisWorksModule {}
