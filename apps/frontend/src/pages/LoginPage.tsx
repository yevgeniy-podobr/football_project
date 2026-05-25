import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useUser } from '../context/UserContext';
import { PasswordInput } from '../components/PasswordInput';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useUser();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const notice = (location.state as { notice?: string } | null)?.notice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, access_token } = await authApi.login({ email, password });
      login(user, access_token);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? 'Login failed';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-8 text-center">Sign in</h1>

      {notice && (
        <p className="text-green-400 text-sm text-center mb-4">{notice}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Password</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        <Link to="/forgot-password" className="text-gray-400 hover:text-white">
          Forgot password?
        </Link>
      </p>

      <p className="text-center text-sm text-gray-500 mt-3">
        No account?{' '}
        <Link to="/register" className="text-blue-400 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
