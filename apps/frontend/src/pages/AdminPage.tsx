import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, matchesApi, predictionsApi } from '../api/client';
import type { AdminUserDetail, AdminUserRow, Outcome } from '../types';
import { CompBadge } from './MatchesPage';

const { Text, Title } = Typography;

// ─── helpers ──────────────────────────────────────────────────────────────────

function predictedOutcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME_WIN';
  if (home === away) return 'DRAW';
  return 'AWAY_WIN';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── small shared components ──────────────────────────────────────────────────

function RoleBadge({ role }: { role: AdminUserRow['role'] }) {
  const { t } = useTranslation();
  if (role === 'ADMIN') return <Tag color="orange">{t('admin.roleAdmin')}</Tag>;
  return <Text type="secondary">{t('admin.roleUser')}</Text>;
}

function OutcomeBadge({ p }: { p: AdminUserDetail['predictions'][number] }) {
  const { t } = useTranslation();
  if (p.isExactScore) return <Tag color="gold">{t('admin.badgeExact')}</Tag>;
  if (p.outcome !== null) {
    const predicted = predictedOutcome(p.predictedHome, p.predictedAway);
    const correct = predicted === p.outcome;
    return correct ? (
      <Tag color="blue">{t('admin.badgeCorrect')}</Tag>
    ) : (
      <Tag color="error">{t('admin.badgeWrong')}</Tag>
    );
  }
  return <Tag>{t('admin.badgePending')}</Tag>;
}

// ─── user detail panel ────────────────────────────────────────────────────────

