const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const publicDir = path.resolve(__dirname, '../public');
const apiDir = path.resolve(__dirname, '../api');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function addResponseHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  res.send = (data) => {
    if (Buffer.isBuffer(data)) {
      res.end(data);
      return;
    }
    if (typeof data === 'object') {
      res.json(data);
      return;
    }
    res.end(String(data));
  };
  return res;
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function toQueryObject(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

async function handleApi(req, res, urlObj) {
  const routePath = urlObj.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  if (!routePath) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  const apiFile = path.join(apiDir, `${routePath}.js`);
  if (!apiFile.startsWith(apiDir) || !fs.existsSync(apiFile)) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  req.query = toQueryObject(urlObj.searchParams);

  const contentType = req.headers['content-type'] || '';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const rawBody = await readRequestBody(req);
    if (contentType.includes('application/json') && rawBody) {
      try {
        req.body = JSON.parse(rawBody);
      } catch (error) {
        req.body = rawBody;
      }
    } else {
      req.body = rawBody;
    }
  } else {
    req.body = {};
  }

  const mod = (() => {
    // Bust require cache for the API file and all project-local lib deps
    const libDir = path.resolve(__dirname, '../lib');
    Object.keys(require.cache).forEach(k => {
      if (k.startsWith(apiDir) || k.startsWith(libDir)) delete require.cache[k];
    });
    return require(apiFile);
  })();
  const handler = mod.default || mod;
  if (typeof handler !== 'function') {
    return res.status(500).json({ ok: false, error: 'Invalid API handler' });
  }

  return handler(req, res);
}

function safePathFromUrl(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^\/+/, '');
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) {
    return null;
  }
  return filePath;
}

async function handleStatic(req, res, urlObj) {
  let filePath = safePathFromUrl(urlObj.pathname);
  if (!filePath) {
    return res.status(400).send('Bad request');
  }

  if (urlObj.pathname === '/' || urlObj.pathname === '') {
    filePath = path.join(publicDir, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(404).send('Not found');
    }
    filePath = indexPath;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.status(500).send('Server error'));
  stream.pipe(res);
}

async function handler(req, res) {
  addResponseHelpers(res);
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  const startTime = Date.now();
  const method = req.method;
  const path = urlObj.pathname;

  if (urlObj.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, urlObj);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Server error' });
      }
    }
    const duration = Date.now() - startTime;
    const status = res.statusCode || 500;
    const statusColor = status >= 400 ? '\x1b[91m' : '\x1b[92m';
    console.log(`${statusColor}${status}\x1b[0m ${method} ${path} (${duration}ms)`);
    return;
  }

  try {
    await handleStatic(req, res, urlObj);
  } catch (error) {
    console.error(error);
  }
  
  const duration = Date.now() - startTime;
  const status = res.statusCode || 200;
  const statusColor = status >= 400 ? '\x1b[91m' : '\x1b[92m';
  console.log(`${statusColor}${status}\x1b[0m ${method} ${path} (${duration}ms)`);
}

function listenWithFallback(server, preferredPort) {
  return new Promise((resolve, reject) => {
    server.listen(preferredPort, () => resolve(server.address().port));
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        // Preferred port taken — let OS assign a free one
        server.removeAllListeners('error');
        server.listen(0, () => resolve(server.address().port));
        server.once('error', reject);
        return;
      }
      reject(error);
    });
  });
}

const port = Number(process.env.PORT || 3001);
const server = http.createServer(handler);

listenWithFallback(server, port)
  .then((boundPort) => {
    const portNote = boundPort === port ? '' : ` (port ${port} was busy, using fallback)`;
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Local dev server started');
    console.log(`  🌐 URL: http://localhost:${boundPort}${portNote}`);
    console.log(`  📁 Public: ${publicDir}`);
    console.log(`  🔌 API: /api/* routes active`);
    console.log('═══════════════════════════════════════════════════════════\n');
  })
  .catch((error) => {
    console.error('\n❌ Failed to start dev server:', error.message);
    process.exit(1);
  });
