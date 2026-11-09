import { formatAed } from '@playaround/contracts';

export function when(iso: string) {
  return new Date(iso).toLocaleString('en-AE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });
}

export function shareLabel(amountFils: number | null | undefined) {
  if (amountFils == null) return 'Free';
  return formatAed(amountFils);
}

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: string }).message);
  return 'Something went wrong.';
}
