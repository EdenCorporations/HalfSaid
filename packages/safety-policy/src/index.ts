/**
 * @halfsaid/safety-policy — the Hard Rule as executable code (SPEC §0, §8).
 *
 * The Generation/Suggestion path must import `buildCandidate` from here to
 * construct any user-facing suggestion. There is no other constructor, and it
 * accepts PCG items only — a raw model completion has no path to the user.
 */

export {
  HardRuleViolation,
  CONFIDENCE,
  gateFor,
  buildCandidate,
  assertGrounded,
} from './candidate';
export type { PcgSourceItem, BuildCandidateParams } from './candidate';

export { isHighStakes, applyHighStakesFilter } from './high-stakes';
export type { HighStakesContext } from './high-stakes';
