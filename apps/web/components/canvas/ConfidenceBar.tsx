import { CONFIDENCE_GATE_TOKENS } from '@halfsaid/ui-tokens';

/**
 * The confidence bar on a suggestion card (SPEC §7.2, §13). A meter, not decoration:
 * it carries an accessible name + value so screen readers announce the confidence.
 * Sandbox candidates ("HalfSaid is unsure") get the caution treatment.
 */
export function ConfidenceBar({
  confidence,
  gate,
}: {
  confidence: number;
  gate: 'ship' | 'sandbox';
}) {
  const token = CONFIDENCE_GATE_TOKENS[gate];
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label="Suggestion confidence"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pct}% — ${token.label}`}
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: token.bar }}
        />
      </div>
      {token.note && (
        <p className="text-xs font-medium" style={{ color: token.bar }}>
          {token.note}
        </p>
      )}
    </div>
  );
}
