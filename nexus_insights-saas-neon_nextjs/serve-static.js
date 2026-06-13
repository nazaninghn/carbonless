/**
 * Minimal static file server for Next.js production build output.
 * Bypasses the middleware (which crashes due to eval-source-map in Edge Runtime).
 * Serves pre-rendered pages + static assets from .next/ directory.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT  = __dirname;
const NEXT  = path.join(ROOT, '.next');
const PORT  = 4001;

const MIME = {
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
};

function serveFile(res, filePath, mime) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    res.end(data);
    return true;
  } catch { return false; }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // Strip trailing slash (except root)
  if (pathname !== '/' && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  // ── Static assets ────────────────────────────────────────────────────────────
  if (pathname.startsWith('/_next/static/')) {
    const rel  = pathname.slice('/_next/static/'.length);
    const file = path.join(NEXT, 'static', ...rel.split('/'));
    const ext  = path.extname(file);
    if (serveFile(res, file, MIME[ext] || 'application/octet-stream')) return;
  }

  // ── Public assets ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/public/') || pathname.startsWith('/favicon')) {
    const file = path.join(ROOT, 'public', pathname.replace(/^\/public/, ''));
    if (serveFile(res, file, MIME[path.extname(file)] || 'application/octet-stream')) return;
  }

  // ── Page routes ───────────────────────────────────────────────────────────────
  // Map pathname → pre-rendered .html in .next/server/app/
  function htmlPath(route) {
    // e.g. '/dashboard/workspace' → '.next/server/app/dashboard/workspace.html'
    // '/' → '.next/server/app/index.html'
    if (route === '/') return path.join(NEXT, 'server', 'app', 'index.html');
    return path.join(NEXT, 'server', 'app', ...route.slice(1).split('/').map(encodeURIComponent).join('/').split('/')) + '.html';
  }

  // Try exact match then fallback
  const candidateFile = htmlPath(pathname);
  if (serveFile(res, candidateFile, 'text/html; charset=utf-8')) return;

  // Try index.html inside directory
  const indexFile = path.join(htmlPath(pathname).replace('.html',''), 'index.html');
  if (serveFile(res, indexFile, 'text/html; charset=utf-8')) return;

  // Fallback: serve from /public/ directory (handles /carbonless.png, /favicon.ico, etc.)
  const publicFallback = path.join(ROOT, 'public', pathname);
  const fallbackExt = path.extname(publicFallback);
  if (fallbackExt && serveFile(res, publicFallback, MIME[fallbackExt] || 'application/octet-stream')) return;

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found: ' + pathname);
});

server.listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
  console.log('Routes: / → index.html, /dashboard/workspace → workspace.html');
  console.log('Press Ctrl+C to stop.');
});
