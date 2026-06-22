import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Pagination,
  Segmented,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { configApi, matchesApi, standingsApi } from '../api/client';
import { useUserStore } from '../store/userStore';
import type { GroupStanding, Match, MatchStatus, Outcome, Standing } from '../types';

const { Text } = Typography;

// ─── competition metadata ─────────────────────────────────────────────────────

const COMPETITIONS = [
  { code: 'WC', label: 'FIFA World Cup', badge: 'WC', tagColor: 'green', hasStages: false },
  { code: 'CL', label: 'Champions League', badge: 'UCL', tagColor: 'blue', hasStages: true },
  { code: 'PL', label: 'Premier League', badge: 'PL', tagColor: 'purple', hasStages: false },
  { code: 'PD', label: 'La Liga', badge: 'LaLiga', tagColor: 'orange', hasStages: false },
  { code: 'BL1', label: 'Bundesliga', badge: 'BL', tagColor: 'red', hasStages: false },
  { code: 'SA', label: 'Serie A', badge: 'SA', tagColor: 'cyan', hasStages: false },
] as const;

type CompCode = (typeof COMPETITIONS)[number]['code'];

export const COMP_META: Record<string, { label: string; badge: string; tagColor: string }> = {
  WC: { label: 'FIFA World Cup', badge: 'WC', tagColor: 'green' },
  CL: { label: 'Champions League', badge: 'UCL', tagColor: 'blue' },
  PL: { label: 'Premier League', badge: 'PL', tagColor: 'purple' },
  PD: { label: 'La Liga', badge: 'LaLiga', tagColor: 'orange' },
  BL1: { label: 'Bundesliga', badge: 'BL', tagColor: 'red' },
  SA: { label: 'Serie A', badge: 'SA', tagColor: 'cyan' },
};

export function CompBadge({ code }: { code: string }) {
  const meta = COMP_META[code];
  if (!meta) return null;
  return (
    <Tag color={meta.tagColor} style={{ margin: 0 }}>
      {meta.badge}
    </Tag>
  );
}

// ─── status badge ─────────────────────────────────────────────────────────────

const STATUS_TAG_COLOR: Record<string, string> = {
  FINISHED: 'default',
  IN_PLAY: 'success',
  PAUSED: 'warning',
  SCHEDULED: 'processing',
  TIMED: 'processing',
  POSTPONED: 'error',
  CANCELLED: 'error',
};

function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <Tag color={STATUS_TAG_COLOR[status] ?? 'default'} style={{ fontSize: 11, margin: 0 }}>
      {status.replace('_', ' ')}
    </Tag>
  );
}

// ─── stage metadata ───────────────────────────────────────────────────────────

const STAGE_ORDER: Record<string, number> = {
  FINAL: 0,
  SEMI_FINALS: 1,
  QUARTER_FINALS: 2,
  LAST_16: 3,
  PLAYOFFS: 4,
  LEAGUE_STAGE: 5,
};

const STAGE_LABEL: Record<string, string> = {
  FINAL: 'Final',
  SEMI_FINALS: 'Semi Finals',
  QUARTER_FINALS: 'Quarter Finals',
  LAST_16: 'Round of 16',
  PLAYOFFS: 'Play-offs',
  LEAGUE_STAGE: 'League Stage',
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
  if (Number.isNaN(year)) return season;
  return `${year}/${String(year + 1).slice(-2)}`;
}

// ─── prediction badge ─────────────────────────────────────────────────────────

function predOutcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME_WIN';
  if (home === away) return 'DRAW';
  return 'AWAY_WIN';
}

function PredictionBadge({ p }: { p: Match['predictions'][number] }) {
  if (p.outcome === null) {
    return (
      <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: 500 }}>
        {p.predictedHome}–{p.predictedAway}
      </Text>
    );
  }
  const correct = predOutcome(p.predictedHome, p.predictedAway) === p.outcome;
  if (p.isExactScore) {
    return <Text style={{ color: '#facc15', fontSize: 12, fontWeight: 500 }}>★ Exact</Text>;
  }
  return (
    <Text style={{ color: correct ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 500 }}>
      {correct ? '✓ Correct' : '✗ Wrong'}
    </Text>
  );
}

// ─── single match card ────────────────────────────────────────────────────────

const SHOW_SCORE_STATUSES = new Set(['FINISHED', 'IN_PLAY', 'PAUSED']);

