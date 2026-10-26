import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../src/llm/llm.js';
import { parseJson } from '../src/llm/openai.js';

describe('parseJson', () => {
  it('reads plain, fenced and wrapped JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseJson('Here you go: {"a":{"b":3}} hope it helps')).toEqual({ a: { b: 3 } });
  });

  it('rejects output without an object', () => {
    expect(() => parseJson('no json here')).toThrow(ExtractionError);
  });
});
