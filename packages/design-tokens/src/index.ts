// Single source for colours, radii, spacing, typography, blur and motion (ARC-009).
// Web/admin consume dist/theme.css (generated); mobile consumes nativewind-preset.cjs.

export const palette = {
  ink: {
    50: '#F5F7FA',
    100: '#E9EDF3',
    200: '#D3DAE5',
    300: '#AEB9CA',
    400: '#8090A8',
    500: '#5C6B84',
    600: '#45526A',
    700: '#333D52',
    800: '#1F2636',
    900: '#111621',
    950: '#0A0D14',
  },
  brand: {
    50: '#EEF6FF',
    100: '#D9EBFF',
    200: '#B5D7FF',
    300: '#84BCFF',
    400: '#4F99FF',
    500: '#2A78F5',
    600: '#1A5CDB',
    700: '#1748B0',
    800: '#183F8C',
    900: '#193870',
  },
  success: '#30B46C',
  warning: '#F2A93B',
  danger: '#E5484D',
} as const;

/** Per-sport accents; production values come from `sports.accent_color`. */
export const sportAccents = {
  badminton: '#14B8A6',
  football: '#34C759',
  cricket: '#F59E0B',
} as const;

export const semantic = {
  light: {
    background: palette.ink[50],
    surface: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.62)',
    glassBorder: 'rgba(255, 255, 255, 0.55)',
    text: palette.ink[900],
    textMuted: palette.ink[500],
    border: palette.ink[200],
    primary: palette.brand[600],
    primaryText: '#FFFFFF',
  },
  dark: {
    background: palette.ink[950],
    surface: palette.ink[900],
    glass: 'rgba(17, 22, 33, 0.58)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    text: palette.ink[50],
    textMuted: palette.ink[300],
    border: palette.ink[700],
    primary: palette.brand[400],
    primaryText: palette.ink[950],
  },
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, "SF Pro Text", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    display: 'Inter, "SF Pro Display", system-ui, -apple-system, sans-serif',
  },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
} as const;

export const blur = { sm: 8, md: 16, lg: 28 } as const;

export const motion = {
  durationMs: { fast: 120, base: 200, slow: 320 },
  easing: { standard: 'cubic-bezier(0.2, 0, 0, 1)', emphasized: 'cubic-bezier(0.3, 0, 0, 1.2)' },
} as const;

export const tokens = { palette, sportAccents, semantic, radii, spacing, typography, blur, motion };
export type Tokens = typeof tokens;
