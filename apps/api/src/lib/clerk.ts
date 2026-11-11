import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../config/env';
import { AppError } from './errors';
import type { SocialProfile } from './oauth';

export interface ClerkVerifier {
  profileFromSession(sessionToken: string): Promise<SocialProfile>;
}

interface ClerkEmail {
  email_address?: string;
  verification?: { status?: string };
}

interface ClerkExternalAccount {
  provider?: string;
  provider_user_id?: string;
  email_address?: string;
}

interface ClerkUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: ClerkEmail[];
  external_accounts?: ClerkExternalAccount[];
}

/** Decode Clerk publishable key → Frontend API host (e.g. foo.clerk.accounts.dev). */
export function clerkFrontendApiHost(publishableKey: string): string {
  const raw = publishableKey.trim();
  const encoded = raw.replace(/^pk_(test|live)_/, '');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '').trim();
  if (!decoded) throw new AppError('SERVICE_UNAVAILABLE', 'Clerk publishable key is invalid.');
  return decoded;
}

export function createClerkVerifier(
  env: Pick<Env, 'CLERK_SECRET_KEY' | 'CLERK_PUBLISHABLE_KEY'>,
  fetchImpl: typeof fetch = fetch,
): ClerkVerifier {
  return {
    async profileFromSession(sessionToken) {
      if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) {
        throw new AppError('SERVICE_UNAVAILABLE', 'Clerk is not configured.');
      }
      const host = clerkFrontendApiHost(env.CLERK_PUBLISHABLE_KEY);
      const jwks = createRemoteJWKSet(new URL(`https://${host}/.well-known/jwks.json`));
      let sub: string;
      try {
        const { payload } = await jwtVerify(sessionToken, jwks);
        sub = String(payload.sub ?? '');
      } catch {
        throw new AppError('UNAUTHENTICATED', 'Invalid Clerk session.');
      }
      if (!sub) throw new AppError('UNAUTHENTICATED', 'Invalid Clerk session.');

      const res = await fetchImpl(`https://api.clerk.com/v1/users/${sub}`, {
        headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
      });
      if (!res.ok) {
        throw new AppError('UNAUTHENTICATED', 'Could not load Clerk user.');
      }
      const user = (await res.json()) as ClerkUser;
      const google = user.external_accounts?.find((account) => account.provider === 'oauth_google');
      const email =
        google?.email_address ??
        user.email_addresses?.find((row) => row.verification?.status === 'verified')?.email_address ??
        user.email_addresses?.[0]?.email_address ??
        null;
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
      return {
        provider: 'GOOGLE',
        providerUserId: google?.provider_user_id ?? `clerk:${user.id}`,
        email: email?.toLowerCase() ?? null,
        emailVerified: true,
        displayName,
      };
    },
  };
}
