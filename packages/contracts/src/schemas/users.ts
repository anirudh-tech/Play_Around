import { z } from 'zod';
import { SkillLevel, UserRole } from '../enums';
import { Uuid } from './common';
import { AuthUser } from './auth';

export const MeResponse = z.object({
  data: AuthUser.extend({
    favouriteSports: z.array(
      z.object({
        sportId: z.number().int(),
        skillLevel: SkillLevel,
      }),
    ),
  }),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const PublicProfile = z.object({
  id: Uuid,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  ratingAvg: z.number(),
  ratingCount: z.number().int(),
  role: UserRole,
});

export const PublicProfileResponse = z.object({
  data: PublicProfile,
});

export const UserReviewsResponse = z.object({
  data: z.array(z.unknown()),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
