'use client';

import type { AuthUser } from '@playaround/contracts';
import { create } from 'zustand';

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  setSession: (input: { accessToken: string; refreshToken?: string; user?: AuthUser | null } | null) => void;
};

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === 'undefined') {
      set({ hydrated: true });
      return;
    }
    const stored = window.localStorage.getItem('pa_access');
    set((state) => ({
      accessToken: state.accessToken ?? stored,
      hydrated: true,
    }));
  },
  setSession: (input) => {
    if (typeof window !== 'undefined') {
      if (!input) {
        window.localStorage.removeItem('pa_access');
        window.localStorage.removeItem('pa_refresh');
      } else {
        window.localStorage.setItem('pa_access', input.accessToken);
        if (input.refreshToken) window.localStorage.setItem('pa_refresh', input.refreshToken);
      }
    }
    set({ accessToken: input?.accessToken ?? null, user: input?.user ?? null, hydrated: true });
  },
}));
