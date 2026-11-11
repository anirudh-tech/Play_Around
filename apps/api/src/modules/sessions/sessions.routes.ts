import {
  AttendanceBody,
  CancelSessionBody,
  CreateSessionBody,
  CreateVenueBody,
  JoinBody,
  NearbyQuery,
  MinPlayersDecisionBody,
  OrganiserPlayingBody,
  PatchSessionBody,
  PatchVenueBookingBody,
  ProposeVenueOptionBody,
  SessionIdParams,
  VenueBookingBody,
} from '@playaround/contracts';
import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env';
import type { Database } from '../../lib/prisma';
import {
  createRequireAuth,
  createRequireVerifiedEmail,
  requireStaff,
  requireVerifiedPhone,
} from '../../middleware/auth';
import { requireIdempotency } from '../../middleware/idempotency';
import { createNearbyLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { nearbySessions } from '../discovery/discovery.service';
import * as join from './join.service';
import * as sessions from './session.service';
import * as venues from '../venues/venues.service';

export function createSessionsRouter(env: Env, db: Database, now: () => Date): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env, db);
  const requireVerifiedEmail = createRequireVerifiedEmail(env);
  const ctx = () => ({ db, now });
  const idemp = requireIdempotency(db);

  router.get('/sports', async (_req, res) => {
    const rows = await venues.listSports(db);
    res.json({ data: rows });
  });

  router.get('/venues', requireAuth, async (req, res) => {
    const data = await venues.searchVenues(db, {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      sportId: req.query.sportId ? Number(req.query.sportId) : undefined,
    });
    res.json({ data });
  });

  router.get('/venues/nearby', requireAuth, async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radiusKm ?? 5);
    const data = await venues.nearbyVenues(db, {
      lat,
      lng,
      radiusKm,
      sportId: req.query.sportId ? Number(req.query.sportId) : undefined,
    });
    res.json({ data });
  });

  router.get('/venues/:id', requireAuth, validate({ params: SessionIdParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await venues.getVenue(db, params.id) });
  });

  router.post(
    '/venues',
    requireAuth,
    requireVerifiedPhone,
    validate({ body: CreateVenueBody }),
    async (_req, res) => {
      const body = res.locals.validated!.body as CreateVenueBody;
      const data = await venues.createVenue(ctx(), res.locals.auth!.id, body);
      res.status(201).json({ data });
    },
  );

  router.post(
    '/sessions',
    requireAuth,
    requireVerifiedPhone,
    idemp,
    validate({ body: CreateSessionBody }),
    async (_req, res) => {
      const body = res.locals.validated!.body as CreateSessionBody;
      const data = await sessions.createSession(ctx(), res.locals.auth!.id, body);
      res.status(201).json({ data });
    },
  );

  router.get(
    '/sessions/nearby',
    requireAuth,
    createNearbyLimiter(env),
    validate({ query: NearbyQuery }),
    async (_req, res) => {
      const query = res.locals.validated!.query as NearbyQuery;
      const result = await nearbySessions(db, res.locals.auth!.id, query, now());
      res.json(result);
    },
  );

  router.get('/sessions/:id', validate({ params: SessionIdParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    const { summary } = await sessions.getSession(ctx(), params.id);
    res.json({ data: summary });
  });

  router.patch(
    '/sessions/:id',
    requireAuth,
    validate({ params: SessionIdParams, body: PatchSessionBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as PatchSessionBody;
      res.json({ data: await sessions.patchSession(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/sessions/:id/cancel',
    requireAuth,
    idemp,
    validate({ params: SessionIdParams, body: CancelSessionBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = (res.locals.validated!.body ?? {}) as CancelSessionBody;
      res.json({
        data: await sessions.cancelSession(ctx(), params.id, res.locals.auth!.id, 'ORGANISER_CANCELLED', body.note),
      });
    },
  );

  router.post(
    '/sessions/:id/min-players-decision',
    requireAuth,
    validate({ params: SessionIdParams, body: MinPlayersDecisionBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as MinPlayersDecisionBody;
      res.json({ data: await sessions.decideMinPlayers(ctx(), params.id, res.locals.auth!.id, body.decision) });
    },
  );

  router.put(
    '/sessions/:id/organiser-participation',
    requireAuth,
    validate({ params: SessionIdParams, body: OrganiserPlayingBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as OrganiserPlayingBody;
      res.json({ data: await sessions.setOrganiserPlaying(ctx(), params.id, res.locals.auth!.id, body.playing) });
    },
  );

  router.get('/sessions/:id/events', requireAuth, validate({ params: SessionIdParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await sessions.listEvents(ctx(), params.id, res.locals.auth!.id) });
  });

  router.get('/me/sessions', requireAuth, async (req, res) => {
    const role = (req.query.role as 'organised' | 'joined' | 'interested') ?? 'joined';
    const bucket = (req.query.bucket as 'upcoming' | 'completed' | 'cancelled') ?? 'upcoming';
    res.json({ data: await sessions.mySessions(ctx(), res.locals.auth!.id, role, bucket) });
  });

  router.get(
    '/sessions/:id/venue-arrangement',
    requireAuth,
    validate({ params: SessionIdParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await sessions.getVenueArrangement(ctx(), params.id, res.locals.auth!.id) });
    },
  );

  router.post(
    '/sessions/:id/venue-options',
    requireAuth,
    requireStaff,
    validate({ params: SessionIdParams, body: ProposeVenueOptionBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as ProposeVenueOptionBody;
      const data = await sessions.proposeVenueOption(ctx(), params.id, res.locals.auth!.id, body);
      res.status(201).json({ data });
    },
  );

  router.post(
    '/sessions/:id/venue-options/:optionId/approve',
    requireAuth,
    validate({ params: z.object({ id: z.uuid(), optionId: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string; optionId: string };
      res.json({ data: await sessions.decideVenueOption(ctx(), params.id, res.locals.auth!.id, params.optionId, true) });
    },
  );

  router.post(
    '/sessions/:id/venue-options/:optionId/reject',
    requireAuth,
    validate({ params: z.object({ id: z.uuid(), optionId: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string; optionId: string };
      res.json({ data: await sessions.decideVenueOption(ctx(), params.id, res.locals.auth!.id, params.optionId, false) });
    },
  );

  router.post(
    '/sessions/:id/venue-booking',
    requireAuth,
    idemp,
    validate({ params: SessionIdParams, body: VenueBookingBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as VenueBookingBody;
      res.json({ data: await sessions.recordVenueBooking(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.patch(
    '/sessions/:id/venue-booking',
    requireAuth,
    validate({ params: SessionIdParams, body: PatchVenueBookingBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as PatchVenueBookingBody;
      res.json({ data: await sessions.patchVenueBooking(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/sessions/:id/interest',
    requireAuth,
    requireVerifiedEmail,
    validate({ params: SessionIdParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      await join.toggleInterest(ctx(), params.id, res.locals.auth!.id, true);
      res.status(204).send();
    },
  );

  router.delete(
    '/sessions/:id/interest',
    requireAuth,
    validate({ params: SessionIdParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      await join.toggleInterest(ctx(), params.id, res.locals.auth!.id, false);
      res.status(204).send();
    },
  );

  router.post(
    '/sessions/:id/join',
    requireAuth,
    requireVerifiedEmail,
    idemp,
    validate({ params: SessionIdParams, body: JoinBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = (res.locals.validated!.body ?? {}) as JoinBody;
      const result = await join.joinSession(ctx(), params.id, res.locals.auth!.id, body.expectedVersion);
      res.status(201).json({ data: { participant: result.participant, payment: result.payment } });
    },
  );

  router.post(
    '/sessions/:id/leave',
    requireAuth,
    idemp,
    validate({ params: SessionIdParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await join.leaveSession(ctx(), params.id, res.locals.auth!.id) });
    },
  );

  router.get('/sessions/:id/participants', requireAuth, validate({ params: SessionIdParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await join.listParticipants(ctx(), params.id, res.locals.auth!.id) });
  });

  router.delete(
    '/sessions/:id/participants/:userId',
    requireAuth,
    validate({ params: z.object({ id: z.uuid(), userId: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string; userId: string };
      await join.removeParticipant(ctx(), params.id, res.locals.auth!.id, params.userId);
      res.status(204).send();
    },
  );

  router.put(
    '/sessions/:id/participants/:userId/attendance',
    requireAuth,
    validate({ params: z.object({ id: z.uuid(), userId: z.uuid() }), body: AttendanceBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string; userId: string };
      const body = res.locals.validated!.body as AttendanceBody;
      await join.markAttendance(ctx(), params.id, res.locals.auth!.id, params.userId, body.status);
      res.status(204).send();
    },
  );

  router.post(
    '/price-consents/:id/accept',
    requireAuth,
    validate({ params: z.object({ id: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      await join.respondPriceConsent(ctx(), params.id, res.locals.auth!.id, true);
      res.status(204).send();
    },
  );

  router.post(
    '/price-consents/:id/reject',
    requireAuth,
    validate({ params: z.object({ id: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      await join.respondPriceConsent(ctx(), params.id, res.locals.auth!.id, false);
      res.status(204).send();
    },
  );

  return router;
}
