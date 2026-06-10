import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PredictionsService } from '../predictions/predictions.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly predictionsService: PredictionsService) {}

  @Cron('*/5 * * * *')
  async resolveFinishedMatches() {
    const { resolved, affectedUsers } = await this.predictionsService.resolveAll();
    if (resolved > 0) {
      this.logger.log(`Resolved ${resolved} predictions for ${affectedUsers.length} user(s)`);
    }
  }
}