function MatchRow({
  match,
  userId,
  backQuery,
}: {
  match: Match;
  userId?: number;
  backQuery?: string;
}) {
  const navigate = useNavigate();
  const showScore = SHOW_SCORE_STATUSES.has(match.status);
  const myPrediction = userId != null ? match.predictions.find((p) => p.userId === userId) : null;

  return (
    <Card
      hoverable
      onClick={() =>
        navigate(`/matches/${match.id}?${backQuery ?? `comp=${match.competitionCode}`}`)
      }
      styles={{ body: { padding: '12px 16px' } }}
      style={{ marginBottom: 8, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Teams */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space style={{ marginBottom: 6, display: 'flex' }}>
            {match.homeTeam.crest && (
              <img
                src={match.homeTeam.crest}
                alt=""
                style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <Text
              strong
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {match.homeTeam.name}
            </Text>
          </Space>
          <Space style={{ display: 'flex' }}>
            {match.awayTeam.crest && (
              <img
                src={match.awayTeam.crest}
                alt=""
                style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <Text
              strong
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {match.awayTeam.name}
            </Text>
          </Space>
        </div>

        {/* Score / Date */}
        <div style={{ textAlign: 'center', padding: '0 24px', flexShrink: 0 }}>
          {showScore ? (
            <Text style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
              {match.homeScore ?? 0} – {match.awayScore ?? 0}
            </Text>
          ) : (
            <div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                {new Date(match.matchDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                {new Date(match.matchDate).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </div>
          )}
        </div>

        {/* Status + badges */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <StatusBadge status={match.status} />
          </div>
          {match.stage && match.stage !== 'REGULAR_SEASON' && (
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {stageLabel(match.stage)}
              </Text>
            </div>
          )}
          {myPrediction && (
            <div style={{ marginBottom: 4 }}>
              <PredictionBadge p={myPrediction} />
            </div>
          )}
          <div>
            <CompBadge code={match.competitionCode} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── grouped match list (UCL only) ───────────────────────────────────────────

function GroupedMatchList({
  matches,
  userId,
  backQuery,
}: {
  matches: Match[];
  userId?: number;
  backQuery?: string;
}) {
  const bySeason = new Map<string, Match[]>();
  for (const m of matches) {
    if (!bySeason.has(m.season)) bySeason.set(m.season, []);
    bySeason.get(m.season)?.push(m);
  }
  const seasons = [...bySeason.keys()].sort((a, b) => b.localeCompare(a));
  const multiSeason = seasons.length > 1;

  return (
    <div>
      {seasons.map((season) => {
        const seasonMatches = bySeason.get(season) ?? [];
        const byStage = new Map<string, Match[]>();
        for (const m of seasonMatches) {
          const key = m.stage ?? 'OTHER';
          if (!byStage.has(key)) byStage.set(key, []);
          byStage.get(key)?.push(m);
        }
        const stages = sortedStages([...byStage.keys()]);

        return (
          <div key={season} style={{ marginBottom: 32 }}>
            {multiSeason && (
              <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 20 }}>
                {seasonLabel(season)}
              </Text>
            )}
            {stages.map((stage) => (
              <div key={stage} style={{ marginBottom: 24 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    display: 'block',
                    marginBottom: 12,
                    paddingLeft: 4,
                  }}
                >
                  {stageLabel(stage)}
                  <Text
                    type="secondary"
                    style={{
                      marginLeft: 8,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      fontWeight: 400,
                    }}
                  >
                    {byStage.get(stage)?.length} matches
                  </Text>
                </Text>
                {byStage.get(stage)?.map((m) => (
                  <MatchRow key={m.id} match={m} userId={userId} backQuery={backQuery} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── standings table ──────────────────────────────────────────────────────────

const CL_SPOTS = 4;
const RELEGATION = 3;
const WC_ADVANCE = 2;

function isGroupStandings(data: Standing[] | GroupStanding[]): data is GroupStanding[] {
  return data.length > 0 && 'group' in data[0];
}

function groupLabel(group: string) {
  return group.replace(/^GROUP_/, 'Group ');
}

interface StandingsTableProps {
  standings: Standing[];
  total: number;
  advancementSpots?: number;
  showRelegation?: boolean;
  advancementLabel?: string;
}

function StandingsTable({
  standings,
  total,
  advancementSpots = CL_SPOTS,
  showRelegation = true,
  advancementLabel = 'Champions League',
}: StandingsTableProps) {
  const columns = [
    {
      title: '#',
      dataIndex: 'position',
      width: 40,
      render: (pos: number) => {
        const isAdv = pos <= advancementSpots;
        const isRel = showRelegation && pos > total - RELEGATION;
        return (
          <Text
            style={{
              color: isAdv ? '#4ade80' : isRel ? '#f87171' : '#6b7280',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {pos}
          </Text>
        );
      },
    },
    {
      title: 'Team',
      key: 'team',
      render: (_: unknown, row: Standing) => (
        <Space size={8}>
          {row.team.crest && (
            <img
              src={row.team.crest}
              alt=""
              style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <Text>{row.team.shortName ?? row.team.name}</Text>
        </Space>
      ),
    },
    { title: 'P', dataIndex: 'playedGames', width: 40, align: 'center' as const },
    { title: 'W', dataIndex: 'won', width: 40, align: 'center' as const },
    { title: 'D', dataIndex: 'draw', width: 40, align: 'center' as const },
    { title: 'L', dataIndex: 'lost', width: 40, align: 'center' as const },
    {
      title: 'GD',
      dataIndex: 'goalDifference',
      width: 52,
      align: 'center' as const,
      render: (gd: number) => (
        <Text style={{ color: gd > 0 ? '#4ade80' : gd < 0 ? '#f87171' : undefined }}>
          {gd > 0 ? `+${gd}` : gd}
        </Text>
      ),
    },
    {
      title: 'Pts',
      dataIndex: 'points',
      width: 52,
      align: 'center' as const,
      render: (pts: number) => <Text strong>{pts}</Text>,
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={standings}
        rowKey="position"
        pagination={false}
        size="small"
        onRow={(record) => ({
          style: {
            background:
              record.position <= advancementSpots
                ? 'rgba(0, 100, 0, 0.12)'
                : showRelegation && record.position > total - RELEGATION
                  ? 'rgba(120, 0, 0, 0.12)'
                  : undefined,
          },
        })}
      />
      <Space
        style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Space size={6}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#14532d' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {advancementLabel}
          </Text>
        </Space>
        {showRelegation && (
          <Space size={6}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#7f1d1d' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Relegation
            </Text>
          </Space>
        )}
      </Space>
    </div>
  );
}

function WCGroupsView({ groups }: { groups: GroupStanding[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(540px, 1fr))',
        gap: 16,
      }}
    >
      {groups.map((g) => (
        <Card
          key={g.group}
          title={<Text strong>{groupLabel(g.group)}</Text>}
          styles={{ body: { padding: '0 0 12px' } }}
          size="small"
        >
          <StandingsTable
            standings={g.table}
            total={g.table.length}
            advancementSpots={WC_ADVANCE}
            showRelegation={false}
            advancementLabel="Advance to Round of 32"
          />
        </Card>
      ))}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const STATUS_SEGMENTS = [
  { label: 'All', value: '' },
  { label: 'Scheduled', value: 'SCHEDULED,TIMED' },
  { label: 'Live', value: 'IN_PLAY,PAUSED' },
  { label: 'Finished', value: 'FINISHED' },
];

export default function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const competition = (COMPETITIONS.find((c) => c.code === searchParams.get('comp'))?.code ??
    'WC') as CompCode;
  const statusFilter = searchParams.get('status') || undefined;
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const [stageFilter, setStageFilter] = useState<string | undefined>();
  const [view, setView] = useState<'matches' | 'table'>('matches');
  const [limit, setLimit] = useState(10);
  const user = useUserStore((s) => s.user);

  const {
    data: matchesPage,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matches', competition, statusFilter, page, limit],
    queryFn: () => matchesApi.getAll(statusFilter, competition, page, limit),
  });

  const matches = matchesPage?.data;
  const total = matchesPage?.total ?? 0;

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: configApi.get,
    staleTime: Infinity,
  });

  const currentComp = COMPETITIONS.find((c) => c.code === competition) ?? COMPETITIONS[0];

  const {
    data: standings,
    isLoading: standingsLoading,
    error: standingsError,
  } = useQuery<Standing[] | GroupStanding[]>({
    queryKey: ['standings', competition],
    queryFn: () => standingsApi.get(competition),
    enabled: view === 'table' && !currentComp.hasStages,
    staleTime: 60 * 60 * 1000,
  });

  const backQuery = (() => {
    const p = new URLSearchParams({ comp: competition });
    const status = searchParams.get('status');
    const pg = searchParams.get('page');
    if (status) p.set('status', status);
    if (pg && pg !== '1') p.set('page', pg);
    return p.toString();
  })();

  const handleCompetition = (code: CompCode) => {
    // Omitting status and page from the new params resets them to their defaults
    setSearchParams({ comp: code }, { replace: true });
    setStageFilter(undefined);
    setView('matches');
  };

  const handleStatusFilter = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('status', value);
      else next.delete('status');
      next.delete('page');
      return next;
    });
    setStageFilter(undefined);
  };

  const isFinishedTab = statusFilter === 'FINISHED';

  const availableStages =
    isFinishedTab && currentComp.hasStages && matches
      ? sortedStages([...new Set(matches.map((m) => m.stage ?? 'OTHER'))])
      : [];

  const visibleMatches = stageFilter ? matches?.filter((m) => m.stage === stageFilter) : matches;

  const emptyMessage = () => {
    if (statusFilter === 'IN_PLAY,PAUSED') return 'No matches live right now.';
    if (statusFilter === 'SCHEDULED,TIMED') return 'No upcoming matches scheduled.';
    if (stageFilter) return `No finished matches in the ${stageLabel(stageFilter)} stage.`;
    if (!config?.footballApiConfigured) {
      return (
        <>
          No matches found. Set <Text code>FOOTBALL_DATA_API_KEY</Text> in{' '}
          <Text code>apps/backend/.env</Text> to fetch live data.
        </>
      );
    }
    return 'No matches found.';
  };

  const competitionTabItems = COMPETITIONS.map((comp) => ({
    key: comp.code,
    label: (
      <Space size={6}>
        <Tag color={comp.tagColor} style={{ margin: 0 }}>
          {comp.badge}
        </Tag>
        {comp.label}
      </Space>
    ),
  }));

  return (
    <div>
      {/* Competition Tabs */}
      <Tabs
        activeKey={competition}
        items={competitionTabItems}
        onChange={(key) => handleCompetition(key as CompCode)}
        tabBarExtraContent={
          <Space wrap>
            {!currentComp.hasStages && (
              <Segmented
                options={[
                  { label: 'Matches', value: 'matches' },
                  { label: 'Table', value: 'table' },
                ]}
                value={view}
                onChange={(v) => setView(v as 'matches' | 'table')}
              />
            )}
            {view === 'matches' && (
              <Segmented
                options={STATUS_SEGMENTS}
                value={statusFilter ?? ''}
                onChange={(v) => handleStatusFilter(v as string)}
              />
            )}
          </Space>
        }
        renderTabBar={(props, DefaultTabBar) => (
          <DefaultTabBar {...props} style={{ marginBottom: 16 }} />
        )}
      />

      {/* Stage filter chips */}
      {view === 'matches' &&
        isFinishedTab &&
        currentComp.hasStages &&
        availableStages.length > 1 && (
          <Space wrap style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Stage:
            </Text>
            {availableStages.map((stage) => (
              <Tag
                key={stage}
                color={stageFilter === stage ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setStageFilter(stageFilter === stage ? undefined : stage)}
              >
                {stageLabel(stage)}
              </Tag>
            ))}
          </Space>
        )}

      {/* Page title */}
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        {currentComp.label}
      </Typography.Title>

      {/* Standings view */}
      {view === 'table' && (
        <div>
          {standingsLoading && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Spin size="large" />
            </div>
          )}
          {standingsError && <Alert title="Failed to load standings." type="error" />}
          {standings &&
            standings.length > 0 &&
            (isGroupStandings(standings) ? (
              <WCGroupsView groups={standings} />
            ) : (
              <Card>
                <StandingsTable standings={standings as Standing[]} total={standings.length} />
              </Card>
            ))}
        </div>
      )}

      {/* Matches view */}
      {view === 'matches' && (
        <div>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Spin size="large" />
            </div>
          )}
          {error && (
            <Alert
              title="Failed to load matches."
              description="Make sure the backend is running on port 3000."
              type="error"
              showIcon
            />
          )}
          {!isLoading && !error && visibleMatches?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Text type="secondary">{emptyMessage()}</Text>
            </div>
          )}
          {visibleMatches &&
            visibleMatches.length > 0 &&
            (isFinishedTab && !stageFilter && currentComp.hasStages ? (
              <GroupedMatchList matches={visibleMatches} userId={user?.id} backQuery={backQuery} />
            ) : (
              visibleMatches.map((m) => (
                <MatchRow key={m.id} match={m} userId={user?.id} backQuery={backQuery} />
              ))
            ))}
          {!isLoading && !error && total > 0 && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                current={page}
                pageSize={limit}
                total={total}
                pageSizeOptions={[10, 20, 30]}
                showSizeChanger
                showTotal={(t) => `${t} matches`}
                onChange={(p, ps) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    if (p === 1) next.delete('page');
                    else next.set('page', String(p));
                    return next;
                  });
                  setLimit(ps);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
