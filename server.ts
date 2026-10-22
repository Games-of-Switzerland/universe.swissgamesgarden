/**
 * @file Development server (`bun run dev`): static files, with src/main.js bundled on the fly. Files of public/
 * are served from the root, as in the build. index.html gets the version of VERSION.md, as in the build.
 */
import { injectVersion } from './scripts/version.ts';

const port = Number(process.env.PORT) || 0; // 0 = a random free port

async function bundle(): Promise<string> {
  const result = await Bun.build({
    entrypoints: ['./src/main.js'],
    target: 'browser',
    format: 'esm',
    sourcemap: 'inline',
  });
  if (!result.success) throw new Error(result.logs.map(String).join('\n'));
  return result.outputs[0].text();
}

const notFound = () => new Response('Not found', { status: 404 });

const server = Bun.serve({
  port,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    if (path === '/src/main.js') {
      try {
        return new Response(await bundle(), {
          headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
        });
      } catch (err) {
        console.error(err);
        return new Response(String(err), { status: 500 });
      }
    }
    if (path === '/' || path === '/index.html') {
      const html = injectVersion(await Bun.file('./index.html').text(), await Bun.file('./VERSION.md').text());
      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (path.includes('..') || path.startsWith('/.')) return notFound();
    for (const candidate of [`.${path}`, `./public${path}`]) {
      const file = Bun.file(candidate);
      if (await file.exists()) return new Response(file, { headers: { 'cache-control': 'no-store' } });
    }
    return notFound();
  },
});

console.log(`http://localhost:${server.port}`);
