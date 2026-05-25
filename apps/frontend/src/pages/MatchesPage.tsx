import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { configApi, matchesApi, standingsApi } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Match, MatchStatus, Outcome, Standing } from '../types';

// ─── competition metadata ─────────────────────────────────────────────────────

const COMPETITIONS = [
  { code: 'CL',  label: 'Champions League', badge: 'UCL',    tabActive: 'bg-blue-700 text-white',   badgeClass: 'bg-blue-900 text-blue-300',   hasStages: true  },
  { code: 'PL',  label: 'Premier League',   badge: 'PL',     tabActive: 'bg-violet-700 text-white', badgeClass: 'bg-violet-900 text-violet-300', hasStages: false },
  { code: 'PD',  label: 'La Liga',          badge: 'LaLiga', tabActive: 'bg-orange-700 text-white', badgeClass: 'bg-orange-900 text-orange-300', hasStages: false },
  { code: 'BL1', label: 'Bundesliga',       badge: 'BL',     tabActive: 'bg-red-700 text-white',    badgeClass: 'bg-red-900 text-red-300',      hasStages: false },
  { code: 'SA',  label: 'Serie A',          badge: 'SA',     tabActive: 'bg-sky-700 text-white',    badgeClass: 'bg-sky-900 text-sky-300',      hasStages: false },
] as const;

type CompCode = typeof COMPETITIONS[number]['code'];

export const COMP_META: Record<string, { label: string; badge: string; badgeClass: string }> = {
  CL:  { label: 'Champions League', badge: 'UCL',    badgeClass: 'bg-blue-900 text-blue-300'   },
  PL:  { label: 'Premier League',   badge: 'PL',     badgeClass: 'bg-violet-900 text-violet-300' },
  PD:  { label: 'La Liga',          badge: 'LaLiga', badgeClass: 'bg-orange-900 text-orange-300' },
  BL1: { label: 'Bundesliga',       badge: 'BL',     badgeClass: 'bg-red-900 text-red-300'     },
  SA:  { label: 'Serie A',          badge: 'SA',     badgeClass: 'bg-sky-900 text-sky-300'     },
};

