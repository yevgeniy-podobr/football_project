import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchesApi, predictionsApi } from '../api/client';
import { useUser } from '../context/UserContext';
import { CompBadge } from './MatchesPage';
import type { Goal } from '../types';

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
    if (type === 'OWN_GOAL') return <span className="text-xs text-red-400 ml-1">OG</span>;
    if (type === 'PENALTY')  return <span className="text-xs text-yellow-400 ml-1">P</span>;
    return null;
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Goals</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {homeGoals.map((g, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-sm">
              <span className="text-gray-500 tabular-nums w-10 flex-shrink-0">{goalMin(g)}</span>
              <span className="font-medium text-white">{g.scorer.name}</span>
              {goalTag(g.type)}
            </div>
          ))}
          {homeGoals.length === 0 && <span className="text-gray-600 text-sm">—</span>}
        </div>
        <div className="space-y-2">
          {awayGoals.map((g, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-sm justify-end text-right">
              {goalTag(g.type)}
              <span className="font-medium text-white">{g.scorer.name}</span>
              <span className="text-gray-500 tabular-nums w-10 flex-shrink-0 text-left">{goalMin(g)}</span>
            </div>
          ))}
          {awayGoals.length === 0 && <span className="text-gray-600 text-sm float-right">—</span>}
        </div>
      </div>
    </div>
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

  const matchId = parseInt(id!, 10);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => matchesApi.getOne(matchId),
  });

  const [home, setHome] = useState('');
  const [away, setAway] = useState('');

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

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading...</div>;
  if (!match)   return <div className="text-center py-16 text-red-400">Match not found</div>;

  const prediction = user ? match.predictions.find((p) => p.userId === user.id) : null;
  const isFinished = match.status === 'FINISHED';
  const showScore  = isFinished || match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const isCorrect =
    prediction?.outcome != null
      ? displayOutcome(prediction.predictedHome, prediction.predictedAway) ===
        (prediction.outcome === 'HOME_WIN' ? 'Home Win'
          : prediction.outcome === 'DRAW' ? 'Draw' : 'Away Win')
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseInt(home);
    const a = parseInt(away);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || !user) return;

    if (prediction) {
      updateMutation.mutate({ pid: prediction.id, data: { predictedHome: h, predictedAway: a } });
    } else {
      createMutation.mutate({ matchId, predictedHome: h, predictedAway: a });
    }
    setHome('');
    setAway('');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const goals     = (match.goals ?? []) as Goal[];

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => comp ? navigate(`/?comp=${comp}`) : navigate(-1)}
        className="mb-6 text-gray-400 hover:text-white flex items-center gap-2 text-sm"
      >
        ← Back to matches
      </button>

      {/* Match card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
        {/* Competition + date */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <CompBadge code={match.competitionCode} />
          <span className="text-sm text-gray-500">
            {match.competition} {seasonLabel(match.season)}
            {match.stage && match.stage !== 'REGULAR_SEASON' && (
              <> · {match.stage.replace(/_/g, ' ')}</>
            )}
          </span>
        </div>
        <div className="text-center text-sm text-gray-500 mb-6">
          {fullDate(match.matchDate)} · {kickoffTime(match.matchDate)}
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            {match.homeTeam.crest && (
              <img src={match.homeTeam.crest} alt="" className="w-16 h-16 mx-auto mb-3 object-contain" />
            )}
            <div className="font-bold text-lg leading-tight">{match.homeTeam.name}</div>
            {match.homeTeam.shortName && (
              <div className="text-xs text-gray-500 mt-0.5">{match.homeTeam.shortName}</div>
            )}
          </div>

          <div className="text-center px-4 flex-shrink-0">
            {showScore ? (
              <>
                <div className="text-5xl font-black tabular-nums">
                  {match.homeScore ?? 0} – {match.awayScore ?? 0}
                </div>
                {match.halfTimeHome != null && (
                  <div className="text-xs text-gray-500 mt-2">
                    HT {match.halfTimeHome} – {match.halfTimeAway}
                  </div>
                )}
              </>
            ) : (
              <div className="text-3xl font-bold text-gray-400">VS</div>
            )}
          </div>

          <div className="text-center flex-1">
            {match.awayTeam.crest && (
              <img src={match.awayTeam.crest} alt="" className="w-16 h-16 mx-auto mb-3 object-contain" />
            )}
            <div className="font-bold text-lg leading-tight">{match.awayTeam.name}</div>
            {match.awayTeam.shortName && (
              <div className="text-xs text-gray-500 mt-0.5">{match.awayTeam.shortName}</div>
            )}
          </div>
        </div>
      </div>

      {/* Goals */}
      {showScore && goals.length > 0 && (
        <GoalsSection goals={goals} homeTeamId={match.homeTeamId} />
      )}

      {/* Prediction card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4">Your Prediction</h2>

        {!user && (
          <p className="text-gray-500 text-sm">Sign in via the navbar to make a prediction.</p>
        )}

        {user && prediction && (
          <div className="mb-5">
            <div
              className={`p-4 rounded-xl border text-center ${
                isCorrect === null
                  ? 'border-blue-800 bg-blue-950/40'
                  : isCorrect
                  ? 'border-green-700 bg-green-950/40'
                  : 'border-red-800 bg-red-950/40'
              }`}
            >
              <div className="text-3xl font-black tabular-nums">
                {prediction.predictedHome} – {prediction.predictedAway}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {displayOutcome(prediction.predictedHome, prediction.predictedAway)}
              </div>
              {isCorrect !== null && (
                <div className={`font-semibold mt-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {prediction.isExactScore
                    ? '★ Exact score!'
                    : isCorrect
                    ? '✓ Correct outcome'
                    : '✗ Incorrect'}
                </div>
              )}
              {isCorrect === null && (
                <div className="text-xs text-gray-500 mt-2">Awaiting result</div>
              )}
            </div>

            {!isFinished && (
              <button
                onClick={() => deleteMutation.mutate(prediction.id)}
                disabled={deleteMutation.isPending}
                className="mt-3 text-sm text-red-500 hover:text-red-400 disabled:opacity-50"
              >
                Delete prediction
              </button>
            )}
          </div>
        )}

        {user && !prediction && !isFinished && (
          <p className="text-gray-500 text-sm mb-4">No prediction yet for this match.</p>
        )}

        {user && !prediction && isFinished && (
          <p className="text-gray-500 text-sm">This match is finished — predictions are closed.</p>
        )}

        {user && !isFinished && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1.5">{match.homeTeam.name}</label>
                <input
                  type="number" min="0" max="20" value={home}
                  onChange={(e) => setHome(e.target.value)}
                  placeholder="0" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-center text-2xl font-bold focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="text-gray-600 font-bold text-2xl pb-3">–</div>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1.5">{match.awayTeam.name}</label>
                <input
                  type="number" min="0" max="20" value={away}
                  onChange={(e) => setAway(e.target.value)}
                  placeholder="0" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-center text-2xl font-bold focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {home && away && (
              <p className="text-sm text-gray-400 text-center">
                Predicted outcome:{' '}
                <span className="text-white font-medium">
                  {displayOutcome(parseInt(home) || 0, parseInt(away) || 0)}
                </span>
              </p>
            )}

            <button
              type="submit" disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {isPending ? 'Saving...' : prediction ? 'Update Prediction' : 'Save Prediction'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
