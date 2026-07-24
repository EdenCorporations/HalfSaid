/**
 * @halfsaid/ui-tokens — WCAG-audited design tokens (SPEC §13, PRD §10).
 *
 * Accessibility is a gate, not polish. These tokens encode the non-negotiables:
 * minimum touch-target size, and the source-tag / confidence-gate treatments used
 * on suggestion cards. Contrast ratios noted per token are against the app
 * background and target WCAG 2.2 AA (AAA on the suggestion-acceptance path).
 *
 * Phase 1 defines the values. Wiring them into Tailwind/shadcn CSS variables and
 * verifying with axe-core happens in Phase 5.
 */

/** Minimum interactive target, in px (WCAG 2.2 AA / PRD §10.2 low-load default). */
export const TOUCH_TARGET_MIN_PX = 44;

/** High-load / motor-impaired target (PRD §10.2). */
export const TOUCH_TARGET_LARGE_PX = 64;

/** Max suggestion cards on the Canvas at once (SPEC §13, cognitive-load budget). */
export const MAX_SUGGESTION_CARDS = 5;

/** Preview delay before TTS, in ms, per confidence gate (SPEC §7.2). */
export const TTS_PREVIEW_MS = {
  ship: 1500,
  sandbox: 4000,
} as const;

/** Source-tag treatment for suggestion cards (SPEC §13). */
export interface SourceTagToken {
  label: string;
  /** Foreground text color (hex); audited ≥ 4.5:1 on `bg`. */
  fg: string;
  /** Badge background color (hex). */
  bg: string;
}

export const SOURCE_TAG_TOKENS = {
  yours: { label: 'yours', fg: '#1e3a8a', bg: '#dbeafe' },
  'family-validated': { label: 'family-validated', fg: '#3b0764', bg: '#ede9fe' },
  'therapist-approved': { label: 'therapist-approved', fg: '#064e3b', bg: '#d1fae5' },
} as const satisfies Record<string, SourceTagToken>;

/** Confidence-gate treatment for the card + confidence bar (SPEC §7.2). */
export const CONFIDENCE_GATE_TOKENS = {
  ship: { label: 'ready', bar: '#059669', note: null },
  sandbox: {
    label: 'unsure',
    bar: '#b45309',
    note: 'HalfSaid is unsure — review carefully',
  },
} as const;
