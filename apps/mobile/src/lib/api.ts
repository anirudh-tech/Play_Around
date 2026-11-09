import { createApiClient, createSocketClient } from '@playaround/api-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAccessToken, getRefreshToken, useAuth } from '@/store/auth';

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  client: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  getAccessToken,
  getRefreshToken,
  setTokens: async (tokens) => {
    await useAuth.getState().setSession(tokens ? { ...tokens, user: useAuth.getState().user } : null);
  },
});

export const sockets = createSocketClient({
  url: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  getAccessToken,
});
