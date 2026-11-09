import { z } from 'zod';
import {
  PaymentDisputeReason,
  PaymentMethod,
  PaymentStatus,
} from '../enums';
import { Fils, Money } from '../money';
import { Uuid } from './common';

export const PaymentIdParams = z.object({ id: Uuid });

export const PaymentDto = z.object({
  id: Uuid,
  status: PaymentStatus,
  amountDue: Money,
  agreedAmount: Money,
  amountPaid: Money,
  refundedAmount: Money,
  lastMethod: PaymentMethod.nullable().optional(),
  lastReference: z.string().nullable().optional(),
  participantStatus: z.string(),
  session: z.object({ id: Uuid, title: z.string(), startsAt: z.string() }),
  payer: z.object({ id: Uuid, displayName: z.string() }),
  payee: z.object({ id: Uuid, displayName: z.string() }),
  openDispute: z
    .object({
      id: Uuid,
      reason: z.string(),
      description: z.string().nullable(),
      openedById: Uuid,
    })
    .nullable(),
  log: z.array(z.unknown()),
  version: z.number().int(),
});
export type PaymentDto = z.infer<typeof PaymentDto>;

export const PaymentResponse = z.object({ data: PaymentDto });
export const PaymentListResponse = z.object({ data: z.array(PaymentDto) });
export const SessionPaymentsResponse = z.object({
  data: z.object({
    payments: z.array(PaymentDto),
    totals: z.object({ due: Money, paid: Money, refunded: Money }),
  }),
});

export const ReportPaymentBody = z.object({
  method: PaymentMethod,
  reference: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type ReportPaymentBody = z.infer<typeof ReportPaymentBody>;

export const ConfirmPaymentBody = z.object({
  amountFils: Fils.optional(),
  method: PaymentMethod.optional(),
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type ConfirmPaymentBody = z.infer<typeof ConfirmPaymentBody>;

export const WaivePaymentBody = z.object({
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type WaivePaymentBody = z.infer<typeof WaivePaymentBody>;

export const RefundPaymentBody = z.object({
  amountFils: Fils,
  method: PaymentMethod.optional(),
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type RefundPaymentBody = z.infer<typeof RefundPaymentBody>;

export const OpenDisputeBody = z.object({
  reason: PaymentDisputeReason,
  description: z.string().max(1000).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type OpenDisputeBody = z.infer<typeof OpenDisputeBody>;

export const RejectReportBody = OpenDisputeBody;
export type RejectReportBody = OpenDisputeBody;

export const RetractReportBody = z.object({
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type RetractReportBody = z.infer<typeof RetractReportBody>;

export const AdminReasonBody = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const AdminPaymentActionBody = ConfirmPaymentBody.and(AdminReasonBody);
export type AdminPaymentActionBody = z.infer<typeof AdminPaymentActionBody>;
export const AdminWaiveBody = WaivePaymentBody.and(AdminReasonBody);
export type AdminWaiveBody = z.infer<typeof AdminWaiveBody>;
export const AdminRefundBody = RefundPaymentBody.and(AdminReasonBody);
export type AdminRefundBody = z.infer<typeof AdminRefundBody>;
export const AdminCorrectStatusBody = z.object({
  status: PaymentStatus,
  note: z.string().max(500).optional(),
  reason: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type AdminCorrectStatusBody = z.infer<typeof AdminCorrectStatusBody>;

export const ResolveDisputeBody = z.object({
  resolutionStatus: PaymentStatus,
  note: z.string().trim().min(1).max(1000),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type ResolveDisputeBody = z.infer<typeof ResolveDisputeBody>;

export const PatchVenueBookingBody = z.object({
  bookingReference: z.string().max(80).optional(),
  venuePaymentStatus: z.enum(['NOT_PAID', 'PAID']).optional(),
});
export type PatchVenueBookingBody = z.infer<typeof PatchVenueBookingBody>;

export const AdminVenueBookingBody = z.object({
  venueOptionId: Uuid,
  totalCostFils: Fils.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  bookingReference: z.string().max(80).optional(),
  venuePaymentStatus: z.enum(['NOT_PAID', 'PAID']).optional(),
  reason: z.string().trim().min(1).max(500),
});
export type AdminVenueBookingBody = z.infer<typeof AdminVenueBookingBody>;

export const AdminProposeVenueOptionBody = z.object({
  venueId: Uuid,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  totalCostFils: Fils,
  notes: z.string().max(500).optional(),
  reason: z.string().trim().min(1).max(500),
});
export type AdminProposeVenueOptionBody = z.infer<typeof AdminProposeVenueOptionBody>;

export const PatchVenueOptionBody = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  totalCostFils: Fils.optional(),
  notes: z.string().max(500).optional(),
  reason: z.string().trim().min(1).max(500),
});
export type PatchVenueOptionBody = z.infer<typeof PatchVenueOptionBody>;

export const AssignArrangementBody = z.object({
  assigneeId: Uuid,
  reason: z.string().trim().min(1).max(500),
});
export type AssignArrangementBody = z.infer<typeof AssignArrangementBody>;

export const PatchArrangementBody = z.object({
  status: z.enum(['IN_PROGRESS', 'UNSUCCESSFUL', 'CANCELLED']).optional(),
  staffNotes: z.string().max(5000).optional(),
  reason: z.string().trim().min(1).max(500),
});
export type PatchArrangementBody = z.infer<typeof PatchArrangementBody>;

/** Rejects card-number-shaped strings (O-10). */
export function assertPaymentReference(reference: string | undefined) {
  if (!reference) return;
  const digits = reference.replace(/\D/g, '');
  if (digits.length >= 13 && digits.length <= 19) {
    throw new Error('CARD_LIKE_REFERENCE');
  }
}
