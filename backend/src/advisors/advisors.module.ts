import { Module } from '@nestjs/common';
import { AdvisorsService } from './advisors.service';
import { AdvisorsController } from './advisors.controller';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [RiskModule],
  providers: [AdvisorsService],
  controllers: [AdvisorsController],
  exports: [AdvisorsService],
})
export class AdvisorsModule {}
