import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MilestonesService } from './milestones.service';
import { MilestonesController } from './milestones.controller';

@Module({
  imports: [AuditModule],
  providers: [MilestonesService],
  controllers: [MilestonesController],
  exports: [MilestonesService],
})
export class MilestonesModule {}
