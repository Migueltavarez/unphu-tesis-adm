import { Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { BlocksController, BlocksNodeController } from './blocks.controller';

@Module({
  providers: [BlocksService],
  controllers: [BlocksController, BlocksNodeController],
  exports: [BlocksService],
})
export class BlocksModule {}
