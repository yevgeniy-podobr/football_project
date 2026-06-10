import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED = new Set(['PL', 'PD', 'BL1', 'SA', 'WC']);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// football-data.org /competitions/:code/standings response shapes
interface ApiStandingEntry {
  position: number;
  team: { id: number; name: string; shortName: string | null; crest: string | null };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

interface ApiStandingGroup {
  stage: string;
  type: string;
  group: string | null;
  table: ApiStandingEntry[];
}

interface ApiStandingsResponse {
  standings: ApiStandingGroup[];
}

// Shapes stored in and returned from StandingsCache
export interface StandingRow {
  position: number;
  team: { id: number; name: string; shortName: string | null; crest: string | null };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

export interface GroupStandingRow {
  group: string;
  table: StandingRow[];
}

type CachedStandings = StandingRow[] | GroupStandingRow[];

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStandings(competitionCode: string) {
    if (!ALLOWED.has(competitionCode)) {
      throw new BadRequestException(`Standings not available for ${competitionCode}`);
    }

    const cached = await this.prisma.standingsCache.findUnique({
      where: { competitionCode },
    });

    // Prisma returns Json as JsonValue; we know the stored shape is CachedStandings
    const cachedData = cached?.data as unknown as CachedStandings | undefined;
    const cacheValid =
      cached &&
      Date.now() - new Date(cached.cachedAt).getTime() < ONE_DAY_MS &&
      Array.isArray(cachedData) &&
      cachedData.length > 0 &&
      // WC stores [{group, table}] — reject old flat [{position,...}] cache entries
      (competitionCode !== 'WC' || ('group' in cachedData[0] && 'table' in cachedData[0]));
    if (cacheValid) {
      // biome-ignore lint/style/noNonNullAssertion: Array.isArray + length>0 check above guarantees non-null
      return cachedData!;
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) throw new BadRequestException('Football API key not configured');

    const { data } = await axios.get<ApiStandingsResponse>(
      `https://api.football-data.org/v4/competitions/${competitionCode}/standings`,
      { headers: { 'X-Auth-Token': apiKey } },
    );

    const allGroups = (data.standings ?? []).filter((s) => s.type === 'TOTAL');

    const mapEntry = (entry: ApiStandingEntry): StandingRow => ({
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
    });

    console.log(`[StandingsService] ${competitionCode}: API returned ${allGroups.length} group(s)`);

    // Multi-group competitions (WC): return GroupStandingRow[]
    // Single-table competitions (leagues): return StandingRow[]
    const result: CachedStandings =
      allGroups.length > 1
        ? [...allGroups]
            .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? ''))
            // biome-ignore lint/style/noNonNullAssertion: filtered to TOTAL type groups which always have group set
            .map((g) => ({ group: g.group!, table: g.table.map(mapEntry) }))
        : (allGroups[0]?.table ?? []).map(mapEntry);

    console.log(`[StandingsService] ${competitionCode}: saving ${result.length} entries to cache`);

    // CachedStandings is a valid JSON structure; cast required because TypeScript cannot
    // automatically prove named-property interfaces satisfy Prisma's InputJsonValue index type
    const resultJson = result as unknown as Prisma.InputJsonValue;

    await this.prisma.standingsCache.upsert({
      where: { competitionCode },
      update: { data: resultJson, cachedAt: new Date() },
      create: { competitionCode, data: resultJson, cachedAt: new Date() },
    });

    return result;
  }
}
