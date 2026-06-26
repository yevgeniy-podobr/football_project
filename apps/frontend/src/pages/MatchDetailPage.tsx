import { LeftOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, InputNumber, Progress, Space, Spin, Tag, Typography } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { matchesApi, predictionsApi } from '../api/client';
import { useUserStore } from '../store/userStore';
import type { AiMatchPreview, AiMatchStats } from '../types';
import { CompBadge } from './MatchesPage';

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
  if (Number.isNaN(year)) return season;
  return `${year}/${String(year + 1).slice(-2)}`;
}

function fullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function kickoffTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─── ai stats card ────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  display: 'block',
  marginBottom: 12,
  color: 'rgba(255,255,255,0.45)',
};

function AiStatsCard({
  stats,
  homeTeamName,
  awayTeamName,
}: {
  stats: AiMatchStats;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const { Text } = Typography;

  return (
    <Card style={{ marginBottom: 24 }} styles={{ body: { padding: '20px 24px' } }}>
      <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 20 }}>
        🤖 AI Match Statistics
      </Text>

      {/* Goals */}
      {(stats.goals.home.length > 0 || stats.goals.away.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <Text style={LABEL_STYLE}>Goals</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              {stats.goals.home.map((g) => (
                <Text key={`hg-${g.minute}-${g.scorer}`} style={{ display: 'block', fontSize: 13 }}>
                  ⚽ {g.scorer}{' '}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {g.minute}&apos;
                  </Text>
                </Text>
              ))}
              {stats.goals.home.length === 0 && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  —
                </Text>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {stats.goals.away.map((g) => (
                <Text key={`ag-${g.minute}-${g.scorer}`} style={{ display: 'block', fontSize: 13 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {g.minute}&apos;{' '}
                  </Text>
                  {g.scorer} ⚽
                </Text>
              ))}
              {stats.goals.away.length === 0 && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  —
                </Text>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      {(stats.cards.home.length > 0 || stats.cards.away.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <Text style={LABEL_STYLE}>Cards</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              {stats.cards.home.map((c) => (
                <Text key={`hc-${c.minute}-${c.player}`} style={{ display: 'block', fontSize: 13 }}>
                  <Tag
                    color={c.type === 'yellow' ? 'gold' : 'red'}
                    style={{ fontSize: 10, padding: '0 4px', marginRight: 4 }}
                  >
                    {c.type === 'yellow' ? '🟨' : '🟥'}
                  </Tag>
                  {c.player}{' '}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {c.minute}&apos;
                  </Text>
                </Text>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              {stats.cards.away.map((c) => (
                <Text key={`ac-${c.minute}-${c.player}`} style={{ display: 'block', fontSize: 13 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {c.minute}&apos;{' '}
                  </Text>
                  {c.player}{' '}
                  <Tag
                    color={c.type === 'yellow' ? 'gold' : 'red'}
                    style={{ fontSize: 10, padding: '0 4px', marginLeft: 4 }}
                  >
                    {c.type === 'yellow' ? '🟨' : '🟥'}
                  </Tag>
                </Text>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Possession */}
      {(stats.possession.home > 0 || stats.possession.away > 0) && (
        <div style={{ marginBottom: 20 }}>
          <Text style={LABEL_STYLE}>Possession</Text>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 13 }}>{stats.possession.home}%</Text>
            <Progress
              percent={stats.possession.home}
              showInfo={false}
              strokeColor="#60a5fa"
              trailColor="#374151"
              style={{ flex: 1, margin: 0 }}
            />
            <Text style={{ fontSize: 13 }}>{stats.possession.away}%</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {homeTeamName}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {awayTeamName}
            </Text>
          </div>
        </div>
      )}

      {/* Shots */}
      {(stats.shots.home.total > 0 || stats.shots.away.total > 0) && (
        <div>
          <Text style={LABEL_STYLE}>Shots</Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 600 }}>
              {stats.shots.home.onTarget}
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                /{stats.shots.home.total}
              </Text>
            </Text>
            <Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
              on target / total
            </Text>
            <Text style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>
              {stats.shots.away.onTarget}
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                /{stats.shots.away.total}
              </Text>
            </Text>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── ai preview card ──────────────────────────────────────────────────────────

const FORM_COLOR: Record<string, string> = { W: '#4ade80', D: '#facc15', L: '#f87171' };

function FormBadges({ form }: { form: string }) {
  return (
    <Space size={4}>
      {form
        .toUpperCase()
        .split('')
        .map((ch, i) => (
          <Tag
            key={i}
            style={{
              background: FORM_COLOR[ch] ?? '#6b7280',
              color: '#000',
              fontWeight: 700,
              fontSize: 12,
              padding: '1px 6px',
              margin: 0,
              border: 'none',
            }}
          >
            {ch}
          </Tag>
        ))}
    </Space>
  );
}

function AiPreviewCard({
  preview,
  homeTeamName,
  awayTeamName,
}: {
  preview: AiMatchPreview;
  homeTeamName: string;
  awayTeamName: string;
}) {
  return (
    <Card style={{ marginBottom: 24 }} styles={{ body: { padding: '20px 24px' } }}>
      <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 20 }}>
        🔮 AI Match Preview
      </Text>

      {/* Form */}
      <div style={{ marginBottom: 20 }}>
        <Text style={LABEL_STYLE}>Recent Form (last 5)</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              {homeTeamName}
            </Text>
            <FormBadges form={preview.form.home} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              {awayTeamName}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <FormBadges form={preview.form.away} />
            </div>
          </div>
        </div>
      </div>

      {/* Key players */}
      <div style={{ marginBottom: 20 }}>
        <Text style={LABEL_STYLE}>Key Players</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            {preview.keyPlayers.home.map((p) => (
              <div key={p.name} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{p.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {p.note}
                </Text>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            {preview.keyPlayers.away.map((p) => (
              <div key={p.name} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{p.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {p.note}
                </Text>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Head to head */}
      {preview.headToHead && (
        <div style={{ marginBottom: 20 }}>
          <Text style={LABEL_STYLE}>Head to Head</Text>
          <Text style={{ fontSize: 13 }}>{preview.headToHead}</Text>
        </div>
      )}

      {/* Summary */}
      <div>
        <Text style={LABEL_STYLE}>Preview</Text>
        <Text style={{ fontSize: 13, lineHeight: 1.6 }}>{preview.summary}</Text>
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
  const statusParam = searchParams.get('status');
  const pageParam = searchParams.get('page');
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  const [form] = Form.useForm();

  const matchId = id ? parseInt(id, 10) : 0;

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => matchesApi.getOne(matchId),
    enabled: matchId > 0,
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
    mutationFn: ({
      pid,
      data,
    }: {
      pid: number;
      data: { predictedHome: number; predictedAway: number };
    }) => predictionsApi.update(pid, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: predictionsApi.delete,
    onSuccess: invalidate,
  });

  const aiStatsMutation = useMutation({
    mutationFn: () => matchesApi.getAiStats(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match', matchId] }),
  });

  const aiPreviewMutation = useMutation({
    mutationFn: () => matchesApi.getAiPreview(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['match', matchId] }),
  });

  if (!id) return null;

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
  const isScheduled = match.status === 'SCHEDULED' || match.status === 'TIMED';
  const showScore = isFinished || match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const isCorrect =
    prediction?.outcome != null
      ? displayOutcome(prediction.predictedHome, prediction.predictedAway) ===
        (prediction.outcome === 'HOME_WIN'
          ? 'Home Win'
          : prediction.outcome === 'DRAW'
            ? 'Draw'
            : 'Away Win')
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

  const predictionBgColor =
    isCorrect === null
      ? 'rgba(37, 99, 235, 0.1)'
      : isCorrect
        ? 'rgba(22, 163, 74, 0.1)'
        : 'rgba(220, 38, 38, 0.1)';

  const predictionBorderColor = isCorrect === null ? '#1d4ed8' : isCorrect ? '#16a34a' : '#dc2626';

  return (
    <div style={{ maxWidth: 672, margin: '0 auto' }}>
      <Button
        type="text"
        icon={<LeftOutlined />}
        onClick={() => {
          if (!comp) return navigate(-1);
          const p = new URLSearchParams({ comp });
          if (statusParam) p.set('status', statusParam);
          if (pageParam && pageParam !== '1') p.set('page', pageParam);
          navigate(`/?${p.toString()}`);
        }}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ textAlign: 'center', flex: 1 }}>
            {match.homeTeam.crest && (
              <img
                src={match.homeTeam.crest}
                alt=""
                style={{
                  width: 64,
                  height: 64,
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto 12px',
                }}
              />
            )}
            <Text strong style={{ fontSize: 17, display: 'block', lineHeight: 1.3 }}>
              {match.homeTeam.name}
            </Text>
            {match.homeTeam.shortName && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {match.homeTeam.shortName}
              </Text>
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
              <Text style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
                VS
              </Text>
            )}
          </div>

          <div style={{ textAlign: 'center', flex: 1 }}>
            {match.awayTeam.crest && (
              <img
                src={match.awayTeam.crest}
                alt=""
                style={{
                  width: 64,
                  height: 64,
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto 12px',
                }}
              />
            )}
            <Text strong style={{ fontSize: 17, display: 'block', lineHeight: 1.3 }}>
              {match.awayTeam.name}
            </Text>
            {match.awayTeam.shortName && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {match.awayTeam.shortName}
              </Text>
            )}
          </div>
        </div>
      </Card>

      {/* AI Stats */}
      {isFinished && match.aiStats && (
        <AiStatsCard
          stats={match.aiStats}
          homeTeamName={match.homeTeam.name}
          awayTeamName={match.awayTeam.name}
        />
      )}
      {isFinished && !match.aiStats && (
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Button
            onClick={() => aiStatsMutation.mutate()}
            loading={aiStatsMutation.isPending}
            icon={<span>🤖</span>}
          >
            Get AI Stats
          </Button>
          {aiStatsMutation.isError && (
            <Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
              Failed to load stats. Try again.
            </Text>
          )}
        </div>
      )}

      {/* AI Preview */}
      {isScheduled && match.aiPreview && (
        <AiPreviewCard
          preview={match.aiPreview}
          homeTeamName={match.homeTeam.name}
          awayTeamName={match.awayTeam.name}
        />
      )}
      {isScheduled && !match.aiPreview && user && (
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Button
            onClick={() => aiPreviewMutation.mutate()}
            loading={aiPreviewMutation.isPending}
            icon={<span>🔮</span>}
          >
            Get AI Preview
          </Button>
          {aiPreviewMutation.isError && (
            <Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
              Failed to load preview. Try again.
            </Text>
          )}
        </div>
      )}

      {/* Prediction card */}
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          Your Prediction
        </Title>

        {!user && <Text type="secondary">Sign in via the navbar to make a prediction.</Text>}

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
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'block',
                }}
              >
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
                <Text style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
                  –
                </Text>
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

            <Button
              type="primary"
              htmlType="submit"
              loading={isPending}
              block
              size="large"
              disabled={aiStatsMutation.isPending || aiPreviewMutation.isPending}
            >
              {prediction ? 'Update Prediction' : 'Save Prediction'}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
