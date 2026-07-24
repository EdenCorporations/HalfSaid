/**
 * @halfsaid/federated — federated, privacy-preserving learning of the communication
 * model across clinics (SPEC §F). Clinics improve the shared adaptive ranker together
 * WITHOUT exposing any patient's raw communication data or PCG:
 *
 *   on-clinic local update  →  L2 clip  →  Gaussian DP noise  →  secure-agg mask
 *                                                                      ↓
 *   apply (Safety pinned)   ←  aggregate (masks cancel)  ←  transmit masked delta only
 */

export { mulberry32, seedFrom, gaussian, randomVector } from './prng';
export {
  l2norm,
  clipL2,
  gaussianSigma,
  addGaussianNoise,
  PrivacyLedger,
  type DpParams,
} from './dp';
export { pairwiseMask, maskDelta, aggregateMasked } from './secure-agg';
export { sigmoid, logisticLoss, computeLocalDelta, type FeedbackSample } from './local';
export {
  RANKER_DIM,
  SAFETY_INDEX,
  weightsToVector,
  vectorToWeights,
  clinicLocalStep,
  aggregateRound,
  runFederatedRound,
  type ClinicData,
  type ClinicUpdate,
  type RoundConfig,
  type RoundResult,
} from './round';
