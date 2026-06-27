import { QuestionOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Grid,
  Pagination,
  Segmented,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { configApi, matchesApi, standingsApi } from '../api/client';
import { useUserStore } from '../store/userStore';
import type { GroupStanding, Match, MatchStatus, Outcome, Standing, Team } from '../types';
import { STAGE_ORDER, seasonLabel, stageLabel } from '../utils/matchUtils';

const { Text } = Typography;
const { useBreakpoint } = Grid;

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
  const { t } = useTranslation();
  return (
    <Tag color={STATUS_TAG_COLOR[status] ?? 'default'} style={{ fontSize: 11, margin: 0 }}>
      {t(`matches.status.${status}`, { defaultValue: status.replace('_', ' ') })}
    </Tag>
  );
}

// ─── stage metadata ───────────────────────────────────────────────────────────

function sortedStages(stages: string[]) {
  return [...stages].sort((a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99));
}

// ─── prediction badge ─────────────────────────────────────────────────────────

function predOutcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME_WIN';
  if (home === away) return 'DRAW';
  return 'AWAY_WIN';
}

function PredictionBadge({ p }: { p: Match['predictions'][number] }) {
  const { t } = useTranslation();
  if (p.outcome === null) {
    return (
      <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: 500 }}>
        {p.predictedHome}–{p.predictedAway}
      </Text>
    );
  }
  const correct = predOutcome(p.predictedHome, p.predictedAway) === p.outcome;
  if (p.isExactScore) {
    return (
      <Text style={{ color: '#facc15', fontSize: 12, fontWeight: 500 }}>
        {t('matches.predExact')}
      </Text>
    );
  }
  return (
    <Text style={{ color: correct ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 500 }}>
      {correct ? t('matches.predCorrect') : t('matches.predWrong')}
    </Text>
  );
}

// ─── TBD team helpers ─────────────────────────────────────────────────────────

function isTeamTBD(team: Team): boolean {
  return team.externalId === 0 || team.name === 'TBD';
}

function TeamDisplay({ team, isMobile }: { team: Team; isMobile: boolean }) {
  const { t } = useTranslation();
  if (isTeamTBD(team)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <QuestionOutlined style={{ fontSize: 10, color: '#6b7280' }} />
        </div>
        <Text type="secondary" style={{ fontStyle: 'italic' }}>
          {t('matches.tbd')}
        </Text>
      </div>
    );
  }
  const displayName = isMobile ? (team.shortName ?? team.name) : team.name;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
      {team.crest && (
        <img
          src={team.crest}
          alt=""
          style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
        />
      )}
      <Text strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayName}
      </Text>
    </div>
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
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
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
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              overflow: 'hidden',
            }}
          >
            <TeamDisplay team={match.homeTeam} isMobile={isMobile} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <TeamDisplay team={match.awayTeam} isMobile={isMobile} />
          </div>
        </div>

        {/* Score / Date */}
        <div
          style={{ textAlign: 'center', padding: isMobile ? '0 10px' : '0 24px', flexShrink: 0 }}
        >
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
                {t(`matches.stages.${match.stage}`, { defaultValue: stageLabel(match.stage) })}
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
  const { t } = useTranslation();

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
                  {t(`matches.stages.${stage}`, { defaultValue: stageLabel(stage) })}
                  <Text
                    type="secondary"
                    style={{
                      marginLeft: 8,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      fontWeight: 400,
                    }}
                  >
                    {t('matches.stageMatchCount', { count: byStage.get(stage)?.length ?? 0 })}
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
  advancementLabel,
}: StandingsTableProps) {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const effectiveAdvLabel = advancementLabel ?? t('matches.legendCL');

  const posW = isMobile ? 28 : 36;
  const teamW = isMobile ? 110 : 160;
  const statW = isMobile ? 26 : 36;
  const gdW = isMobile ? 42 : 52;
  const ptsW = isMobile ? 38 : 50;

  const columns: ColumnsType<Standing> = [
    {
      title: '#',
      dataIndex: 'position',
      width: posW,
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
      title: t('matches.colTeam'),
      key: 'team',
      width: teamW,
      render: (_: unknown, row: Standing) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          {row.team.crest && (
            <img
              src={row.team.crest}
              alt=""
              style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <Text style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.team.shortName ?? row.team.name}
          </Text>
        </div>
      ),
    },
    { title: 'P', dataIndex: 'playedGames', width: statW, align: 'center' as const },
    { title: 'W', dataIndex: 'won', width: statW, align: 'center' as const },
    { title: 'D', dataIndex: 'draw', width: statW, align: 'center' as const },
    { title: 'L', dataIndex: 'lost', width: statW, align: 'center' as const },
    {
      title: 'GD',
      dataIndex: 'goalDifference',
      width: gdW,
      align: 'center' as const,
      render: (gd: number) => (
        <Text
          style={{
            color: gd > 0 ? '#4ade80' : gd < 0 ? '#f87171' : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          {gd > 0 ? `+${gd}` : gd}
        </Text>
      ),
    },
    {
      title: 'Pts',
      dataIndex: 'points',
      width: ptsW,
      align: 'center' as const,
      render: (pts: number) => (
        <Text strong style={{ whiteSpace: 'nowrap' }}>
          {pts}
        </Text>
      ),
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
        scroll={{ x: 'max-content' }}
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
            {effectiveAdvLabel}
          </Text>
        </Space>
        {showRelegation && (
          <Space size={6}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#7f1d1d' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('matches.legendRelegation')}
            </Text>
          </Space>
        )}
      </Space>
    </div>
  );
}

function WCGroupsView({ groups }: { groups: GroupStanding[] }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 540px), 1fr))',
        gap: 16,
      }}
    >
      {groups.map((g) => (
        <Card
          key={g.group}
          title={<Text strong>{g.group.replace(/^GROUP_/, `${t('matches.groupPrefix')} `)}</Text>}
          styles={{ body: { padding: '0 0 12px' } }}
          size="small"
        >
          <StandingsTable
            standings={g.table}
            total={g.table.length}
            advancementSpots={WC_ADVANCE}
            showRelegation={false}
            advancementLabel={t('matches.legendWCAdvance')}
          />
        </Card>
      ))}
    </div>
  );
}

