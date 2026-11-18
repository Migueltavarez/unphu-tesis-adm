import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RiskService } from './risk.service';
import { RiskController } from './risk.controller';

@Module({
  imports: [NotificationsModule],
  providers: [RiskService],
  controllers: [RiskController],
  exports: [RiskService],
})
export class RiskModule {}
