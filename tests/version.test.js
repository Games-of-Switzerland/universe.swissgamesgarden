import { describe, expect, it } from 'vitest';
import { injectVersion } from '../scripts/version.ts';

describe('injectVersion', () => {
  it('fills the data-version span', () => {
    expect(injectVersion('<a>GitHub<span data-version></span></a>', '1.2.3\n')).toBe(
      '<a>GitHub<span data-version> v1.2.3</span></a>',
    );
  });
});
