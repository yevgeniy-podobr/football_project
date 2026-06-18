import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiStatsService } from './ai-stats.service';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matchesService: MatchesService,
    private readonly aiStatsService: AiStatsService,
  ) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('competition') competition?: string) {
    return this.matchesService.findAll(status, competition);
  }

  @Get('sync')
  sync(@Query('force') force?: string) {
    return this.matchesService.fetchAndSync(force === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.matchesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/ai-stats')
  getAiStats(@Param('id', ParseIntPipe) id: number) {
    return this.aiStatsService.getOrFetchStats(id);
  }
}
