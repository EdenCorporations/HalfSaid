/**
 * High-stakes hard-block seam (SPEC §7.3, PRD §22.4).
 *
 * MVP does NOT implement context detection. But the interception seam must exist
 * and be testable with a forced flag: in a high-stakes context, free retrieval is
 * disabled and only Tier 3 (clinician-approved) items may surface. Phase 3 wires
 * this into the retrieval policy filter; here we provide the predicate + filter so
 * the seam is present and covered from day one.
 */

import { PrivacyTier } from '@halfsaid/shared-types';
import type { PcgSourceItem } from './candidate';

export interface HighStakesContext {
  /**
   * Forced flag for MVP. Detection (location + partner + topic) is out of scope
   * (SPEC §7.3 / deviation D4); this flag lets tests prove the block works.
   */
  readonly forced: boolean;
}

/** Whether the block is active for this context. */
export function isHighStakes(ctx: HighStakesContext): boolean {
  return ctx.forced;
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
