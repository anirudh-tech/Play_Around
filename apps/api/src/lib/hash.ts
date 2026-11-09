import { createHash, randomBytes, randomInt } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function recoveryCode(): string {
  return randomBytes(5).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'X').slice(0, 10);
}

export function hashSecret(secret: string, value: string): string {
  return sha256(`${secret}:${value}`);
}
