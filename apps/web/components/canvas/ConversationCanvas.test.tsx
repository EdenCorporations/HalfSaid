/**
 * Conversation Canvas a11y + flow tests (SPEC §13). axe-core must be clean; typing a
 * request fetches grounded candidates; accepting speaks; the refusal path renders.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { SuggestionsResponse } from '@halfsaid/shared-types';

import { ConversationCanvas } from './ConversationCanvas';

const candidatesResponse: SuggestionsResponse = {
  kind: 'candidates',
  candidates: [
    {
      text: 'call Sarah',
      mode: 'full_utterance',
      sourceTag: 'family-validated',
      confidence: 0.82,
      gate: 'ship',
      provenance: { nodeIds: ['n1'], edgeIds: [] },
      explanation: 'A phrase your family confirmed.',
    },
    {
      text: 'go to the garden',
      mode: 'full_utterance',
      sourceTag: 'yours',
      confidence: 0.66,
      gate: 'sandbox',
      provenance: { nodeIds: ['n2'], edgeIds: [] },
      explanation: 'From your own past words.',
    },
  ],
};

function mockFetch(response: SuggestionsResponse) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
  }) as unknown as typeof fetch;
}

// jsdom has no speechSynthesis, so tts.speak() no-ops — no mock needed.

describe('ConversationCanvas', () => {
  it('has no axe violations in its initial state', async () => {
    mockFetch(candidatesResponse);
    const { container } = render(<ConversationCanvas />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('typing a request fetches and renders grounded candidates', async () => {
    mockFetch(candidatesResponse);
    const user = userEvent.setup();
    render(<ConversationCanvas />);

    await user.type(screen.getByLabelText(/type what you want to say/i), 'I want to');
    await user.click(screen.getByRole('button', { name: /get suggestions/i }));

    await waitFor(() => expect(screen.getByText('call Sarah')).toBeInTheDocument());
    expect(screen.getByText('go to the garden')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/suggestions', expect.any(Object));
  });

  it('accepting a card records it as spoken', async () => {
    mockFetch(candidatesResponse);
    const user = userEvent.setup();
    render(<ConversationCanvas />);
    await user.type(screen.getByLabelText(/type what you want to say/i), 'I want to');
    await user.click(screen.getByRole('button', { name: /get suggestions/i }));

    const card = await screen.findByRole('group', { name: /suggestion: call Sarah/i });
    await user.click(within(card).getByRole('button', { name: /accept and speak/i }));

    await waitFor(() => expect(screen.getByLabelText('Spoken')).toBeInTheDocument());
    expect(within(screen.getByLabelText('Spoken')).getByText('call Sarah')).toBeInTheDocument();
  });

  it('renders the first-class refusal path', async () => {
    mockFetch({
      kind: 'refusal',
      reason: "I don't have a confident suggestion.",
      alternatives: ['Type it out'],
    });
    const user = userEvent.setup();
    render(<ConversationCanvas />);
    await user.type(screen.getByLabelText(/type what you want to say/i), 'zzz');
    await user.click(screen.getByRole('button', { name: /get suggestions/i }));

    await waitFor(() =>
      expect(screen.getByText(/don't have a confident suggestion/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Type it out')).toBeInTheDocument();
  });
});
