import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { predictionsApi } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Outcome, Prediction } from '../types';

const { Text, Title } = Typography;

// ─── helpers ────────────────────────────────────────────────────────────────

function predictedOutcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME_WIN';
  if (home === away) return 'DRAW';
  return 'AWAY_WIN';
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  HOME_WIN: 'Home Win',
  DRAW: 'Draw',
  AWAY_WIN: 'Away Win',
};

function isCorrect(p: Prediction): boolean {
  return p.outcome !== null && predictedOutcome(p.predictedHome, p.predictedAway) === p.outcome;
}

// ─── chart constants ─────────────────────────────────────────────────────────

const PIE_COLORS = ['#22c55e', '#ef4444', '#6b7280'];
const CHART_STYLE = { background: '#fff', border: '1px solid #374151', borderRadius: 8 };

// ─── outcome tag ─────────────────────────────────────────────────────────────

function OutcomeTag({ p }: { p: Prediction }) {
  if (p.outcome === null) return null;
  if (p.isExactScore) return <Tag color="gold">★ Exact</Tag>;
  const correct = isCorrect(p);
  return correct ? <Tag color="success">✓ Correct</Tag> : <Tag color="error">✗ Wrong</Tag>;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const { user } = useUser();
  const qc = useQueryClient();

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions'],
    queryFn: predictionsApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: predictionsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['predictions'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  const resolved = predictions.filter((p) => p.outcome !== null);
  const pending = predictions.filter((p) => p.outcome === null);

  const correctCount = resolved.filter(isCorrect).length;
  const incorrectCount = resolved.length - correctCount;
  const exactCount = resolved.filter((p) => p.isExactScore).length;
  const accuracy =
    resolved.length > 0 ? Math.round((correctCount / resolved.length) * 1000) / 10 : 0;

  // Pie: correct / incorrect / pending
  const pieData = [
    { name: 'Correct', value: correctCount },
    { name: 'Incorrect', value: incorrectCount },
    { name: 'Pending', value: pending.length },
  ].filter((d) => d.value > 0);

  // Bar: by predicted outcome type
  const byPredicted: Record<Outcome, { total: number; correct: number }> = {
    HOME_WIN: { total: 0, correct: 0 },
    DRAW: { total: 0, correct: 0 },
    AWAY_WIN: { total: 0, correct: 0 },
  };
  for (const p of resolved) {
    const po = predictedOutcome(p.predictedHome, p.predictedAway);
    byPredicted[po].total++;
    if (isCorrect(p)) byPredicted[po].correct++;
  }

  const kpis = [
    { label: 'Predictions', value: predictions.length, color: undefined },
    { label: 'Correct', value: correctCount, color: '#4ade80' },
    { label: 'Exact scores', value: exactCount, color: '#facc15' },
    { label: 'Accuracy', value: `${accuracy}%`, color: '#60a5fa' },
  ];

  const predBorderColor = (p: Prediction) => {
    if (p.outcome === null) return undefined;
    return isCorrect(p) ? '#16a34a' : '#dc2626';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <Title level={3} style={{ margin: 0 }}>
        {`${user?.username ?? user?.email}'s Predictions`}
      </Title>

      {/* KPI strip */}
      {predictions.length > 0 && (
        <Row gutter={[16, 16]}>
          {kpis.map((k) => (
            <Col xs={12} sm={6} key={k.label}>
              <Card>
                <Statistic
                  title={k.label}
                  value={k.value}
                  valueStyle={k.color ? { color: k.color } : undefined}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Charts — only when there's something evaluated */}
      {resolved.length > 0 && (
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card title="Results breakdown">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((_e, i) => (
                      <Cell key={_e.name} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {/* Prediction list */}
      <div>
        <Title level={5} style={{ marginBottom: 16 }}>
          All predictions
        </Title>

        {predictions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              No predictions yet.
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Go to a <Link to="/">match</Link> to add your first prediction.
            </Text>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {predictions.map((p) => {
            const matchFinished = p.match?.status === 'FINISHED';
            const po = predictedOutcome(p.predictedHome, p.predictedAway);
            const correct = isCorrect(p);
            const isResolved = p.outcome !== null;
            const borderColor = predBorderColor(p);

            return (
              <Card
                key={p.id}
                styles={{ body: { padding: '16px' } }}
                style={borderColor ? { borderColor } : undefined}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Match info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/matches/${p.matchId}`}
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.match?.homeTeam.name} vs {p.match?.awayTeam.name}
                    </Link>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {p.match?.status} ·{' '}
                      {new Date(p.match?.matchDate ?? '').toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </div>

                  {/* Predicted score */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        display: 'block',
                      }}
                    >
                      {p.predictedHome} – {p.predictedAway}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {OUTCOME_LABEL[po]}
                    </Text>
                  </div>

                  {/* Actual result */}
                  {matchFinished && p.match && (
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          display: 'block',
                        }}
                      >
                        {p.match.homeScore} – {p.match.awayScore}
                      </Text>
                      {isResolved ? (
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: p.isExactScore ? '#facc15' : correct ? '#4ade80' : '#f87171',
                          }}
                        >
                          {p.isExactScore ? '★ Exact' : correct ? '✓ Correct' : '✗ Wrong'}
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Pending
                        </Text>
                      )}
                    </div>
                  )}

                  <Space>
                    <OutcomeTag p={p} />
                    {!matchFinished && (
                      <Button
                        danger
                        size="small"
                        type="text"
                        onClick={() => deleteMutation.mutate(p.id)}
                        loading={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    )}
                  </Space>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
