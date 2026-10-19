/**
 * @file Text helpers shared by the detail page, the explainer and the search results.
 * @module format
 */

/** Human date for an ISO day; January 1st means "year only" in the archive, so it shows the year alone. */
export function fmtDate(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (/-01-01$/.test(isoDate)) return String(date.getUTCFullYear());
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "1 award", "3 awards". */
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Opening of the detail subtitle by state of the first release; bold parts are { b: text }.
 *   released     First released <date> on <platform>     / Unknown release date on <platform>
 *   development  Under development on <platform>         / Under development, planned <date> on <platform>
 *   prototype    Prototype, <date> on <platform>         / Prototype, TBA on <platform>
 *   canceled     Canceled, <year> on <platform>          / Canceled on <platform>   (year only, never the full date)
 */
export function subtitleParts(firstRelease = {}) {
  const state = firstRelease.state || 'released';
  const date = fmtDate(firstRelease.date);
  const onPlatform = firstRelease.platform ? [' on ', { b: firstRelease.platform }] : [];
  if (state === 'development') {
    return date ? ['Under development, planned ', { b: date }, ...onPlatform] : ['Under development', ...onPlatform];
  }
  if (state === 'prototype') return ['Prototype, ', { b: date || 'TBA' }, ...onPlatform];
  if (state === 'canceled') {
    return firstRelease.date
      ? ['Canceled, ', { b: firstRelease.date.slice(0, 4) }, ...onPlatform]
      : ['Canceled', ...onPlatform];
  }
  return date ? ['First released ', { b: date }, ...onPlatform] : ['Unknown release date', ...onPlatform];
}

/** The subtitle as plain text, for tests and fallbacks. */
export const subtitleText = (firstRelease) =>
  subtitleParts(firstRelease)
    .map((part) => (typeof part === 'string' ? part : part.b))
    .join('');
