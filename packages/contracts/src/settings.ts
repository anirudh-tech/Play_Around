/**
 * Platform setting keys and defaults (docs/product/business-decisions.md). Stored in
 * `platform_settings`; these defaults apply when a key is missing.
 */
export const PLATFORM_SETTING_DEFAULTS = {
  'sessions.min_lead_time_hours': 3,
  'sessions.max_upcoming_organised': 10,
  'sessions.min_players_decision_hours_before_start': 2,
  'sessions.venue_confirm_deadline_hours_before_start': 12,
  'sessions.price_increase_consent_threshold_pct': 20,
  'sessions.price_consent_window_hours': 24,
  'sessions.attendance_window_hours_after_end': 72,
  'payments.min_paid_share_fils': 1000,
  'discovery.default_radius_km': 5,
  'discovery.max_radius_km': 50,
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;
