import { create } from 'zustand';
import type { User } from '../types';

const USER_KEY = 'cl-predictor-user';
const TOKEN_KEY = 'cl-predictor-token';

interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  updateUser: (user: User, token: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: localStorage.getItem(TOKEN_KEY) !== null,
  setUser: (user, token) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token, isAuthenticated: true });
  },
  updateUser: (user, token) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
