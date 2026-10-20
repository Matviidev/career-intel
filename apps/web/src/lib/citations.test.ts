import { describe, expect, it } from 'vitest';
import { citationLabel, linkCitations } from './citations';

describe('linkCitations', () => {
  it('turns single and grouped citations into anchor links', () => {
    expect(linkCitations('Led a team [R2]. Needs Go [J1.2, J1.4].')).toBe(
      'Led a team [R2](#cite-R2). Needs Go [J1.2](#cite-J1.2)[J1.4](#cite-J1.4).',
    );
  });

  it('leaves ordinary brackets alone', () => {
    expect(linkCitations('[optional] and [link](https://x.y)')).toBe(
      '[optional] and [link](https://x.y)',
    );
  });

  it('reads labels from hrefs', () => {
    expect(citationLabel('#cite-J2.1')).toBe('J2.1');
    expect(citationLabel('https://example.com')).toBeNull();
  });
});
