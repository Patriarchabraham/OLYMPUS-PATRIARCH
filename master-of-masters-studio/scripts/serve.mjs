import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const rootDir = fs.existsSync(distDir) ? distDir : projectRoot;

const PORT = 7777;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

import { spawn } from 'node:child_process';

let cachedColabUrl = '';
let cachedLatency = 0;
let lastCheckedTime = 0;
let isColabAlive = false;

async function probeUrl(targetUrl) {
  const clean = targetUrl.trim().replace(/\/+$/, '');
  const start = performance.now();
  try {
    const res = await fetch(`${clean}/config`, { signal: AbortSignal.timeout(2200) });
    if (res.ok || res.status === 200 || res.status === 405) {
      return { alive: true, latencyMs: Math.max(1, Math.round(performance.now() - start)) };
    }
  } catch (_) {}

  try {
    const res = await fetch(clean, { signal: AbortSignal.timeout(2200) });
    if (res.ok || res.status === 200 || res.status === 302 || res.status === 405) {
      return { alive: true, latencyMs: Math.max(1, Math.round(performance.now() - start)) };
    }
  } catch (_) {}

  return { alive: false, latencyMs: 0 };
}

async function checkColabRelay(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedColabUrl && isColabAlive && (now - lastCheckedTime < 5000)) {
    return {
      connected: true,
      url: cachedColabUrl,
      latencyMs: cachedLatency,
      status: 'online',
      message: `🟢 Google Colab T4 Online (${cachedLatency}ms)`
    };
  }

  // 1. Check local server ports first (instant)
  for (const localCandidate of ['http://127.0.0.1:7860', 'http://127.0.0.1:8000']) {
    const localProbe = await probeUrl(localCandidate);
    if (localProbe.alive) {
      cachedColabUrl = localCandidate;
      cachedLatency = localProbe.latencyMs;
      isColabAlive = true;
      lastCheckedTime = now;
      return {
        connected: true,
        url: localCandidate,
        latencyMs: localProbe.latencyMs,
        status: 'online',
        isLocal: true,
        message: `🟢 GPU Local Online (${localProbe.latencyMs}ms)`
      };
    }
  }

  // 2. Fetch and actively verify candidate URLs from ntfy.sh relay channel
  try {
    const res = await fetch('https://ntfy.sh/olympus_master_studio_relay/json?poll=1', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const data = JSON.parse(lines[i]);
          const candidate = (data.message || '').trim();
          if (candidate.startsWith('http') && (candidate.includes('gradio.live') || candidate.includes('ngrok') || candidate.includes('loca.lt') || candidate.includes('7860') || candidate.includes('8000'))) {
            const probe = await probeUrl(candidate);
            if (probe.alive) {
              cachedColabUrl = candidate;
              cachedLatency = probe.latencyMs;
              isColabAlive = true;
              lastCheckedTime = now;
              return {
                connected: true,
                url: candidate,
                latencyMs: probe.latencyMs,
                status: 'online',
                message: `🟢 Google Colab T4 Online (${probe.latencyMs}ms)`
              };
            }
          }
        } catch (_) {}
      }
    }
  } catch (err) {}

  // If previously cached URL is still alive, re-check it
  if (cachedColabUrl) {
    const recheck = await probeUrl(cachedColabUrl);
    if (recheck.alive) {
      isColabAlive = true;
      cachedLatency = recheck.latencyMs;
      lastCheckedTime = now;
      return {
        connected: true,
        url: cachedColabUrl,
        latencyMs: cachedLatency,
        status: 'online',
        message: `🟢 Google Colab T4 Online (${cachedLatency}ms)`
      };
    }
  }

  isColabAlive = false;
  return {
    connected: false,
    url: '',
    latencyMs: 0,
    status: 'waiting',
    message: '⏳ Aguardando Sinal do Google Colab T4...'
  };
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Colab relay endpoint for zero-CORS status detection
  if (reqPath === '/api/colab-relay') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    const force = req.url.includes('force=1');
    checkColabRelay(force).then(data => res.end(JSON.stringify(data)));
    return;
  }

  if (reqPath === '/api/colab-url' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.clear || parsed.url === '') {
          cachedColabUrl = '';
          isColabAlive = false;
          lastCheckedTime = 0;
        } else if (parsed.url) {
          const test = await probeUrl(parsed.url);
          if (test.alive) {
            cachedColabUrl = parsed.url.trim();
            cachedLatency = test.latencyMs;
            isColabAlive = true;
            lastCheckedTime = Date.now();
          } else {
            cachedColabUrl = '';
            isColabAlive = false;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, connected: isColabAlive, url: cachedColabUrl, latencyMs: cachedLatency }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Trigger Colab launch via backend on Windows
  if (reqPath === '/api/colab-launch' && req.method === 'POST') {
    const autopilotScript = path.join(__dirname, 'colab_autopilot.ps1');
    try {
      spawn('powershell.exe', ['-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', autopilotScript], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, message: 'Autopilot disparado com sucesso no Windows' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(rootDir, reqPath);

  // Security check
  if (!filePath.startsWith(rootDir) && !filePath.startsWith(projectRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // If file doesn't exist, try dist or SPA fallback to index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error: ' + err.message);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Master of Masters Studio Pro Server online at http://127.0.0.1:${PORT}`);
  console.log(`📁 Serving directory: ${rootDir}`);
});