// ─── WC knockout bracket view ─────────────────────────────────────────────────

const WC_KNOCKOUT_STAGES = [
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'FINAL',
] as const;
type WCKnockoutStage = (typeof WC_KNOCKOUT_STAGES)[number];

function WCKnockoutView({ userId, backQuery }: { userId?: number; backQuery?: string }) {
  const { t } = useTranslation();
  const [knockoutStage, setKnockoutStage] = useState<WCKnockoutStage>('LAST_32');

  const { data, isLoading, error } = useQuery({
    queryKey: ['matches', 'knockout', 'WC', knockoutStage],
    queryFn: () => matchesApi.getAll(undefined, 'WC', 1, 100, knockoutStage),
    staleTime: 5 * 60 * 1000,
  });

  const matches = data?.data ?? [];

  const stageTabs = WC_KNOCKOUT_STAGES.map((key) => ({
    key,
    label: t(`matches.stages.${key}`, { defaultValue: stageLabel(key) }),
  }));

  return (
    <div>
      <Tabs
        activeKey={knockoutStage}
        onChange={(k) => setKnockoutStage(k as WCKnockoutStage)}
        items={stageTabs}
        size="small"
        style={{ marginBottom: 8 }}
      />

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Spin size="large" />
        </div>
      )}

      {error && (
        <Alert
          title={t('matches.errorMatches')}
          description={t('matches.errorMatchesDesc')}
          type="error"
          showIcon
        />
      )}

      {!isLoading && !error && matches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Text type="secondary">{t('matches.emptyKnockout')}</Text>
        </div>
      )}

      {!isLoading &&
        !error &&
        matches.map((m) => <MatchRow key={m.id} match={m} userId={userId} backQuery={backQuery} />)}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const competition = (COMPETITIONS.find((c) => c.code === searchParams.get('comp'))?.code ??
    'WC') as CompCode;
  const statusFilter = searchParams.get('status') || undefined;
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const [stageFilter, setStageFilter] = useState<string | undefined>();
  const [view, setView] = useState<'matches' | 'table' | 'knockout'>('matches');
  const [limit, setLimit] = useState(10);
  const user = useUserStore((s) => s.user);
  const screens = useBreakpoint();
  const isMobile = screens.md === false;

  const STATUS_SEGMENTS = [
    { label: t('matches.segAll'), value: '' },
    { label: t('matches.segScheduled'), value: 'SCHEDULED,TIMED' },
    { label: t('matches.segLive'), value: 'IN_PLAY,PAUSED' },
    { label: t('matches.segFinished'), value: 'FINISHED' },
  ];

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
    if (statusFilter === 'IN_PLAY,PAUSED') return t('matches.emptyLive');
    if (statusFilter === 'SCHEDULED,TIMED') return t('matches.emptyScheduled');
    if (stageFilter) {
      return t('matches.emptyStage', {
        stage: t(`matches.stages.${stageFilter}`, { defaultValue: stageLabel(stageFilter) }),
      });
    }
    if (!config?.footballApiConfigured) {
      return (
        <>
          {t('matches.emptyApiKeyPre')} <Text code>FOOTBALL_DATA_API_KEY</Text>{' '}
          {t('matches.emptyApiKeyMid')} <Text code>apps/backend/.env</Text>{' '}
          {t('matches.emptyApiKeyPost')}
        </>
      );
    }
    return t('matches.emptyNotFound');
  };

  const competitionTabItems = COMPETITIONS.map((comp) => ({
    key: comp.code,
    label: isMobile ? (
      <Tag color={comp.tagColor} style={{ margin: 0 }}>
        {comp.badge}
      </Tag>
    ) : (
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
          isMobile ? undefined : (
            <Space wrap>
              {competition === 'WC' ? (
                <Segmented
                  options={[
                    { label: t('matches.viewMatches'), value: 'matches' },
                    { label: t('matches.viewTable'), value: 'table' },
                    { label: t('matches.viewKnockout'), value: 'knockout' },
                  ]}
                  value={view}
                  onChange={(v) => setView(v as 'matches' | 'table' | 'knockout')}
                />
              ) : (
                !currentComp.hasStages && (
                  <Segmented
                    options={[
                      { label: t('matches.viewMatches'), value: 'matches' },
                      { label: t('matches.viewTable'), value: 'table' },
                    ]}
                    value={view === 'knockout' ? 'matches' : view}
                    onChange={(v) => setView(v as 'matches' | 'table')}
                  />
                )
              )}
              {view === 'matches' && (
                <Segmented
                  options={STATUS_SEGMENTS}
                  value={statusFilter ?? ''}
                  onChange={(v) => handleStatusFilter(v as string)}
                />
              )}
            </Space>
          )
        }
        renderTabBar={(props, DefaultTabBar) => (
          <DefaultTabBar {...props} style={{ marginBottom: isMobile ? 8 : 16 }} />
        )}
      />

      {/* Mobile view/status controls — rendered below tabs to avoid squeezing the tab bar */}
      {isMobile && (
        <Space wrap style={{ marginBottom: 16 }}>
          {competition === 'WC' ? (
            <Segmented
              options={[
                { label: t('matches.viewMatches'), value: 'matches' },
                { label: t('matches.viewTable'), value: 'table' },
                { label: t('matches.viewKnockout'), value: 'knockout' },
              ]}
              value={view}
              onChange={(v) => setView(v as 'matches' | 'table' | 'knockout')}
            />
          ) : (
            !currentComp.hasStages && (
              <Segmented
                options={[
                  { label: t('matches.viewMatches'), value: 'matches' },
                  { label: t('matches.viewTable'), value: 'table' },
                ]}
                value={view === 'knockout' ? 'matches' : view}
                onChange={(v) => setView(v as 'matches' | 'table')}
              />
            )
          )}
          {view === 'matches' && (
            <Segmented
              options={STATUS_SEGMENTS}
              value={statusFilter ?? ''}
              onChange={(v) => handleStatusFilter(v as string)}
            />
          )}
        </Space>
      )}

      {/* Stage filter chips */}
      {view === 'matches' &&
        isFinishedTab &&
        currentComp.hasStages &&
        availableStages.length > 1 && (
          <Space wrap style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('matches.stageFilter')}
            </Text>
            {availableStages.map((stage) => (
              <Tag
                key={stage}
                color={stageFilter === stage ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setStageFilter(stageFilter === stage ? undefined : stage)}
              >
                {t(`matches.stages.${stage}`, { defaultValue: stageLabel(stage) })}
              </Tag>
            ))}
          </Space>
        )}

      {/* Page title */}
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        {currentComp.label}
      </Typography.Title>

      {/* Knockout bracket view (WC only) */}
      {view === 'knockout' && competition === 'WC' && (
        <WCKnockoutView userId={user?.id} backQuery={backQuery} />
      )}

      {/* Standings view */}
      {view === 'table' && (
        <div>
          {standingsLoading && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Spin size="large" />
            </div>
          )}
          {standingsError && <Alert title={t('matches.errorStandings')} type="error" />}
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
              title={t('matches.errorMatches')}
              description={t('matches.errorMatchesDesc')}
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
                onChange={(p, ps) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    if (p === 1) next.delete('page');
                    else next.set('page', String(p));
                    return next;
                  });
                  setLimit(ps);
                }}
                {...(isMobile
                  ? { simple: true, size: 'small' as const }
                  : {
                      pageSizeOptions: [10, 20, 30],
                      showSizeChanger: true,
                      showTotal: (tot: number) => t('matches.totalMatches', { count: tot }),
                    })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
