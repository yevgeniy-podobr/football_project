import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

const COMPETITIONS = [
  { code: 'CL', name: 'UEFA Champions League' },
  { code: 'PL', name: 'Premier League' },
  { code: 'PD', name: 'La Liga' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'SA', name: 'Serie A' },
  { code: 'WC', name: 'FIFA World Cup' },
] as const;

type CompCode = (typeof COMPETITIONS)[number]['code'];

// football-data.org /competitions/:code/matches response shapes
interface ApiTeam {
  id: number | null;
  name: string;
  shortName: string | null;
  crest: string | null;
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

  // externalId=0 is reserved as the TBD placeholder team (no real football-data.org team has id 0)
  private static readonly TBD_EXTERNAL_ID = 0;

  private async syncCompetition(apiKey: string, code: CompCode, now: Date): Promise<number> {
    const { data } = await axios.get<ApiMatchesResponse>(
      `https://api.football-data.org/v4/competitions/${code}/matches`,
      { headers: { 'X-Auth-Token': apiKey }, params: { limit: 100 } },
    );

    const rawMatches = data.matches ?? [];

    // Deduplicate teams with known IDs
    const teamMap = new Map<
      number,
      { externalId: number; name: string; shortName: string | null; crest: string | null }
    >();
    for (const m of rawMatches) {
      for (const side of [m.homeTeam, m.awayTeam]) {
        if (side.id != null && !teamMap.has(side.id)) {
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
      // 1. Upsert known teams
      const idMap = new Map<number, number>();
      for (const team of teamMap.values()) {
        const rec = await tx.team.upsert({
          where: { externalId: team.externalId },
          update: { name: team.name, shortName: team.shortName, crest: team.crest },
          create: team,
        });
        idMap.set(team.externalId, rec.id);
      }

      // 2. Ensure TBD placeholder team exists for matches where teams aren't determined yet
      const tbdTeam = await tx.team.upsert({
        where: { externalId: MatchesService.TBD_EXTERNAL_ID },
        update: {},
        create: {
          externalId: MatchesService.TBD_EXTERNAL_ID,
          name: 'TBD',
          shortName: 'TBD',
          crest: null,
        },
      });

      // 3. Upsert all matches (including knockout slots with undetermined teams)
      for (const m of rawMatches) {
        const homeTeamId = m.homeTeam.id != null ? idMap.get(m.homeTeam.id) : tbdTeam.id;
        const awayTeamId = m.awayTeam.id != null ? idMap.get(m.awayTeam.id) : tbdTeam.id;
        if (!homeTeamId || !awayTeamId) continue;

        await tx.match.upsert({
          where: { externalId: m.id },
          update: {
            homeTeamId,
            awayTeamId,
            status: m.status,
            homeScore: m.score?.fullTime?.home ?? null,
            awayScore: m.score?.fullTime?.away ?? null,
            halfTimeHome: m.score?.halfTime?.home ?? null,
            halfTimeAway: m.score?.halfTime?.away ?? null,
            winner: m.score?.winner ?? null,
            cachedAt: now,
          },
          create: {
            externalId: m.id,
            homeTeamId,
            awayTeamId,
            matchDate: new Date(m.utcDate),
            status: m.status,
            stage: m.stage ?? null,
            group: m.group ?? null,
            homeScore: m.score?.fullTime?.home ?? null,
            awayScore: m.score?.fullTime?.away ?? null,
            halfTimeHome: m.score?.halfTime?.home ?? null,
            halfTimeAway: m.score?.halfTime?.away ?? null,
            winner: m.score?.winner ?? null,
            competition: data.competition?.name ?? code,
            competitionCode: code,
            season: String(m.season?.startDate?.split('-')[0] ?? '2024'),
            cachedAt: now,
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
        console.error(
          `Sync failed for ${comp.code}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // reset() would flush the whole Redis DB (including standings:* keys) — clear only match query keys
    const staleKeys = await this.cache.store.keys('matches:*');
    await Promise.all(staleKeys.map((key) => this.cache.del(key)));
    return { synced: true, count: totalCount };
  }

  async findAll(status?: string, competition?: string, page = 1, limit = 10, stage?: string) {
    const statuses = status ? status.split(',').map((s) => s.trim()) : null;
    const cacheKey = `matches:${competition ?? 'all'}:${statuses?.sort().join(',') ?? 'all'}:${stage ?? 'all'}:${page}:${limit}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    await this.fetchAndSync().catch((err) => console.error('Background sync failed:', err.message));

    const where = {
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(competition ? { competitionCode: competition } : {}),
      // Stage filter is set for the Knockout view — include all matches there (TBD teams visible).
      // Without a stage filter (regular Matches view) exclude any slot where either team is still
      // undetermined so that pagination totals are accurate and no partially-known fixtures appear.
      ...(stage
        ? { stage }
        : { homeTeam: { externalId: { not: 0 } }, awayTeam: { externalId: { not: 0 } } }),
    };

    const [total, data] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        // Stage-filtered queries (knockout view) show upcoming matches first; others most-recent first
        orderBy: { matchDate: stage ? 'asc' : 'desc' },
        include: { homeTeam: true, awayTeam: true, predictions: true },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const result = { data, total, page, limit };
    await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  async findOne(id: number) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { homeTeam: true, awayTeam: true, predictions: true },
    });
    if (!match) throw new NotFoundException(`Match #${id} not found`);
    return match;
  }
}
