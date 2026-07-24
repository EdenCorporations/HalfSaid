'use client';

/**
 * Demo personas (Enhancement: multi-persona). Each persona is a separate PCG owner
 * — separate user id, separate seed, separate RLS scope — so switching personas
 * visibly changes every suggestion, log entry, and graph view. The selection lives
 * in localStorage; requests carry it via the mock-auth `x-halfsaid-user` header.
 */

export interface Persona {
  key: 'maya' | 'david';
  /** The seeded user id (auth subject). */
  id: string;
  name: string;
  condition: string;
  blurb: string;
}

export const PERSONAS: Persona[] = [
  {
    key: 'maya',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Maya',
    condition: "Broca's aphasia (post-stroke)",
    blurb: 'Retired English teacher. Garden, tea, family, poetry.',
  },
  {
    key: 'david',
    id: '00000000-0000-4000-8000-000000000101',
    name: 'David',
    condition: 'ALS (dysarthria)',
    blurb: 'Software engineer. Chess, fishing, his wife Anna.',
  },
];

const STORAGE_KEY = 'halfsaid.persona';

export function getPersona(): Persona {
  if (typeof window !== 'undefined') {
    const key = window.localStorage.getItem(STORAGE_KEY);
    const found = PERSONAS.find((p) => p.key === key);
    if (found) return found;
  }
  return PERSONAS[0]!;
}

export function setPersona(key: Persona['key']): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, key);
}

/** Header carrying the active persona for the mock-auth demo backend. */
export function personaHeaders(): Record<string, string> {
  return { 'x-halfsaid-user': getPersona().id };
}
