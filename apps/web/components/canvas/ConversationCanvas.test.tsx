/**
 * Conversation Canvas a11y + flow tests (SPEC §13). axe-core must be clean; typing a
 * request fetches grounded candidates; accepting speaks WITH a 5s undo window before
 * anything persists; the refusal path renders with a teach-a-phrase exit; the
 * first-visit walkthrough is accessible.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { SuggestionsResponse } from '@halfsaid/shared-types';

import { ConversationCanvas } from './ConversationCanvas';
import { WALKTHROUGH_KEY } from './DemoWalkthrough';

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

function ingestCalls(): number {
  return (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
    String(url).includes('/api/v1/pcg/ingest'),
  ).length;
}

// jsdom has no speechSynthesis, so tts.speak() no-ops — no mock needed.

describe('ConversationCanvas', () => {
  beforeEach(() => {
    // Skip the first-visit tour in flow tests (it has its own test below).
    window.localStorage.setItem(WALKTHROUGH_KEY, 'done');
  });

  it('has no axe violations in its initial state', async () => {
    mockFetch(candidatesResponse);
    const { container } = render(<ConversationCanvas />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows an accessible first-visit walkthrough that frames the PCG', async () => {
    window.localStorage.removeItem(WALKTHROUGH_KEY);
    mockFetch(candidatesResponse);
    const user = userEvent.setup();
    const { container } = render(<ConversationCanvas />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName(/personal communication graph/i);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: /skip tour/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(WALKTHROUGH_KEY)).toBe('done');
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

  it('accepting speaks with a 5s undo window, then persists to the PCG', async () => {
    mockFetch(candidatesResponse);
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    try {
      render(<ConversationCanvas />);
      await user.type(screen.getByLabelText(/type what you want to say/i), 'I want to');
      await user.click(screen.getByRole('button', { name: /get suggestions/i }));

      const card = await screen.findByRole('group', { name: /suggestion: call Sarah/i });
      await user.click(within(card).getByRole('button', { name: /accept and speak/i }));

      // Spoken immediately + undo offered; NOT yet persisted.
      expect(screen.getByLabelText('Spoken')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo speaking/i })).toBeInTheDocument();
      expect(ingestCalls()).toBe(0);

      // Window elapses → the utterance lands in the PCG.
      act(() => {
        jest.advanceTimersByTime(5100);
      });
      await waitFor(() => expect(ingestCalls()).toBe(1));
    } finally {
      jest.useRealTimers();
    }
  });

  it('undo inside the window stops persistence entirely (Dignity First)', async () => {
    mockFetch(candidatesResponse);
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    try {
      render(<ConversationCanvas />);
      await user.type(screen.getByLabelText(/type what you want to say/i), 'I want to');
      await user.click(screen.getByRole('button', { name: /get suggestions/i }));

      const card = await screen.findByRole('group', { name: /suggestion: call Sarah/i });
      await user.click(within(card).getByRole('button', { name: /accept and speak/i }));
      await user.click(screen.getByRole('button', { name: /undo speaking/i }));

      act(() => {
        jest.advanceTimersByTime(6000);
      });
      expect(ingestCalls()).toBe(0);
      expect(screen.queryByLabelText('Spoken')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders the first-class refusal path with a teach-a-phrase exit', async () => {
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
    // The refusal is a constructive exit, not a dead end.
    expect(screen.getByLabelText(/teach a new phrase/i)).toBeInTheDocument();
  });

  it('accepts a card from the keyboard with its number key', async () => {
    mockFetch(candidatesResponse);
    const user = userEvent.setup();
    render(<ConversationCanvas />);
    await user.type(screen.getByLabelText(/type what you want to say/i), 'I want to');
    await user.click(screen.getByRole('button', { name: /get suggestions/i }));
    await screen.findByRole('group', { name: /suggestion: call Sarah/i });

    // Move focus off the input, then press "2" → second card is spoken.
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('2');
    await waitFor(() => expect(screen.getByLabelText('Spoken')).toBeInTheDocument());
    expect(
      within(screen.getByLabelText('Spoken')).getByText('go to the garden'),
    ).toBeInTheDocument();
  });
});
