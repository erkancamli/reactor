// Local stand-in for Netlify: serves dist/ and routes /api/* to the real handler with an in-memory store.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { handle } from '../netlify/functions/api.mjs';
const mem = new Map();
const store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
const offset = { ms: 0 }; // lets a test fast forward the server clock
const port = Number(process.env.PORT || 8790);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__clock') { offset.ms += Number(url.searchParams.get('add') || 0); res.end('ok'); return; }
  if (url.pathname.startsWith('/api/')) {
    const body = await new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });
    const r = await handle(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }), { store, ip: req.socket.remoteAddress, secret: 'dev-secret-0123456789abcdef', now: Date.now() + offset.ms });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  const file = url.pathname === '/' ? 'dist/index.html' : 'dist' + url.pathname;
  try {
    const data = await readFile(file);
    const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log('dev server on ' + port));
