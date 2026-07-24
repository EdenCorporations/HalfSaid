/**
 * Clinician dashboard a11y + behaviour tests (SPEC §14). The FCM chart is labelled
 * MOCK and accessible; the conversation log renders timeline items; axe is clean.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { TimelineResponse } from '@halfsaid/shared-types';

import { FcmTrendChart } from './FcmTrendChart';
import { ConversationLog } from './ConversationLog';
import { SessionStats } from './SessionStats';

describe('FcmTrendChart', () => {
  it('is visibly labelled MOCK and has an accessible summary', () => {
    render(<FcmTrendChart />);
    expect(screen.getByText('MOCK DATA')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /mock fcm trend/i })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<FcmTrendChart />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ConversationLog', () => {
  const timeline: TimelineResponse = {
    items: [
      {
        id: 'a',
        date: '2026-05-16T09:00:00.000Z',
        modality: 'phrase',
        summary: 'call Sarah',
        privacyTier: 2,
      },
      {
        id: 'b',
        date: '2026-05-15T09:00:00.000Z',
        modality: 'phrase',
        summary: 'go to the garden',
        privacyTier: 1,
      },
    ],
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => timeline,
    }) as unknown as typeof fetch;
  });

  it('renders recent utterances from the timeline', async () => {
    render(<ConversationLog />);
    await waitFor(() => expect(screen.getByText('call Sarah')).toBeInTheDocument());
    expect(screen.getByText('go to the garden')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/pcg/timeline?limit=15'),
      expect.any(Object),
    );
  });

  it('offers a search box wired to the server-side q filter', async () => {
    render(<ConversationLog />);
    await waitFor(() => expect(screen.getByText('call Sarah')).toBeInTheDocument());
    expect(screen.getByLabelText(/search the conversation log/i)).toBeInTheDocument();
  });

  it('has no axe violations once loaded', async () => {
    const { container } = render(<ConversationLog />);
    await waitFor(() => expect(screen.getByText('call Sarah')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SessionStats', () => {
  const timeline: TimelineResponse = {
    items: [
      {
        id: 'a',
        date: new Date().toISOString(),
        modality: 'phrase',
        summary: 'call Sarah',
        privacyTier: 2,
      },
      {
        id: 'b',
        date: new Date().toISOString(),
        modality: 'phrase',
        summary: 'call Sarah',
        privacyTier: 2,
      },
      {
        id: 'c',
        date: '2026-05-15T09:00:00.000Z',
        modality: 'full_utterance',
        summary: 'go to the garden',
        privacyTier: 1,
      },
    ],
    total: 3,
    offset: 0,
  };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => timeline,
    }) as unknown as typeof fetch;
  });

  it('computes LIVE stats from the timeline (total, top phrases)', async () => {
    render(<SessionStats />);
    expect(await screen.findByText('Utterances')).toBeInTheDocument();
    expect(screen.getByText('LIVE DATA')).toBeInTheDocument();
    expect(screen.getByText('Utterances').nextSibling).toHaveTextContent('3');
    expect(screen.getByText(/call sarah/)).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });

  it('has no axe violations once loaded', async () => {
    const { container } = render(<SessionStats />);
    await screen.findByText('Utterances');
    expect(await axe(container)).toHaveNoViolations();
  });
});
