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
  if (role === 'ADMIN') return <Tag color="orange">Admin</Tag>;
  return <Text type="secondary">User</Text>;
}

function OutcomeBadge({ p }: { p: AdminUserDetail['predictions'][number] }) {
  if (p.isExactScore) return <Tag color="gold">Exact</Tag>;
  if (p.outcome !== null) {
    const predicted = predictedOutcome(p.predictedHome, p.predictedAway);
    const correct = predicted === p.outcome;
    return correct ? <Tag color="blue">Correct</Tag> : <Tag color="error">Wrong</Tag>;
  }
  return <Tag>Pending</Tag>;
}

// ─── user detail panel ────────────────────────────────────────────────────────

function UserDetailPanel({ userId }: { userId: number }) {
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
        Failed to load user.
      </Text>
    );
  }

  const statItems = data.stats
    ? [
        { label: 'Total', value: data.stats.total, color: undefined },
        { label: 'Correct', value: data.stats.correct, color: '#4ade80' },
        { label: 'Exact', value: data.stats.exactScores, color: '#facc15' },
        { label: 'Accuracy', value: `${data.stats.accuracy}%`, color: '#60a5fa' },
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
          Registered {fmtDate(data.createdAt)}
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
          No prediction stats yet.
        </Text>
      )}

      {/* Predictions list */}
      {data.predictions.length === 0 ? (
        <Text type="secondary">No predictions yet.</Text>
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
                      actual
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
  const columns: ColumnsType<AdminUserRow> = [
    {
      title: 'User',
      key: 'user',
      render: (_, u) => (
        <Text strong>
          {u.username ?? (
            <Text type="secondary" style={{ fontStyle: 'italic' }}>
              no username
            </Text>
          )}
        </Text>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      responsive: ['sm'],
      render: (email: string) => <Text type="secondary">{email}</Text>,
    },
    {
      title: 'Role',
      key: 'role',
      align: 'center',
      render: (_, u) => <RoleBadge role={u.role} />,
    },
    {
      title: 'Predictions',
      dataIndex: 'predictionCount',
      align: 'center',
    },
    {
      title: 'Accuracy',
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
      title: 'Registered',
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
    : 'Never';

  return (
    <div
      style={{ maxWidth: 896, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}
    >
      <Title level={3} style={{ margin: 0 }}>
        Admin Panel
      </Title>

      {/* Database Overview */}
      <section>
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
          Database Overview
        </Text>
        {statsLoading ? (
          <Spin />
        ) : (
          <Row gutter={[16, 16]}>
            {[
              { label: 'Users', value: stats?.users ?? 0 },
              { label: 'Predictions', value: stats?.predictions ?? 0 },
              { label: 'Matches', value: stats?.matches ?? 0 },
              { label: 'Last Sync', value: lastSync },
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
          Actions
        </Text>

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
                  Resolve All Predictions
                </Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Score all pending predictions for finished matches and update user stats. The cron
                  job does this automatically every 5 minutes.
                </Text>
              </div>
              <Button
                type="primary"
                onClick={() => resolveMutation.mutate()}
                loading={resolveMutation.isPending}
                style={{ flexShrink: 0 }}
              >
                Resolve All
              </Button>
            </div>
            {resolveMutation.isSuccess && resolveMutation.data.type === 'resolve' && (
              <Alert
                style={{ marginTop: 16 }}
                type="success"
                message={
                  resolveMutation.data.resolved === 0
                    ? 'Nothing to resolve — all predictions are up to date.'
                    : `Resolved ${resolveMutation.data.resolved} prediction(s) for ${resolveMutation.data.affectedUsers.length} user(s).`
                }
              />
            )}
            {resolveMutation.isError && (
              <Alert
                style={{ marginTop: 16 }}
                type="error"
                message="Failed to resolve predictions."
              />
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
                  Force Sync Matches
                </Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Immediately fetch the latest match data from football-data.org, bypassing the
                  5-minute cache. Use sparingly — the API is rate-limited to 10 req/min.
                </Text>
              </div>
              <Button
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
                style={{ flexShrink: 0 }}
              >
                Force Sync
              </Button>
            </div>
            {syncMutation.isSuccess && syncMutation.data.type === 'sync' && (
              <Alert
                style={{ marginTop: 16 }}
                type="success"
                message={
                  syncMutation.data.synced
                    ? `Synced ${syncMutation.data.count ?? 0} match(es) from the API.`
                    : `Sync skipped: ${syncMutation.data.reason ?? 'cache is fresh'}.`
                }
              />
            )}
            {syncMutation.isError && (
              <Alert style={{ marginTop: 16 }} type="error" message="Failed to sync matches." />
            )}
          </Card>
        </div>
      </section>

      {/* Users */}
      <section>
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
          Users
        </Text>
        {usersLoading ? (
          <Spin />
        ) : !users?.length ? (
          <Text type="secondary">No users found.</Text>
        ) : (
          <UsersTable users={users} selectedId={selectedUserId} onSelect={handleUserSelect} />
        )}
      </section>
    </div>
  );
}
