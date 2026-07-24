/**
 * High-stakes hard block (SPEC §7.3, PRD §22.4).
 *
 * In a high-stakes context, free generation is disabled and only Tier 3
 * (clinician-approved) items may surface. The MVP now DETECTS high-stakes from the
 * utterance text itself (medical / legal / financial / consent topics) in addition
 * to the original forced flag — a wrong word about medication or a signature is
 * exactly the hallucination class the Hard Rule exists to prevent.
 */

import { PrivacyTier } from '@halfsaid/shared-types';
import type { PcgSourceItem } from './candidate';

export interface HighStakesContext {
  /** Force the block regardless of detection (tests, clinician override). */
  readonly forced: boolean;
  /** The utterance/partial text to run topic detection over (optional). */
  readonly text?: string;
}

/**
 * Topic patterns that trip the block. Word-boundary matched, case-insensitive.
 * Deliberately conservative: false positives cost a little convenience (the user
 * still gets clinician-approved phrases); false negatives cost safety.
 */
const HIGH_STAKES_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  {
    category: 'medical',
    pattern:
      /\b(medication|medications|medicine|dose|dosage|pills?|prescription|allergic|allergy|surgery|operation|diagnosis|symptoms?|pain (level|scale)|blood pressure|insulin|chemo(therapy)?)\b/i,
  },
  {
    category: 'legal',
    pattern:
      /\b(sign(ing)?|signature|contract|lawyer|attorney|court|lawsuit|legal|testify|witness|will and testament|power of attorney|custody)\b/i,
  },
  {
    category: 'financial',
    pattern:
      /\b(bank|loan|mortgage|insurance|invest(ment)?|transfer money|wire|deed|pension|inheritance|beneficiary)\b/i,
  },
  {
    category: 'consent',
    pattern:
      /\b(consent|authorize|authorise|permission to|agree to (the )?(procedure|treatment|terms))\b/i,
  },
];

export interface HighStakesDetection {
  highStakes: boolean;
  /** The matched category when detected (for the UI badge / explanation). */
  category?: string;
}

/** Detect a high-stakes topic from utterance text alone. */
export function detectHighStakes(text: string): HighStakesDetection {
  for (const { category, pattern } of HIGH_STAKES_PATTERNS) {
    if (pattern.test(text)) return { highStakes: true, category };
  }
  return { highStakes: false };
}

/** Whether the block is active for this context (forced flag OR detected topic). */
export function isHighStakes(ctx: HighStakesContext): boolean {
  if (ctx.forced) return true;
  return ctx.text ? detectHighStakes(ctx.text).highStakes : false;
}

/**
 * Apply the high-stakes policy to a candidate item set. When active, only items
 * whose PCG source tier is clinician-approved survive; otherwise items pass
 * through unchanged. `tierOf` maps an item to the privacy tier of its PCG node.
 */
export function applyHighStakesFilter(
  items: readonly PcgSourceItem[],
  ctx: HighStakesContext,
  tierOf: (item: PcgSourceItem) => PrivacyTier,
): PcgSourceItem[] {
  if (!isHighStakes(ctx)) return [...items];
  return items.filter((item) => tierOf(item) === PrivacyTier.ClinicianPlus);
}
