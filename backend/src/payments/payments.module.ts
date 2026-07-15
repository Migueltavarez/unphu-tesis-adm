import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController, PaymentsAdminController } from './payments.controller';

@Module({
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsAdminController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
