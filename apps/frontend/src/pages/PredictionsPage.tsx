import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { predictionsApi } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Outcome, Prediction } from '../types';

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
const CHART_STYLE = { background: '#111827', border: '1px solid #374151', borderRadius: 8 };
const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 };
const GRID_DASH = { strokeDasharray: '3 3', stroke: '#374151' };

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
  const pending  = predictions.filter((p) => p.outcome === null);

  const correctCount   = resolved.filter(isCorrect).length;
  const incorrectCount = resolved.length - correctCount;
  const exactCount     = resolved.filter((p) => p.isExactScore).length;
  const accuracy =
    resolved.length > 0 ? Math.round((correctCount / resolved.length) * 1000) / 10 : 0;

  // Pie: correct / incorrect / pending
  const pieData = [
    { name: 'Correct',   value: correctCount },
    { name: 'Incorrect', value: incorrectCount },
    { name: 'Pending',   value: pending.length },
  ].filter((d) => d.value > 0);

  // Bar: by predicted outcome type
  const byPredicted: Record<Outcome, { total: number; correct: number }> = {
    HOME_WIN: { total: 0, correct: 0 },
    DRAW:     { total: 0, correct: 0 },
    AWAY_WIN: { total: 0, correct: 0 },
  };
  for (const p of resolved) {
    const po = predictedOutcome(p.predictedHome, p.predictedAway);
    byPredicted[po].total++;
    if (isCorrect(p)) byPredicted[po].correct++;
  }
  const barData = (Object.keys(byPredicted) as Outcome[]).map((k) => ({
    name: OUTCOME_LABEL[k],
    Total: byPredicted[k].total,
    Correct: byPredicted[k].correct,
  }));

  // Line: last 10 resolved predictions (oldest → newest)
  const trendData = resolved.slice(-10).map((p, i) => ({
    name: `#${i + 1}`,
    Result: isCorrect(p) ? 1 : 0,
    label: `${p.match?.homeTeam.name} vs ${p.match?.awayTeam.name}`,
  }));

  const kpis = [
    { label: 'Predictions', value: predictions.length, color: 'text-white' },
    { label: 'Correct',     value: correctCount,        color: 'text-green-400' },
    { label: 'Exact scores', value: exactCount,         color: 'text-yellow-400' },
    { label: 'Accuracy',    value: `${accuracy}%`,      color: 'text-blue-400' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {(user?.username ?? user?.email) + "'s Predictions"}
        </h1>
      </div>

      {/* KPI strip */}
      {predictions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className={`text-3xl font-black ${k.color}`}>{k.value}</div>
              <div className="text-sm text-gray-400 mt-1">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts — only when there's something evaluated */}
      {resolved.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="font-semibold mb-4 text-gray-200">Results breakdown</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="value" paddingAngle={3}>
                  {pieData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="font-semibold mb-4 text-gray-200">Accuracy by predicted outcome</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid {...GRID_DASH} />
                <XAxis dataKey="name" tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} />
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend />
                <Bar dataKey="Total"   fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Correct" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {trendData.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4 text-gray-200">
            Recent trend — last {trendData.length} evaluated
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid {...GRID_DASH} />
              <XAxis dataKey="name" tick={AXIS_TICK} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => (v === 1 ? 'Win' : 'Miss')} tick={AXIS_TICK} />
              <Tooltip
                contentStyle={CHART_STYLE}
                formatter={(value: number, _n: string, props: { payload?: { label?: string } }) => [
                  value === 1 ? 'Correct' : 'Incorrect',
                  props.payload?.label ?? '',
                ]}
              />
              <Line type="monotone" dataKey="Result" stroke="#3b82f6" strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Prediction list */}
      <div>
        <h2 className="text-lg font-semibold mb-4">All predictions</h2>

        {predictions.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="mb-1">No predictions yet.</p>
            <p className="text-sm">
              Go to a <Link to="/" className="text-blue-400 hover:underline">match</Link> to add
              your first prediction.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {predictions.map((p) => {
            const isFinished = p.match?.status === 'FINISHED';
            const po = predictedOutcome(p.predictedHome, p.predictedAway);
            const correct = isCorrect(p);
            const resolved = p.outcome !== null;

            return (
              <div
                key={p.id}
                className={`bg-gray-900 border rounded-xl p-4 flex items-center justify-between gap-4 ${
                  !resolved
                    ? 'border-gray-800'
                    : correct
                    ? 'border-green-800'
                    : 'border-red-900'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/matches/${p.matchId}`}
                    className="font-medium hover:text-blue-400 transition-colors truncate block"
                  >
                    {p.match?.homeTeam.name} vs {p.match?.awayTeam.name}
                  </Link>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p.match?.status} ·{' '}
                    {new Date(p.match?.matchDate ?? '').toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </div>
                </div>

                {/* Predicted score */}
                <div className="text-center flex-shrink-0">
                  <div className="font-bold text-lg tabular-nums">
                    {p.predictedHome} – {p.predictedAway}
                  </div>
                  <div className="text-xs text-gray-400">{OUTCOME_LABEL[po]}</div>
                </div>

                {/* Actual result */}
                {isFinished && p.match && (
                  <div className="text-center flex-shrink-0">
                    <div className="font-bold tabular-nums">
                      {p.match.homeScore} – {p.match.awayScore}
                    </div>
                    {resolved ? (
                      <div className={`text-xs font-semibold ${
                        p.isExactScore
                          ? 'text-yellow-400'
                          : correct
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {p.isExactScore ? '★ Exact' : correct ? '✓ Correct' : '✗ Wrong'}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Pending</div>
                    )}
                  </div>
                )}

                {!isFinished && (
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-600 hover:text-red-400 transition-colors text-sm flex-shrink-0 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
