import type { SourceTag } from '@halfsaid/shared-types';
import { SOURCE_TAG_TOKENS } from '@halfsaid/ui-tokens';

/**
 * The provenance source tag on a suggestion card (SPEC §13): yours /
 * family-validated / therapist-approved. Colors are WCAG-audited (ui-tokens).
 */
export function SourceTagBadge({ tag }: { tag: SourceTag }) {
  const token = SOURCE_TAG_TOKENS[tag];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ color: token.fg, backgroundColor: token.bg }}
    >
      {token.label}
    </span>
  );
}
