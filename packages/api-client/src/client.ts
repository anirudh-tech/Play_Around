import {
  AuthTokensResponse,
  JoinResponse,
  MeResponse,
  NearbyResponse,
  PaymentListResponse,
  PaymentResponse,
  SessionListResponse,
  SessionPaymentsResponse,
  SessionSummaryResponse,
  SportDto,
  type AttendanceBody,
  type CancelSessionBody,
  type ConfirmPaymentBody,
  type CreateSessionBody,
  type ErrorCode,
  type ForgotPasswordBody,
  type AdminCreateVenueBody,
  type AdminHideReviewBody,
  type AdminMfaBody,
  type AdminMergeVenueBody,
  type AdminPatchReportBody,
  type AdminPatchSettingBody,
  type AdminPatchSportBody,
  type AdminPatchVenueBody,
  type AdminPaymentActionBody,
  type AdminProposeVenueOptionBody,
  type AdminRecoverBody,
  type AdminRefundBody,
  type AdminSportBody,
  type AdminStaffRoleBody,
  type AdminUserStatusBody,
  type AdminVenueBookingBody,
  type AdminWaiveBody,
  type AssignArrangementBody,
  type LoginBody,
  type MinPlayersDecisionBody,
  type OpenDisputeBody,
  type OrganiserPlayingBody,
  type PatchMeBody,
  type PatchSessionBody,
  type PatchArrangementBody,
  type PatchVenueBookingBody,
  type PatchVenueOptionBody,
  type PhoneBody,
  type RefundPaymentBody,
  type RegisterBody,
  type ReportPaymentBody,
  type ResetPasswordBody,
  type VerifyEmailBody,
  type ResolveDisputeBody,
  type WaivePaymentBody,
} from '@playaround/contracts';
import { ApiErrorBody, HealthResponse, ReadinessResponse } from '@playaround/contracts';
import { z } from 'zod';
import { normalizeApiBaseUrl } from './base-url';

export { normalizeApiBaseUrl } from './base-url';

export type ClientKind = 'ios' | 'android' | 'web' | 'admin';

