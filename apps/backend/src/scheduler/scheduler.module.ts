import { Module } from '@nestjs/common';
import { PredictionsModule } from '../predictions/predictions.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [PredictionsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
