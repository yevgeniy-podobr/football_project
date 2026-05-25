import { Link, NavLink, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function Navbar() {
  const { user, logout } = useUser();
  const { pathname } = useLocation();

  const activeBtn  = 'text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors';
  const ghostBtn   = 'text-sm px-3 py-1.5 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-medium transition-colors';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:text-white hover:bg-gray-800'
    }`;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <span className="text-xl font-bold text-blue-400 mr-4">Football Predictor</span>
        <NavLink to="/" end className={linkClass}>
          Matches
        </NavLink>
        <NavLink to="/predictions" className={linkClass}>
          Predictions
        </NavLink>
        {user?.role === 'ADMIN' && (
          <NavLink to="/admin" className={linkClass}>
            Admin
          </NavLink>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-400">
                {user.username ?? user.email}
              </span>
              {user.role === 'ADMIN' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Admin
                </span>
              )}
              <button
                onClick={logout}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className={pathname === '/register' ? activeBtn : ghostBtn}>
                Register
              </Link>
              <Link to="/login" className={pathname === '/login' ? activeBtn : ghostBtn}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
