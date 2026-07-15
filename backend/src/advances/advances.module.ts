import { Module } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';

@Module({
  providers: [AdvancesService],
  controllers: [AdvancesController],
  exports: [AdvancesService],
})
export class AdvancesModule {}
