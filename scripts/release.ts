/**
 * @file The next release, read from CHANGELOG.md (the Release workflow): its version from the "Unreleased"
 * entries and VERSION.md, and the notes of a released version.
 *
 * `bun scripts/release.ts` prints the next version, or nothing when "Unreleased" is empty.
 * `bun scripts/release.ts --notes <version>` prints the changelog section of that version.
 */

/** The `## [<name>]` section of a Keep a Changelog file, without its heading; '' when it is missing. */
export function changelogSection(changelog: string, name: string): string {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${name}]`));
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && /^## \[/.test(line));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .filter((line) => !/^\[[^\]]+\]: /.test(line)) // link references at the bottom of the file
    .join('\n')
    .trim();
}

/**
 * The version after `current` for what "Unreleased" lists: major for a removal or a breaking change, minor for an
 * addition or a `feat`, patch otherwise; null when there is nothing to release.
 */
export function nextVersion(changelog: string, current: string): string | null {
  const unreleased = changelogSection(changelog, 'Unreleased');
  const entries = unreleased.split('\n').filter((line) => line.startsWith('- '));
  if (entries.length === 0) return null;
  const [major, minor, patch] = current.trim().split('.').map(Number);
  if (/^### Removed/m.test(unreleased) || entries.some((e) => /BREAKING|^- \w+(\([^)]*\))?!:/.test(e))) {
    return `${major + 1}.0.0`;
  }
  if (/^### Added/m.test(unreleased) || entries.some((e) => /^- feat\b/.test(e))) {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

if (import.meta.main) {
  const root = `${import.meta.dir}/..`;
  const changelog = await Bun.file(`${root}/CHANGELOG.md`).text();
  const [flag, version] = process.argv.slice(2);
  if (flag === '--notes') {
    console.log(changelogSection(changelog, version));
  } else {
    console.log(nextVersion(changelog, await Bun.file(`${root}/VERSION.md`).text()) ?? '');
  }
}
