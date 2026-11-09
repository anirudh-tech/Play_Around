import { z } from 'zod';

// Must stay identical to the enums in apps/api/prisma/schema.prisma.

export const UserRole = z.enum(['USER', 'SUPPORT', 'OPERATIONS', 'SUPER_ADMIN']);
export type UserRole = z.infer<typeof UserRole>;
export const STAFF_ROLES = ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] as const satisfies UserRole[];

export const UserStatus = z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']);
export type UserStatus = z.infer<typeof UserStatus>;

export const AuthProvider = z.enum(['GOOGLE', 'APPLE']);
export type AuthProvider = z.infer<typeof AuthProvider>;

export const VerificationPurpose = z.enum([
  'EMAIL_VERIFY',
  'EMAIL_CHANGE',
  'PASSWORD_RESET',
  'PHONE_VERIFY',
]);
export type VerificationPurpose = z.infer<typeof VerificationPurpose>;

export const ClientKind = z.enum(['ios', 'android', 'web', 'admin']);
export type ClientKind = z.infer<typeof ClientKind>;

export const SkillLevel = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL']);
export type SkillLevel = z.infer<typeof SkillLevel>;

export const DevicePlatform = z.enum(['IOS', 'ANDROID', 'WEB']);
export type DevicePlatform = z.infer<typeof DevicePlatform>;

export const SessionType = z.enum(['EXISTING_BOOKING', 'LOOKING_FOR_PLAYERS']);
export type SessionType = z.infer<typeof SessionType>;

export const SessionStatus = z.enum(['OPEN', 'FULL', 'CANCELLED', 'COMPLETED', 'EXPIRED']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const VenueConfirmationStatus = z.enum(['PENDING', 'CONFIRMED', 'LAPSED']);
export type VenueConfirmationStatus = z.infer<typeof VenueConfirmationStatus>;

export const LocationPrecision = z.enum(['EXACT', 'AREA']);
export type LocationPrecision = z.infer<typeof LocationPrecision>;

export const DistanceBand = z.enum(['LE_2', 'LE_5', 'LE_10', 'LE_25', 'GT_25']);
export type DistanceBand = z.infer<typeof DistanceBand>;

export const DiscoverySort = z.enum(['distance', 'soonest', 'price', 'recommended']);
export type DiscoverySort = z.infer<typeof DiscoverySort>;

export const TimeOfDay = z.enum(['morning', 'afternoon', 'evening', 'night']);
export type TimeOfDay = z.infer<typeof TimeOfDay>;

export const SessionVisibility = z.enum(['PUBLIC', 'UNLISTED']);
export type SessionVisibility = z.infer<typeof SessionVisibility>;

export const SessionCancellationReason = z.enum([
  'ORGANISER_CANCELLED',
  'ADMIN_CANCELLED',
  'VENUE_NOT_CONFIRMED',
  'MINIMUM_NOT_MET_ORGANISER_CANCELLED',
  'MINIMUM_NOT_MET_NO_DECISION',
  'ORGANISER_ACCOUNT_DELETED',
]);
export type SessionCancellationReason = z.infer<typeof SessionCancellationReason>;

export const MinPlayersDecision = z.enum(['PROCEED', 'CANCEL']);
export type MinPlayersDecision = z.infer<typeof MinPlayersDecision>;

export const ParticipantRole = z.enum(['ORGANISER', 'PLAYER']);
export type ParticipantRole = z.infer<typeof ParticipantRole>;

export const ParticipantStatus = z.enum(['CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW']);
export type ParticipantStatus = z.infer<typeof ParticipantStatus>;

export const ParticipantCancellationReason = z.enum([
  'LEFT',
  'REMOVED_BY_ORGANISER',
  'REMOVED_BY_ADMIN',
  'SESSION_CANCELLED',
  'PRICE_REJECTED',
  'PRICE_NOT_ACCEPTED',
]);
export type ParticipantCancellationReason = z.infer<typeof ParticipantCancellationReason>;

export const PriceConsentStatus = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
]);
export type PriceConsentStatus = z.infer<typeof PriceConsentStatus>;

export const VenueArrangementStatus = z.enum([
  'REQUESTED',
  'IN_PROGRESS',
  'OPTIONS_PROPOSED',
  'APPROVED',
  'BOOKED',
  'UNSUCCESSFUL',
  'CANCELLED',
]);
export type VenueArrangementStatus = z.infer<typeof VenueArrangementStatus>;

export const VenueOptionStatus = z.enum(['PROPOSED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED']);
export type VenueOptionStatus = z.infer<typeof VenueOptionStatus>;

export const VenuePaymentStatus = z.enum(['NOT_PAID', 'PAID']);
export type VenuePaymentStatus = z.infer<typeof VenuePaymentStatus>;

export const PaymentStatus = z.enum([
  'UNPAID',
  'PAYMENT_REPORTED',
  'PAID',
  'PAYMENT_DISPUTED',
  'WAIVED',
  'REFUNDED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentMethod = z.enum(['CASH', 'BANK_TRANSFER', 'PAYMENT_APP', 'OTHER']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentActorRole = z.enum(['PLAYER', 'ORGANISER', 'ADMIN', 'SYSTEM']);
export type PaymentActorRole = z.infer<typeof PaymentActorRole>;

export const PaymentAction = z.enum([
  'REPORTED_BY_PLAYER',
  'REPORT_RETRACTED',
  'CONFIRMED_BY_ORGANISER',
  'CONFIRMED_BY_ADMIN',
  'REPORT_REJECTED',
  'WAIVED',
  'REFUND_RECORDED',
  'AMOUNT_CHANGED',
  'DISPUTE_OPENED',
  'DISPUTE_RESOLVED',
  'DISPUTE_WITHDRAWN',
  'STATUS_CORRECTED',
]);
export type PaymentAction = z.infer<typeof PaymentAction>;

export const PaymentDisputeReason = z.enum([
  'PAYMENT_NOT_RECEIVED',
  'PAYMENT_NOT_ACKNOWLEDGED',
  'REFUND_NOT_RECEIVED',
  'AMOUNT_INCORRECT',
  'OTHER',
]);
export type PaymentDisputeReason = z.infer<typeof PaymentDisputeReason>;

export const PaymentDisputeStatus = z.enum(['OPEN', 'RESOLVED', 'WITHDRAWN']);
export type PaymentDisputeStatus = z.infer<typeof PaymentDisputeStatus>;

export const NotificationType = z.enum([
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'PLAYER_REMOVED',
  'SESSION_FULL',
  'SESSION_REOPENED',
  'SESSION_JOINABLE',
  'SESSION_UPDATED',
  'SESSION_CANCELLED',
  'SESSION_REMINDER',
  'PRICE_CHANGED',
  'PRICE_CONSENT_REQUIRED',
  'PRICE_CONSENT_REMINDER',
  'MIN_PLAYERS_DECISION_REQUIRED',
  'VENUE_OPTIONS_PROPOSED',
  'VENUE_CONFIRMED',
  'VENUE_DEADLINE_APPROACHING',
  'PAYMENT_REPORTED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_WAIVED',
  'REFUND_RECORDED',
  'PAYMENT_DISPUTED',
  'PAYMENT_DISPUTE_RESOLVED',
  'PAYMENT_REMINDER',
  'REVIEW_RECEIVED',
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const ReportTargetType = z.enum(['USER', 'SESSION', 'REVIEW']);
export type ReportTargetType = z.infer<typeof ReportTargetType>;

export const ReportStatus = z.enum(['OPEN', 'ACTIONED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof ReportStatus>;
