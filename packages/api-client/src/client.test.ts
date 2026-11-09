import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, createApiClient } from './client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function makeClient(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  const client = createApiClient({
    baseUrl: 'http://api.test/api/v1/',
    client: 'web',
    appVersion: '0.0.0',
    getAccessToken: () => 'token-123',
    fetch: fetchMock,
  });
  return { client, fetchMock };
}

describe('createApiClient', () => {
  it('sends client headers and parses the data envelope', async () => {
    const { client, fetchMock } = makeClient(
      jsonResponse(200, {
        data: { status: 'ok', service: 'playaround-api', version: '0.0.0', uptimeSeconds: 1 },
      }),
    );

    const result = await client.health.live();

    expect(result.data.status).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://api.test/api/v1/health');
    expect(init?.headers).toMatchObject({
      'X-Client': 'web',
      Authorization: 'Bearer token-123',
    });
  });

  it('throws a typed error for the error envelope', async () => {
    const { client } = makeClient(
      jsonResponse(409, {
        error: { code: 'SESSION_FULL', message: 'No spots left.', details: null, requestId: 'r1' },
      }),
    );

    await expect(client.health.live()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 409,
      code: 'SESSION_FULL',
      requestId: 'r1',
    });
  });

  it('returns a 503 readiness body instead of throwing', async () => {
    const { client } = makeClient(
      jsonResponse(503, { data: { status: 'not_ready', checks: { database: 'down' } } }),
    );

    await expect(client.health.ready()).resolves.toMatchObject({
      data: { status: 'not_ready' },
    });
  });

  it('refreshes admin sessions against /admin/auth/refresh', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'expired', details: null, requestId: 'r1' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: {
            accessToken: 'new',
            refreshToken: 'r2',
            expiresIn: 600,
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              email: 'a@b.c',
              phone: null,
              phoneVerifiedAt: null,
              emailVerifiedAt: null,
              role: 'SUPPORT',
              status: 'ACTIVE',
              profile: {
                displayName: 'A',
                avatarUrl: null,
                bio: null,
                homeAreaLabel: null,
                defaultRadiusKm: 5,
                notificationPrefs: null,
                ratingAvg: 0,
                ratingCount: 0,
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { status: 'ok', service: 'playaround-api', version: '0.0.0', uptimeSeconds: 1 },
        }),
      );
    const client = createApiClient({
      baseUrl: 'http://api.test/api/v1',
      client: 'admin',
      appVersion: '0.0.0',
      getAccessToken: () => 'old',
      getRefreshToken: () => 'refresh',
      setTokens: () => undefined,
      fetch: fetchMock,
    });
    await client.health.live();
    expect(String(fetchMock.mock.calls[1]![0])).toBe('http://api.test/api/v1/admin/auth/refresh');
  });

  it('accepts 202 { data: { sent: true } } for empty mutations', async () => {
    const { client } = makeClient(jsonResponse(202, { data: { sent: true } }));
    await expect(client.users.sendPhone({ phone: '+971500000000' })).resolves.toEqual({ data: { sent: true } });
  });

  it('wraps network failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      client: 'ios',
      appVersion: '0.0.0',
      fetch: fetchMock,
    });

    const error = await client.health.live().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).code).toBe('NETWORK_ERROR');
  });
});
