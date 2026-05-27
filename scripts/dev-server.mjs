import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = normalize(join(__dirname, '..'));

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const trimmed = decoded.startsWith('/') ? decoded.slice(1) : decoded;
  const target = normalize(join(rootDir, trimmed));
  if (!target.startsWith(rootDir)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    return res.end('Bad Request');
  }

  let path = safePath(req.url);
  if (!path) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  if (existsSync(path) && statSync(path).isDirectory()) {
    path = join(path, 'index.html');
  }
  if (!existsSync(path)) {
    // SPA-style fallback to index.html
    path = join(rootDir, 'index.html');
  }

  const ext = extname(path).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  createReadStream(path)
    .on('error', () => {
      res.statusCode = 500;
      res.end('Internal Server Error');
    })
    .pipe(res);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`NAVPRO frontend listening on http://${HOST}:${PORT}`);
});

