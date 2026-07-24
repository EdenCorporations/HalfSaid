'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Network } from 'lucide-react';
import type { GraphResponse } from '@halfsaid/shared-types';

import { personaHeaders } from '@/lib/client/persona';

export interface PcgGrowthChipProps {
  /** Bump to refetch (e.g. after an utterance is ingested). */
  refreshKey?: number;
}

/**
 * Live PCG growth counter (Enhancement 11) — "213 nodes · 487 edges", pulsing
 * when the graph grows. Makes the "continuously learning" narrative visible in
 * the Canvas header.
 */
export function PcgGrowthChip({ refreshKey = 0 }: PcgGrowthChipProps) {
  const [totals, setTotals] = useState<{ nodes: number; edges: number } | null>(null);
  const [grew, setGrew] = useState(false);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/pcg/graph?limit=5', { headers: personaHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as GraphResponse;
        if (!active) return;
        setTotals(data.totals);
        if (prev.current !== null && data.totals.nodes > prev.current) {
          setGrew(true);
          setTimeout(() => setGrew(false), 1600);
        }
        prev.current = data.totals.nodes;
      } catch {
        /* decorative — fail silent */
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!totals) return null;

  return (
    <motion.span
      animate={grew ? { scale: [1, 1.12, 1] } : {}}
      transition={{ duration: 0.5 }}
      className={`glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-shadow ${
        grew ? 'shadow-glow text-foreground' : 'text-muted-foreground'
      }`}
      aria-label={`Personal Communication Graph: ${totals.nodes} nodes and ${totals.edges} edges`}
    >
      <Network className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span aria-hidden="true">
        PCG {totals.nodes} nodes · {totals.edges} edges
      </span>
    </motion.span>
  );
}
