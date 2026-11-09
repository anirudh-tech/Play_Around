import { z } from 'zod';
import { AuthProvider, ClientKind, DevicePlatform, SkillLevel, UserRole, UserStatus } from '../enums';
import { isCommonPassword } from '../passwords';
import { Uuid } from './common';

export const Email = z
  .email()
  .max(191)
  .transform((value) => value.trim().toLowerCase());

export const Password = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(200)
  .refine((value) => !isCommonPassword(value), 'This password is too common.');

export const DisplayName = z.string().trim().min(1).max(60);

export const PhoneE164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be an E.164 phone number.');

export const OtpCode = z.string().regex(/^\d{6}$/);

export const AuthUser = z.object({
  id: Uuid,
  email: z.string(),
  phone: z.string().nullable(),
  phoneVerifiedAt: z.string().datetime().nullable(),
  emailVerifiedAt: z.string().datetime().nullable(),
  role: UserRole,
  status: UserStatus,
  profile: z.object({
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    homeAreaLabel: z.string().nullable(),
    defaultRadiusKm: z.number().int(),
    notificationPrefs: z.unknown().nullable(),
    ratingAvg: z.number(),
    ratingCount: z.number().int(),
  }),
});
export type AuthUser = z.infer<typeof AuthUser>;

export const AuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int(),
  user: AuthUser,
});
export type AuthTokens = z.infer<typeof AuthTokens>;

export const RegisterBody = z.object({
  email: Email,
  password: Password,
  displayName: DisplayName,
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({
  email: Email,
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const GoogleAuthBody = z.object({
  idToken: z.string().min(1),
});
export type GoogleAuthBody = z.infer<typeof GoogleAuthBody>;

export const AppleAuthBody = z.object({
  identityToken: z.string().min(1),
  authorizationCode: z.string().min(1).optional(),
  fullName: z.string().trim().min(1).max(60).optional(),
});
export type AppleAuthBody = z.infer<typeof AppleAuthBody>;

export const RefreshBody = z.object({
  refreshToken: z.string().min(1).nullish(),
});
export type RefreshBody = z.infer<typeof RefreshBody>;

export const VerifyEmailBody = z.object({
  code: OtpCode,
});
export type VerifyEmailBody = z.infer<typeof VerifyEmailBody>;

export const ForgotPasswordBody = z.object({
  email: Email,
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBody>;

export const ResetPasswordBody = z.object({
  email: Email,
  code: OtpCode,
  password: Password,
});
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;

export const LinkIdentityBody = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('GOOGLE'), idToken: z.string().min(1) }),
  z.object({
    provider: z.literal('APPLE'),
    identityToken: z.string().min(1),
    fullName: z.string().trim().min(1).max(60).optional(),
  }),
]);
export type LinkIdentityBody = z.infer<typeof LinkIdentityBody>;

export const IdentityProviderParams = z.object({
  provider: AuthProvider,
});

export const AuthIdentityItem = z.object({
  provider: AuthProvider,
  email: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AuthIdentitiesResponse = z.object({
  data: z.array(AuthIdentityItem),
});

export const AuthTokensResponse = z.object({
  data: AuthTokens,
});

export const ClientHeader = ClientKind;

export const DeviceBody = z.object({
  platform: DevicePlatform,
  pushToken: z.string().min(8).max(255),
});
export type DeviceBody = z.infer<typeof DeviceBody>;

export const FavouriteSportItem = z.object({
  sportId: z.coerce.number().int().positive(),
  skillLevel: SkillLevel,
});

export const FavouriteSportsBody = z.array(FavouriteSportItem).max(20);
export type FavouriteSportsBody = z.infer<typeof FavouriteSportsBody>;

export const PatchMeBody = z
  .object({
    displayName: DisplayName.optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    avatarUrl: z.url().max(500).nullable().optional(),
    homeAreaLabel: z.string().trim().max(120).nullable().optional(),
    defaultRadiusKm: z.number().int().min(1).max(50).optional(),
    notificationPrefs: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No fields to update.');
export type PatchMeBody = z.infer<typeof PatchMeBody>;

export const ChangeEmailBody = z.object({
  password: z.string().min(1),
  email: Email,
});
export type ChangeEmailBody = z.infer<typeof ChangeEmailBody>;

export const PhoneBody = z.object({
  phone: PhoneE164,
});
export type PhoneBody = z.infer<typeof PhoneBody>;

export const AdminLoginBody = LoginBody;
export type AdminLoginBody = z.infer<typeof AdminLoginBody>;

export const AdminMfaBody = z.object({
  mfaToken: z.string().min(1),
  code: OtpCode,
});
export type AdminMfaBody = z.infer<typeof AdminMfaBody>;

export const AdminRecoverBody = z.object({
  mfaToken: z.string().min(1),
  recoveryCode: z.string().trim().min(8).max(32),
});
export type AdminRecoverBody = z.infer<typeof AdminRecoverBody>;
