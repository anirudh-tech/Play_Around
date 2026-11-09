import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import {
  ApiErrorBody,
  AppleAuthBody,
  AuthIdentitiesResponse,
  AuthTokensResponse,
  DeviceBody,
  FavouriteSportsBody,
  ForgotPasswordBody,
  GoogleAuthBody,
  HealthResponse,
  LoginBody,
  MeResponse,
  PatchMeBody,
  PhoneBody,
  PublicProfileResponse,
  ReadinessResponse,
  RefreshBody,
  RegisterBody,
  ResetPasswordBody,
  VerifyEmailBody,
  AdminLoginBody,
  AdminMfaBody,
  AttendanceBody,
  CancelSessionBody,
  CreateSessionBody,
  CreateVenueBody,
  JoinBody,
  NearbyResponse,
  MinPlayersDecisionBody,
  OrganiserPlayingBody,
  OpenDisputeBody,
  PatchSessionBody,
  PatchVenueBookingBody,
  ProposeVenueOptionBody,
  RefundPaymentBody,
  ReportBody,
  ReportPaymentBody,
  ReviewBody,
  SessionSummary,
  VenueBookingBody,
} from '@playaround/contracts';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { z } from 'zod';

// Named components (`registry.register`) need `.openapi()` on schemas, which Zod 4 only adds to
// schemas created after `extendZodWithOpenApi`. Contracts are created first, so schemas are inlined.
const errorResponse = {
  description: 'Error envelope',
  content: { 'application/json': { schema: ApiErrorBody } },
};

