import { Secret, TOTP } from 'otpauth';
import { decryptSecret, encryptSecret } from './crypto-box';
import { recoveryCode, sha256 } from './hash';

export function generateTotpSecret(): { secret: string; otpauthUri: string; label: string } {
  const secret = new Secret({ size: 20 });
  return { secret: secret.base32, otpauthUri: '', label: '' };
}

export function otpauthUri(email: string, secretBase32: string, issuer = 'PlayAround'): string {
  const totp = new TOTP({
    issuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}

export function verifyTotp(secretBase32: string, code: string): boolean {
  const totp = new TOTP({
    issuer: 'PlayAround',
    label: 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.validate({ token: code, window: 1 }) !== null;
}

export function sealTotpSecret(hexKey: string, secretBase32: string): string {
  return encryptSecret(hexKey, secretBase32);
}

export function openTotpSecret(hexKey: string, sealed: string): string {
  return decryptSecret(hexKey, sealed);
}

export function createRecoveryCodes(count = 10): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: count }, () => recoveryCode());
  return { plain, hashes: plain.map((code) => sha256(code.toLowerCase())) };
}

export function remainingRecoveryHashes(hashes: string[], usedCode: string): string[] | null {
  const used = sha256(usedCode.toLowerCase());
  const index = hashes.indexOf(used);
  if (index === -1) return null;
  return hashes.filter((_, i) => i !== index);
}
