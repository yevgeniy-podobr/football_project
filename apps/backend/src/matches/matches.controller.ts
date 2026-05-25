import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('competition') competition?: string,
  ) {
    return this.matchesService.findAll(status, competition);
  }

  @Get('sync')
  sync(@Query('force') force?: string) {
    return this.matchesService.fetchAndSync(force === 'true');
  }

  @Get('upcoming')
  findUpcoming() {
    return this.matchesService.findUpcoming();
  }

  @Get('recent')
  findRecent() {
    return this.matchesService.findRecent();
  }

  @Get('h2h')
  findH2H(
    @Query('homeId', ParseIntPipe) homeId: number,
    @Query('awayId', ParseIntPipe) awayId: number,
  ) {
    return this.matchesService.findByTeams(homeId, awayId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.matchesService.findOne(id);
  }
}
