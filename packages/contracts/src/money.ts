import { z } from 'zod';

/** All amounts are integer fils (1 AED = 100 fils). */
export const FILS_PER_AED = 100;
export const CURRENCY = 'AED' as const;

export const Fils = z.number().int().nonnegative();

export const Money = z.object({
  amountFils: Fils,
  currency: z.literal(CURRENCY),
});
export type Money = z.infer<typeof Money>;

export function money(amountFils: number): Money {
  return { amountFils, currency: CURRENCY };
}

/** Parses a user-entered AED string ("33.5", "33.50") into fils without floating-point maths. */
export function parseAedToFils(input: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * FILS_PER_AED + fraction;
}

export function formatAed(amountFils: number): string {
  const sign = amountFils < 0 ? '-' : '';
  const abs = Math.abs(amountFils);
  const whole = Math.floor(abs / FILS_PER_AED).toLocaleString('en-AE');
  const fraction = String(abs % FILS_PER_AED).padStart(2, '0');
  return `${sign}AED ${whole}.${fraction}`;
}
