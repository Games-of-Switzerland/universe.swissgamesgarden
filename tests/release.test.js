import { describe, expect, it } from 'vitest';
import { changelogSection, nextVersion } from '../scripts/release.ts';

const changelog = (unreleased) => `# Changelog

## [Unreleased]
${unreleased}
## [1.2.3] - 2026-01-01
### Fixed
- fix: an older fix

[Unreleased]: https://example.com/compare/v1.2.3...HEAD
[1.2.3]: https://example.com/releases/tag/v1.2.3
`;

describe('changelogSection', () => {
  it('returns the section up to the next one', () => {
    expect(changelogSection(changelog('### Fixed\n- fix: a\n'), 'Unreleased')).toBe('### Fixed\n- fix: a');
  });

  it('leaves out the link references of the last section', () => {
    expect(changelogSection(changelog(''), '1.2.3')).toBe('### Fixed\n- fix: an older fix');
  });

  it('returns an empty string for a missing section', () => {
    expect(changelogSection(changelog(''), '9.9.9')).toBe('');
  });
});

describe('nextVersion', () => {
  it('returns null when Unreleased lists nothing', () => {
    expect(nextVersion(changelog('\n'), '1.2.3')).toBeNull();
    expect(nextVersion(changelog('### Changed\n'), '1.2.3')).toBeNull();
  });

  it('bumps the patch for fixes only', () => {
    expect(nextVersion(changelog('### Changed\n- fix: a\n- perf: b\n'), '1.2.3')).toBe('1.2.4');
  });

  it('bumps the minor for an addition or a feat', () => {
    expect(nextVersion(changelog('### Added\n- a new page\n'), '1.2.3')).toBe('1.3.0');
    expect(nextVersion(changelog('### Changed\n- fix: a\n- feat(detail): b\n'), '1.2.3')).toBe('1.3.0');
  });

  it('bumps the major for a removal or a breaking change', () => {
    expect(nextVersion(changelog('### Removed\n- the old page\n'), '1.2.3')).toBe('2.0.0');
    expect(nextVersion(changelog('### Changed\n- feat!: a\n'), '1.2.3')).toBe('2.0.0');
    expect(nextVersion(changelog('### Changed\n- feat(data)!: a\n'), '1.2.3')).toBe('2.0.0');
    expect(nextVersion(changelog('### Changed\n- feat: BREAKING the hash routes\n'), '1.2.3')).toBe('2.0.0');
  });

  it('reads VERSION.md with its trailing newline', () => {
    expect(nextVersion(changelog('- fix: a\n'), '0.0.0\n')).toBe('0.0.1');
  });
});