export function buildOpenApiDocument(version: string) {
  const registry = new OpenAPIRegistry();

  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    summary: 'Liveness',
    responses: {
      200: {
        description: 'API process is up',
        content: { 'application/json': { schema: HealthResponse } },
      },
      default: errorResponse,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/health/ready',
    tags: ['Health'],
    summary: 'Readiness (database reachable)',
    responses: {
      200: { description: 'Ready', content: { 'application/json': { schema: ReadinessResponse } } },
      503: {
        description: 'Not ready',
        content: { 'application/json': { schema: ReadinessResponse } },
      },
      default: errorResponse,
    },
  });

  const json = (schema: z.ZodType, description: string) => ({
    description,
    content: { 'application/json': { schema } },
  });

  const authPaths: Array<{
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    path: string;
    summary: string;
    body?: z.ZodType;
    ok?: z.ZodType;
    status?: number;
  }> = [
    { method: 'post', path: '/auth/register', summary: 'Register', body: RegisterBody, ok: AuthTokensResponse, status: 201 },
    { method: 'post', path: '/auth/login', summary: 'Login', body: LoginBody, ok: AuthTokensResponse },
    { method: 'post', path: '/auth/google', summary: 'Google sign-in', body: GoogleAuthBody, ok: AuthTokensResponse },
    { method: 'post', path: '/auth/apple', summary: 'Apple sign-in', body: AppleAuthBody, ok: AuthTokensResponse },
    { method: 'post', path: '/auth/refresh', summary: 'Rotate refresh token', body: RefreshBody, ok: AuthTokensResponse },
    { method: 'post', path: '/auth/logout', summary: 'Logout this session' },
    { method: 'post', path: '/auth/logout-all', summary: 'Logout every session' },
    { method: 'post', path: '/auth/verify-email', summary: 'Verify email', body: VerifyEmailBody },
    { method: 'post', path: '/auth/verify-email/resend', summary: 'Resend email code' },
    { method: 'post', path: '/auth/forgot-password', summary: 'Request password reset', body: ForgotPasswordBody },
    { method: 'post', path: '/auth/reset-password', summary: 'Reset password', body: ResetPasswordBody },
    { method: 'get', path: '/auth/identities', summary: 'List linked identities', ok: AuthIdentitiesResponse },
    { method: 'post', path: '/auth/identities', summary: 'Link Google or Apple' },
    { method: 'delete', path: '/auth/identities/{provider}', summary: 'Unlink identity' },
    { method: 'get', path: '/users/me', summary: 'Current user', ok: MeResponse },
    { method: 'patch', path: '/users/me', summary: 'Update profile', body: PatchMeBody, ok: MeResponse },
    { method: 'post', path: '/users/me/phone', summary: 'Send phone OTP', body: PhoneBody },
    { method: 'post', path: '/users/me/phone/verify', summary: 'Verify phone', body: VerifyEmailBody },
    { method: 'put', path: '/users/me/favourite-sports', summary: 'Replace favourite sports', body: FavouriteSportsBody, ok: MeResponse },
    { method: 'post', path: '/users/me/devices', summary: 'Register push token', body: DeviceBody },
    { method: 'delete', path: '/users/me/devices/{pushToken}', summary: 'Remove push token' },
    { method: 'delete', path: '/users/me', summary: 'Delete account' },
    { method: 'get', path: '/users/{id}', summary: 'Public profile', ok: PublicProfileResponse },
    { method: 'get', path: '/users/{id}/reviews', summary: 'Public reviews' },
    { method: 'post', path: '/admin/auth/login', summary: 'Staff login', body: AdminLoginBody },
    { method: 'post', path: '/admin/auth/mfa/enrol', summary: 'Enrol TOTP', body: AdminMfaBody },
    { method: 'post', path: '/admin/auth/mfa/verify', summary: 'Verify TOTP', body: AdminMfaBody, ok: AuthTokensResponse },
    { method: 'post', path: '/admin/auth/mfa/recover', summary: 'Use recovery code', ok: AuthTokensResponse },
    { method: 'post', path: '/admin/auth/refresh', summary: 'Staff refresh', body: RefreshBody, ok: AuthTokensResponse },
    { method: 'post', path: '/admin/auth/logout', summary: 'Staff logout' },
    { method: 'get', path: '/sports', summary: 'List sports' },
    { method: 'get', path: '/venues', summary: 'Search venues' },
    { method: 'get', path: '/venues/nearby', summary: 'Venues near a point' },
    { method: 'get', path: '/venues/{id}', summary: 'Venue details' },
    { method: 'post', path: '/venues', summary: 'Create venue', body: CreateVenueBody, status: 201 },
    { method: 'post', path: '/sessions', summary: 'Create session', body: CreateSessionBody, ok: SessionSummary, status: 201 },
    { method: 'get', path: '/sessions/nearby', summary: 'Nearby sessions', ok: NearbyResponse },
    { method: 'get', path: '/sessions/{id}', summary: 'Session details', ok: SessionSummary },
    { method: 'patch', path: '/sessions/{id}', summary: 'Edit session', body: PatchSessionBody, ok: SessionSummary },
    { method: 'post', path: '/sessions/{id}/cancel', summary: 'Cancel session', body: CancelSessionBody, ok: SessionSummary },
    { method: 'post', path: '/sessions/{id}/min-players-decision', summary: 'Minimum-player decision', body: MinPlayersDecisionBody, ok: SessionSummary },
    { method: 'put', path: '/sessions/{id}/organiser-participation', summary: 'Organiser playing', body: OrganiserPlayingBody, ok: SessionSummary },
    { method: 'get', path: '/sessions/{id}/events', summary: 'Session timeline' },
    { method: 'get', path: '/me/sessions', summary: 'My activities' },
    { method: 'post', path: '/sessions/{id}/venue-options', summary: 'Propose venue option', body: ProposeVenueOptionBody, status: 201 },
    { method: 'post', path: '/sessions/{id}/venue-options/{optionId}/approve', summary: 'Approve venue option', ok: SessionSummary },
    { method: 'post', path: '/sessions/{id}/venue-options/{optionId}/reject', summary: 'Reject venue option', ok: SessionSummary },
    { method: 'get', path: '/sessions/{id}/venue-arrangement', summary: 'Venue arrangement (organiser)' },
    { method: 'post', path: '/sessions/{id}/venue-booking', summary: 'Record venue booking', body: VenueBookingBody, ok: SessionSummary },
    { method: 'patch', path: '/sessions/{id}/venue-booking', summary: 'Update booking reference or venue payment', body: PatchVenueBookingBody },
    { method: 'post', path: '/sessions/{id}/interest', summary: 'Register interest' },
    { method: 'delete', path: '/sessions/{id}/interest', summary: 'Withdraw interest' },
    { method: 'post', path: '/sessions/{id}/join', summary: 'Join session', body: JoinBody, status: 201 },
    { method: 'post', path: '/sessions/{id}/leave', summary: 'Leave session', ok: SessionSummary },
    { method: 'get', path: '/sessions/{id}/participants', summary: 'List participants' },
    { method: 'delete', path: '/sessions/{id}/participants/{userId}', summary: 'Remove participant' },
    { method: 'put', path: '/sessions/{id}/participants/{userId}/attendance', summary: 'Mark attendance', body: AttendanceBody },
    { method: 'post', path: '/price-consents/{id}/accept', summary: 'Accept price increase' },
    { method: 'post', path: '/price-consents/{id}/reject', summary: 'Reject price increase' },
    { method: 'get', path: '/notifications', summary: 'List notifications' },
    { method: 'get', path: '/notifications/unread-count', summary: 'Unread notification count' },
    { method: 'patch', path: '/notifications/{id}/read', summary: 'Mark notification read' },
    { method: 'post', path: '/notifications/read-all', summary: 'Mark all notifications read' },
    { method: 'post', path: '/sessions/{id}/reviews', summary: 'Review a co-participant', body: ReviewBody, status: 201 },
    { method: 'post', path: '/reports', summary: 'File a report', body: ReportBody, status: 201 },
    { method: 'get', path: '/me/payments', summary: 'My payment records' },
    { method: 'get', path: '/sessions/{id}/payments', summary: 'Session payment overview' },
    { method: 'post', path: '/sessions/{id}/payments/remind', summary: 'Remind unpaid players' },
    { method: 'get', path: '/payments/{id}', summary: 'Payment record and action log' },
    { method: 'post', path: '/payments/{id}/report', summary: 'Player reports paying', body: ReportPaymentBody },
    { method: 'post', path: '/payments/{id}/retract-report', summary: 'Retract a payment report' },
    { method: 'post', path: '/payments/{id}/confirm', summary: 'Organiser confirms receipt' },
    { method: 'post', path: '/payments/{id}/reject-report', summary: 'Reject report and open dispute', body: OpenDisputeBody },
    { method: 'post', path: '/payments/{id}/waive', summary: 'Waive a share' },
    { method: 'post', path: '/payments/{id}/refund', summary: 'Record an offline refund', body: RefundPaymentBody },
    { method: 'post', path: '/payments/{id}/disputes', summary: 'Open a payment dispute', body: OpenDisputeBody },
    { method: 'post', path: '/payment-disputes/{id}/withdraw', summary: 'Withdraw a dispute' },
    { method: 'get', path: '/admin/venue-arrangements', summary: 'List venue arrangements' },
    { method: 'get', path: '/admin/payments', summary: 'List payments (staff)' },
    { method: 'get', path: '/admin/payment-disputes', summary: 'List payment disputes (staff)' },
    { method: 'get', path: '/admin/metrics', summary: 'Staff overview KPIs' },
    { method: 'get', path: '/admin/users', summary: 'List users (staff)' },
    { method: 'get', path: '/admin/sessions', summary: 'List sessions (staff)' },
    { method: 'get', path: '/admin/sports', summary: 'List sports including inactive' },
    { method: 'get', path: '/admin/venues', summary: 'List venues with staff contact fields' },
    { method: 'get', path: '/admin/reports', summary: 'Moderation reports' },
    { method: 'get', path: '/admin/reviews', summary: 'List reviews for hiding' },
    { method: 'get', path: '/admin/settings', summary: 'Platform settings' },
    { method: 'get', path: '/admin/audit-logs', summary: 'Admin audit log' },
  ];

  for (const item of authPaths) {
    registry.registerPath({
      method: item.method,
      path: item.path,
      tags: item.path.startsWith('/admin')
        ? ['Admin auth']
        : item.path.startsWith('/users')
          ? ['Users']
          : item.path.includes('session') ||
              item.path.includes('venue') ||
              item.path.includes('sport') ||
              item.path.includes('join') ||
              item.path.includes('price-consent') ||
              item.path.includes('notification') ||
              item.path.includes('report') ||
              item.path.includes('/me/sessions') ||
              item.path.includes('payment')
            ? ['Sessions']
            : ['Auth'],
      summary: item.summary,
      request: item.body
        ? { body: { content: { 'application/json': { schema: item.body } } } }
        : undefined,
      responses: {
        [item.status ?? (item.ok ? 200 : 204)]: item.ok
          ? json(item.ok, 'OK')
          : { description: item.summary },
        default: errorResponse,
      },
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'PlayAround API',
      version,
      description:
        'MVP v1. See docs/api/api-specification.md. Phase 10 launch tooling is local-only; production remains blocked on L-05/L-07/L-08/L-09.',
    },
    servers: [{ url: '/api/v1' }],
  });
}

export function createDocsRouter(version: string): Router {
  const document = buildOpenApiDocument(version);
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(document));
  router.use('/', swaggerUi.serve, swaggerUi.setup(document));
  return router;
}
