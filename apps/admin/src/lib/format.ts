import { ApiClientError } from '@playaround/api-client';

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: string }).message);
  return 'Something went wrong.';
}

export function when(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-AE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });
}

export const inputClass =
  'mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm';
