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
  explanationForSourceTag,
  buildCandidate,
  composeGenerated,
  assertGrounded,
} from './candidate';
export type { PcgSourceItem, BuildCandidateParams, GeneratedParams } from './candidate';

export { isHighStakes, detectHighStakes, applyHighStakesFilter } from './high-stakes';
export type { HighStakesContext, HighStakesDetection } from './high-stakes';
