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
  findAll(
    @Query('status') status?: string,
    @Query('competition') competition?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const limitNum = [10, 20, 30].includes(Number.parseInt(limit ?? '10', 10))
      ? Number.parseInt(limit ?? '10', 10)
      : 10;
    return this.matchesService.findAll(status, competition, pageNum, limitNum);
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

  @UseGuards(JwtAuthGuard)
  @Post(':id/ai-preview')
  getAiPreview(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    const resolvedLang = lang === 'uk' ? 'uk' : 'en';
    return this.aiStatsService.getOrFetchPreview(id, resolvedLang);
  }
}
