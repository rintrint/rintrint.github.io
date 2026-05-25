// tools/serve.js — 極簡靜態檔案 server,給瀏覽器測試用。
// 用法: node tools/serve.js [port]    預設 port 8000
//
// 跟 production 行為等價的部分:fetch CSV、ES script load order。
// 不會做任何 cache / compression / live reload。

const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');
const url  = require('node:url');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.argv[2] || '8000', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function safeJoin(root, reqPath) {
  const full = path.normalize(path.join(root, reqPath));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(url.parse(req.url).pathname);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const fullPath = safeJoin(ROOT, reqPath);
  if (!fullPath) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found: ' + reqPath); return; }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}/index.html`);
  console.log(`  http://localhost:${PORT}/generator.html`);
});
