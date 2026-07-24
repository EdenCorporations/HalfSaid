'use client';

import { motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const UNDO_WINDOW_MS = 5000;

export interface UndoToastProps {
  text: string;
  onUndo: () => void;
}

/**
 * The 5-second undo window after accepting a suggestion (Enhancement 3, SPEC §13).
 * Dignity First operationalized: HalfSaid proposes, the user disposes — a wrong
 * tap is recoverable, speech stops, and nothing is saved to the PCG until the
 * window expires.
 */
export function UndoToast({ text, onUndo }: UndoToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      role="status"
      className="glass-strong fixed bottom-24 left-1/2 z-40 flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 overflow-hidden rounded-2xl p-3 pl-4 shadow-glow-soft"
    >
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">
        Speaking: <span className="font-medium">{text}</span>
      </p>
      <Button size="sm" variant="outline" aria-label={`Undo speaking: ${text}`} onClick={onUndo}>
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        Undo
      </Button>
      {/* Draining progress bar — visual countdown of the undo window. */}
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: UNDO_WINDOW_MS / 1000, ease: 'linear' }}
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-primary"
      />
    </motion.div>
  );
}