export function CompBadge({ code }: { code: string }) {
  const meta = COMP_META[code];
  if (!meta) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${meta.badgeClass}`}>
      {meta.badge}
    </span>
  );
}

// ─── status filter tabs ───────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value?: string }[] = [
  { label: 'All' },
  { label: 'Scheduled', value: 'SCHEDULED,TIMED' },
  { label: 'Live',      value: 'IN_PLAY,PAUSED' },
  { label: 'Finished',  value: 'FINISHED' },
];

// ─── stage metadata ───────────────────────────────────────────────────────────

const STAGE_ORDER: Record<string, number> = {
  FINAL:          0,
  SEMI_FINALS:    1,
  QUARTER_FINALS: 2,
  LAST_16:        3,
  PLAYOFFS:       4,
  LEAGUE_STAGE:   5,
};

const STAGE_LABEL: Record<string, string> = {
  FINAL:          'Final',
  SEMI_FINALS:    'Semi Finals',
  QUARTER_FINALS: 'Quarter Finals',
  LAST_16:        'Round of 16',
  PLAYOFFS:       'Play-offs',
  LEAGUE_STAGE:   'League Stage',
  REGULAR_SEASON: 'Regular Season',
};

function stageLabel(stage: string) {
  return STAGE_LABEL[stage] ?? stage.replace(/_/g, ' ');
}

function sortedStages(stages: string[]) {
  return [...stages].sort((a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99));
}

function seasonLabel(season: string) {
  const year = parseInt(season, 10);
  if (isNaN(year)) return season;
  return `${year}/${String(year + 1).slice(-2)}`;
}

// ─── status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  FINISHED:  'bg-gray-700 text-gray-200',
  IN_PLAY:   'bg-green-700 text-green-100 animate-pulse',
  PAUSED:    'bg-yellow-700 text-yellow-100',
  SCHEDULED: 'bg-blue-900 text-blue-200',
  TIMED:     'bg-blue-900 text-blue-200',
  POSTPONED: 'bg-red-800 text-red-200',
  CANCELLED: 'bg-red-950 text-red-300',
};

function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[status] ?? 'bg-gray-700 text-gray-200'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── prediction badge ─────────────────────────────────────────────────────────

function predOutcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME_WIN';
  if (home === away) return 'DRAW';
  return 'AWAY_WIN';
}

function PredictionBadge({ p }: { p: Match['predictions'][number] }) {
  if (p.outcome === null) {
    return <span className="text-xs text-blue-400 font-medium">{p.predictedHome}–{p.predictedAway}</span>;
  }
  const correct = predOutcome(p.predictedHome, p.predictedAway) === p.outcome;
  if (p.isExactScore) return <span className="text-xs text-yellow-400 font-medium">★ Exact</span>;
  return (
    <span className={`text-xs font-medium ${correct ? 'text-green-400' : 'text-red-400'}`}>
      {correct ? '✓ Correct' : '✗ Wrong'}
    </span>
  );
}

// ─── single match row ─────────────────────────────────────────────────────────

const SHOW_SCORE_STATUSES = new Set(['FINISHED', 'IN_PLAY', 'PAUSED']);

function MatchRow({ match, userId }: { match: Match; userId?: number }) {
  const showScore   = SHOW_SCORE_STATUSES.has(match.status);
  const myPrediction = userId != null ? match.predictions.find((p) => p.userId === userId) : null;

  return (
    <Link
      to={`/matches/${match.id}?comp=${match.competitionCode}`}
      className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-600 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {match.homeTeam.crest && (
            <img src={match.homeTeam.crest} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
          )}
          <span className="font-semibold truncate">{match.homeTeam.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {match.awayTeam.crest && (
            <img src={match.awayTeam.crest} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
          )}
          <span className="font-semibold truncate">{match.awayTeam.name}</span>
        </div>
      </div>

      <div className="text-center px-6">
        {showScore ? (
          <span className="text-2xl font-black tabular-nums">
            {match.homeScore ?? 0} – {match.awayScore ?? 0}
          </span>
        ) : (
          <div className="text-gray-400 text-sm leading-tight">
            <div>{new Date(match.matchDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
            <div>{new Date(match.matchDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        )}
      </div>

      <div className="text-right flex-shrink-0 space-y-1">
        <div><StatusBadge status={match.status} /></div>
        {match.stage && match.stage !== 'REGULAR_SEASON' && (
          <div className="text-xs text-gray-500">{stageLabel(match.stage)}</div>
        )}
        {myPrediction && <div><PredictionBadge p={myPrediction} /></div>}
        <div><CompBadge code={match.competitionCode} /></div>
      </div>
    </Link>
  );
}

// ─── grouped match list (UCL only) ───────────────────────────────────────────

function GroupedMatchList({ matches, userId }: { matches: Match[]; userId?: number }) {
  const bySeason = new Map<string, Match[]>();
  for (const m of matches) {
    if (!bySeason.has(m.season)) bySeason.set(m.season, []);
    bySeason.get(m.season)!.push(m);
  }
  const seasons    = [...bySeason.keys()].sort((a, b) => b.localeCompare(a));
  const multiSeason = seasons.length > 1;

  return (
    <div className="space-y-8">
      {seasons.map((season) => {
        const seasonMatches = bySeason.get(season)!;
        const byStage = new Map<string, Match[]>();
        for (const m of seasonMatches) {
          const key = m.stage ?? 'OTHER';
          if (!byStage.has(key)) byStage.set(key, []);
          byStage.get(key)!.push(m);
        }
        const stages = sortedStages([...byStage.keys()]);

        return (
          <div key={season}>
            {multiSeason && (
              <h2 className="text-base font-bold text-white mb-5">{seasonLabel(season)}</h2>
            )}
            <div className="space-y-6">
              {stages.map((stage) => (
                <div key={stage}>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
                    {stageLabel(stage)}
                    <span className="ml-2 text-gray-600 normal-case tracking-normal font-normal">
                      {byStage.get(stage)!.length} matches
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {byStage.get(stage)!.map((m) => <MatchRow key={m.id} match={m} userId={userId} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── standings table ──────────────────────────────────────────────────────────

const CL_SPOTS   = 4;
const RELEGATION = 3;

function StandingsTable({ standings, total }: { standings: Standing[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
            <th className="text-left pb-3 w-8">#</th>
            <th className="text-left pb-3">Team</th>
            <th className="text-center pb-3 w-10">P</th>
            <th className="text-center pb-3 w-10">W</th>
            <th className="text-center pb-3 w-10">D</th>
            <th className="text-center pb-3 w-10">L</th>
            <th className="text-center pb-3 w-12">GD</th>
            <th className="text-center pb-3 w-12 font-bold text-gray-300">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {standings.map((row) => {
            const isTop4      = row.position <= CL_SPOTS;
            const isRelegation = row.position > total - RELEGATION;

            return (
              <tr
                key={row.position}
                className={`transition-colors ${
                  isTop4
                    ? 'bg-green-950/20 hover:bg-green-950/40'
                    : isRelegation
                    ? 'bg-red-950/20 hover:bg-red-950/40'
                    : 'hover:bg-gray-800/40'
                }`}
              >
                <td className="py-2.5 pr-3">
                  <span className={`text-xs font-semibold ${
                    isTop4 ? 'text-green-400' : isRelegation ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {row.position}
                  </span>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    {row.team.crest && (
                      <img src={row.team.crest} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                    )}
                    <span className="font-medium text-white truncate">
                      {row.team.shortName ?? row.team.name}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-center text-gray-400 tabular-nums">{row.playedGames}</td>
                <td className="py-2.5 text-center text-gray-400 tabular-nums">{row.won}</td>
                <td className="py-2.5 text-center text-gray-400 tabular-nums">{row.draw}</td>
                <td className="py-2.5 text-center text-gray-400 tabular-nums">{row.lost}</td>
                <td className="py-2.5 text-center tabular-nums">
                  <span className={row.goalDifference > 0 ? 'text-green-400' : row.goalDifference < 0 ? 'text-red-400' : 'text-gray-400'}>
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </span>
                </td>
                <td className="py-2.5 text-center font-bold text-white tabular-nums">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-800 flex-shrink-0" />
          Champions League
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-900 flex-shrink-0" />
          Relegation
        </span>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const competition = (COMPETITIONS.find(c => c.code === searchParams.get('comp'))?.code ?? 'CL') as CompCode;
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [stageFilter, setStageFilter]   = useState<string | undefined>();
  const [view, setView] = useState<'matches' | 'table'>('matches');
  const { user } = useUser();

  const { data: matches, isLoading, error } = useQuery({
    queryKey: ['matches', competition, statusFilter],
    queryFn: () => matchesApi.getAll(statusFilter, competition),
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: configApi.get,
    staleTime: Infinity,
  });

  const currentComp    = COMPETITIONS.find((c) => c.code === competition)!;

  const { data: standings, isLoading: standingsLoading, error: standingsError } = useQuery({
    queryKey: ['standings', competition],
    queryFn: () => standingsApi.get(competition),
    enabled: view === 'table' && !currentComp.hasStages,
    staleTime: 60 * 60 * 1000,
  });

  const handleCompetition = (code: CompCode) => {
    setSearchParams({ comp: code }, { replace: true });
    setStatusFilter(undefined);
    setStageFilter(undefined);
    setView('matches');
  };

  const handleStatusFilter = (value: string | undefined) => {
    setStatusFilter(value);
    setStageFilter(undefined);
  };

  const isFinishedTab  = statusFilter === 'FINISHED';

  const availableStages = isFinishedTab && currentComp.hasStages && matches
    ? sortedStages([...new Set(matches.map((m) => m.stage ?? 'OTHER'))])
    : [];

  const visibleMatches = stageFilter
    ? matches?.filter((m) => m.stage === stageFilter)
    : matches;

  const emptyMessage = () => {
    if (statusFilter === 'IN_PLAY,PAUSED')   return 'No matches live right now.';
    if (statusFilter === 'SCHEDULED,TIMED')  return 'No upcoming matches scheduled.';
    if (stageFilter) return `No finished matches in the ${stageLabel(stageFilter)} stage.`;
    if (!config?.footballApiConfigured) {
      return (
        <>
          <p className="text-lg mb-2">No matches found.</p>
          <p className="text-sm">
            Set <code className="bg-gray-800 px-1 rounded">FOOTBALL_DATA_API_KEY</code> in{' '}
            <code className="bg-gray-800 px-1 rounded">apps/backend/.env</code> to fetch live data.
          </p>
        </>
      );
    }
    return 'No matches found.';
  };

  return (
    <div>
      {/* Competition tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {COMPETITIONS.map((comp) => (
          <button
            key={comp.code}
            onClick={() => handleCompetition(comp.code)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
              competition === comp.code
                ? comp.tabActive
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
              competition === comp.code ? 'bg-white/20 text-white' : comp.badgeClass
            }`}>
              {comp.badge}
            </span>
            {comp.label}
          </button>
        ))}
      </div>

      {/* Header row: title + view/filter controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">{currentComp.label}</h1>
        <div className="flex gap-2 flex-wrap">
          {/* Table toggle — only for league competitions */}
          {!currentComp.hasStages && (
            <>
              <button
                onClick={() => setView('matches')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  view === 'matches'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Matches
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  view === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Table
              </button>
            </>
          )}

          {/* Status filters — only in matches view */}
          {view === 'matches' && STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => handleStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stage filter chips — only for UCL Finished tab */}
      {view === 'matches' && isFinishedTab && currentComp.hasStages && availableStages.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <span className="text-xs text-gray-500 self-center mr-1">Stage:</span>
          {availableStages.map((stage) => (
            <button
              key={stage}
              onClick={() => setStageFilter(stageFilter === stage ? undefined : stage)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                stageFilter === stage
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {stageLabel(stage)}
            </button>
          ))}
        </div>
      )}

      {/* ── Standings view ── */}
      {view === 'table' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {standingsLoading && (
            <div className="text-center py-16 text-gray-400">Loading standings...</div>
          )}
          {standingsError && (
            <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300">
              Failed to load standings.
            </div>
          )}
          {standings && standings.length > 0 && (
            <StandingsTable standings={standings} total={standings.length} />
          )}
        </div>
      )}

      {/* ── Matches view ── */}
      {view === 'matches' && (
        <>
          {isLoading && <div className="text-center py-16 text-gray-400">Loading matches...</div>}

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300">
              Failed to load matches. Make sure the backend is running on port 3000.
            </div>
          )}

          {!isLoading && !error && visibleMatches?.length === 0 && (
            <div className="text-center py-16 text-gray-400">{emptyMessage()}</div>
          )}

          {visibleMatches && visibleMatches.length > 0 && (
            isFinishedTab && !stageFilter && currentComp.hasStages
              ? <GroupedMatchList matches={visibleMatches} userId={user?.id} />
              : (
                <div className="space-y-3">
                  {visibleMatches.map((m) => <MatchRow key={m.id} match={m} userId={user?.id} />)}
                </div>
              )
          )}
        </>
      )}
    </div>
  );
}