export interface ApiClientOptions {
  baseUrl: string;
  client: ClientKind;
  appVersion: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  getRefreshToken?: () => string | null | Promise<string | null>;
  setTokens?: (tokens: { accessToken: string; refreshToken?: string } | null) => void | Promise<void>;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  skipAuthRetry?: boolean;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE',
    message: string,
    readonly details: unknown = null,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** 204 has no body; 202 accepted endpoints return `{ data: { sent: true } }`. */
const VoidResponse = z.union([z.undefined(), z.null(), z.object({ data: z.unknown().optional() })]);
const DataUnknown = z.object({ data: z.unknown() });
const SportsResponse = z.object({ data: z.array(SportDto) });
const VenueDto = z.object({
  id: z.string(),
  name: z.string(),
  addressLine: z.string(),
  area: z.string().nullable(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  isVerified: z.boolean(),
  googlePlaceId: z.string().nullable(),
  distanceKm: z.number().optional(),
});
const VenuesResponse = z.object({ data: z.array(VenueDto) });
const ParticipantsResponse = z.object({
  data: z.array(
    z.object({
      userId: z.string(),
      role: z.string(),
      status: z.string(),
      shareSlot: z.number().nullable(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      paymentStatus: z.string().nullable(),
    }),
  ),
});
const EventsResponse = z.object({ data: z.array(z.object({ type: z.string() }).passthrough()) });
const ArrangementResponse = z.object({ data: z.unknown() });
const NotificationsResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      body: z.string(),
      readAt: z.string().nullable(),
      createdAt: z.string(),
      sessionId: z.string().nullable(),
    }),
  ),
});
const UnreadResponse = z.object({ data: z.object({ count: z.number().int() }) });
const PublicProfileResponse = z.object({
  data: z.object({
    id: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    ratingAvg: z.number(),
    ratingCount: z.number().int(),
    role: z.string(),
  }),
});

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `idemp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);
  let refreshInFlight: Promise<boolean> | null = null;

  async function request<T extends z.ZodType>(
    path: string,
    schema: T,
    { method = 'GET', body, query, idempotencyKey: key, signal, skipAuthRetry }: RequestOptions = {},
  ): Promise<z.infer<T>> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Client': options.client,
      'X-App-Version': options.appVersion,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers['Idempotency-Key'] = key;
    const token = await options.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await doFetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
        signal,
      });
    } catch (error) {
      throw new ApiClientError(0, 'NETWORK_ERROR', (error as Error).message);
    }

    if (response.status === 401 && !skipAuthRetry && path !== '/auth/refresh' && path !== '/admin/auth/refresh') {
      const hasSession = Boolean((await options.getAccessToken?.()) || (await options.getRefreshToken?.()));
      if (hasSession) {
        const ok = await refreshAccess();
        if (ok) {
          return request(path, schema, { method, body, query, idempotencyKey: key, signal, skipAuthRetry: true });
        }
      }
    }

    if (response.status === 204) {
      return undefined as z.infer<T>;
    }

    const json: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = ApiErrorBody.safeParse(json);
      if (parsed.success) {
        const { code, message, details, requestId } = parsed.data.error;
        throw new ApiClientError(response.status, code, message, details, requestId);
      }
      const fallback = schema.safeParse(json);
      if (fallback.success) return fallback.data;
      throw new ApiClientError(response.status, 'INVALID_RESPONSE', response.statusText);
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiClientError(response.status, 'INVALID_RESPONSE', parsed.error.message);
    }
    return parsed.data;
  }

  const authPrefix = options.client === 'admin' ? '/admin/auth' : '/auth';
  const EnrolResponse = z.object({ data: z.object({ recoveryCodes: z.array(z.string()) }) });

  async function refreshAccess(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refreshToken = await options.getRefreshToken?.();
        try {
          const result = await request(`${authPrefix}/refresh`, AuthTokensResponse, {
            method: 'POST',
            body: refreshToken ? { refreshToken } : {},
            skipAuthRetry: true,
          });
          await options.setTokens?.({
            accessToken: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          });
          return true;
        } catch {
          await options.setTokens?.(null);
          return false;
        } finally {
          refreshInFlight = null;
        }
      })();
    }
    return refreshInFlight;
  }

  async function saveAuth(result: z.infer<typeof AuthTokensResponse>) {
    await options.setTokens?.({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });
    return result;
  }

  return {
    request,
    health: {
      live: (signal?: AbortSignal) => request('/health', HealthResponse, { signal }),
      ready: (signal?: AbortSignal) => request('/health/ready', ReadinessResponse, { signal }),
    },
    auth: {
      register: (body: RegisterBody) =>
        request('/auth/register', AuthTokensResponse, { method: 'POST', body }).then(saveAuth),
      login: (body: LoginBody) =>
        request('/auth/login', AuthTokensResponse, { method: 'POST', body }).then(saveAuth),
      google: (idToken: string) =>
        request('/auth/google', AuthTokensResponse, { method: 'POST', body: { idToken } }).then(saveAuth),
      clerk: (sessionToken: string) =>
        request('/auth/clerk', AuthTokensResponse, { method: 'POST', body: { sessionToken } }).then(saveAuth),
      apple: (identityToken: string, fullName?: string) =>
        request('/auth/apple', AuthTokensResponse, {
          method: 'POST',
          body: { identityToken, fullName },
        }).then(saveAuth),
      refresh: () => refreshAccess(),
      logout: async () => {
        try {
          const refreshToken = await options.getRefreshToken?.();
          await request('/auth/logout', VoidResponse, {
            method: 'POST',
            body: refreshToken ? { refreshToken } : {},
            skipAuthRetry: true,
          });
        } catch {
          /* already signed out or token expired — still drop the local session */
        } finally {
          await options.setTokens?.(null);
        }
      },
      verifyEmail: (body: VerifyEmailBody) =>
        request('/auth/verify-email', VoidResponse, { method: 'POST', body }),
      resendVerify: () => request('/auth/verify-email/resend', VoidResponse, { method: 'POST', body: {} }),
      forgotPassword: (body: ForgotPasswordBody) =>
        request('/auth/forgot-password', VoidResponse, { method: 'POST', body }),
      resetPassword: (body: ResetPasswordBody) =>
        request('/auth/reset-password', VoidResponse, { method: 'POST', body }),
    },
    users: {
      me: (signal?: AbortSignal) => request('/users/me', MeResponse, { signal }),
      patchMe: (body: PatchMeBody) => request('/users/me', MeResponse, { method: 'PATCH', body }),
      sendPhone: (body: PhoneBody) => request('/users/me/phone', VoidResponse, { method: 'POST', body }),
      verifyPhone: (code: string) =>
        request('/users/me/phone/verify', VoidResponse, { method: 'POST', body: { code } }),
      publicProfile: (id: string) => request(`/users/${id}`, PublicProfileResponse),
    },
    catalog: {
      sports: () => request('/sports', SportsResponse),
      venues: (q?: string) => request('/venues', VenuesResponse, { query: { q } }),
      nearbyVenues: (lat: number, lng: number, radiusKm = 8) =>
        request('/venues/nearby', VenuesResponse, { query: { lat, lng, radiusKm } }),
    },
    sessions: {
      nearby: (query: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) =>
        request('/sessions/nearby', NearbyResponse, { query, signal }),
      get: (id: string, signal?: AbortSignal) =>
        request(`/sessions/${id}`, SessionSummaryResponse, { signal }),
      create: (body: CreateSessionBody) =>
        request('/sessions', SessionSummaryResponse, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      patch: (id: string, body: PatchSessionBody) =>
        request(`/sessions/${id}`, SessionSummaryResponse, { method: 'PATCH', body }),
      cancel: (id: string, body: CancelSessionBody = {}) =>
        request(`/sessions/${id}/cancel`, SessionSummaryResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      minPlayersDecision: (id: string, body: MinPlayersDecisionBody) =>
        request(`/sessions/${id}/min-players-decision`, SessionSummaryResponse, { method: 'POST', body }),
      organiserPlaying: (id: string, body: OrganiserPlayingBody) =>
        request(`/sessions/${id}/organiser-participation`, SessionSummaryResponse, { method: 'PUT', body }),
      events: (id: string) => request(`/sessions/${id}/events`, EventsResponse),
      mine: (role: string, bucket: string) =>
        request('/me/sessions', SessionListResponse, { query: { role, bucket } }),
      join: (id: string) =>
        request(`/sessions/${id}/join`, JoinResponse, {
          method: 'POST',
          body: {},
          idempotencyKey: idempotencyKey(),
        }),
      leave: (id: string) =>
        request(`/sessions/${id}/leave`, SessionSummaryResponse, {
          method: 'POST',
          body: {},
          idempotencyKey: idempotencyKey(),
        }),
      interest: (id: string, interested: boolean) =>
        request(`/sessions/${id}/interest`, VoidResponse, { method: interested ? 'POST' : 'DELETE', body: interested ? {} : undefined }),
      participants: (id: string) => request(`/sessions/${id}/participants`, ParticipantsResponse),
      removeParticipant: (id: string, userId: string) =>
        request(`/sessions/${id}/participants/${userId}`, VoidResponse, { method: 'DELETE' }),
      attendance: (id: string, userId: string, body: AttendanceBody) =>
        request(`/sessions/${id}/participants/${userId}/attendance`, VoidResponse, { method: 'PUT', body }),
      arrangement: (id: string) => request(`/sessions/${id}/venue-arrangement`, ArrangementResponse),
      approveOption: (id: string, optionId: string) =>
        request(`/sessions/${id}/venue-options/${optionId}/approve`, SessionSummaryResponse, { method: 'POST', body: {} }),
      rejectOption: (id: string, optionId: string) =>
        request(`/sessions/${id}/venue-options/${optionId}/reject`, SessionSummaryResponse, { method: 'POST', body: {} }),
      recordBooking: (id: string, body: { venueOptionId: string }) =>
        request(`/sessions/${id}/venue-booking`, SessionSummaryResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      patchBooking: (id: string, body: PatchVenueBookingBody) =>
        request(`/sessions/${id}/venue-booking`, DataUnknown, { method: 'PATCH', body }),
    },
    payments: {
      mine: (role: 'payer' | 'payee') => request('/me/payments', PaymentListResponse, { query: { role } }),
      forSession: (sessionId: string) => request(`/sessions/${sessionId}/payments`, SessionPaymentsResponse),
      get: (id: string) => request(`/payments/${id}`, PaymentResponse),
      report: (id: string, body: ReportPaymentBody) =>
        request(`/payments/${id}/report`, PaymentResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      retract: (id: string) =>
        request(`/payments/${id}/retract-report`, PaymentResponse, {
          method: 'POST',
          body: {},
          idempotencyKey: idempotencyKey(),
        }),
      confirm: (id: string, body: ConfirmPaymentBody = {}) =>
        request(`/payments/${id}/confirm`, PaymentResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      rejectReport: (id: string, body: OpenDisputeBody) =>
        request(`/payments/${id}/reject-report`, PaymentResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      waive: (id: string, body: WaivePaymentBody = {}) =>
        request(`/payments/${id}/waive`, PaymentResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      refund: (id: string, body: RefundPaymentBody) =>
        request(`/payments/${id}/refund`, PaymentResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      dispute: (id: string, body: OpenDisputeBody) =>
        request(`/payments/${id}/disputes`, PaymentResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      remind: (sessionId: string) =>
        request(`/sessions/${sessionId}/payments/remind`, DataUnknown, {
          method: 'POST',
          body: {},
          idempotencyKey: idempotencyKey(),
        }),
    },
    consents: {
      accept: (id: string) => request(`/price-consents/${id}/accept`, VoidResponse, { method: 'POST', body: {} }),
      reject: (id: string) => request(`/price-consents/${id}/reject`, VoidResponse, { method: 'POST', body: {} }),
    },
    notifications: {
      list: () => request('/notifications', NotificationsResponse),
      unreadCount: () => request('/notifications/unread-count', UnreadResponse),
      read: (id: string) => request(`/notifications/${id}/read`, VoidResponse, { method: 'PATCH', body: {} }),
      readAll: () => request('/notifications/read-all', VoidResponse, { method: 'POST', body: {} }),
    },
    admin: {
      login: (body: LoginBody) =>
        request('/admin/auth/login', AuthTokensResponse, { method: 'POST', body, skipAuthRetry: true }),
      enrolMfa: (body: AdminMfaBody) =>
        request('/admin/auth/mfa/enrol', EnrolResponse, { method: 'POST', body, skipAuthRetry: true }),
      verifyMfa: (body: AdminMfaBody) =>
        request('/admin/auth/mfa/verify', AuthTokensResponse, { method: 'POST', body, skipAuthRetry: true }).then(saveAuth),
      recoverMfa: (body: AdminRecoverBody) =>
        request('/admin/auth/mfa/recover', AuthTokensResponse, { method: 'POST', body, skipAuthRetry: true }).then(saveAuth),
      logout: async () => {
        try {
          const refreshToken = await options.getRefreshToken?.();
          await request('/admin/auth/logout', VoidResponse, {
            method: 'POST',
            body: refreshToken ? { refreshToken } : {},
            skipAuthRetry: true,
          });
        } catch {
          /* already signed out or token expired — still drop the local session */
        } finally {
          await options.setTokens?.(null);
        }
      },
      metrics: () => request('/admin/metrics', DataUnknown),
      staff: () => request('/admin/staff', DataUnknown),
      users: (query?: Record<string, string | undefined>) => request('/admin/users', DataUnknown, { query }),
      user: (id: string) => request(`/admin/users/${id}`, DataUnknown),
      setUserStatus: (id: string, body: AdminUserStatusBody) =>
        request(`/admin/users/${id}/status`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      setStaffRole: (id: string, body: AdminStaffRoleBody) =>
        request(`/admin/users/${id}/role`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      sessions: (query?: Record<string, string | undefined>) => request('/admin/sessions', DataUnknown, { query }),
      session: (id: string) => request(`/admin/sessions/${id}`, DataUnknown),
      cancelSession: (id: string, body: { reason: string }) =>
        request(`/admin/sessions/${id}/cancel`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      removeParticipant: (id: string, userId: string, body: { reason: string }) =>
        request(`/admin/sessions/${id}/participants/${userId}/remove`, VoidResponse, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      sports: () => request('/admin/sports', DataUnknown),
      createSport: (body: AdminSportBody) =>
        request('/admin/sports', DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      patchSport: (id: number, body: AdminPatchSportBody) =>
        request(`/admin/sports/${id}`, DataUnknown, { method: 'PATCH', body, idempotencyKey: idempotencyKey() }),
      venues: (q?: string) => request('/admin/venues', DataUnknown, { query: { q } }),
      venue: (id: string) => request(`/admin/venues/${id}`, DataUnknown),
      createVenue: (body: AdminCreateVenueBody) =>
        request('/admin/venues', DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      patchVenue: (id: string, body: AdminPatchVenueBody) =>
        request(`/admin/venues/${id}`, DataUnknown, { method: 'PATCH', body, idempotencyKey: idempotencyKey() }),
      mergeVenue: (id: string, body: AdminMergeVenueBody) =>
        request(`/admin/venues/${id}/merge`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      arrangements: (query?: Record<string, string | undefined>) =>
        request('/admin/venue-arrangements', DataUnknown, { query }),
      arrangement: (id: string) => request(`/admin/venue-arrangements/${id}`, DataUnknown),
      assignArrangement: (id: string, body: AssignArrangementBody) =>
        request(`/admin/venue-arrangements/${id}/assign`, DataUnknown, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      patchArrangement: (id: string, body: PatchArrangementBody) =>
        request(`/admin/venue-arrangements/${id}`, DataUnknown, {
          method: 'PATCH',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      addArrangementOption: (id: string, body: AdminProposeVenueOptionBody) =>
        request(`/admin/venue-arrangements/${id}/options`, DataUnknown, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      patchVenueOption: (id: string, body: PatchVenueOptionBody) =>
        request(`/admin/venue-options/${id}`, DataUnknown, { method: 'PATCH', body, idempotencyKey: idempotencyKey() }),
      withdrawVenueOption: (id: string, body: { reason: string }) =>
        request(`/admin/venue-options/${id}`, VoidResponse, { method: 'DELETE', body, idempotencyKey: idempotencyKey() }),
      recordBooking: (sessionId: string, body: AdminVenueBookingBody) =>
        request(`/admin/sessions/${sessionId}/venue-booking`, DataUnknown, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      payments: (status?: string) => request('/admin/payments', DataUnknown, { query: { status } }),
      payment: (id: string) => request(`/admin/payments/${id}`, DataUnknown),
      confirmPayment: (id: string, body: AdminPaymentActionBody) =>
        request(`/admin/payments/${id}/confirm`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      waivePayment: (id: string, body: AdminWaiveBody) =>
        request(`/admin/payments/${id}/waive`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      refundPayment: (id: string, body: AdminRefundBody) =>
        request(`/admin/payments/${id}/refund`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      correctPayment: (id: string, body: { status: string; reason: string; note?: string; expectedVersion?: number }) =>
        request(`/admin/payments/${id}/correct-status`, DataUnknown, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      disputes: (status?: string) => request('/admin/payment-disputes', DataUnknown, { query: { status } }),
      dispute: (id: string) => request(`/admin/payment-disputes/${id}`, DataUnknown),
      resolveDispute: (id: string, body: ResolveDisputeBody) =>
        request(`/admin/payment-disputes/${id}/resolve`, DataUnknown, {
          method: 'POST',
          body,
          idempotencyKey: idempotencyKey(),
        }),
      reports: (status?: string) => request('/admin/reports', DataUnknown, { query: { status } }),
      patchReport: (id: string, body: AdminPatchReportBody) =>
        request(`/admin/reports/${id}`, DataUnknown, { method: 'PATCH', body, idempotencyKey: idempotencyKey() }),
      reviews: (hidden?: boolean) =>
        request('/admin/reviews', DataUnknown, { query: { hidden: hidden == null ? undefined : String(hidden) } }),
      hideReview: (id: string, body: AdminHideReviewBody) =>
        request(`/admin/reviews/${id}/hide`, DataUnknown, { method: 'POST', body, idempotencyKey: idempotencyKey() }),
      settings: () => request('/admin/settings', DataUnknown),
      putSetting: (key: string, body: AdminPatchSettingBody) =>
        request(`/admin/settings/${key}`, DataUnknown, { method: 'PUT', body, idempotencyKey: idempotencyKey() }),
      auditLogs: (query?: Record<string, string | undefined>) => request('/admin/audit-logs', DataUnknown, { query }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
