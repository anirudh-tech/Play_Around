import { createApiClient, createSocketClient } from '@playaround/api-client';
import { useAuth } from './auth';

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  client: 'admin',
  appVersion: '0.0.0',
  getAccessToken: () =>
    useAuth.getState().accessToken ?? (typeof window === 'undefined' ? null : window.localStorage.getItem('pa_admin_access')),
  getRefreshToken: () => (typeof window === 'undefined' ? null : window.localStorage.getItem('pa_admin_refresh')),
  setTokens: (tokens) => {
    useAuth.getState().setSession(tokens ? { ...tokens, user: useAuth.getState().user } : null);
  },
});

export const sockets = createSocketClient({
  url: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  getAccessToken: () => useAuth.getState().accessToken,
});
