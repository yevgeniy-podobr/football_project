import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, matchesApi, predictionsApi } from '../api/client';
import type { AdminUserDetail, AdminUserRow, Outcome } from '../types';
import { CompBadge } from './MatchesPage';

// ─── helpers ──────────────────────────────────────────────────────────────────

function predictedOutcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME_WIN';
  if (home === away) return 'DRAW';
  return 'AWAY_WIN';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── small shared components ──────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminUserRow['role'] }) {
  if (role === 'ADMIN') {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
        Admin
      </span>
    );
  }
  return <span className="text-xs text-gray-500">User</span>;
}

function OutcomeBadge({ p }: { p: AdminUserDetail['predictions'][number] }) {
  if (p.isExactScore) {
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Exact</span>;
  }
  if (p.outcome !== null) {
    const predicted = predictedOutcome(p.predictedHome, p.predictedAway);
    const correct = predicted === p.outcome;
    return correct
      ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Correct</span>
      : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Wrong</span>;
  }
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">Pending</span>;
}

// ─── user detail panel ────────────────────────────────────────────────────────

function UserDetailPanel({ userId }: { userId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => adminApi.getUserDetail(userId),
  });

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>;
  if (isError || !data) return <div className="py-8 text-center text-red-400 text-sm">Failed to load user.</div>;

  return (
    <div className="space-y-5 pt-4">
      {/* User info */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-white font-semibold">{data.username ?? '—'}</span>
        <span className="text-gray-400">{data.email}</span>
        <RoleBadge role={data.role} />
        <span className="text-gray-500">Registered {fmtDate(data.createdAt)}</span>
      </div>

      {/* Stats KPIs */}
      {data.stats ? (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total',      value: data.stats.total,      color: 'text-white' },
            { label: 'Correct',    value: data.stats.correct,    color: 'text-green-400' },
            { label: 'Exact',      value: data.stats.exactScores, color: 'text-yellow-400' },
            { label: 'Accuracy',   value: `${data.stats.accuracy}%`, color: 'text-blue-400' },
          ].map((k) => (
            <div key={k.label} className="bg-gray-800 rounded-lg p-3 text-center">
              <div className={`text-xl font-black ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No prediction stats yet.</p>
      )}

      {/* Predictions list */}
      {data.predictions.length === 0 ? (
        <p className="text-sm text-gray-500">No predictions yet.</p>
      ) : (
        <div className="space-y-2">
          {data.predictions.map((p) => {
            const isFinished = p.match.status === 'FINISHED';
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3 text-sm flex-wrap"
              >
                {/* Teams + competition */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <CompBadge code={p.match.competitionCode} />
                  <span className="font-medium text-white truncate">
                    {p.match.homeTeam.shortName ?? p.match.homeTeam.name}
                    <span className="text-gray-500 mx-1">vs</span>
                    {p.match.awayTeam.shortName ?? p.match.awayTeam.name}
                  </span>
                </div>

                {/* Match date */}
                <span className="text-gray-500 flex-shrink-0 text-xs">
                  {fmtDate(p.match.matchDate)}
                </span>

                {/* Predicted score */}
                <span className="font-bold tabular-nums text-blue-300 flex-shrink-0">
                  {p.predictedHome}–{p.predictedAway}
                </span>

                {/* Actual score */}
                {isFinished && (
                  <span className="font-bold tabular-nums text-gray-300 flex-shrink-0">
                    <span className="text-gray-500 text-xs mr-1">actual</span>
                    {p.match.homeScore}–{p.match.awayScore}
                  </span>
                )}

                {/* Outcome badge */}
                <div className="flex-shrink-0">
                  <OutcomeBadge p={p} />
                </div>
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
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-widest border-b border-gray-800">
            <th className="text-left px-4 py-3">User</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
            <th className="text-center px-4 py-3">Role</th>
            <th className="text-center px-4 py-3">Predictions</th>
            <th className="text-center px-4 py-3">Accuracy</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Registered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {users.map((u) => {
            const isSelected = u.id === selectedId;
            return (
              <>
                <tr
                  key={u.id}
                  onClick={() => onSelect(u.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-950/30'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{u.username ?? <span className="text-gray-500 italic">no username</span>}</span>
                      <span className="text-gray-600 text-xs">{isSelected ? '▲' : '▼'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3 text-center"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-300">{u.predictionCount}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {u.accuracy !== null
                      ? <span className="text-blue-400 font-medium">{u.accuracy}%</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{fmtDate(u.createdAt)}</td>
                </tr>

                {isSelected && (
                  <tr key={`${u.id}-detail`}>
                    <td colSpan={6} className="px-4 pb-5 border-b border-gray-700 bg-gray-900/60">
                      <UserDetailPanel userId={u.id} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
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
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Never';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {/* Database Overview */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Database Overview
        </h2>
        {statsLoading ? (
          <div className="text-gray-400 text-sm">Loading stats...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Users" value={stats?.users ?? 0} />
            <StatCard label="Predictions" value={stats?.predictions ?? 0} />
            <StatCard label="Matches" value={stats?.matches ?? 0} />
            <StatCard label="Last Sync" value={lastSync} />
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Actions
        </h2>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-white mb-1">Resolve All Predictions</h3>
              <p className="text-sm text-gray-400">
                Score all pending predictions for finished matches and update user stats.
                The cron job does this automatically every 5 minutes.
              </p>
            </div>
            <button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve All'}
            </button>
          </div>
          {resolveMutation.isSuccess && resolveMutation.data.type === 'resolve' && (
            <div className="mt-4 p-3 rounded-lg bg-green-950/50 border border-green-800 text-sm text-green-300">
              {resolveMutation.data.resolved === 0
                ? 'Nothing to resolve — all predictions are up to date.'
                : `Resolved ${resolveMutation.data.resolved} prediction(s) for ${resolveMutation.data.affectedUsers.length} user(s).`}
            </div>
          )}
          {resolveMutation.isError && (
            <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800 text-sm text-red-300">
              Failed to resolve predictions.
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-white mb-1">Force Sync Matches</h3>
              <p className="text-sm text-gray-400">
                Immediately fetch the latest match data from football-data.org, bypassing
                the 5-minute cache. Use sparingly — the API is rate-limited to 10 req/min.
              </p>
            </div>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex-shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {syncMutation.isPending ? 'Syncing...' : 'Force Sync'}
            </button>
          </div>
          {syncMutation.isSuccess && syncMutation.data.type === 'sync' && (
            <div className="mt-4 p-3 rounded-lg bg-green-950/50 border border-green-800 text-sm text-green-300">
              {syncMutation.data.synced
                ? `Synced ${syncMutation.data.count ?? 0} match(es) from the API.`
                : `Sync skipped: ${syncMutation.data.reason ?? 'cache is fresh'}.`}
            </div>
          )}
          {syncMutation.isError && (
            <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800 text-sm text-red-300">
              Failed to sync matches.
            </div>
          )}
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Users
        </h2>
        {usersLoading ? (
          <div className="text-gray-400 text-sm">Loading users...</div>
        ) : !users?.length ? (
          <div className="text-gray-500 text-sm">No users found.</div>
        ) : (
          <UsersTable
            users={users}
            selectedId={selectedUserId}
            onSelect={handleUserSelect}
          />
        )}
      </section>
    </div>
  );
}
