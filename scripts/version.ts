/**
 * @file The site version: VERSION.md holds it, the build and the dev server write it next to the GitHub link.
 */

/** Writes the version into the `data-version` span of index.html. */
export function injectVersion(html: string, version: string): string {
  return html.replace('data-version></span>', () => `data-version> v${version.trim()}</span>`);
}
