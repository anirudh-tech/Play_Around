/** Accept host-only Render URLs or an explicit `/api/v1` prefix. Safe in Server Components. */
export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  if (/\/api\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api/v1`;
}
