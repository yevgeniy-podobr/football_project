import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getGlobalStats() {
    return this.statsService.getGlobalStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  getUserStats(@Param('userId', ParseIntPipe) userId: number) {
    return this.statsService.getUserStats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('recalculate/:userId')
  recalculate(@Param('userId', ParseIntPipe) userId: number) {
    return this.statsService.recalculate(userId);
  }
}
