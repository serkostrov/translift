import { Module } from '@nestjs/common';
import { FinanceController } from '../finance/finance.controller.js';
import { ObjectsModule } from '../objects/objects.module.js';
import { ClaimsController } from './claims.controller.js';

@Module({
  imports: [ObjectsModule],
  controllers: [ClaimsController, FinanceController],
})
export class ClaimsModule {}
