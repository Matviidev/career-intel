import { describe, expect, it, vi } from 'vitest';
import { dispatch, type StreamHandlers } from './api';

function handlers(): StreamHandlers {
  return { onMeta: vi.fn(), onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
}

describe('dispatch', () => {
  it('routes SSE events to handlers', () => {
    const h = handlers();
    dispatch('event: delta\ndata: {"text":"Hi"}', h);
    dispatch('event: done\ndata: {"cited":["R1"],"unknownCitations":[],"flags":[]}', h);
    dispatch('event: error\ndata: {"message":"boom"}', h);
    expect(h.onDelta).toHaveBeenCalledWith('Hi');
    expect(h.onDone).toHaveBeenCalledWith({ cited: ['R1'], unknownCitations: [], flags: [] });
    expect(h.onError).toHaveBeenCalledWith('boom');
  });

  it('ignores malformed blocks', () => {
    const h = handlers();
    dispatch(': keep-alive', h);
    expect(
      Object.values(h).every((fn) => !(fn as ReturnType<typeof vi.fn>).mock.calls.length),
    ).toBe(true);
  });
});
