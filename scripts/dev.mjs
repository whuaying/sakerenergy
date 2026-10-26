import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { build, root } from './build.mjs';

await build();
let pending;
let building = Promise.resolve();
watch(path.join(root, 'web'), { recursive: true }, () => {
  clearTimeout(pending);
  pending = setTimeout(() => { building = building.then(build).catch(console.error); }, 100);
});
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
http.createServer(async (req, res) => {
  await building;
  try {
    const requestURL = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(requestURL.pathname);
    if (pathname === '/__qa__/viewport') {
      const width = Math.max(320, Math.min(1440, Number(requestURL.searchParams.get('width')) || 390));
      const requestedPage = requestURL.searchParams.get('page') || 'index.html';
      const selectedPage = ['index.html', 'platform.html', 'solutions.html', 'technology.html', 'experience.html', 'contact.html', 'privacy.html', '404.html'].includes(requestedPage) ? requestedPage : 'index.html';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(`<!doctype html><html lang="zh-CN"><head><title>Responsive QA · ${width}px</title><style>body{margin:0;background:#d9ddd5;font-family:Arial,sans-serif}header{padding:12px;text-align:center;font-size:12px;color:#41553c}iframe{display:block;width:${width}px;height:850px;border:0;margin:0 auto;background:white;box-shadow:0 10px 30px #1d331b25}</style></head><body><header>Local development viewport · ${width}px · ${selectedPage}</header><iframe title="Mobile website preview" src="/${selectedPage}"></iframe></body></html>`);
      return;
    }
    const file = path.resolve(root, 'dist', '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(path.join(root, 'dist') + path.sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(root, 'dist/404.html')));
  }
}).listen(Number(process.env.PORT) || 4173, '0.0.0.0', () => console.log('Saker Energy ready'));
