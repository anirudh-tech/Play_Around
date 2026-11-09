import { z } from 'zod';
import {
  DiscoverySort,
  DistanceBand,
  LocationPrecision,
  MinPlayersDecision,
  ParticipantStatus,
  PaymentStatus,
  SessionStatus,
  SessionType,
  SkillLevel,
  TimeOfDay,
  VenueConfirmationStatus,
  VenuePaymentStatus,
} from '../enums';
import { Fils, Money } from '../money';
import { Uuid } from './common';

export const CreateVenueBody = z.object({
  googlePlaceId: z.string().min(1).max(255),
  name: z.string().trim().min(1).max(120),
  addressLine: z.string().trim().min(1).max(255),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  countryCode: z.string().length(2).default('AE'),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  sportIds: z.array(z.number().int().positive()).max(10).default([]),
});
export type CreateVenueBody = z.infer<typeof CreateVenueBody>;

const PreferredArea = z.object({
  label: z.string().trim().min(1).max(120),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  radiusKm: z.number().gt(0).lte(50),
  googlePlaceId: z.string().max(255).optional(),
});

export const CreateSessionBody = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('EXISTING_BOOKING'),
    sportId: z.number().int().positive(),
    venue: z.union([
      z.object({ venueId: Uuid }),
      z.object({ newVenue: CreateVenueBody }),
    ]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().positive(),
    minPlayers: z.number().int().positive().optional(),
    organiserIsPlaying: z.boolean().default(true),
    totalCostFils: Fils,
    bookingReference: z.string().max(80).optional(),
    venuePaymentStatus: VenuePaymentStatus.optional(),
    skillLevel: SkillLevel.optional(),
    title: z.string().trim().max(100).optional(),
    instructions: z.string().max(5000).optional(),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('LOOKING_FOR_PLAYERS'),
    sportId: z.number().int().positive(),
    preferredArea: PreferredArea,
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().positive(),
    minPlayers: z.number().int().positive().optional(),
    organiserIsPlaying: z.boolean().default(true),
    estimatedTotalCostFils: Fils,
    skillLevel: SkillLevel.optional(),
    title: z.string().trim().max(100).optional(),
    instructions: z.string().max(5000).optional(),
  }),
]);
export type CreateSessionBody = z.infer<typeof CreateSessionBody>;

