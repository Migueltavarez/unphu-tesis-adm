import { Module } from '@nestjs/common';
import { RepositoryService } from './repository.service';
import { RepositoryController } from './repository.controller';

@Module({
  providers: [RepositoryService],
  controllers: [RepositoryController],
})
export class RepositoryModule {}
