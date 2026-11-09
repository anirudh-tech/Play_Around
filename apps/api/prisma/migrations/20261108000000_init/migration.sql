-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `phone_verified_at` DATETIME(3) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `role` ENUM('USER', 'SUPPORT', 'OPERATIONS', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_identities` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `provider` ENUM('GOOGLE', 'APPLE') NOT NULL,
    `provider_user_id` VARCHAR(255) NOT NULL,
    `email` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auth_identities_user_id_idx`(`user_id`),
    UNIQUE INDEX `auth_identities_provider_provider_user_id_key`(`provider`, `provider_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profiles` (
    `user_id` CHAR(36) NOT NULL,
    `display_name` VARCHAR(60) NOT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `bio` VARCHAR(280) NULL,
    `home_area_label` VARCHAR(120) NULL,
    `home_latitude` DECIMAL(5, 2) NULL,
    `home_longitude` DECIMAL(5, 2) NULL,
    `default_radius_km` SMALLINT NOT NULL DEFAULT 5,
    `notification_prefs` JSON NULL,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `rating_count` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_mfa` (
    `user_id` CHAR(36) NOT NULL,
    `totp_secret_enc` VARCHAR(255) NOT NULL,
    `enabled_at` DATETIME(3) NULL,
    `recovery_codes` JSON NOT NULL,
    `failed_count` SMALLINT NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `family_id` CHAR(36) NOT NULL,
    `replaced_by_id` CHAR(36) NULL,
    `audience` VARCHAR(10) NOT NULL DEFAULT 'app',
    `user_agent` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_family_id_idx`(`family_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_codes` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `purpose` ENUM('EMAIL_VERIFY', 'EMAIL_CHANGE', 'PASSWORD_RESET', 'PHONE_VERIFY') NOT NULL,
    `target` VARCHAR(191) NULL,
    `code_hash` CHAR(64) NOT NULL,
    `attempts` TINYINT NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `verification_codes_user_id_purpose_idx`(`user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `platform` ENUM('IOS', 'ANDROID', 'WEB') NOT NULL,
    `push_token` VARCHAR(255) NOT NULL,
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `devices_push_token_key`(`push_token`),
    INDEX `devices_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(40) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `icon_key` VARCHAR(40) NOT NULL,
    `accent_color` CHAR(7) NOT NULL,
    `min_players` SMALLINT NOT NULL,
    `max_players` SMALLINT NOT NULL,
    `default_players` SMALLINT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` SMALLINT NOT NULL DEFAULT 0,

    UNIQUE INDEX `sports_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_favourite_sports` (
    `user_id` CHAR(36) NOT NULL,
    `sport_id` INTEGER NOT NULL,
    `skill_level` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL') NOT NULL DEFAULT 'INTERMEDIATE',

    INDEX `user_favourite_sports_sport_id_idx`(`sport_id`),
    PRIMARY KEY (`user_id`, `sport_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venues` (
    `id` CHAR(36) NOT NULL,
    `google_place_id` VARCHAR(255) NULL,
    `name` VARCHAR(120) NOT NULL,
    `address_line` VARCHAR(255) NOT NULL,
    `area` VARCHAR(120) NULL,
    `city` VARCHAR(80) NOT NULL,
    `country_code` CHAR(2) NOT NULL DEFAULT 'AE',
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `contact_phone` VARCHAR(20) NULL,
    `contact_email` VARCHAR(191) NULL,
    `booking_channel` VARCHAR(255) NULL,
    `staff_notes` TEXT NULL,
    `merged_into_id` CHAR(36) NULL,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `venues_google_place_id_key`(`google_place_id`),
    INDEX `venues_latitude_longitude_idx`(`latitude`, `longitude`),
    INDEX `venues_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_sports` (
    `venue_id` CHAR(36) NOT NULL,
    `sport_id` INTEGER NOT NULL,

    INDEX `venue_sports_sport_id_idx`(`sport_id`),
    PRIMARY KEY (`venue_id`, `sport_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_images` (
    `id` CHAR(36) NOT NULL,
    `venue_id` CHAR(36) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `public_id` VARCHAR(255) NOT NULL,
    `sort_order` SMALLINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `venue_images_venue_id_idx`(`venue_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `organiser_id` CHAR(36) NOT NULL,
    `sport_id` INTEGER NOT NULL,
    `session_type` ENUM('EXISTING_BOOKING', 'LOOKING_FOR_PLAYERS') NOT NULL,
    `status` ENUM('OPEN', 'FULL', 'CANCELLED', 'COMPLETED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `venue_confirmation_status` ENUM('PENDING', 'CONFIRMED', 'LAPSED') NOT NULL,
    `visibility` ENUM('PUBLIC', 'UNLISTED') NOT NULL DEFAULT 'PUBLIC',
    `venue_id` CHAR(36) NULL,
    `preferred_area_label` VARCHAR(120) NULL,
    `preferred_area_place_id` VARCHAR(255) NULL,
    `area_radius_km` DECIMAL(4, 1) NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `location_precision` ENUM('EXACT', 'AREA') NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `venue_confirm_deadline` DATETIME(3) NULL,
    `venue_confirmed_at` DATETIME(3) NULL,
    `capacity` SMALLINT NOT NULL,
    `min_players` SMALLINT NULL,
    `min_players_decision_deadline` DATETIME(3) NULL,
    `min_players_decision` ENUM('PROCEED', 'CANCEL') NULL,
    `min_players_decided_at` DATETIME(3) NULL,
    `organiser_is_playing` BOOLEAN NOT NULL DEFAULT true,
    `confirmed_count` SMALLINT NOT NULL DEFAULT 0,
    `interested_count` SMALLINT NOT NULL DEFAULT 0,
    `skill_level` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL') NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'AED',
    `estimated_total_cost_fils` INTEGER NULL,
    `estimated_share_max_fils` INTEGER NULL,
    `total_cost_fils` INTEGER NULL,
    `share_max_fils` INTEGER NULL,
    `title` VARCHAR(100) NULL,
    `instructions` TEXT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancellation_reason` ENUM('ORGANISER_CANCELLED', 'ADMIN_CANCELLED', 'VENUE_NOT_CONFIRMED', 'MINIMUM_NOT_MET_ORGANISER_CANCELLED', 'MINIMUM_NOT_MET_NO_DECISION', 'ORGANISER_ACCOUNT_DELETED') NULL,
    `cancellation_note` VARCHAR(280) NULL,
    `closed_at` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sessions_status_starts_at_idx`(`status`, `starts_at`),
    INDEX `sessions_latitude_longitude_idx`(`latitude`, `longitude`),
    INDEX `sessions_sport_id_status_starts_at_idx`(`sport_id`, `status`, `starts_at`),
    INDEX `sessions_organiser_id_starts_at_idx`(`organiser_id`, `starts_at`),
    INDEX `sessions_venue_id_starts_at_idx`(`venue_id`, `starts_at`),
    INDEX `sessions_venue_confirmation_status_venue_confirm_deadline_idx`(`venue_confirmation_status`, `venue_confirm_deadline`),
    INDEX `sessions_status_min_players_decision_deadline_idx`(`status`, `min_players_decision_deadline`),
    INDEX `sessions_status_ends_at_idx`(`status`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_participants` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('ORGANISER', 'PLAYER') NOT NULL DEFAULT 'PLAYER',
    `status` ENUM('CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW') NOT NULL,
    `share_slot` SMALLINT NULL,
    `cancellation_reason` ENUM('LEFT', 'REMOVED_BY_ORGANISER', 'REMOVED_BY_ADMIN', 'SESSION_CANCELLED', 'PRICE_REJECTED', 'PRICE_NOT_ACCEPTED') NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelled_at` DATETIME(3) NULL,
    `attendance_marked_at` DATETIME(3) NULL,
    `attendance_marked_by_id` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `session_participants_user_id_status_idx`(`user_id`, `status`),
    INDEX `session_participants_session_id_status_idx`(`session_id`, `status`),
    UNIQUE INDEX `session_participants_session_id_user_id_key`(`session_id`, `user_id`),
    UNIQUE INDEX `session_participants_session_id_share_slot_key`(`session_id`, `share_slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_interests` (
    `session_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_interests_user_id_idx`(`user_id`),
    PRIMARY KEY (`session_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_images` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `public_id` VARCHAR(255) NOT NULL,
    `sort_order` SMALLINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_images_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_events` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NULL,
    `type` VARCHAR(60) NOT NULL,
    `data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_events_session_id_created_at_idx`(`session_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_price_changes` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `previous_total_fils` INTEGER NOT NULL,
    `new_total_fils` INTEGER NOT NULL,
    `previous_capacity` SMALLINT NOT NULL,
    `new_capacity` SMALLINT NOT NULL,
    `reason` VARCHAR(280) NULL,
    `consent_deadline` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_price_changes_session_id_created_at_idx`(`session_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_consents` (
    `id` CHAR(36) NOT NULL,
    `price_change_id` CHAR(36) NOT NULL,
    `participant_id` CHAR(36) NOT NULL,
    `previous_amount_fils` INTEGER NOT NULL,
    `new_amount_fils` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
    `responded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_consents_participant_id_status_idx`(`participant_id`, `status`),
    INDEX `price_consents_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `price_consents_price_change_id_participant_id_key`(`price_change_id`, `participant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_arrangements` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `status` ENUM('REQUESTED', 'IN_PROGRESS', 'OPTIONS_PROPOSED', 'APPROVED', 'BOOKED', 'UNSUCCESSFUL', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `assigned_to_id` CHAR(36) NULL,
    `staff_notes` TEXT NULL,
    `closed_reason` VARCHAR(280) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `venue_arrangements_session_id_key`(`session_id`),
    INDEX `venue_arrangements_status_created_at_idx`(`status`, `created_at`),
    INDEX `venue_arrangements_assigned_to_id_status_idx`(`assigned_to_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_options` (
    `id` CHAR(36) NOT NULL,
    `arrangement_id` CHAR(36) NOT NULL,
    `venue_id` CHAR(36) NOT NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `total_cost_fils` INTEGER NOT NULL,
    `notes` VARCHAR(500) NULL,
    `valid_until` DATETIME(3) NULL,
    `status` ENUM('PROPOSED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED') NOT NULL DEFAULT 'PROPOSED',
    `proposed_by_id` CHAR(36) NOT NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `venue_options_arrangement_id_status_idx`(`arrangement_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_bookings` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `venue_id` CHAR(36) NOT NULL,
    `venue_option_id` CHAR(36) NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `total_cost_fils` INTEGER NOT NULL,
    `booking_reference` VARCHAR(80) NULL,
    `venue_payment_status` ENUM('NOT_PAID', 'PAID') NOT NULL DEFAULT 'NOT_PAID',
    `venue_paid_at` DATETIME(3) NULL,
    `recorded_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `venue_bookings_session_id_key`(`session_id`),
    UNIQUE INDEX `venue_bookings_venue_option_id_key`(`venue_option_id`),
    INDEX `venue_bookings_venue_id_starts_at_idx`(`venue_id`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `participant_id` CHAR(36) NOT NULL,
    `payer_id` CHAR(36) NOT NULL,
    `payee_id` CHAR(36) NOT NULL,
    `status` ENUM('UNPAID', 'PAYMENT_REPORTED', 'PAID', 'PAYMENT_DISPUTED', 'WAIVED', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `currency` CHAR(3) NOT NULL DEFAULT 'AED',
    `amount_due_fils` INTEGER NOT NULL,
    `agreed_amount_fils` INTEGER NOT NULL,
    `amount_paid_fils` INTEGER NOT NULL DEFAULT 0,
    `refunded_amount_fils` INTEGER NOT NULL DEFAULT 0,
    `last_method` ENUM('CASH', 'BANK_TRANSFER', 'PAYMENT_APP', 'OTHER') NULL,
    `last_reference` VARCHAR(80) NULL,
    `reported_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `waived_at` DATETIME(3) NULL,
    `refunded_at` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_participant_id_key`(`participant_id`),
    INDEX `payments_session_id_status_idx`(`session_id`, `status`),
    INDEX `payments_payer_id_status_idx`(`payer_id`, `status`),
    INDEX `payments_payee_id_status_idx`(`payee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_confirmations` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NULL,
    `actor_role` ENUM('PLAYER', 'ORGANISER', 'ADMIN', 'SYSTEM') NOT NULL,
    `action` ENUM('REPORTED_BY_PLAYER', 'REPORT_RETRACTED', 'CONFIRMED_BY_ORGANISER', 'CONFIRMED_BY_ADMIN', 'REPORT_REJECTED', 'WAIVED', 'REFUND_RECORDED', 'AMOUNT_CHANGED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'DISPUTE_WITHDRAWN', 'STATUS_CORRECTED') NOT NULL,
    `from_status` ENUM('UNPAID', 'PAYMENT_REPORTED', 'PAID', 'PAYMENT_DISPUTED', 'WAIVED', 'REFUNDED') NULL,
    `to_status` ENUM('UNPAID', 'PAYMENT_REPORTED', 'PAID', 'PAYMENT_DISPUTED', 'WAIVED', 'REFUNDED') NOT NULL,
    `amount_fils` INTEGER NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'PAYMENT_APP', 'OTHER') NULL,
    `reference` VARCHAR(80) NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_confirmations_payment_id_created_at_idx`(`payment_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_disputes` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `opened_by_id` CHAR(36) NOT NULL,
    `reason` ENUM('PAYMENT_NOT_RECEIVED', 'PAYMENT_NOT_ACKNOWLEDGED', 'REFUND_NOT_RECEIVED', 'AMOUNT_INCORRECT', 'OTHER') NOT NULL,
    `description` VARCHAR(1000) NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'WITHDRAWN') NOT NULL DEFAULT 'OPEN',
    `status_before_dispute` ENUM('UNPAID', 'PAYMENT_REPORTED', 'PAID', 'PAYMENT_DISPUTED', 'WAIVED', 'REFUNDED') NOT NULL,
    `resolution_status` ENUM('UNPAID', 'PAYMENT_REPORTED', 'PAID', 'PAYMENT_DISPUTED', 'WAIVED', 'REFUNDED') NULL,
    `resolution_note` VARCHAR(1000) NULL,
    `resolved_by_id` CHAR(36) NULL,
    `open_lock` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    UNIQUE INDEX `payment_disputes_open_lock_key`(`open_lock`),
    INDEX `payment_disputes_status_created_at_idx`(`status`, `created_at`),
    INDEX `payment_disputes_payment_id_idx`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `type` ENUM('PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_REMOVED', 'SESSION_FULL', 'SESSION_REOPENED', 'SESSION_JOINABLE', 'SESSION_UPDATED', 'SESSION_CANCELLED', 'SESSION_REMINDER', 'PRICE_CHANGED', 'PRICE_CONSENT_REQUIRED', 'PRICE_CONSENT_REMINDER', 'MIN_PLAYERS_DECISION_REQUIRED', 'VENUE_OPTIONS_PROPOSED', 'VENUE_CONFIRMED', 'VENUE_DEADLINE_APPROACHING', 'PAYMENT_REPORTED', 'PAYMENT_CONFIRMED', 'PAYMENT_WAIVED', 'REFUND_RECORDED', 'PAYMENT_DISPUTED', 'PAYMENT_DISPUTE_RESOLVED', 'PAYMENT_REMINDER', 'REVIEW_RECEIVED') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `entity_type` VARCHAR(30) NULL,
    `entity_id` CHAR(36) NULL,
    `session_id` CHAR(36) NULL,
    `actor_id` CHAR(36) NULL,
    `data` JSON NULL,
    `read_at` DATETIME(3) NULL,
    `pushed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `reviewer_id` CHAR(36) NOT NULL,
    `reviewee_id` CHAR(36) NOT NULL,
    `rating` TINYINT NOT NULL,
    `comment` VARCHAR(500) NULL,
    `is_hidden` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reviews_reviewee_id_created_at_idx`(`reviewee_id`, `created_at`),
    UNIQUE INDEX `reviews_session_id_reviewer_id_reviewee_id_key`(`session_id`, `reviewer_id`, `reviewee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` CHAR(36) NOT NULL,
    `reporter_id` CHAR(36) NOT NULL,
    `target_type` ENUM('USER', 'SESSION', 'REVIEW') NOT NULL,
    `target_id` CHAR(36) NOT NULL,
    `reason` VARCHAR(60) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `status` ENUM('OPEN', 'ACTIONED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `resolved_by_id` CHAR(36) NULL,
    `resolution` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `reports_status_created_at_idx`(`status`, `created_at`),
    INDEX `reports_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_keys` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `method` VARCHAR(8) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `status_code` SMALLINT NULL,
    `response_body` JSON NULL,
    `locked_until` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idempotency_keys_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `idempotency_keys_user_id_key_key`(`user_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_settings` (
    `key` VARCHAR(80) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by_id` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `target_type` VARCHAR(30) NOT NULL,
    `target_id` CHAR(36) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_target_type_target_id_idx`(`target_type`, `target_id`),
    INDEX `admin_audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_identities` ADD CONSTRAINT `auth_identities_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_mfa` ADD CONSTRAINT `user_mfa_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_codes` ADD CONSTRAINT `verification_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_favourite_sports` ADD CONSTRAINT `user_favourite_sports_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_favourite_sports` ADD CONSTRAINT `user_favourite_sports_sport_id_fkey` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venues` ADD CONSTRAINT `venues_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_sports` ADD CONSTRAINT `venue_sports_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_sports` ADD CONSTRAINT `venue_sports_sport_id_fkey` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_images` ADD CONSTRAINT `venue_images_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_organiser_id_fkey` FOREIGN KEY (`organiser_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_sport_id_fkey` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_attendance_marked_by_id_fkey` FOREIGN KEY (`attendance_marked_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_interests` ADD CONSTRAINT `session_interests_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_interests` ADD CONSTRAINT `session_interests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_images` ADD CONSTRAINT `session_images_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_events` ADD CONSTRAINT `session_events_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_events` ADD CONSTRAINT `session_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_price_changes` ADD CONSTRAINT `session_price_changes_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_price_changes` ADD CONSTRAINT `session_price_changes_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_consents` ADD CONSTRAINT `price_consents_price_change_id_fkey` FOREIGN KEY (`price_change_id`) REFERENCES `session_price_changes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_consents` ADD CONSTRAINT `price_consents_participant_id_fkey` FOREIGN KEY (`participant_id`) REFERENCES `session_participants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_arrangements` ADD CONSTRAINT `venue_arrangements_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_arrangements` ADD CONSTRAINT `venue_arrangements_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_options` ADD CONSTRAINT `venue_options_arrangement_id_fkey` FOREIGN KEY (`arrangement_id`) REFERENCES `venue_arrangements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_options` ADD CONSTRAINT `venue_options_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_options` ADD CONSTRAINT `venue_options_proposed_by_id_fkey` FOREIGN KEY (`proposed_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_venue_option_id_fkey` FOREIGN KEY (`venue_option_id`) REFERENCES `venue_options`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_participant_id_fkey` FOREIGN KEY (`participant_id`) REFERENCES `session_participants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_payer_id_fkey` FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_payee_id_fkey` FOREIGN KEY (`payee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_confirmations` ADD CONSTRAINT `payment_confirmations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_confirmations` ADD CONSTRAINT `payment_confirmations_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_disputes` ADD CONSTRAINT `payment_disputes_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_disputes` ADD CONSTRAINT `payment_disputes_opened_by_id_fkey` FOREIGN KEY (`opened_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_disputes` ADD CONSTRAINT `payment_disputes_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewee_id_fkey` FOREIGN KEY (`reviewee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_keys` ADD CONSTRAINT `idempotency_keys_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_settings` ADD CONSTRAINT `platform_settings_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


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
