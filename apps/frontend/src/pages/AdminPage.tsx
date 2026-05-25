import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, matchesApi, predictionsApi } from '../api/client';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

type ActionResult =
  | { type: 'resolve'; resolved: number; affectedUsers: number[] }
  | { type: 'sync'; synced: boolean; count?: number; reason?: string };

export default function AdminPage() {
  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminApi.getStats,
  });

  const resolveMutation = useMutation<ActionResult>({
    mutationFn: async () => {
      const data = await predictionsApi.resolveAll();
      return { type: 'resolve', ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-stats'] }),
  });

  const syncMutation = useMutation<ActionResult>({
    mutationFn: async () => {
      const data = await matchesApi.sync(true);
      return { type: 'sync', ...data };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-stats'] }),
  });

  const lastSync = stats?.lastSyncAt
    ? new Date(stats.lastSyncAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Never';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {/* Stats */}
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

        {/* Resolve All */}
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

        {/* Force Sync */}
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
    </div>
  );
}
