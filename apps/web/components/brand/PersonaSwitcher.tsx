'use client';

import { useEffect, useState } from 'react';

import { PERSONAS, getPersona, setPersona, type Persona } from '@/lib/client/persona';

/**
 * Persona quick-switch (Enhancement 10). Each persona is a separate RLS-scoped
 * PCG owner, so switching proves the system is personal, not hard-coded: Maya
 * gets garden-and-tea suggestions, David gets chess-and-tablet ones.
 *
 * A full reload after switching keeps every screen's state consistent (cheap and
 * predictable for a demo). Rendered as a labelled segmented control.
 */
export function PersonaSwitcher() {
  // Resolve from localStorage only after mount to avoid an SSR hydration mismatch.
  const [active, setActive] = useState<Persona['key'] | null>(null);
  useEffect(() => {
    setActive(getPersona().key);
  }, []);

  function choose(key: Persona['key']) {
    if (key === active) return;
    setPersona(key);
    window.location.reload();
  }

  return (
    <div
      role="group"
      aria-label="Demo persona"
      className="glass flex items-center rounded-xl p-1"
    >
      {PERSONAS.map((p) => {
        const selected = p.key === active;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={selected}
            title={`${p.name} — ${p.condition}. ${p.blurb}`}
            onClick={() => choose(p.key)}
            className={`min-h-[36px] rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? 'bg-primary text-primary-foreground shadow-glow-soft'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
