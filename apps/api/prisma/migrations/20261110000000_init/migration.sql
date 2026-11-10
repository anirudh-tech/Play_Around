-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPPORT', 'OPERATIONS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFY', 'EMAIL_CHANGE', 'PASSWORD_RESET', 'PHONE_VERIFY');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('EXISTING_BOOKING', 'LOOKING_FOR_PLAYERS');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'FULL', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VenueConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'LAPSED');

-- CreateEnum
CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'AREA');

-- CreateEnum
CREATE TYPE "SessionVisibility" AS ENUM ('PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "SessionCancellationReason" AS ENUM ('ORGANISER_CANCELLED', 'ADMIN_CANCELLED', 'VENUE_NOT_CONFIRMED', 'MINIMUM_NOT_MET_ORGANISER_CANCELLED', 'MINIMUM_NOT_MET_NO_DECISION', 'ORGANISER_ACCOUNT_DELETED');

-- CreateEnum
CREATE TYPE "MinPlayersDecision" AS ENUM ('PROCEED', 'CANCEL');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('ORGANISER', 'PLAYER');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ParticipantCancellationReason" AS ENUM ('LEFT', 'REMOVED_BY_ORGANISER', 'REMOVED_BY_ADMIN', 'SESSION_CANCELLED', 'PRICE_REJECTED', 'PRICE_NOT_ACCEPTED');

-- CreateEnum
CREATE TYPE "PriceConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "VenueArrangementStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'OPTIONS_PROPOSED', 'APPROVED', 'BOOKED', 'UNSUCCESSFUL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VenueOptionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VenuePaymentStatus" AS ENUM ('NOT_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAYMENT_REPORTED', 'PAID', 'PAYMENT_DISPUTED', 'WAIVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'PAYMENT_APP', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentActorRole" AS ENUM ('PLAYER', 'ORGANISER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentAction" AS ENUM ('REPORTED_BY_PLAYER', 'REPORT_RETRACTED', 'CONFIRMED_BY_ORGANISER', 'CONFIRMED_BY_ADMIN', 'REPORT_REJECTED', 'WAIVED', 'REFUND_RECORDED', 'AMOUNT_CHANGED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'DISPUTE_WITHDRAWN', 'STATUS_CORRECTED');

-- CreateEnum
CREATE TYPE "PaymentDisputeReason" AS ENUM ('PAYMENT_NOT_RECEIVED', 'PAYMENT_NOT_ACKNOWLEDGED', 'REFUND_NOT_RECEIVED', 'AMOUNT_INCORRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentDisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_REMOVED', 'SESSION_FULL', 'SESSION_REOPENED', 'SESSION_JOINABLE', 'SESSION_UPDATED', 'SESSION_CANCELLED', 'SESSION_REMINDER', 'PRICE_CHANGED', 'PRICE_CONSENT_REQUIRED', 'PRICE_CONSENT_REMINDER', 'MIN_PLAYERS_DECISION_REQUIRED', 'VENUE_OPTIONS_PROPOSED', 'VENUE_CONFIRMED', 'VENUE_DEADLINE_APPROACHING', 'PAYMENT_REPORTED', 'PAYMENT_CONFIRMED', 'PAYMENT_WAIVED', 'REFUND_RECORDED', 'PAYMENT_DISPUTED', 'PAYMENT_DISPUTE_RESOLVED', 'PAYMENT_REMINDER', 'REVIEW_RECEIVED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'SESSION', 'REVIEW');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" CHAR(36) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "password_hash" VARCHAR(255),
    "phone" VARCHAR(20),
    "phone_verified_at" TIMESTAMPTZ(3),
    "email_verified_at" TIMESTAMPTZ(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(191),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" CHAR(36) NOT NULL,
    "display_name" VARCHAR(60) NOT NULL,
    "avatar_url" VARCHAR(500),
    "bio" VARCHAR(280),
    "home_area_label" VARCHAR(120),
    "home_latitude" DECIMAL(5,2),
    "home_longitude" DECIMAL(5,2),
    "default_radius_km" SMALLINT NOT NULL DEFAULT 5,
    "notification_prefs" JSONB,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_mfa" (
    "user_id" CHAR(36) NOT NULL,
    "totp_secret_enc" VARCHAR(255) NOT NULL,
    "enabled_at" TIMESTAMPTZ(3),
    "recovery_codes" JSONB NOT NULL,
    "failed_count" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),

    CONSTRAINT "user_mfa_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "family_id" CHAR(36) NOT NULL,
    "replaced_by_id" CHAR(36),
    "audience" VARCHAR(10) NOT NULL DEFAULT 'app',
    "user_agent" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "target" VARCHAR(191),
    "code_hash" CHAR(64) NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "push_token" VARCHAR(255) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "icon_key" VARCHAR(40) NOT NULL,
    "accent_color" CHAR(7) NOT NULL,
    "min_players" SMALLINT NOT NULL,
    "max_players" SMALLINT NOT NULL,
    "default_players" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favourite_sports" (
    "user_id" CHAR(36) NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "skill_level" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE',

    CONSTRAINT "user_favourite_sports_pkey" PRIMARY KEY ("user_id","sport_id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" CHAR(36) NOT NULL,
    "google_place_id" VARCHAR(255),
    "name" VARCHAR(120) NOT NULL,
    "address_line" VARCHAR(255) NOT NULL,
    "area" VARCHAR(120),
    "city" VARCHAR(80) NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'AE',
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "contact_phone" VARCHAR(20),
    "contact_email" VARCHAR(191),
    "booking_channel" VARCHAR(255),
    "staff_notes" TEXT,
    "merged_into_id" CHAR(36),
    "created_by_id" CHAR(36),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sports" (
    "venue_id" CHAR(36) NOT NULL,
    "sport_id" INTEGER NOT NULL,

    CONSTRAINT "venue_sports_pkey" PRIMARY KEY ("venue_id","sport_id")
);

-- CreateTable
CREATE TABLE "venue_images" (
    "id" CHAR(36) NOT NULL,
    "venue_id" CHAR(36) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" CHAR(36) NOT NULL,
    "organiser_id" CHAR(36) NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "venue_confirmation_status" "VenueConfirmationStatus" NOT NULL,
    "visibility" "SessionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "venue_id" CHAR(36),
    "preferred_area_label" VARCHAR(120),
    "preferred_area_place_id" VARCHAR(255),
    "area_radius_km" DECIMAL(4,1),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "location_precision" "LocationPrecision" NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "venue_confirm_deadline" TIMESTAMPTZ(3),
    "venue_confirmed_at" TIMESTAMPTZ(3),
    "capacity" SMALLINT NOT NULL,
    "min_players" SMALLINT,
    "min_players_decision_deadline" TIMESTAMPTZ(3),
    "min_players_decision" "MinPlayersDecision",
    "min_players_decided_at" TIMESTAMPTZ(3),
    "organiser_is_playing" BOOLEAN NOT NULL DEFAULT true,
    "confirmed_count" SMALLINT NOT NULL DEFAULT 0,
    "interested_count" SMALLINT NOT NULL DEFAULT 0,
    "skill_level" "SkillLevel",
    "currency" CHAR(3) NOT NULL DEFAULT 'AED',
    "estimated_total_cost_fils" INTEGER,
    "estimated_share_max_fils" INTEGER,
    "total_cost_fils" INTEGER,
    "share_max_fils" INTEGER,
    "title" VARCHAR(100),
    "instructions" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" "SessionCancellationReason",
    "cancellation_note" VARCHAR(280),
    "closed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'PLAYER',
    "status" "ParticipantStatus" NOT NULL,
    "share_slot" SMALLINT,
    "cancellation_reason" "ParticipantCancellationReason",
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),
    "attendance_marked_at" TIMESTAMPTZ(3),
    "attendance_marked_by_id" CHAR(36),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_interests" (
    "session_id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_interests_pkey" PRIMARY KEY ("session_id","user_id")
);

-- CreateTable
CREATE TABLE "session_images" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "actor_id" CHAR(36),
    "type" VARCHAR(60) NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_price_changes" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "created_by_id" CHAR(36) NOT NULL,
    "previous_total_fils" INTEGER NOT NULL,
    "new_total_fils" INTEGER NOT NULL,
    "previous_capacity" SMALLINT NOT NULL,
    "new_capacity" SMALLINT NOT NULL,
    "reason" VARCHAR(280),
    "consent_deadline" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_consents" (
    "id" CHAR(36) NOT NULL,
    "price_change_id" CHAR(36) NOT NULL,
    "participant_id" CHAR(36) NOT NULL,
    "previous_amount_fils" INTEGER NOT NULL,
    "new_amount_fils" INTEGER NOT NULL,
    "status" "PriceConsentStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_arrangements" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "status" "VenueArrangementStatus" NOT NULL DEFAULT 'REQUESTED',
    "assigned_to_id" CHAR(36),
    "staff_notes" TEXT,
    "closed_reason" VARCHAR(280),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venue_arrangements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_options" (
    "id" CHAR(36) NOT NULL,
    "arrangement_id" CHAR(36) NOT NULL,
    "venue_id" CHAR(36) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "total_cost_fils" INTEGER NOT NULL,
    "notes" VARCHAR(500),
    "valid_until" TIMESTAMPTZ(3),
    "status" "VenueOptionStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_by_id" CHAR(36) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_bookings" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "venue_id" CHAR(36) NOT NULL,
    "venue_option_id" CHAR(36),
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "total_cost_fils" INTEGER NOT NULL,
    "booking_reference" VARCHAR(80),
    "venue_payment_status" "VenuePaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
    "venue_paid_at" TIMESTAMPTZ(3),
    "recorded_by_id" CHAR(36) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venue_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "participant_id" CHAR(36) NOT NULL,
    "payer_id" CHAR(36) NOT NULL,
    "payee_id" CHAR(36) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" CHAR(3) NOT NULL DEFAULT 'AED',
    "amount_due_fils" INTEGER NOT NULL,
    "agreed_amount_fils" INTEGER NOT NULL,
    "amount_paid_fils" INTEGER NOT NULL DEFAULT 0,
    "refunded_amount_fils" INTEGER NOT NULL DEFAULT 0,
    "last_method" "PaymentMethod",
    "last_reference" VARCHAR(80),
    "reported_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "waived_at" TIMESTAMPTZ(3),
    "refunded_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_confirmations" (
    "id" CHAR(36) NOT NULL,
    "payment_id" CHAR(36) NOT NULL,
    "actor_id" CHAR(36),
    "actor_role" "PaymentActorRole" NOT NULL,
    "action" "PaymentAction" NOT NULL,
    "from_status" "PaymentStatus",
    "to_status" "PaymentStatus" NOT NULL,
    "amount_fils" INTEGER,
    "method" "PaymentMethod",
    "reference" VARCHAR(80),
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_disputes" (
    "id" CHAR(36) NOT NULL,
    "payment_id" CHAR(36) NOT NULL,
    "opened_by_id" CHAR(36) NOT NULL,
    "reason" "PaymentDisputeReason" NOT NULL,
    "description" VARCHAR(1000),
    "status" "PaymentDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "status_before_dispute" "PaymentStatus" NOT NULL,
    "resolution_status" "PaymentStatus",
    "resolution_note" VARCHAR(1000),
    "resolved_by_id" CHAR(36),
    "open_lock" CHAR(36),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "entity_type" VARCHAR(30),
    "entity_id" CHAR(36),
    "session_id" CHAR(36),
    "actor_id" CHAR(36),
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "pushed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "reviewer_id" CHAR(36) NOT NULL,
    "reviewee_id" CHAR(36) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(500),
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" CHAR(36) NOT NULL,
    "reporter_id" CHAR(36) NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" CHAR(36) NOT NULL,
    "reason" VARCHAR(60) NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" CHAR(36),
    "resolution" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" CHAR(36) NOT NULL,
    "user_id" CHAR(36) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status_code" SMALLINT,
    "response_body" JSONB,
    "locked_until" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" CHAR(36),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" CHAR(36) NOT NULL,
    "actor_id" CHAR(36) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" CHAR(36) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "verification_codes_user_id_purpose_idx" ON "verification_codes"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices"("push_token");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE INDEX "user_favourite_sports_sport_id_idx" ON "user_favourite_sports"("sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "venues_google_place_id_key" ON "venues"("google_place_id");

-- CreateIndex
CREATE INDEX "venues_latitude_longitude_idx" ON "venues"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");

-- CreateIndex
CREATE INDEX "venue_sports_sport_id_idx" ON "venue_sports"("sport_id");

-- CreateIndex
CREATE INDEX "venue_images_venue_id_idx" ON "venue_images"("venue_id");

-- CreateIndex
CREATE INDEX "sessions_status_starts_at_idx" ON "sessions"("status", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_latitude_longitude_idx" ON "sessions"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "sessions_sport_id_status_starts_at_idx" ON "sessions"("sport_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_organiser_id_starts_at_idx" ON "sessions"("organiser_id", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_venue_id_starts_at_idx" ON "sessions"("venue_id", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_venue_confirmation_status_venue_confirm_deadline_idx" ON "sessions"("venue_confirmation_status", "venue_confirm_deadline");

-- CreateIndex
CREATE INDEX "sessions_status_min_players_decision_deadline_idx" ON "sessions"("status", "min_players_decision_deadline");

-- CreateIndex
CREATE INDEX "sessions_status_ends_at_idx" ON "sessions"("status", "ends_at");

-- CreateIndex
CREATE INDEX "session_participants_user_id_status_idx" ON "session_participants"("user_id", "status");

-- CreateIndex
CREATE INDEX "session_participants_session_id_status_idx" ON "session_participants"("session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_user_id_key" ON "session_participants"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_share_slot_key" ON "session_participants"("session_id", "share_slot");

-- CreateIndex
CREATE INDEX "session_interests_user_id_idx" ON "session_interests"("user_id");

-- CreateIndex
CREATE INDEX "session_images_session_id_idx" ON "session_images"("session_id");

-- CreateIndex
CREATE INDEX "session_events_session_id_created_at_idx" ON "session_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "session_price_changes_session_id_created_at_idx" ON "session_price_changes"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "price_consents_participant_id_status_idx" ON "price_consents"("participant_id", "status");

-- CreateIndex
CREATE INDEX "price_consents_status_created_at_idx" ON "price_consents"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "price_consents_price_change_id_participant_id_key" ON "price_consents"("price_change_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_arrangements_session_id_key" ON "venue_arrangements"("session_id");

-- CreateIndex
CREATE INDEX "venue_arrangements_status_created_at_idx" ON "venue_arrangements"("status", "created_at");

-- CreateIndex
CREATE INDEX "venue_arrangements_assigned_to_id_status_idx" ON "venue_arrangements"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "venue_options_arrangement_id_status_idx" ON "venue_options"("arrangement_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "venue_bookings_session_id_key" ON "venue_bookings"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_bookings_venue_option_id_key" ON "venue_bookings"("venue_option_id");

-- CreateIndex
CREATE INDEX "venue_bookings_venue_id_starts_at_idx" ON "venue_bookings"("venue_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_participant_id_key" ON "payments"("participant_id");

-- CreateIndex
CREATE INDEX "payments_session_id_status_idx" ON "payments"("session_id", "status");

-- CreateIndex
CREATE INDEX "payments_payer_id_status_idx" ON "payments"("payer_id", "status");

-- CreateIndex
CREATE INDEX "payments_payee_id_status_idx" ON "payments"("payee_id", "status");

-- CreateIndex
CREATE INDEX "payment_confirmations_payment_id_created_at_idx" ON "payment_confirmations"("payment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_disputes_open_lock_key" ON "payment_disputes"("open_lock");

-- CreateIndex
CREATE INDEX "payment_disputes_status_created_at_idx" ON "payment_disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_disputes_payment_id_idx" ON "payment_disputes"("payment_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_created_at_idx" ON "reviews"("reviewee_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_session_id_reviewer_id_reviewee_id_key" ON "reviews"("session_id", "reviewer_id", "reviewee_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mfa" ADD CONSTRAINT "user_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favourite_sports" ADD CONSTRAINT "user_favourite_sports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favourite_sports" ADD CONSTRAINT "user_favourite_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sports" ADD CONSTRAINT "venue_sports_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sports" ADD CONSTRAINT "venue_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_images" ADD CONSTRAINT "venue_images_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_attendance_marked_by_id_fkey" FOREIGN KEY ("attendance_marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_interests" ADD CONSTRAINT "session_interests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_interests" ADD CONSTRAINT "session_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_images" ADD CONSTRAINT "session_images_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_price_changes" ADD CONSTRAINT "session_price_changes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_price_changes" ADD CONSTRAINT "session_price_changes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_consents" ADD CONSTRAINT "price_consents_price_change_id_fkey" FOREIGN KEY ("price_change_id") REFERENCES "session_price_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_consents" ADD CONSTRAINT "price_consents_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "session_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_arrangements" ADD CONSTRAINT "venue_arrangements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_arrangements" ADD CONSTRAINT "venue_arrangements_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_options" ADD CONSTRAINT "venue_options_arrangement_id_fkey" FOREIGN KEY ("arrangement_id") REFERENCES "venue_arrangements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_options" ADD CONSTRAINT "venue_options_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_options" ADD CONSTRAINT "venue_options_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_venue_option_id_fkey" FOREIGN KEY ("venue_option_id") REFERENCES "venue_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "session_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_confirmations" ADD CONSTRAINT "payment_confirmations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_confirmations" ADD CONSTRAINT "payment_confirmations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CHECK constraints (not expressible in Prisma). Source: docs/database/schema.md §2
ALTER TABLE sessions
  ADD CONSTRAINT chk_sessions_capacity   CHECK (capacity BETWEEN 2 AND 50),
  ADD CONSTRAINT chk_sessions_count      CHECK (confirmed_count BETWEEN 0 AND capacity),
  ADD CONSTRAINT chk_sessions_min        CHECK (min_players IS NULL OR min_players BETWEEN 1 AND capacity),
  ADD CONSTRAINT chk_sessions_time       CHECK (ends_at > starts_at),
  ADD CONSTRAINT chk_sessions_venue      CHECK (venue_confirmation_status <> 'CONFIRMED'
                                                OR (venue_id IS NOT NULL AND total_cost_fils IS NOT NULL)),
  ADD CONSTRAINT chk_sessions_cost       CHECK (COALESCE(total_cost_fils, 0) >= 0
                                                AND COALESCE(estimated_total_cost_fils, 0) >= 0),
  ADD CONSTRAINT chk_sessions_currency   CHECK (currency = 'AED');

ALTER TABLE session_participants
  ADD CONSTRAINT chk_participant_slot    CHECK ((status = 'CANCELLED' AND share_slot IS NULL)
                                                OR (status <> 'CANCELLED' AND share_slot IS NOT NULL));

ALTER TABLE payments
  ADD CONSTRAINT chk_payments_amounts    CHECK (amount_due_fils >= 0 AND agreed_amount_fils >= 0
                                                AND amount_paid_fils >= 0
                                                AND refunded_amount_fils BETWEEN 0 AND amount_paid_fils);

ALTER TABLE venue_options
  ADD CONSTRAINT chk_venue_options       CHECK (ends_at > starts_at AND total_cost_fils >= 0);

ALTER TABLE venue_bookings
  ADD CONSTRAINT chk_venue_bookings      CHECK (ends_at > starts_at AND total_cost_fils >= 0);

ALTER TABLE reviews
  ADD CONSTRAINT chk_reviews_rating      CHECK (rating BETWEEN 1 AND 5);
