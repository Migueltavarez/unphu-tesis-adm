import { Module } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [FeedbackModule],
  providers: [AdvancesService],
  controllers: [AdvancesController],
  exports: [AdvancesService],
})
export class AdvancesModule {}
