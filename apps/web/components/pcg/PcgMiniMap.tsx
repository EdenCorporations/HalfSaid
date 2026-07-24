'use client';

import { useEffect, useRef, useState } from 'react';
import type { GraphResponse } from '@halfsaid/shared-types';

import { personaHeaders } from '@/lib/client/persona';

/**
 * The PCG made visible (Enhancement 6) — a zero-dependency force-directed map of
 * the most-connected slice of the user's Personal Communication Graph, rendered
 * on <canvas>. Hubs (people, topics, intents) anchor the layout; utterances
 * cluster around what they mention. Colored by node type, sized by connections.
 *
 * Accessibility: the canvas is role="img" with a computed summary, and a
 * visually-hidden list names the top hubs — the graph is never information
 * that only sighted users get.
 */

const TYPE_COLORS: Record<string, string> = {
  Person: '#F472B6',
  Place: '#34D399',
  Object: '#FBBF24',
  Topic: '#60A5FA',
  Utterance: '#A855F7',
  Routine: '#2DD4BF',
  Emotion: '#FB7185',
  Intent: '#C084FC',
  CulturalContext: '#F97316',
  User: '#FFFFFF',
};
const FALLBACK_COLOR = '#94A3B8';

interface SimNode {
  id: string;
  type: string;
  label: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface PcgMiniMapProps {
  height?: number;
  /** Bump to refetch (e.g. after the graph grows). */
  refreshKey?: number;
}

export function PcgMiniMap({ height = 340, refreshKey = 0 }: PcgMiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; label: string; type: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/pcg/graph?limit=48', { headers: personaHeaders() });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as GraphResponse;
        if (active) setGraph(data);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Force simulation + render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !graph || graph.nodes.length === 0) return;

    const width = wrap.clientWidth;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Deterministic initial layout: a ring ordered by the API's hub ranking.
    const cx = width / 2;
    const cy = height / 2;
    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const ring = 0.28 * Math.min(width, height) * (1 + (i % 3) * 0.25);
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        degree: n.degree,
        x: cx + Math.cos(angle) * ring,
        y: cy + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
        r: Math.min(16, 4 + n.degree * 1.1),
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links = graph.edges
      .map((e) => ({ a: byId.get(e.from), b: byId.get(e.to) }))
      .filter((l): l is { a: SimNode; b: SimNode } => Boolean(l.a && l.b));

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;
    const MAX_FRAMES = 240;

    function step() {
      // Repulsion between all pairs (O(n²) is fine for ≤48 nodes).
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 1;
          const d = Math.sqrt(d2);
          const force = 900 / d2;
          dx /= d;
          dy /= d;
          a.vx += dx * force;
          a.vy += dy * force;
          b.vx -= dx * force;
          b.vy -= dy * force;
        }
      }
      // Springs along edges.
      for (const { a, b } of links) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (d - 70) * 0.012;
        a.vx += (dx / d) * force;
        a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force;
        b.vy -= (dy / d) * force;
      }
      // Gravity to center + integrate with damping; keep inside bounds.
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.004;
        n.vy += (cy - n.y) * 0.004;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x = Math.max(n.r + 2, Math.min(width - n.r - 2, n.x + n.vx));
        n.y = Math.max(n.r + 2, Math.min(height - n.r - 2, n.y + n.vy));
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      // Edges.
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.16)';
      for (const { a, b } of links) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Nodes.
      for (const n of nodes) {
        const color = TYPE_COLORS[n.type] ?? FALLBACK_COLOR;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Labels for the top hubs.
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const hubs = [...nodes].sort((a, b) => b.degree - a.degree).slice(0, 7);
      for (const n of hubs) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const label = n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label;
        ctx.fillText(label, n.x, n.y - n.r - 4);
      }
    }

    function tick() {
      // Several physics steps per frame settle the layout quickly.
      for (let s = 0; s < 3; s++) step();
      draw();
      frame += 1;
      if (frame < MAX_FRAMES) raf = requestAnimationFrame(tick);
    }

    if (reduceMotion) {
      for (let s = 0; s < MAX_FRAMES * 3; s++) step();
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

    // Hover hit-testing → tooltip.
    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best: SimNode | null = null;
      let bestD = 18;
      for (const n of nodes) {
        const d = Math.hypot(n.x - mx, n.y - my) - n.r;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      setHover(best ? { x: best.x, y: best.y - best.r - 8, label: best.label, type: best.type } : null);
    }
    function onLeave() {
      setHover(null);
    }
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [graph, height]);

  if (error) {
    return <p className="text-sm text-muted-foreground">The graph view is unavailable right now.</p>;
  }
  if (!graph) {
    return <p className="text-sm text-muted-foreground">Mapping the graph…</p>;
  }

  const topHubs = [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 5);
  const summary = `Personal Communication Graph: showing the ${graph.nodes.length} most connected of ${graph.totals.nodes} nodes with ${graph.edges.length} links. Biggest hubs: ${topHubs.map((h) => h.label).join(', ')}.`;
  const legendTypes = [...new Set(graph.nodes.map((n) => n.type))].slice(0, 8);

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas ref={canvasRef} role="img" aria-label={summary} className="w-full" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-black/80 px-2 py-1 text-xs text-white"
          style={{ left: hover.x, top: hover.y }}
        >
          <span className="font-medium">{hover.label}</span>
          <span className="text-white/60"> · {hover.type}</span>
        </div>
      )}
      {/* Legend. */}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
        {legendTypes.map((t) => (
          <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[t] ?? FALLBACK_COLOR }}
            />
            {t}
          </li>
        ))}
      </ul>
      {/* Screen-reader alternative. */}
      <div className="sr-only">
        <p>{summary}</p>
        <ul>
          {topHubs.map((h) => (
            <li key={h.id}>
              {h.label} ({h.type}), {h.degree} connections
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
