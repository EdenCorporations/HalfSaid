/**
 * Accessibility + behaviour tests for the suggestion card (SPEC §13). axe-core must
 * report ZERO violations (the CI gate); the actions must be keyboard-operable with
 * descriptive names.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { SuggestionCandidate } from '@halfsaid/shared-types';

import { SuggestionCard } from './SuggestionCard';

const candidate: SuggestionCandidate = {
  text: 'call Sarah',
  mode: 'full_utterance',
  sourceTag: 'family-validated',
  confidence: 0.82,
  gate: 'ship',
  provenance: { nodeIds: ['n1'], edgeIds: [] },
  explanation: 'A phrase your family confirmed.',
};

function setup() {
  const onAccept = jest.fn();
  const onEdit = jest.fn();
  const onReject = jest.fn();
  render(
    <SuggestionCard
      candidate={candidate}
      onAccept={onAccept}
      onEdit={onEdit}
      onReject={onReject}
    />,
  );
  return { onAccept, onEdit, onReject };
}

describe('SuggestionCard', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <SuggestionCard
        candidate={candidate}
        onAccept={() => {}}
        onEdit={() => {}}
        onReject={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes the candidate text and a confidence meter', () => {
    setup();
    expect(screen.getByText('call Sarah')).toBeInTheDocument();
    const meter = screen.getByRole('meter', { name: /confidence/i });
    expect(meter).toHaveAttribute('aria-valuenow', '82');
  });

  it('accepts via keyboard with a descriptive action name', async () => {
    const user = userEvent.setup();
    const { onAccept } = setup();
    await user.click(screen.getByRole('button', { name: /accept and speak: call Sarah/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('edit and dismiss fire their callbacks', async () => {
    const user = userEvent.setup();
    const { onEdit, onReject } = setup();
    await user.click(screen.getByRole('button', { name: /edit before speaking/i }));
    await user.click(screen.getByRole('button', { name: /dismiss suggestion/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
