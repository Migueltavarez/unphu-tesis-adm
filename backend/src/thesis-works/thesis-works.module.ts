import { Module } from '@nestjs/common';
import { ThesisWorksService } from './thesis-works.service';
import { ThesisWorksController } from './thesis-works.controller';
import { RiskModule } from '../risk/risk.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RiskModule, MilestonesModule, AuditModule],
  providers: [ThesisWorksService],
  controllers: [ThesisWorksController],
  exports: [ThesisWorksService],
})
export class ThesisWorksModule {}
