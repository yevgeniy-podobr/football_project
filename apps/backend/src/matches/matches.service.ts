import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_TTL_MS     = 5 * 60 * 1000;

const COMPETITIONS = [
  { code: 'CL',  name: 'UEFA Champions League' },
  { code: 'PL',  name: 'Premier League' },
  { code: 'PD',  name: 'La Liga' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'SA',  name: 'Serie A' },
  { code: 'WC',  name: 'FIFA World Cup' },
] as const;

type CompCode = typeof COMPETITIONS[number]['code'];

// football-data.org /competitions/:code/matches response shapes
interface ApiTeam {
  id: number;
  name: string;
  shortName: string | null;
  crest: string | null;
}

interface ApiGoal {
  minute: number;
  injuryTime: number | null;
  type: string;
  team: { id: number; name: string };
  scorer: { id: number; name: string };
  assist: { id: number; name: string } | null;
}

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string | null;
  group: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
    winner: string | null;
  };
  goals: ApiGoal[];
  season: { startDate: string };
}

interface ApiMatchesResponse {
  competition: { name: string } | null;
  matches: ApiMatch[];
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private async syncCompetition(
    apiKey: string,
    code: CompCode,
    now: Date,
  ): Promise<number> {
    const { data } = await axios.get<ApiMatchesResponse>(
      `https://api.football-data.org/v4/competitions/${code}/matches`,
      { headers: { 'X-Auth-Token': apiKey }, params: { limit: 100 } },
    );

    const rawMatches = (data.matches ?? []).filter(
      (m) => m.homeTeam?.id != null && m.awayTeam?.id != null,
    );

    // Deduplicate teams
    const teamMap = new Map<number, { externalId: number; name: string; shortName: string | null; crest: string | null }>();
    for (const m of rawMatches) {
      for (const side of [m.homeTeam, m.awayTeam]) {
        if (!teamMap.has(side.id)) {
          teamMap.set(side.id, {
            externalId: side.id,
            name: side.name ?? 'Unknown',
            shortName: side.shortName ?? null,
            crest: side.crest ?? null,
          });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert teams
      const idMap = new Map<number, number>();
      for (const team of teamMap.values()) {
        const rec = await tx.team.upsert({
          where:  { externalId: team.externalId },
          update: { name: team.name, shortName: team.shortName, crest: team.crest },
          create: team,
        });
        idMap.set(team.externalId, rec.id);
      }

      // 2. Upsert matches
      for (const m of rawMatches) {
        const homeTeamId = idMap.get(m.homeTeam.id)!;
        const awayTeamId = idMap.get(m.awayTeam.id)!;
        // goals is stored as a Prisma Json field; cast is required because TypeScript
        // cannot automatically prove ApiGoal[] satisfies Prisma's InputJsonValue index type
        const goalsJson = (m.goals ?? []) as unknown as Prisma.InputJsonValue;

        await tx.match.upsert({
          where:  { externalId: m.id },
          update: {
            status:       m.status,
            homeScore:    m.score?.fullTime?.home ?? null,
            awayScore:    m.score?.fullTime?.away ?? null,
            halfTimeHome: m.score?.halfTime?.home ?? null,
            halfTimeAway: m.score?.halfTime?.away ?? null,
            winner:       m.score?.winner ?? null,
            goals:        goalsJson,
            cachedAt:     now,
          },
          create: {
            externalId:      m.id,
            homeTeamId,
            awayTeamId,
            matchDate:       new Date(m.utcDate),
            status:          m.status,
            stage:           m.stage ?? null,
            group:           m.group ?? null,
            homeScore:       m.score?.fullTime?.home ?? null,
            awayScore:       m.score?.fullTime?.away ?? null,
            halfTimeHome:    m.score?.halfTime?.home ?? null,
            halfTimeAway:    m.score?.halfTime?.away ?? null,
            winner:          m.score?.winner ?? null,
            goals:           goalsJson,
            competition:     data.competition?.name ?? code,
            competitionCode: code,
            season:          String(m.season?.startDate?.split('-')[0] ?? '2024'),
            cachedAt:        now,
          },
        });
      }
    });

    return rawMatches.length;
  }

  async fetchAndSync(force = false): Promise<{ synced: boolean; count?: number; reason?: string }> {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) return { synced: false, reason: 'No API key configured' };

    if (!force) {
      const lastSync = await this.prisma.match.findFirst({ orderBy: { cachedAt: 'desc' } });
      if (lastSync) {
        const ageMs = Date.now() - new Date(lastSync.cachedAt).getTime();
        if (ageMs < SYNC_INTERVAL_MS) return { synced: false, reason: 'Cache is fresh' };
      }
    }

    const now = new Date();
    let totalCount = 0;

    for (const comp of COMPETITIONS) {
      try {
        const n = await this.syncCompetition(apiKey, comp.code, now);
        totalCount += n;
      } catch (err: unknown) {
        console.error(`Sync failed for ${comp.code}:`, err instanceof Error ? err.message : String(err));
      }
    }

    await this.cache.reset();
    return { synced: true, count: totalCount };
  }

  async findAll(status?: string, competition?: string) {
    const statuses = status ? status.split(',').map((s) => s.trim()) : null;
    const cacheKey = `matches:${competition ?? 'all'}:${statuses?.sort().join(',') ?? 'all'}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    await this.fetchAndSync().catch((err) =>
      console.error('Background sync failed:', err.message),
    );

    const matches = await this.prisma.match.findMany({
      where: {
        ...(statuses    ? { status: { in: statuses } } : {}),
        ...(competition ? { competitionCode: competition } : {}),
      },
      orderBy: { matchDate: 'desc' },
      include: { homeTeam: true, awayTeam: true, predictions: true },
    });

    await this.cache.set(cacheKey, matches, CACHE_TTL_MS);
    return matches;
  }

  async findOne(id: number) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { homeTeam: true, awayTeam: true, predictions: true },
    });
    if (!match) throw new NotFoundException(`Match #${id} not found`);
    return match;
  }

  async findUpcoming() {
    return this.prisma.match.findMany({
      where: { status: { in: ['SCHEDULED', 'TIMED'] } },
      orderBy: { matchDate: 'desc' },
      take: 5,
      include: { homeTeam: true, awayTeam: true },
    });
  }

  async findRecent() {
    return this.prisma.match.findMany({
      where: { status: 'FINISHED' },
      orderBy: { matchDate: 'desc' },
      take: 10,
      include: { homeTeam: true, awayTeam: true, predictions: true },
    });
  }

  async findByTeams(homeId: number, awayId: number) {
    return this.prisma.match.findMany({
      where: {
        OR: [
          { homeTeamId: homeId, awayTeamId: awayId },
          { homeTeamId: awayId, awayTeamId: homeId },
        ],
      },
      orderBy: { matchDate: 'desc' },
      include: { homeTeam: true, awayTeam: true },
    });
  }
}
