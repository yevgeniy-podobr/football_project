import { Module } from '@nestjs/common';
import { AiStatsService } from './ai-stats.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, AiStatsService],
  exports: [MatchesService],
})
export class MatchesModule {}