function UserDetailPanel({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => adminApi.getUserDetail(userId),
  });

  if (isLoading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Text type="danger" style={{ display: 'block', padding: '16px 0' }}>
        {t('admin.loadUserFailed')}
      </Text>
    );
  }

  const statItems = data.stats
    ? [
        { label: t('admin.statTotal'), value: data.stats.total, color: undefined },
        { label: t('admin.statCorrect'), value: data.stats.correct, color: '#4ade80' },
        { label: t('admin.statExact'), value: data.stats.exactScores, color: '#facc15' },
        { label: t('admin.statAccuracy'), value: `${data.stats.accuracy}%`, color: '#60a5fa' },
      ]
    : [];

  return (
    <div style={{ paddingTop: 16 }}>
      {/* User info */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Text strong>{data.username ?? '—'}</Text>
        <Text type="secondary">{data.email}</Text>
        <RoleBadge role={data.role} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('admin.registeredOn', { date: fmtDate(data.createdAt) })}
        </Text>
      </Space>

      {/* Stats KPIs */}
      {data.stats ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {statItems.map((k) => (
            <Col xs={12} sm={6} key={k.label}>
              <Card size="small">
                <Statistic
                  title={k.label}
                  value={k.value}
                  valueStyle={k.color ? { color: k.color, fontSize: 20 } : { fontSize: 20 }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {t('admin.noStats')}
        </Text>
      )}

      {/* Predictions list */}
      {data.predictions.length === 0 ? (
        <Text type="secondary">{t('admin.noPredictions')}</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.predictions.map((p) => {
            const matchFinished = p.match.status === 'FINISHED';
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  flexWrap: 'wrap',
                }}
              >
                <CompBadge code={p.match.competitionCode} />
                <Text
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.match.homeTeam.shortName ?? p.match.homeTeam.name}
                  <Text type="secondary"> vs </Text>
                  {p.match.awayTeam.shortName ?? p.match.awayTeam.name}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                  {fmtDate(p.match.matchDate)}
                </Text>
                <Text
                  style={{
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#93c5fd',
                    flexShrink: 0,
                  }}
                >
                  {p.predictedHome}–{p.predictedAway}
                </Text>
                {matchFinished && (
                  <Text
                    style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                  >
                    <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>
                      {t('admin.actualScore')}
                    </Text>
                    {p.match.homeScore}–{p.match.awayScore}
                  </Text>
                )}
                <OutcomeBadge p={p} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── users table ─────────────────────────────────────────────────────────────

function UsersTable({
  users,
  selectedId,
  onSelect,
}: {
  users: AdminUserRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();

  const columns: ColumnsType<AdminUserRow> = [
    {
      title: t('admin.colUser'),
      key: 'user',
      render: (_, u) => (
        <Text strong>
          {u.username ?? (
            <Text type="secondary" style={{ fontStyle: 'italic' }}>
              {t('admin.noUsername')}
            </Text>
          )}
        </Text>
      ),
    },
    {
      title: t('admin.colEmail'),
      dataIndex: 'email',
      responsive: ['sm'],
      render: (email: string) => <Text type="secondary">{email}</Text>,
    },
    {
      title: t('admin.colRole'),
      key: 'role',
      align: 'center',
      render: (_, u) => <RoleBadge role={u.role} />,
    },
    {
      title: t('admin.colPredictions'),
      dataIndex: 'predictionCount',
      align: 'center',
    },
    {
      title: t('admin.colAccuracy'),
      key: 'accuracy',
      align: 'center',
      render: (_, u) =>
        u.accuracy !== null ? (
          <Text style={{ color: '#60a5fa', fontWeight: 500 }}>{u.accuracy}%</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t('admin.colRegistered'),
      dataIndex: 'createdAt',
      responsive: ['md'],
      render: (date: string) => <Text type="secondary">{fmtDate(date)}</Text>,
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={users}
      rowKey="id"
      pagination={false}
      expandable={{
        expandedRowRender: (u) => <UserDetailPanel userId={u.id} />,
        expandedRowKeys: selectedId ? [selectedId] : [],
        onExpand: (expanded, record) => onSelect(expanded ? record.id : -1),
        expandRowByClick: true,
      }}
    />
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

type ActionResult =
  | { type: 'resolve'; resolved: number; affectedUsers: number[] }
  | { type: 'sync'; synced: boolean; count?: number; reason?: string };

export default function AdminPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminApi.getStats,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  });

  const resolveMutation = useMutation<ActionResult>({
    mutationFn: async () => {
      const data = await predictionsApi.resolveAll();
      return { type: 'resolve', ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-user'] });
    },
  });

  const syncMutation = useMutation<ActionResult>({
    mutationFn: async () => {
      const data = await matchesApi.sync(true);
      return { type: 'sync', ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-stats'] }),
  });

  const handleUserSelect = (id: number) => {
    setSelectedUserId((prev) => (prev === id ? null : id));
  };

  const lastSync = stats?.lastSyncAt
    ? new Date(stats.lastSyncAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('admin.neverSynced');

  const sectionLabel = (text: string) => (
    <Text
      type="secondary"
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        display: 'block',
        marginBottom: 16,
      }}
    >
      {text}
    </Text>
  );

  return (
    <div
      style={{ maxWidth: 896, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}
    >
      <Title level={3} style={{ margin: 0 }}>
        {t('admin.title')}
      </Title>

      {/* Database Overview */}
      <section>
        {sectionLabel(t('admin.sectionOverview'))}
        {statsLoading ? (
          <Spin />
        ) : (
          <Row gutter={[16, 16]}>
            {[
              { label: t('admin.statUsers'), value: stats?.users ?? 0 },
              { label: t('admin.statPredictions'), value: stats?.predictions ?? 0 },
              { label: t('admin.statMatches'), value: stats?.matches ?? 0 },
              { label: t('admin.statLastSync'), value: lastSync },
            ].map((s) => (
              <Col xs={12} sm={6} key={s.label}>
                <Card>
                  <Statistic title={s.label} value={s.value} />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </section>

      {/* Actions */}
      <section>
        {sectionLabel(t('admin.sectionActions'))}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Resolve All */}
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  {t('admin.resolveTitle')}
                </Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('admin.resolveDesc')}
                </Text>
              </div>
              <Button
                type="primary"
                onClick={() => resolveMutation.mutate()}
                loading={resolveMutation.isPending}
                style={{ flexShrink: 0 }}
              >
                {t('admin.resolveBtn')}
              </Button>
            </div>
            {resolveMutation.isSuccess && resolveMutation.data.type === 'resolve' && (
              <Alert
                style={{ marginTop: 16 }}
                type="success"
                message={
                  resolveMutation.data.resolved === 0
                    ? t('admin.resolveNone')
                    : t('admin.resolveSuccess', {
                        predictions: resolveMutation.data.resolved,
                        users: resolveMutation.data.affectedUsers.length,
                      })
                }
              />
            )}
            {resolveMutation.isError && (
              <Alert style={{ marginTop: 16 }} type="error" message={t('admin.resolveFailed')} />
            )}
          </Card>

          {/* Force Sync */}
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  {t('admin.syncTitle')}
                </Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('admin.syncDesc')}
                </Text>
              </div>
              <Button
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
                style={{ flexShrink: 0 }}
              >
                {t('admin.syncBtn')}
              </Button>
            </div>
            {syncMutation.isSuccess && syncMutation.data.type === 'sync' && (
              <Alert
                style={{ marginTop: 16 }}
                type="success"
                message={
                  syncMutation.data.synced
                    ? t('admin.syncedCount', { count: syncMutation.data.count ?? 0 })
                    : t('admin.syncSkipped', {
                        reason: syncMutation.data.reason ?? t('admin.cacheFresh'),
                      })
                }
              />
            )}
            {syncMutation.isError && (
              <Alert style={{ marginTop: 16 }} type="error" message={t('admin.syncFailed')} />
            )}
          </Card>
        </div>
      </section>

      {/* Users */}
      <section>
        {sectionLabel(t('admin.sectionUsers'))}
        {usersLoading ? (
          <Spin />
        ) : !users?.length ? (
          <Text type="secondary">{t('admin.noUsersFound')}</Text>
        ) : (
          <UsersTable users={users} selectedId={selectedUserId} onSelect={handleUserSelect} />
        )}
      </section>
    </div>
  );
}
