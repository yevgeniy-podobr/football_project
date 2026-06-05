import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button, Card, Form, InputNumber, Space, Spin, Tag, Typography, Alert,
} from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { matchesApi, predictionsApi } from '../api/client';
import { useUser } from '../context/UserContext';
import { CompBadge } from './MatchesPage';
import type { Goal } from '../types';

const { Text, Title } = Typography;

// ─── helpers ──────────────────────────────────────────────────────────────────

type DisplayOutcome = 'Home Win' | 'Draw' | 'Away Win';

function displayOutcome(home: number, away: number): DisplayOutcome {
  if (home > away) return 'Home Win';
  if (home === away) return 'Draw';
  return 'Away Win';
}

function seasonLabel(season: string) {
  const year = parseInt(season, 10);
  if (isNaN(year)) return season;
  return `${year}/${String(year + 1).slice(-2)}`;
}

function fullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function kickoffTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─── goals section ────────────────────────────────────────────────────────────

function GoalsSection({ goals, homeTeamId }: { goals: Goal[]; homeTeamId: number }) {
  if (!goals.length) return null;

  const sorted    = [...goals].sort((a, b) => a.minute - b.minute || (a.injuryTime ?? 0) - (b.injuryTime ?? 0));
  const homeGoals = sorted.filter((g) => g.team.id === homeTeamId);
  const awayGoals = sorted.filter((g) => g.team.id !== homeTeamId);

  function goalMin(g: Goal) {
    return g.injuryTime ? `${g.minute}+${g.injuryTime}'` : `${g.minute}'`;
  }

  function goalTag(type: Goal['type']) {
    if (type === 'OWN_GOAL') return <Tag color="error" style={{ fontSize: 11, margin: '0 0 0 4px' }}>OG</Tag>;
    if (type === 'PENALTY')  return <Tag color="warning" style={{ fontSize: 11, margin: '0 0 0 4px' }}>P</Tag>;
    return null;
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}
      >
        Goals
      </Text>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          {homeGoals.map((g, i) => (
            <Space key={i} style={{ display: 'flex', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>
                {goalMin(g)}
              </Text>
              <Text style={{ fontSize: 13 }}>{g.scorer.name}</Text>
              {goalTag(g.type)}
            </Space>
          ))}
          {homeGoals.length === 0 && <Text type="secondary" style={{ fontSize: 13 }}>—</Text>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {awayGoals.map((g, i) => (
            <Space key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              {goalTag(g.type)}
              <Text style={{ fontSize: 13 }}>{g.scorer.name}</Text>
              <Text type="secondary" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'left' }}>
                {goalMin(g)}
              </Text>
            </Space>
          ))}
          {awayGoals.length === 0 && <Text type="secondary" style={{ fontSize: 13 }}>—</Text>}
        </div>
      </div>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comp = searchParams.get('comp');
  const qc = useQueryClient();
  const { user } = useUser();
  const [form] = Form.useForm();

  const matchId = parseInt(id!, 10);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => matchesApi.getOne(matchId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['match', matchId] });
    qc.invalidateQueries({ queryKey: ['matches'] });
    qc.invalidateQueries({ queryKey: ['predictions'] });
  };

  const createMutation = useMutation({
    mutationFn: predictionsApi.create,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ pid, data }: { pid: number; data: { predictedHome: number; predictedAway: number } }) =>
      predictionsApi.update(pid, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: predictionsApi.delete,
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!match) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <Text type="danger">Match not found</Text>
      </div>
    );
  }

  const prediction = user ? match.predictions.find((p) => p.userId === user.id) : null;
  const isFinished = match.status === 'FINISHED';
  const showScore  = isFinished || match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const isCorrect =
    prediction?.outcome != null
      ? displayOutcome(prediction.predictedHome, prediction.predictedAway) ===
        (prediction.outcome === 'HOME_WIN' ? 'Home Win'
          : prediction.outcome === 'DRAW' ? 'Draw' : 'Away Win')
      : null;

  const handleFinish = (values: { home: number; away: number }) => {
    if (values.home == null || values.away == null || !user) return;
    if (prediction) {
      updateMutation.mutate({
        pid: prediction.id,
        data: { predictedHome: values.home, predictedAway: values.away },
      });
    } else {
      createMutation.mutate({ matchId, predictedHome: values.home, predictedAway: values.away });
    }
    form.resetFields();
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const goals     = (match.goals ?? []) as Goal[];

  const predictionBgColor =
    isCorrect === null
      ? 'rgba(37, 99, 235, 0.1)'
      : isCorrect
      ? 'rgba(22, 163, 74, 0.1)'
      : 'rgba(220, 38, 38, 0.1)';

  const predictionBorderColor =
    isCorrect === null ? '#1d4ed8' : isCorrect ? '#16a34a' : '#dc2626';

  return (
    <div style={{ maxWidth: 672, margin: '0 auto' }}>
      <Button
        type="text"
        icon={<LeftOutlined />}
        onClick={() => (comp ? navigate(`/?comp=${comp}`) : navigate(-1))}
        style={{ marginBottom: 24, paddingLeft: 0, color: 'rgba(255,255,255,0.45)' }}
      >
        Back to matches
      </Button>

      {/* Match card */}
      <Card style={{ marginBottom: 24 }}>
        {/* Competition + date */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Space style={{ marginBottom: 4 }}>
            <CompBadge code={match.competitionCode} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {match.competition} {seasonLabel(match.season)}
              {match.stage && match.stage !== 'REGULAR_SEASON' && (
                <> · {match.stage.replace(/_/g, ' ')}</>
              )}
            </Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
            {fullDate(match.matchDate)} · {kickoffTime(match.matchDate)}
          </Text>
        </div>

        {/* Teams + score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            {match.homeTeam.crest && (
              <img
                src={match.homeTeam.crest}
                alt=""
                style={{ width: 64, height: 64, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
              />
            )}
            <Text strong style={{ fontSize: 17, display: 'block', lineHeight: 1.3 }}>
              {match.homeTeam.name}
            </Text>
            {match.homeTeam.shortName && (
              <Text type="secondary" style={{ fontSize: 12 }}>{match.homeTeam.shortName}</Text>
            )}
          </div>

          <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 16px' }}>
            {showScore ? (
              <>
                <Text style={{ fontSize: 48, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                  {match.homeScore ?? 0} – {match.awayScore ?? 0}
                </Text>
                {match.halfTimeHome != null && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    HT {match.halfTimeHome} – {match.halfTimeAway}
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>VS</Text>
            )}
          </div>

          <div style={{ textAlign: 'center', flex: 1 }}>
            {match.awayTeam.crest && (
              <img
                src={match.awayTeam.crest}
                alt=""
                style={{ width: 64, height: 64, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
              />
            )}
            <Text strong style={{ fontSize: 17, display: 'block', lineHeight: 1.3 }}>
              {match.awayTeam.name}
            </Text>
            {match.awayTeam.shortName && (
              <Text type="secondary" style={{ fontSize: 12 }}>{match.awayTeam.shortName}</Text>
            )}
          </div>
        </div>
      </Card>

      {/* Goals */}
      {showScore && goals.length > 0 && (
        <GoalsSection goals={goals} homeTeamId={match.homeTeamId} />
      )}

      {/* Prediction card */}
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>Your Prediction</Title>

        {!user && (
          <Text type="secondary">Sign in via the navbar to make a prediction.</Text>
        )}

        {user && prediction && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                border: `1px solid ${predictionBorderColor}`,
                background: predictionBgColor,
                textAlign: 'center',
              }}
            >
              <Text style={{ fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums', display: 'block' }}>
                {prediction.predictedHome} – {prediction.predictedAway}
              </Text>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
                {displayOutcome(prediction.predictedHome, prediction.predictedAway)}
              </Text>
              {isCorrect !== null && (
                <Text
                  style={{
                    fontWeight: 600,
                    marginTop: 8,
                    display: 'block',
                    color: isCorrect ? '#4ade80' : '#f87171',
                  }}
                >
                  {prediction.isExactScore
                    ? '★ Exact score!'
                    : isCorrect
                    ? '✓ Correct outcome'
                    : '✗ Incorrect'}
                </Text>
              )}
              {isCorrect === null && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                  Awaiting result
                </Text>
              )}
            </div>

            {!isFinished && (
              <Button
                danger
                type="text"
                size="small"
                onClick={() => deleteMutation.mutate(prediction.id)}
                loading={deleteMutation.isPending}
                style={{ marginTop: 12 }}
              >
                Delete prediction
              </Button>
            )}
          </div>
        )}

        {user && !prediction && !isFinished && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            No prediction yet for this match.
          </Text>
        )}

        {user && !prediction && isFinished && (
          <Text type="secondary">This match is finished — predictions are closed.</Text>
        )}

        {user && !isFinished && (
          <Form form={form} onFinish={handleFinish} layout="vertical">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <Form.Item
                label={match.homeTeam.name}
                name="home"
                rules={[{ required: true, message: ' ' }]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <InputNumber
                  min={0}
                  max={20}
                  placeholder="0"
                  size="large"
                  style={{ width: '100%', textAlign: 'center', fontSize: 24 }}
                />
              </Form.Item>

              <div style={{ paddingBottom: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>–</Text>
              </div>

              <Form.Item
                label={match.awayTeam.name}
                name="away"
                rules={[{ required: true, message: ' ' }]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <InputNumber
                  min={0}
                  max={20}
                  placeholder="0"
                  size="large"
                  style={{ width: '100%', fontSize: 24 }}
                />
              </Form.Item>
            </div>

            <Form.Item shouldUpdate style={{ marginTop: 16, marginBottom: 16 }}>
              {({ getFieldValue }) => {
                const h = getFieldValue('home');
                const a = getFieldValue('away');
                if (h != null && a != null) {
                  return (
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                      Predicted outcome:{' '}
                      <Text strong style={{ color: 'inherit' }}>
                        {displayOutcome(h, a)}
                      </Text>
                    </Text>
                  );
                }
                return null;
              }}
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={isPending} block size="large">
              {prediction ? 'Update Prediction' : 'Save Prediction'}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
