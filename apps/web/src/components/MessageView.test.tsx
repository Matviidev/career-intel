import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../lib/types';
import { MessageView } from './MessageView';

const message: ChatMessage = {
  id: 'a',
  role: 'assistant',
  content: 'You built a Kafka pipeline [R3] but the role needs Kubernetes [J1.2] and Rust [J9.9].',
  status: 'done',
  meta: {
    traceId: 't',
    scope: { reason: 'mentioned', jobs: [1], unknown: [] },
    sources: [
      {
        label: 'R3',
        documentKind: 'resume',
        jobNumber: null,
        documentTitle: 'Resume',
        section: 'Experience',
        content: '',
      },
      {
        label: 'J1.2',
        documentKind: 'job',
        jobNumber: 1,
        documentTitle: 'Job',
        section: 'Requirements',
        content: '',
      },
    ],
    flags: [],
  },
  done: { cited: ['R3', 'J1.2'], unknownCitations: ['J9.9'], flags: ['unknown_citation'] },
};

describe('MessageView', () => {
  it('renders citations as buttons and reports clicks', () => {
    const onCite = vi.fn();
    render(
      <MessageView
        message={message}
        active={false}
        onCite={onCite}
        onShowSources={vi.fn()}
        onRate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'R3' }));
    expect(onCite).toHaveBeenCalledWith('R3');
    expect(screen.getByRole('button', { name: 'J9.9' })).toHaveAttribute(
      'title',
      expect.stringMatching(/not among/),
    );
  });

  it('shows scope and guardrail warnings', () => {
    render(
      <MessageView
        message={message}
        active={false}
        onCite={vi.fn()}
        onShowSources={vi.fn()}
        onRate={vi.fn()}
      />,
    );
    expect(screen.getByText('Resume + Job #1')).toBeInTheDocument();
    expect(screen.getByText(/cites a source that was not retrieved/)).toBeInTheDocument();
  });
});
