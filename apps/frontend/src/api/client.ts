import axios from 'axios';
import type {
  AdminStats,
  AdminUserDetail,
  AdminUserRow,
  AiMatchPreview,
  AiMatchStats,
  GroupStanding,
  Match,
  PaginatedMatches,
  Prediction,
  Standing,
  User,
} from '../types';

const TOKEN_KEY = 'cl-predictor-token';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Don't redirect on 401 from auth endpoints — the page handles those errors itself
    const isAuthEndpoint = (err.config?.url as string | undefined)?.includes('/auth/');
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('cl-predictor-user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const authApi = {
  register: (data: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => api.post<{ access_token: string; user: User }>('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; user: User }>('/auth/login', data).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    api
      .post<{ message: string }>('/auth/reset-password', { token, newPassword })
      .then((r) => r.data),
  updateProfile: (data: { firstName?: string | null; lastName?: string | null }) =>
    api.patch<{ access_token: string; user: User }>('/auth/profile', data).then((r) => r.data),
};

export const configApi = {
  get: () => api.get<{ footballApiConfigured: boolean }>('/config').then((r) => r.data),
};

export const matchesApi = {
  getAll: (status?: string, competition?: string, page = 1, limit = 10) =>
    api
      .get<PaginatedMatches>('/matches', {
        params: {
          ...(status ? { status } : {}),
          ...(competition ? { competition } : {}),
          page,
          limit,
        },
      })
      .then((r) => r.data),
  getOne: (id: number) => api.get<Match>(`/matches/${id}`).then((r) => r.data),
  sync: (force = false) =>
    api.get('/matches/sync', { params: force ? { force: 'true' } : {} }).then((r) => r.data),
  getAiStats: (id: number) => api.post<AiMatchStats>(`/matches/${id}/ai-stats`).then((r) => r.data),
  getAiPreview: (id: number) =>
    api.post<AiMatchPreview>(`/matches/${id}/ai-preview`).then((r) => r.data),
};

export const predictionsApi = {
  getAll: () => api.get<Prediction[]>('/predictions').then((r) => r.data),
  create: (data: { matchId: number; predictedHome: number; predictedAway: number }) =>
    api.post<Prediction>('/predictions', data).then((r) => r.data),
  update: (id: number, data: { predictedHome?: number; predictedAway?: number }) =>
    api.patch<Prediction>(`/predictions/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/predictions/${id}`).then((r) => r.data),
  resolveAll: () => api.post('/predictions/resolve-all').then((r) => r.data),
};

export const standingsApi = {
  get: (competitionCode: string) =>
    api.get<Standing[] | GroupStanding[]>(`/standings/${competitionCode}`).then((r) => r.data),
};

export const adminApi = {
  getStats: () => api.get<AdminStats>('/admin/stats').then((r) => r.data),
  getUsers: () => api.get<AdminUserRow[]>('/admin/users').then((r) => r.data),
  getUserDetail: (id: number) => api.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),
};
