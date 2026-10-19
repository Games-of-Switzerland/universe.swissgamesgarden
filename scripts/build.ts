/**
 * @file Production build (`bun run build`): one self-contained dist/index.html, plus the files of public/
 * (favicons, sharing image, robots.txt, sitemap.xml) copied as they are.
 */
import { cp, mkdir } from 'node:fs/promises';

const root = `${import.meta.dir}/..`;

const result = await Bun.build({
  entrypoints: [`${root}/src/main.js`],
  target: 'browser',
  format: 'iife',
  minify: true,
});
if (!result.success) {
  console.error(result.logs.map(String).join('\n'));
  process.exit(1);
}

// "</script" inside a JS string would end the inline script early: escape it (valid in JS and JSON strings).
const js = (await result.outputs[0].text()).replaceAll('</script', '<\\/script');
const css = await Bun.file(`${root}/src/styles.css`).text();
const html = await Bun.file(`${root}/index.html`).text();

const styleTag = '<link rel="stylesheet" href="src/styles.css">';
const scriptTag = '<script type="module" src="src/main.js"></script>';
if (!html.includes(styleTag) || !html.includes(scriptTag)) {
  console.error('index.html: expected the stylesheet link and the module script tag to inline.');
  process.exit(1);
}
// Replacer functions: a plain replacement string would interpret "$&" (which the bundle contains) as a pattern.
const out = html
  .replace(styleTag, () => `<style>\n${css}</style>`)
  .replace(scriptTag, () => `<script>\n${js}\n</script>`);

// The inlined script must still parse: catches an escaping or replacement mistake before it ships.
try {
  new Function(js);
} catch (err) {
  console.error(`The bundled script does not parse once inlined: ${err}`);
  process.exit(1);
}

await mkdir(`${root}/dist`, { recursive: true });
await Bun.write(`${root}/dist/index.html`, out);
await cp(`${root}/public`, `${root}/dist`, { recursive: true });
// Custom domain for GitHub Pages (the Deploy workflow publishes dist/ as is).
await Bun.write(`${root}/dist/CNAME`, 'universe.swissgames.garden\n');
// Pages must not run Jekyll over the output.
await Bun.write(`${root}/dist/.nojekyll`, '');
console.log(`dist/index.html (${(out.length / 1024).toFixed(0)} kB)`);
