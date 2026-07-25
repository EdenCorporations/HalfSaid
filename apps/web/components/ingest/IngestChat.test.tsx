/**
 * Graph-building companion chat tests — a message is sent to /v1/pcg/chat, the
 * reply renders with entity chips, and axe is clean.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { IngestChat } from './IngestChat';

function mockFetch() {
  global.fetch = jest.fn().mockImplementation((url: unknown) => {
    if (String(url).includes('/pcg/chat')) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          reply: 'Lovely — saved Nora. Does she live nearby?',
          utteranceId: 'u1',
          linked: 2,
          entities: { people: ['Nora'], places: [], objects: [], topics: ['baking'] },
        }),
      });
    }
    // Growth chip / mini-map graph fetches.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ nodes: [], edges: [], totals: { nodes: 5, edges: 3 } }),
    });
  }) as unknown as typeof fetch;
}

describe('IngestChat', () => {
  beforeEach(mockFetch);

  it('sends a message and renders the companion reply with entity chips', async () => {
    const user = userEvent.setup();
    render(<IngestChat />);

    await user.type(
      screen.getByLabelText(/tell halfsaid something/i),
      'Nora visits every Sunday and they bake scones',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/saved Nora\. Does she live nearby\?/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/\+ Person: Nora/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Topic: baking/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/pcg/chat', expect.any(Object));
  });

  it('has no axe violations (empty state and after a reply)', async () => {
    const user = userEvent.setup();
    const { container } = render(<IngestChat />);
    expect(await axe(container)).toHaveNoViolations();

    await user.type(screen.getByLabelText(/tell halfsaid something/i), 'hello there');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/saved Nora/i)).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });
});
