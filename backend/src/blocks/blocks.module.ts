import { Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { BlocksController, BlocksSectionController } from './blocks.controller';

@Module({
  providers: [BlocksService],
  controllers: [BlocksController, BlocksSectionController],
  exports: [BlocksService],
})
export class BlocksModule {}
