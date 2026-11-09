import type { AuthUser } from '@playaround/contracts';
import { Platform } from 'react-native';
import { create } from 'zustand';

const memory = { access: null as string | null, refresh: null as string | null };

function webStore() {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  return localStorage;
}

async function read(key: 'access' | 'refresh') {
  const stored = webStore()?.getItem(`pa_${key}`);
  return stored ?? memory[key];
}

async function write(key: 'access' | 'refresh', value: string | null) {
  memory[key] = value;
  const store = webStore();
  if (!store) return;
  if (value) store.setItem(`pa_${key}`, value);
  else store.removeItem(`pa_${key}`);
}

type AuthState = {
  hydrated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  hydrate: () => Promise<void>;
  setSession: (input: { accessToken: string; refreshToken?: string; user?: AuthUser | null } | null) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};

export const useAuth = create<AuthState>((set) => ({
  hydrated: false,
  user: null,
  accessToken: null,
  hydrate: async () => {
    const accessToken = await read('access');
    set({ accessToken, hydrated: true });
  },
  setSession: async (input) => {
    if (!input) {
      await write('access', null);
      await write('refresh', null);
      set({ accessToken: null, user: null });
      return;
    }
    await write('access', input.accessToken);
    if (input.refreshToken) await write('refresh', input.refreshToken);
    set({ accessToken: input.accessToken, user: input.user ?? null });
  },
  setUser: (user) => set({ user }),
}));

export async function getAccessToken() {
  return useAuth.getState().accessToken ?? (await read('access'));
}

export async function getRefreshToken() {
  return read('refresh');
}
