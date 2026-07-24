/**
 * Deterministic pseudo-randomness. Seeded so federated rounds are reproducible and
 * testable (no Math.random). Used for the DP noise and the secure-aggregation masks.
 */

/** mulberry32 — small, fast, deterministic uniform generator in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of the parts → a 32-bit seed. */
export function seedFrom(...parts: Array<string | number>): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One standard-normal sample via Box–Muller from a uniform generator. */
export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A deterministic vector in [-1, 1)^dim from a seed. */
export function randomVector(seed: number, dim: number): number[] {
  const rng = mulberry32(seed);
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) out[i] = rng() * 2 - 1;
  return out;
}
