/**
 * @file Renders scripts/og-image.html to public/og-image.png (1200 × 630) with headless Chrome.
 * Needs the dev server running: `PORT=4791 bun run dev`, then `bun run og-image` (or set OG_URL).
 */
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.env.OG_URL || 'http://localhost:4791/scripts/og-image.html';
const out = `${import.meta.dir}/../public/og-image.png`;

const run = Bun.spawnSync([
  chrome,
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  // Time for the fonts and the data to load before the screenshot.
  '--virtual-time-budget=8000',
  `--screenshot=${out}`,
  url,
]);
if (run.exitCode !== 0) {
  console.error(run.stderr.toString());
  process.exit(1);
}
console.log(`public/og-image.png from ${url}`);
