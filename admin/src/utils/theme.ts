/**
 * Dark Mode Compatible Theme
 * Uses CSS variables from Strapi Design System
 */

// CSS Variable based colors that adapt to dark mode
export const theme = {
  colors: {
    primary: {
      50: 'var(--colors-primary100, #F0F9FF)',
      100: 'var(--colors-primary200, #E0F2FE)',
      500: 'var(--colors-primary600, #0EA5E9)',
      600: 'var(--colors-primary700, #0284C7)',
      700: 'var(--colors-primary700, #0369A1)',
    },
    secondary: {
      50: 'var(--colors-secondary100, #F3E8FF)',
      100: 'var(--colors-secondary200, #E9D5FF)',
      500: 'var(--colors-secondary600, #A855F7)',
      600: 'var(--colors-secondary700, #9333EA)',
    },
    success: {
      50: 'var(--colors-success100, #DCFCE7)',
      100: 'var(--colors-success100, #DCFCE7)',
      500: 'var(--colors-success600, #22C55E)',
      600: 'var(--colors-success700, #16A34A)',
      700: 'var(--colors-success700, #15803D)',
    },
    warning: {
      50: 'var(--colors-warning100, #FEF3C7)',
      100: 'var(--colors-warning100, #FEF3C7)',
      500: 'var(--colors-warning600, #F59E0B)',
      600: 'var(--colors-warning700, #D97706)',
    },
    danger: {
      50: 'var(--colors-danger100, #FEE2E2)',
      100: 'var(--colors-danger100, #FEE2E2)',
      500: 'var(--colors-danger600, #EF4444)',
      600: 'var(--colors-danger700, #DC2626)',
    },
    neutral: {
      0: 'var(--colors-neutral0, #FFFFFF)',
      50: 'var(--colors-neutral100, #F9FAFB)',
      100: 'var(--colors-neutral150, #F3F4F6)',
      200: 'var(--colors-neutral200, #E5E7EB)',
      400: 'var(--colors-neutral400, #9CA3AF)',
      500: 'var(--colors-neutral500, #6B7280)',
      600: 'var(--colors-neutral600, #4B5563)',
      700: 'var(--colors-neutral700, #374151)',
      800: 'var(--colors-neutral800, #1F2937)',
      900: 'var(--colors-neutral900, #111827)',
    }
  },
  // Background colors that properly adapt to dark mode
  backgrounds: {
    primary: 'var(--colors-neutral0, #FFFFFF)',
    secondary: 'var(--colors-neutral100, #F9FAFB)',
    tertiary: 'var(--colors-neutral150, #F3F4F6)',
    input: 'var(--colors-neutral0, #FFFFFF)',
  },
  // Text colors that adapt
  text: {
    primary: 'var(--colors-neutral800, #1F2937)',
    secondary: 'var(--colors-neutral600, #4B5563)',
    muted: 'var(--colors-neutral500, #6B7280)',
    inverse: 'var(--colors-neutral0, #FFFFFF)',
  },
  // Borders
  borders: {
    default: 'var(--colors-neutral200, #E5E7EB)',
    strong: 'var(--colors-neutral300, #D1D5DB)',
  },
  shadows: {
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  }
} as const;

export type Theme = typeof theme;
export default theme;
