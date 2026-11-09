import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../config/env';
import { AppError } from './errors';

export interface SocialProfile {
  provider: 'GOOGLE' | 'APPLE';
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export interface OauthVerifier {
  google(idToken: string): Promise<SocialProfile>;
  apple(identityToken: string): Promise<SocialProfile>;
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export function createOauthVerifier(env: Pick<Env, 'GOOGLE_CLIENT_IDS' | 'APPLE_CLIENT_IDS'>): OauthVerifier {
  return {
    async google(idToken) {
      if (env.GOOGLE_CLIENT_IDS.length === 0) {
        throw new AppError('SERVICE_UNAVAILABLE', 'Google sign-in is not configured.');
      }
      try {
        const { payload } = await jwtVerify(idToken, googleJwks, {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          audience: env.GOOGLE_CLIENT_IDS,
        });
        const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
        return {
          provider: 'GOOGLE',
          providerUserId: String(payload.sub),
          email,
          emailVerified: payload.email_verified === true,
          displayName: typeof payload.name === 'string' ? payload.name : null,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('UNAUTHENTICATED', 'Invalid Google ID token.');
      }
    },
    async apple(identityToken) {
      if (env.APPLE_CLIENT_IDS.length === 0) {
        throw new AppError('SERVICE_UNAVAILABLE', 'Apple sign-in is not configured.');
      }
      try {
        const { payload } = await jwtVerify(identityToken, appleJwks, {
          issuer: 'https://appleid.apple.com',
          audience: env.APPLE_CLIENT_IDS,
        });
        const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
        return {
          provider: 'APPLE',
          providerUserId: String(payload.sub),
          email,
          emailVerified: payload.email_verified === true || payload.email_verified === 'true',
          displayName: null,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('UNAUTHENTICATED', 'Invalid Apple identity token.');
      }
    },
  };
}

export function createStubOauth(): OauthVerifier {
  return {
    async google() {
      throw new AppError('SERVICE_UNAVAILABLE', 'Google sign-in is not configured.');
    },
    async apple() {
      throw new AppError('SERVICE_UNAVAILABLE', 'Apple sign-in is not configured.');
    },
  };
}