export const PatchSessionBody = z
  .object({
    title: z.string().trim().max(100).nullable().optional(),
    instructions: z.string().max(5000).nullable().optional(),
    skillLevel: SkillLevel.nullable().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    capacity: z.number().int().positive().optional(),
    minPlayers: z.number().int().positive().nullable().optional(),
    totalCostFils: Fils.optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
    reason: z.string().max(280).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No fields to update.');
export type PatchSessionBody = z.infer<typeof PatchSessionBody>;

export const CancelSessionBody = z.object({
  note: z.string().max(280).optional(),
  expectedVersion: z.number().int().optional(),
});
export type CancelSessionBody = z.infer<typeof CancelSessionBody>;

export const MinPlayersDecisionBody = z.object({
  decision: MinPlayersDecision,
});
export type MinPlayersDecisionBody = z.infer<typeof MinPlayersDecisionBody>;

export const OrganiserPlayingBody = z.object({
  playing: z.boolean(),
});
export type OrganiserPlayingBody = z.infer<typeof OrganiserPlayingBody>;

export const JoinBody = z.object({
  expectedVersion: z.number().int().optional(),
});
export type JoinBody = z.infer<typeof JoinBody>;

export const AttendanceBody = z.object({
  status: z.enum(['ATTENDED', 'NO_SHOW']),
});
export type AttendanceBody = z.infer<typeof AttendanceBody>;

export const VenueBookingBody = z.object({
  venueOptionId: Uuid,
  totalCostFils: Fils.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  bookingReference: z.string().max(80).optional(),
  venuePaymentStatus: VenuePaymentStatus.optional(),
});
export type VenueBookingBody = z.infer<typeof VenueBookingBody>;

export const ProposeVenueOptionBody = z.object({
  venueId: Uuid,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  totalCostFils: Fils,
  notes: z.string().max(500).optional(),
});
export type ProposeVenueOptionBody = z.infer<typeof ProposeVenueOptionBody>;

export const ReviewBody = z.object({
  revieweeId: Uuid,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
export type ReviewBody = z.infer<typeof ReviewBody>;

export const ReportBody = z.object({
  targetType: z.enum(['USER', 'SESSION', 'REVIEW']),
  targetId: Uuid,
  reason: z.string().min(1).max(60),
  details: z.string().max(1000).optional(),
});
export type ReportBody = z.infer<typeof ReportBody>;

export const SessionIdParams = z.object({ id: Uuid });
export const UserIdParams = z.object({ id: Uuid, userId: Uuid });
export const OptionIdParams = z.object({ id: Uuid, optionId: Uuid });
export const ConsentIdParams = z.object({ id: Uuid });

export const SportDto = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  accentColor: z.string(),
  iconKey: z.string(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  defaultPlayers: z.number().int(),
});

export const SessionSummary = z.object({
  id: Uuid,
  type: SessionType,
  status: SessionStatus,
  venueConfirmationStatus: VenueConfirmationStatus,
  joinable: z.boolean(),
  sport: SportDto.pick({ id: true, slug: true, name: true, accentColor: true }),
  location: z.object({
    precision: LocationPrecision,
    label: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    areaRadiusKm: z.number().nullable(),
    venue: z
      .object({
        id: Uuid,
        name: z.string(),
        area: z.string().nullable(),
        city: z.string(),
      })
      .nullable(),
  }),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string(),
  venueConfirmDeadline: z.string().datetime().nullable(),
  capacity: z.number().int(),
  minPlayers: z.number().int().nullable(),
  confirmedCount: z.number().int(),
  interestedCount: z.number().int(),
  spotsLeft: z.number().int(),
  price: z.object({
    isEstimate: z.boolean(),
    isFree: z.boolean(),
    perPlayerMax: Money.nullable(),
    total: Money.nullable(),
  }),
  paymentNote: z.string(),
  skillLevel: SkillLevel.nullable(),
  organiser: z.object({
    id: Uuid,
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    ratingAvg: z.number(),
    isPlaying: z.boolean(),
  }),
  version: z.number().int(),
  title: z.string().nullable(),
});
export type SessionSummary = z.infer<typeof SessionSummary>;

const boolQuery = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => (value == null ? undefined : value === 'true' || value === '1'));

function splitCsv(value: string | undefined) {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

export const NearbyQuery = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  radiusKm: z.coerce.number().gte(0.5).lte(50).optional(),
  autoExpand: boolQuery,
  joinableOnly: boolQuery,
  sportIds: z
    .string()
    .optional()
    .transform((value) => splitCsv(value)?.map(Number))
    .pipe(z.array(z.number().int().positive()).optional()),
  types: z
    .string()
    .optional()
    .transform(splitCsv)
    .pipe(z.array(SessionType).optional()),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  timeOfDay: z
    .string()
    .optional()
    .transform(splitCsv)
    .pipe(z.array(TimeOfDay).optional()),
  minPriceFils: z.coerce.number().int().nonnegative().optional(),
  maxPriceFils: z.coerce.number().int().nonnegative().optional(),
  minSpots: z.coerce.number().int().min(1).optional(),
  skillLevel: SkillLevel.optional(),
  sort: DiscoverySort.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(500).optional(),
});
export type NearbyQuery = z.infer<typeof NearbyQuery>;

export const NearbySession = SessionSummary.extend({
  distanceKm: z.number(),
  band: DistanceBand,
  participantPreview: z.array(z.object({ id: Uuid, avatarUrl: z.string().nullable() })),
  viewer: z.object({
    participantStatus: ParticipantStatus.nullable(),
    isInterested: z.boolean(),
    paymentStatus: z.string().nullable(),
    amountDue: Money.nullable(),
    pendingPriceConsentId: Uuid.nullable(),
  }),
});
export type NearbySession = z.infer<typeof NearbySession>;

export const NearbyResponse = z.object({
  data: z.array(NearbySession),
  meta: z.object({
    requestedRadiusKm: z.number(),
    radiusUsedKm: z.number(),
    expanded: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});
export type NearbyResponse = z.infer<typeof NearbyResponse>;

export const SessionSummaryResponse = z.object({ data: SessionSummary });
export const SessionListResponse = z.object({ data: z.array(SessionSummary) });
export const JoinResponse = z.object({
  data: z.object({
    participant: z.object({
      id: Uuid,
      status: z.string(),
      shareSlot: z.number().int().nullable(),
    }),
    payment: z
      .object({
        id: Uuid,
        status: PaymentStatus,
        amountDue: Money,
        payTo: z.object({ organiserId: Uuid, displayName: z.string() }),
      })
      .nullable(),
  }),
});
export type JoinResponse = z.infer<typeof JoinResponse>;
