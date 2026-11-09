import { z } from 'zod';
import { PLATFORM_SETTING_DEFAULTS } from '../settings';
import { Uuid } from './common';
import { CreateVenueBody } from './sessions';

export const AdminReason = z.string().trim().min(1).max(500);

export const AdminSportBody = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.'),
  name: z.string().trim().min(1).max(60),
  iconKey: z.string().trim().min(1).max(40),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  minPlayers: z.number().int().min(1).max(100),
  maxPlayers: z.number().int().min(1).max(100),
  defaultPlayers: z.number().int().min(1).max(100),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  reason: AdminReason,
});
export type AdminSportBody = z.infer<typeof AdminSportBody>;

export const AdminPatchSportBody = AdminSportBody.partial().required({ reason: true });
export type AdminPatchSportBody = z.infer<typeof AdminPatchSportBody>;

export const AdminPatchVenueBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  addressLine: z.string().trim().min(1).max(255).optional(),
  area: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(1).max(80).optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  isVerified: z.boolean().optional(),
  contactPhone: z.string().trim().max(20).nullable().optional(),
  contactEmail: z.string().trim().max(191).nullable().optional(),
  bookingChannel: z.string().trim().max(255).nullable().optional(),
  staffNotes: z.string().trim().max(5000).nullable().optional(),
  reason: AdminReason,
});
export type AdminPatchVenueBody = z.infer<typeof AdminPatchVenueBody>;

export const AdminCreateVenueBody = CreateVenueBody.extend({
  googlePlaceId: z.string().min(1).max(255).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  contactEmail: z.string().trim().max(191).optional(),
  bookingChannel: z.string().trim().max(255).optional(),
  staffNotes: z.string().trim().max(5000).optional(),
  isVerified: z.boolean().optional(),
  reason: AdminReason,
});
export type AdminCreateVenueBody = z.infer<typeof AdminCreateVenueBody>;

export const AdminMergeVenueBody = z.object({
  intoVenueId: Uuid,
  reason: AdminReason,
});
export type AdminMergeVenueBody = z.infer<typeof AdminMergeVenueBody>;

export const AdminPatchReportBody = z.object({
  status: z.enum(['ACTIONED', 'DISMISSED']),
  resolution: z.string().trim().min(1).max(500),
  reason: AdminReason,
});
export type AdminPatchReportBody = z.infer<typeof AdminPatchReportBody>;

export const AdminHideReviewBody = z.object({
  isHidden: z.boolean(),
  reason: AdminReason,
});
export type AdminHideReviewBody = z.infer<typeof AdminHideReviewBody>;

export const AdminPatchSettingBody = z.object({
  value: z.number(),
  reason: AdminReason,
});
export type AdminPatchSettingBody = z.infer<typeof AdminPatchSettingBody>;

export const AdminStaffRoleBody = z.object({
  role: z.enum(['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN']),
  reason: AdminReason,
});
export type AdminStaffRoleBody = z.infer<typeof AdminStaffRoleBody>;

export const AdminUserStatusBody = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: AdminReason,
});
export type AdminUserStatusBody = z.infer<typeof AdminUserStatusBody>;

export const SettingKeyParam = z.enum(
  Object.keys(PLATFORM_SETTING_DEFAULTS) as [
    keyof typeof PLATFORM_SETTING_DEFAULTS,
    ...(keyof typeof PLATFORM_SETTING_DEFAULTS)[],
  ],
);
export type SettingKeyParam = z.infer<typeof SettingKeyParam>;
