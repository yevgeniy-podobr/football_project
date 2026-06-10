import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED = new Set(['PL', 'PD', 'BL1', 'SA', 'WC']);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStandings(competitionCode: string) {
    if (!ALLOWED.has(competitionCode)) {
      throw new BadRequestException(
        `Standings not available for ${competitionCode}`,
      );
    }

    const cached = await this.prisma.standingsCache.findUnique({
      where: { competitionCode },
    });

    if (cached && Date.now() - new Date(cached.cachedAt).getTime() < ONE_DAY_MS) {
      return cached.data;
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) throw new BadRequestException('Football API key not configured');

    const { data } = await axios.get(
      `https://api.football-data.org/v4/competitions/${competitionCode}/standings`,
      { headers: { 'X-Auth-Token': apiKey } },
    );

    const table =
      (data.standings as any[])?.find((s) => s.type === 'TOTAL')?.table ?? [];

    const result = table.map((entry: any) => ({
      position: entry.position,
      team: {
        id: entry.team.id,
        name: entry.team.name,
        shortName: entry.team.shortName ?? null,
        crest: entry.team.crest ?? null,
      },
      playedGames: entry.playedGames,
      won: entry.won,
      draw: entry.draw,
      lost: entry.lost,
      points: entry.points,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDifference: entry.goalDifference,
      form: entry.form ?? null,
    }));

    await this.prisma.standingsCache.upsert({
      where: { competitionCode },
      update: { data: result, cachedAt: new Date() },
      create: { competitionCode, data: result, cachedAt: new Date() },
    });

    return result;
  }
}
