import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      navigate('/login', { state: { notice: 'Password updated — please sign in.' } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? 'Reset failed';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center">
        <p className="text-red-400">Invalid reset link — no token found.</p>
        <Link to="/forgot-password" className="text-blue-400 hover:underline text-sm mt-4 block">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-8 text-center">Set new password</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-gray-600 mt-1">At least 6 characters</p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 focus:outline-none transition-colors ${
              mismatch ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-blue-500'
            }`}
          />
          {mismatch && <p className="text-red-400 text-xs mt-1">Passwords do not match</p>}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || mismatch || !password}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
