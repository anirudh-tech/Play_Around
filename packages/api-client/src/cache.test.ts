import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { applySessionAvailability } from './cache';
import { queryKeys } from './query-keys';

describe('applySessionAvailability', () => {
  it('applies a newer version and ignores stale events', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.session('s1'), {
      data: { id: 's1', confirmedCount: 1, version: 3, joinable: true },
    });
    applySessionAvailability(client, { id: 's1', confirmedCount: 2, version: 2 });
    expect(client.getQueryData(queryKeys.session('s1'))).toMatchObject({
      data: { confirmedCount: 1, version: 3 },
    });
    applySessionAvailability(client, { id: 's1', confirmedCount: 4, spotsLeft: 0, version: 4, joinable: false });
    expect(client.getQueryData(queryKeys.session('s1'))).toMatchObject({
      data: { confirmedCount: 4, spotsLeft: 0, version: 4, joinable: false },
    });
  });
});
