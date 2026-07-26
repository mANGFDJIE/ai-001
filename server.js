const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const https = require('https');
const { applySchemaOnce } = require('./supabase/bootstrap');

const app = express();
const PORT = 5000;

const WORKSPACE_DIR = path.join(__dirname, 'workspace', 'preview');

// Apply Postgres schema automatically when SUPABASE_DB_URL is provided.
// Runs once per process; idempotent thanks to CREATE ... IF NOT EXISTS in schema.sql.
applySchemaOnce().catch(err => console.error('[supabase] bootstrap error:', err));

app.use(express.json({ limit: '8mb' }));
// No-store для всего — чтобы правки в /public подхватывались без жёсткой перезагрузки
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(express.static(path.join(__dirname, 'public')));

// ── Raw file read for the source-viewer (no path traversal) ─────────────────
app.get('/api/workspace/raw', (req, res) => {
  const fsRead = require('fs');
  const requested = String(req.query.path || '');
  if (!requested) return res.status(400).json({ error: 'path required' });
  if (requested.includes('..') || requested.startsWith('/') || requested.startsWith('\\')) {
    return res.status(400).json({ error: 'invalid path' });
  }
  const full = path.join(WORKSPACE_DIR, requested);
  if (!full.startsWith(WORKSPACE_DIR)) {
    return res.status(400).json({ error: 'path escapes workspace' });
  }
  // Отдаём бинарно по mime из расширения — клиенту нужны картинки для
  // превью в восстановленной из истории переписки. Весь остальной мир
  // (текст, json) уезжает в /api/workspace/read как utf-8.
  const mime = /\.png$/i.test(requested)  ? 'image/png'
             : /\.jpe?g$/i.test(requested) ? 'image/jpeg'
             : /\.gif$/i.test(requested)  ? 'image/gif'
             : /\.webp$/i.test(requested) ? 'image/webp'
             : /\.bmp$/i.test(requested)  ? 'image/bmp'
             : /\.svg$/i.test(requested)  ? 'image/svg+xml'
             : /json/i.test(requested)   ? 'application/json; charset=utf-8'
             : 'application/octet-stream';
  fsRead.readFile(full, (err, body) => {
    if (err) return res.status(404).json({ error: 'not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', mime);
    res.end(body);
  });
});

// ── File explorer actions: upload / download / delete ─────────────────────
const fsSync = require('fs');
app.post('/api/workspace/upload', (req, res) => {
  // Поддерживаем два варианта:
  //   { name: 'foo.png', data: '<base64>' }  — простой файл в корень workspace.
  //   { path: 'attached/foo.png', data: '<base64>' } — относительный путь
  //   (с подкаталогами), проходит через sanitizePath, чтобы вложения не
  //   выходили за пределы WORKSPACE_DIR.
  const rawPath = String((req.body && req.body.path) || (req.body && req.body.name) || '');
  const data = String((req.body && req.body.data) || '');
  if (!rawPath || !data) return res.status(400).json({ error: 'name|path + data required' });
  let safe;
  if (req.body && req.body.path) {
    safe = sanitizePath(rawPath);
  } else {
    safe = path.basename(rawPath).replace(/[^A-Za-z0-9._-]/g, '_');
  }
  if (!safe || safe.startsWith('.') || safe.includes('..')) {
    return res.status(400).json({ error: 'invalid name/path' });
  }
  try {
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 16 * 1024 * 1024) {
      return res.status(413).json({ error: 'file too large (>16 MB)' });
    }
    const full = path.join(WORKSPACE_DIR, safe);
    fsSync.mkdirSync(path.dirname(full), { recursive: true });
    fsSync.writeFileSync(full, buf);
    res.json({ ok: true, path: safe, size: buf.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/workspace/download', (req, res) => {
  const name = String(req.query.path || '');
  if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
    return res.status(400).json({ error: 'invalid path' });
  }
  const full = path.join(WORKSPACE_DIR, path.basename(name));
  if (!full.startsWith(WORKSPACE_DIR)) {
    return res.status(400).json({ error: 'invalid path' });
  }
  fsSync.readFile(full, (err, body) => {
    if (err) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name.replace(/"/g, '') + '"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  });
});

app.delete('/api/workspace/file', (req, res) => {
  const name = String(req.query.path || '');
  // Поддерживаем вложенные пути (например, attached/2026…-foo.png) —
  // sanitizePath отсекает попытки выйти за WORKSPACE_DIR.
  const safe = name.includes('/') || name.includes('\\') ? sanitizePath(name) : path.basename(name);
  if (!safe || safe.startsWith('.') || safe.includes('..')) {
    return res.status(400).json({ error: 'invalid path' });
  }
  const full = path.join(WORKSPACE_DIR, safe);
  if (!full.startsWith(WORKSPACE_DIR)) {
    return res.status(400).json({ error: 'invalid path' });
  }
  fsSync.unlink(full, (err) => {
    if (err) return res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// ── Preview static — Replit-like: no caching + injected console bridge ──────
// The bridge is prepended to every .html served from /preview so the host
// can capture console.log/warn/error + uncaught exceptions from the iframe.
const PREVIEW_BRIDGE = `<script>(function(){
  const send=function(type,args){try{parent.postMessage({source:'preview-iframe',type,args:args.map(function(a){try{if(a&&typeof a==='object')return JSON.stringify(a).slice(0,2000);return String(a);}catch(_){return String(a);}})},'*')}catch(_){}};
  const orig={log:console.log,warn:console.warn,error:console.error,info:console.info};
  ['log','warn','error','info'].forEach(function(k){console[k]=function(){send(k,Array.prototype.slice.call(arguments));orig[k].apply(console,arguments);};});
  window.addEventListener('error',function(e){send('error',[e.message+' ('+(e.filename||'')+':'+e.lineno+')'])});
  window.addEventListener('unhandledrejection',function(e){send('unhandledrejection',[String(e.reason&&e.reason.message||e.reason)])});
  // ── Select Element mode ────────────────────────────────────────────
  // Родительский агент присылает {type:'select-mode', on:true} — включаем
  // подсветку под курсором и перехват клика. По клику отдаём outerHTML
  // выбранного элемента и оба расцелляем режим.
  let selectOn=false, hoveredEl=null;
  function out(el,on){try{if(el&&el.classList)el.classList[on?'add':'remove']('__sel-outline');}catch(_){}}
  document.addEventListener('mouseover',function(e){if(!selectOn)return;if(hoveredEl&&hoveredEl!==e.target)out(hoveredEl,false);hoveredEl=e.target;out(hoveredEl,true);},true);
  document.addEventListener('mouseout',function(e){if(!selectOn)return;out(e.target,false);},true);
  document.addEventListener('click',function(e){if(!selectOn)return;e.preventDefault();e.stopPropagation();var el=e.target;send('element-selected',[(el.tagName||'').toLowerCase(),(el.outerHTML||'').slice(0,4000),el.id||'',typeof el.className==='string'?el.className:'']);selectOn=false;document.body&&document.body.classList.remove('select-mode');out(hoveredEl,false);hoveredEl=null;},true);
  window.addEventListener('message',function(e){var m=e.data||{};if(m.source!=='agent')return;if(m.type==='select-mode'){selectOn=!!m.on;if(document.body)document.body.classList[selectOn?'add':'remove']('select-mode');if(!selectOn){out(hoveredEl,false);hoveredEl=null;}}});
  // Подсветка выделения и pointer-cursor в режиме выбора (через shadow-style).
  var st=document.createElement('style');st.textContent='.__sel-outline{outline:2px solid #00b3ff !important;outline-offset:-1px !important}.select-mode, .select-mode *{cursor:crosshair !important}';(document.head||document.documentElement).appendChild(st);
  parent.postMessage({source:'preview-iframe',type:'ready'},'*');
})();</script>`;

const previewStatic = express.static(WORKSPACE_DIR, {
  setHeaders(res, filePath) {
    // Always fresh — the user expects Replit-like live updates.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
});

app.use('/preview', (req, res, next) => {
  // Only inject into HTML files; everything else goes through static as-is.
  if (req.path === '/' || /\.html?$/i.test(req.path)) {
    const fs = require('fs');
    const requested = req.path === '/' ? '/index.html' : req.path;
    const filePath = path.join(WORKSPACE_DIR, requested);
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) return next();
      // Inject bridge right after <head> if present, else at top of <body>,
      // else just prepend.
      let injected;
      if (/<head[^>]*>/i.test(html)) {
        injected = html.replace(/<head[^>]*>/i, m => m + PREVIEW_BRIDGE);
      } else if (/<body[^>]*>/i.test(html)) {
        injected = html.replace(/<body[^>]*>/i, m => m + PREVIEW_BRIDGE);
      } else {
        injected = PREVIEW_BRIDGE + html;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(injected);
    });
  } else {
    previewStatic(req, res, next);
  }
});

// ── Live file-change stream (SSE) — pushes 'files' event whenever the
//    workspace/preview/ directory mutates, so the UI updates without polling.
const fsWatch = require('fs');
app.get('/api/workspace/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': connected\n\n');

  const state = { sig: '' };
  function snapshot() {
    try {
      const items = fsWatch.readdirSync(WORKSPACE_DIR, { withFileTypes: true })
        .filter(d => d.isFile())
        .map(d => {
          const full = path.join(WORKSPACE_DIR, d.name);
          const s = fsWatch.statSync(full);
          return { name: d.name, mtime: s.mtimeMs, size: s.size };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return items;
    } catch { return []; }
  }
  function tick() {
    const items = snapshot();
    const sig = items.map(i => i.name + ':' + i.mtime + ':' + i.size).join('|');
    if (sig !== state.sig) {
      state.sig = sig;
      res.write(`event: files\ndata: ${JSON.stringify(items)}\n\n`);
    }
    res.write(`: ping ${Date.now()}\n\n`);
  }
  tick();
  const timer = setInterval(tick, 800);

  let watcher;
  try {
    watcher = fsWatch.watch(WORKSPACE_DIR, { persistent: false }, () => tick());
  } catch {}

  req.on('close', () => {
    clearInterval(timer);
    try { if (watcher) watcher.close(); } catch {}
  });
});

// ── Supabase sync via server-side service_role ─────────────────────────────
// The browser can no longer talk to Supabase directly. Every sync operation
// is forwarded here, where SUPABASE_SERVICE_KEY (admin) does the heavy lifting.
// All endpoints are guard-railed with a feature flag so they degrade gracefully
// when Supabase env vars are missing — in that case we 503 and the browser
// silently falls back to localStorage.
// ── Device identity via signed cookie ─────────────────────────────────────────
// The service_role key bypasses RLS, so we must not trust client-supplied
// device_id in request bodies. Instead the server signs a device_id in a
// httpOnly cookie and validates it on every /api/sync/* call. This keeps each
// device's chats, model state and files isolated from other devices.
const COOKIE_NAME = 'device_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

function signDeviceId(deviceId) {
  const secret = process.env.SESSION_SECRET || 'dev-secret-change-me';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(deviceId);
  return `${deviceId}.${hmac.digest('hex')}`;
}

function verifyDeviceId(signed) {
  const [deviceId, sig] = (signed || '').split('.');
  if (!deviceId || !sig) return null;
  const expected = signDeviceId(deviceId).split('.')[1];
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return deviceId;
    }
  } catch {}
  return null;
}

function getDeviceIdFromCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=([^;]+)'));
  return match ? verifyDeviceId(decodeURIComponent(match[1])) : null;
}

function setDeviceCookie(res, deviceId) {
  const signed = signDeviceId(deviceId);
  res.cookie(COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/api/sync'
  });
}

function requireSyncAuth(req, res, next) {
  const deviceId = getDeviceIdFromCookie(req);
  if (!deviceId) {
    return res.status(401).json({ error: 'device auth required', code: 'AUTH_REQUIRED' });
  }
  req.deviceId = deviceId;
  next();
}

function supabaseAdminEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}
async function supabaseRest(path, opts = {}) {
  if (!supabaseAdminEnabled()) throw new Error('supabase-not-configured');
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      ...(opts.headers || {})
    }
  });
  return res;
}

app.post('/api/sync/session', async (req, res) => {
  try {
    let deviceId = getDeviceIdFromCookie(req);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      setDeviceCookie(res, deviceId);
    }
    const r = await supabaseRest(
      `/rest/v1/chat_sessions?select=id&device_id=eq.${encodeURIComponent(deviceId)}&order=created_at.desc&limit=1`,
      { headers: { 'Accept-Profile': 'public' } }
    );
    // If tables don't exist the project returns PGRST205 — we pass it through
    // so the client falls back to local-only mode.
    if (!r.ok) return res.status(r.status).json(await r.json());
    const rows = await r.json();
    let id;
    if (Array.isArray(rows) && rows.length) {
      id = rows[0].id;
    } else {
      const ins = await supabaseRest('/rest/v1/chat_sessions', {
        method: 'POST',
        headers: { 'Content-Profile': 'public', Prefer: 'return=representation' },
        body: JSON.stringify({ device_id: deviceId, title: 'Чат ' + new Date().toLocaleDateString('ru-RU') })
      });
      const out = await ins.json();
      id = Array.isArray(out) ? out[0]?.id : out?.id;
    }
    res.json({ id });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// All sync endpoints except /session require a valid signed device cookie.
app.use('/api/sync', (req, res, next) => {
  if (req.path === '/session') return next();
  requireSyncAuth(req, res, next);
});

app.post('/api/sync/chat', async (req, res) => {
  try {
    const { session_id, role, content, model, task, complexity } = req.body || {};
    const device_id = req.deviceId;
    if (!session_id || !role || !content) return res.status(400).json({ error: 'missing fields' });
    // Verify the session belongs to this device before writing.
    const sessionCheck = await supabaseRest(
      `/rest/v1/chat_sessions?select=id&device_id=eq.${encodeURIComponent(device_id)}&id=eq.${encodeURIComponent(session_id)}&limit=1`,
      { headers: { 'Accept-Profile': 'public' } }
    );
    if (!sessionCheck.ok) return res.status(sessionCheck.status).json(await sessionCheck.json());
    const sessions = await sessionCheck.json();
    if (!Array.isArray(sessions) || !sessions.length) {
      return res.status(403).json({ error: 'session not owned by device' });
    }
    const r = await supabaseRest('/rest/v1/chat_messages', {
      method: 'POST',
      headers: { 'Content-Profile': 'public', Prefer: 'return=minimal' },
      body: JSON.stringify({ session_id, device_id, role, content, model, task, complexity })
    });
    if (!r.ok) return res.status(r.status).json(await r.json());
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.post('/api/sync/chat/list', async (req, res) => {
  try {
    const { session_id, limit = 50 } = req.body || {};
    const device_id = req.deviceId;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    // Verify the session belongs to this device before reading its messages.
    const sessionCheck = await supabaseRest(
      `/rest/v1/chat_sessions?select=id&device_id=eq.${encodeURIComponent(device_id)}&id=eq.${encodeURIComponent(session_id)}&limit=1`,
      { headers: { 'Accept-Profile': 'public' } }
    );
    if (!sessionCheck.ok) return res.status(sessionCheck.status).json(await sessionCheck.json());
    const sessions = await sessionCheck.json();
    if (!Array.isArray(sessions) || !sessions.length) {
      return res.status(403).json({ error: 'session not owned by device' });
    }
    const r = await supabaseRest(
      `/rest/v1/chat_messages?session_id=eq.${encodeURIComponent(session_id)}` +
      `&device_id=eq.${encodeURIComponent(device_id)}` +
      `&select=role,content,model,created_at&order=created_at.asc&limit=${Number(limit) || 50}`,
      { headers: { 'Accept-Profile': 'public' } }
    );
    if (!r.ok) return res.status(r.status).json(await r.json());
    const rows = await r.json();
    res.json((rows || []).map(m => ({
      role: m.role, content: m.content, model: m.model, ts: Date.parse(m.created_at)
    })));
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.post('/api/sync/model', async (req, res) => {
  try {
    const { model_id, label, vram_gb } = req.body || {};
    const device_id = req.deviceId;
    if (!model_id) return res.status(400).json({ error: 'missing fields' });
    const r = await supabaseRest('/rest/v1/chat_model_state', {
      method: 'POST',
      headers: { 'Content-Profile': 'public', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ model_id, device_id, label, vram_gb: vram_gb || null, last_used: new Date().toISOString() })
    });
    if (!r.ok) return res.status(r.status).json(await r.json());
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.post('/api/sync/file', async (req, res) => {
  try {
    const { path, content } = req.body || {};
    const device_id = req.deviceId;
    if (!path || typeof content !== 'string') return res.status(400).json({ error: 'missing fields' });
    const r = await supabaseRest('/rest/v1/workspace_files', {
      method: 'POST',
      headers: { 'Content-Profile': 'public', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ device_id, path, content, updated_at: new Date().toISOString() })
    });
    if (!r.ok) return res.status(r.status).json(await r.json());
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.get('/api/supabase-status', (req, res) => {
  const { _status } = require('./supabase/bootstrap');
  res.json({
    ..._status(),
    admin: supabaseAdminEnabled(),
    project: process.env.SUPABASE_URL || null
  });
});

app.get('/api/config', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  // Локальный LLM отключён: в Replit-песочнице load Qwen2.5-0.5B падает по сигналу (OOM/timeout),
  // и крашит весь процесс. Если понадобится включить — выставить ENABLE_LOCAL_LLM=1.
  let llmModel = null;
  if (process.env.ENABLE_LOCAL_LLM === '1') {
    try { llmModel = require('./server/llm').MODEL_ID; } catch {}
  }
  res.json({
    mode: 'webllm',
    source: 'browser',
    message: 'Все модели работают в браузере через WebGPU. API-ключи не нужны.',
    supabase: (supabaseUrl && supabaseAnon)
      ? { url: supabaseUrl, anonKey: supabaseAnon }
      : null,
    hasLocalLLM: !!llmModel,
    llmModel,
    hasOpenAI: !!(process.env.OPENAI_API_KEY || process.env.VSEGPTRU),
    hasGemini: !!process.env.GEMINI_API_KEY,
    openaiBaseURL: process.env.OPENAI_BASE_URL || 'https://api.vsegpt.ru'
  });
});

// ── OpenAI-compatible API proxy (VseGPT, Gemini, OpenAI...) ─
app.post('/api/chat/openai', (req, res) => {
  const { messages, model, max_tokens, provider } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages required' });

  // Gemini provider — использует Google AI Studio API (бесплатно, 1500 запр/день)
  if (provider === 'gemini') {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return res.status(400).json({ error: 'GEMINI_API_KEY not configured' });

    const requestedMaxTokens = Number(max_tokens);
    const safeMaxTokens = Number.isFinite(requestedMaxTokens)
      ? Math.max(128, Math.min(4096, Math.floor(requestedMaxTokens)))
      : 512;

    const url = new URL('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    url.searchParams.set('key', geminiKey);

    const isStream = req.body.stream === true;
    if (isStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.flushHeaders();
    }

    const body = JSON.stringify({
      model: model || 'gemini-2.0-flash',
      messages,
      stream: !!isStream,
      max_tokens: safeMaxTokens
    });

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      if (proxyRes.statusCode >= 400) {
        let errBody = '';
        proxyRes.on('data', (chunk) => { errBody += chunk; });
        proxyRes.on('end', () => {
          let msg = errBody;
          try {
            const parsed = JSON.parse(errBody);
            // Gemini возвращает массив [{error:{message:"..."}}]
            if (Array.isArray(parsed)) msg = parsed[0]?.error?.message || parsed[0]?.error || errBody;
            else msg = parsed.error?.message || parsed.error || errBody;
          } catch {}
          if (isStream) {
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
            res.write('data: [DONE]\n\n');
          } else {
            res.json({ error: msg });
          }
          res.end();
        });
        return;
      }
      if (!isStream) {
        let body = '';
        proxyRes.on('data', (chunk) => { body += chunk; });
        proxyRes.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.error) return res.json({ error: json.error.message || json.error });
            const text = json.choices?.[0]?.message?.content || '';
            res.json({ text, model: json.model || model });
          } catch (e) {
            res.json({ error: 'Failed to parse Gemini response: ' + body.slice(0, 200) });
          }
        });
        return;
      }
      proxyRes.on('data', (chunk) => { res.write(chunk); });
      proxyRes.on('end', () => { res.end(); });
    });
    proxyReq.on('error', (err) => {
      if (isStream) { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.write('data: [DONE]\n\n'); }
      else { res.json({ error: err.message }); }
      res.end();
    });
    proxyReq.write(body);
    proxyReq.end();
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.VSEGPTRU;
  if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY/VSEGPTRU not configured' });

  const requestedMaxTokens = Number(max_tokens);
  const safeMaxTokens = Number.isFinite(requestedMaxTokens)
    ? Math.max(128, Math.min(1536, Math.floor(requestedMaxTokens)))
    : 512;

  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.vsegpt.ru/v1').replace(/\/+$/, '');
  const url = new URL(baseURL + '/chat/completions');

  // НЕ streaming — многие модели VseGPT (claude-3-haiku и др.) не поддерживают
  // stream: true. Для оркестратора и multi-запросов используем обычный JSON.
  const isStream = req.body.stream === true;

  if (isStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
  }

  const body = JSON.stringify({
    model: model || 'deepseek-chat',
    messages,
    stream: !!isStream,
    max_tokens: safeMaxTokens
  });

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Если апстрим вернул неуспешный статус
    if (proxyRes.statusCode >= 400) {
      let errBody = '';
      proxyRes.on('data', (chunk) => { errBody += chunk; });
      proxyRes.on('end', () => {
        let msg = errBody;
        try { msg = JSON.parse(errBody).error?.message || errBody; } catch {}
        if (isStream) {
          res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
          res.write('data: [DONE]\n\n');
        } else {
          res.status(proxyRes.statusCode).json({ error: msg });
        }
        res.end();
      });
      return;
    }
    // Не-streaming: собираем JSON-ответ целиком и отдаём клиенту
    if (!isStream) {
      let body = '';
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) return res.json({ error: json.error.message || json.error });
          const text = json.choices?.[0]?.message?.content || '';
          res.json({ text, model: json.model || model });
        } catch (e) {
          res.json({ error: 'Failed to parse upstream response: ' + body.slice(0, 200) });
        }
      });
      return;
    }
    // Streaming: проксируем чанки SSE напрямую
    proxyRes.on('data', (chunk) => { res.write(chunk); });
    proxyRes.on('end', () => { res.end(); });
  });
  proxyReq.on('error', (err) => {
    if (isStream) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
    } else {
      res.json({ error: err.message });
    }
    res.end();
  });
  proxyReq.write(body);
  proxyReq.end();
});

// ── List provider models (proxy to upstream /models) ────────────
app.get('/api/models', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VSEGPTRU;
  if (!apiKey) return res.status(400).json({ error: 'OPENAI_API_KEY/VSEGPTRU not configured' });

  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.vsegpt.ru/v1').replace(/\/+$/, '');
  const url = new URL(baseURL + '/models');

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  };

  const reqUp = https.request(options, (proxyRes) => {
    let buf = '';
    proxyRes.on('data', (chunk) => { buf += chunk; });
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).type('application/json').send(buf);
    });
  });
  reqUp.on('error', (err) => res.status(500).json({ error: err.message }));
  reqUp.end();
});

// ── Server-side local LLM (Transformers.js, CPU, no API key) ──────
app.post('/api/chat/local', async (req, res) => {
  if (process.env.ENABLE_LOCAL_LLM !== '1') {
    return res.status(503).json({ error: 'Локальная модель отключена (см. ENABLE_LOCAL_LLM в server.js)' });
  }
  const { messages, max_tokens } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages required' });

  let llm;
  try { llm = require('./server/llm'); } catch { return res.status(503).json({ error: 'LLM module not available' }); }
  try {
    const reply = await llm.generate(messages, { max_tokens });
    res.json({ reply });
  } catch (err) {
    console.error('[llm] inference error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Workspace / Preview ─────────────────────────────────
app.get('/api/workspace/files', async (req, res) => {
  try {
    const files = await listWorkspaceFiles(WORKSPACE_DIR);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Снимок workspace для контекста LLM: дерево + содержимое небольших файлов. ──
// Используется из клиента (app.js → buildWorkspaceContextMessages) на старте
// каждого запроса — модель сразу видит, что есть в проекте, и не дублирует.
// Бинарные файлы (картинки, видео, pdf и т.п.) исключаем: utf-8 чтение
// превращает их в мусор, а сами картинки модель получает через OpenAI
// multimodal content в /api/chat/openai.
app.get('/api/workspace/snapshot', async (req, res) => {
  try {
    const files = await listWorkspaceFiles(WORKSPACE_DIR);
    const include = [];
    const skipped = [];
    let totalBytes = 0;
    const perFileCap = 32 * 1024;           // 32 KB на файл
    const totalCap   = 4 * 1024 * 1024;     // 4 MB суммарно на снапшот
    const BINARY_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|ico|mp[34]|webm|mov|wav|ogg|m4a|flac|pdf|zip|tar|tgz|7z|rar|exe|so|dll|dylib|class|wasm|bin|psd|ai|sketch|fig|key|docx?|pptx?|xlsx?)$/i;
    for (const rel of files) {
      const full = path.join(WORKSPACE_DIR, rel);
      let st;
      try { st = await fs.stat(full); } catch { continue; }
      if (!st.isFile()) continue;
      if (BINARY_EXT.test(rel)) { skipped.push({ path: rel, reason: 'binary', bytes: st.size }); continue; }
      if (st.size > perFileCap) { skipped.push({ path: rel, reason: 'size', bytes: st.size }); continue; }
      if (totalBytes + st.size > totalCap) { skipped.push({ path: rel, reason: 'budget', bytes: st.size }); continue; }
      try {
        const content = await fs.readFile(full, 'utf8');
        totalBytes += Buffer.byteLength(content, 'utf8');
        include.push({ path: rel, size: st.size, content });
      } catch (e) {
        skipped.push({ path: rel, reason: e.code || 'read', bytes: st.size });
      }
    }
    res.json({ files: include, skipped, totalFiles: files.length, totalBytes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/read', async (req, res) => {
  const filePath = sanitizePath(req.query.path);
  if (!filePath) return res.status(400).json({ error: 'Нет пути' });
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  const safePath = sanitizePath(filePath);
  if (!safePath) return res.status(400).json({ error: 'Некорректный путь' });
  try {
    const fullPath = path.join(WORKSPACE_DIR, safePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ ok: true, path: safePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apply-code', async (req, res) => {
  const { changes } = req.body;
  if (!Array.isArray(changes) || changes.length === 0) return res.status(400).json({ error: 'Нет изменений' });
  const applied = [];
  const errors = [];
  for (const ch of changes) {
    const safePath = sanitizePath(ch.path);
    if (!safePath) { errors.push({ path: ch.path, error: 'Некорректный путь' }); continue; }
    // Серверный backstop: путь должен существовать в реальном листинге.
    let realListing = null;
    try { realListing = await listWorkspaceFiles(WORKSPACE_DIR); } catch {}
    const realSet = new Set(realListing || []);
    if (realSet.size && !realSet.has(safePath)) {
      errors.push({ path: ch.path, error: 'Путь не существует в реальном workspace — отброшено сервером' });
      continue;
    }
    try {
      const fullPath = path.join(WORKSPACE_DIR, safePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, ch.content, 'utf8');
      applied.push(safePath);
    } catch (err) {
      errors.push({ path: ch.path, error: err.message });
    }
  }
  res.json({ applied, errors, count: applied.length });
});

app.post('/api/workspace/clear', async (req, res) => {
  try {
    await clearWorkspace(WORKSPACE_DIR);
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    await fs.writeFile(path.join(WORKSPACE_DIR, 'index.html'), defaultIndexHtml(), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function listWorkspaceFiles(dir, base = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const subFiles = await listWorkspaceFiles(path.join(dir, entry.name), relativePath);
      files = files.concat(subFiles);
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function clearWorkspace(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await clearWorkspace(fullPath);
      await fs.rmdir(fullPath).catch(() => {});
    } else {
      await fs.unlink(fullPath).catch(() => {});
    }
  }
}

function sanitizePath(p) {
  if (!p || typeof p !== 'string') return null;
  // Чистим мусор из имён: кавычки, бэктики, странные суффиксы типа ``\`.``
  let cleaned = p.replace(/[`'"\\<>|?*\u0000-\u001F]/g, '').trim();
  cleaned = cleaned.replace(/\.{2,}/g, '.');                 // тройные+ точки → одна
  cleaned = cleaned.replace(/^[.\/\\]+/, '');                // убрать ведущие точки/слеши
  if (!cleaned) return null;
  const normalized = path.normalize(cleaned).replace(/^(\.\.(\/|\$))+/, '');
  if (!normalized || normalized === '.' ) return null;
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null;
  return normalized.replace(/^[\/\\]+/, '');
}

function defaultIndexHtml() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Старт проекта</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(120% 80% at 50% 0%, #1b2238 0%, #0c0f17 60%);
      color: #d8deeb; display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .hero { max-width: 620px; text-align: center; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px;
             background: rgba(120,140,255,0.12); color: #b6c0ff; font-size: 12px;
             letter-spacing: 0.04em; text-transform: uppercase; }
    h1 { font-size: 32px; margin: 14px 0 8px; color: #fff; }
    p.sub { color: #9aa3bd; margin: 0 0 22px; }
    .hints { display: grid; gap: 10px; max-width: 480px; margin: 0 auto; }
    .hint { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px; padding: 12px 14px; text-align: left; font-size: 14px; }
    .hint b { color: #d6dcf2; }
    .hint code { background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px;
                 font-family: ui-monospace, Menlo, monospace; color: #c8d2ff; }
  </style>
</head>
<body>
  <div class="hero">
    <span class="badge">Готов к работе</span>
    <h1>Здесь появится превью</h1>
    <p class="sub">Попросите агента создать лендинг, форму, дашборд или любую страницу.<br>Файлы появятся в проводнике справа.</p>
    <div class="hints">
      <div class="hint"><b>«Сделай лендинг для кофейни»</b></div>
      <div class="hint"><b>«Сайт-портфолио с тёмной темой»</b></div>
      <div class="hint"><b>«Дашборд с графиком на Chart.js»</b></div>
      <div class="hint"><code>// file: index.html</code> — метка для сохранения в файл</div>
    </div>
  </div>
</body>
</html>`;
}

// ── Scout — server-side model curator (бесплатная LLM, ежечасно) ──
// Источник истины для ростера оркестратора. Не зависит от клиента:
// на сервере setInterval раз в час опрашивает /v1/models провайдера,
// фильтрует дешёвые модели (≤0.06₽/запрос → < BUDGET_RUB=0.07₽ с запасом),
// а потом прогоняет выживших через бесплатную «scout»-модель
// (perplexity/latest-small-online, 0₽ prompt+completion, есть веб-поиск),
// которая ранжирует кандидатов для нашего сценария: (а) генерация UI/лендингов/
// TMA мини-аппсов по тексту, (б) генерация страницы ТОЧНО ПО скриншоту (vision+code).
// Кандидаты со score ≥ 6 сохраняются в workspace/state/roster.json с timestamp.
// Клиент берёт через GET /api/scout-models — там есть ageMs, refreshing, model.
// Если scout-LM не отвечает — fallback на heuristic-only фильтр (без score).
const SCOUT_MODEL = process.env.SCOUT_MODEL || ''; // авто-скан отключён по умолчанию для экономии
const ROSTER_PATH = path.join(__dirname, 'workspace', 'state', 'roster.json');
const SCOUT_CACHE_MS = 60 * 60 * 1000;

async function readRosterState() {
  try { return JSON.parse(await fs.readFile(ROSTER_PATH, 'utf8')); }
  catch { return { scout: [], scoutAt: 0 }; }
}
async function writeRosterState(st) {
  try {
    await fs.mkdir(path.dirname(ROSTER_PATH), { recursive: true });
    await fs.writeFile(ROSTER_PATH, JSON.stringify(st, null, 2));
  } catch (e) { console.warn('[scout] save failed:', e.message); }
}

function heuristicCandidate(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string') return null;
  const id = m.id;
  if (!/^(openai|google|qwen|deepseek|meta-llama|mistralai|anthropic|perplexity|vis-|amazon|cohere|xai|moonshotai|minimax|xiaomi|nvidia)/i.test(id)) return null;
  if (/^(emb-|text-embedding|img-|img2|txt2|tta-|tts-|stt-|utils\/|whisper|dall-?e)/i.test(id)) return null;
  const p = parseFloat(m.pricing?.prompt || 0);
  const c = parseFloat(m.pricing?.completion || 0);
  if (!isFinite(p) || !isFinite(c) || p + c > 0.06) return null;
  const feats = Array.isArray(m.features) ? m.features : [];
  const visionHint = /(vision|vl\b|^vis-|gemini|gpt-?4o|gpt-?5\b|llama-3\.2|qwen.*vl|pixtral|opus|haiku|gpt-oss)/i.test(id)
                  || feats.includes('vision');
  const codingHint = /(coder|code|instruct|chat\b|sonnet|opus|haiku|mini|gpt-?4o-mini|nano|flash|lite|scout|maverick|deepseek|qwq|devstral|pixtral|mistral-small|qwen3|qwen-?2\.5|llama-?4|nova|mistral)/i.test(id)
                  || feats.includes('tools') || feats.includes('structured');
  if (!visionHint && !codingHint) return null;
  return { id, prompt: p, completion: c, vision: visionHint, coding: codingHint };
}

async function fetchProviderCatalog() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VSEGPTRU;
  if (!apiKey) throw new Error('no API key');
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.vsegpt.ru/v1').replace(/\/+$/, '');
  const r = await fetch(baseURL + '/models', { headers: { Authorization: 'Bearer ' + apiKey } });
  if (!r.ok) throw new Error('catalog ' + r.status);
  return r.json();
}

async function llmComplete(messages, opts) {
  opts = opts || {};
  const apiKey = process.env.OPENAI_API_KEY || process.env.VSEGPTRU;
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.vsegpt.ru/v1').replace(/\/+$/, '');
  const body = JSON.stringify({ model: SCOUT_MODEL, messages, temperature: opts.temperature ?? 0.1, max_tokens: opts.max_tokens ?? 2000 });
  const r = await fetch(baseURL + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body,
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('upstream ' + r.status + ' ' + t.slice(0,200)); }
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || '').trim();
}

async function refreshScout() {
  if (!SCOUT_MODEL) return; // авто-скан отключён
  if (!process.env.OPENAI_API_KEY && !process.env.VSEGPTRU) return;
  try {
    const cat = await fetchProviderCatalog();
    if (!cat || !Array.isArray(cat.data)) return;
    const candidates = cat.data.map(heuristicCandidate).filter(Boolean);
    if (!candidates.length) { console.log('[scout] 0 кандидатов после heuristic'); return; }
    // Двухуровневое ранжирование. По умолчанию — детерминированная оценка (0₽),
// поверх неё — опциональный LM-скор, но только если pre-flight ≤0.05₽.
    // Если провайдер поднимает «soft user limit», LM-шаг пропускается и остаёмся
    // на детерминированной разметке. Это удерживает scout в рамках бюджета.
    function heuristicScore(c) {
      const id = String(c.id || '').toLowerCase();
      let s = 5; // baseline
      if (c.vision) s += 2;
      if (/^(vis-|vis_|^vision|vl\b|gemini|gpt-?4o|gpt-?5|llama-3\.2-11b|pixtral|qwen.*vl|claude-?3\.5|opus|haiku)/.test(id)) s += 1;
      if (/coder|code-?(?:instruct|chat)|coder-?(?:7|32)b|deepseek-?(?:coder|chat|reasoner|v3|v4)/.test(id)) s += 2;
      if (c.coding) s += 1;
      if (/qwen3|qwen-?2\.5-coder|devstral|mistral-small/.test(id)) s += 1;
      if (c.prompt === 0 && c.completion === 0) s += 2;        // бесплатные
      const sum = c.prompt + c.completion;
      if (sum <= 0.015) s += 1; else if (sum > 0.04) s -= 1;   // дешёвые в плюс, дорогие — штраф
      return Math.max(0, Math.min(10, s));
    }
    const scoreMap = new Map();
    for (const c of candidates) scoreMap.set(c.id, heuristicScore(c));

    try {
      const sys = 'Эксперт LLM. Оцени id 1..10 для UI/лендингов/image-to-page. JSON [{"id":"...","score":N}].';
      const userTxt = candidates.slice(0, 12).map(c =>
        `${c.id} ${c.vision?'v':''} sum=${(c.prompt+c.completion).toFixed(3)}`
      ).join('\n');
      // Жёсткий pre-flight: даже гипотетический счёт >0.05₽ → не дёргаем LM.
      const estCost = sys.length / 4 * 0.015 / 1000 + userTxt.length / 4 * 0.015 / 1000
                     + 200 * 0.06 / 1000;
      if (estCost > 0.05) {
        console.log('[scout] LM-скор пропущен: pre-flight=' + estCost.toFixed(4) + '₽ > 0.05₽');
      } else {
        const txt = await llmComplete([{role:'system',content:sys},{role:'user',content:userTxt}], { temperature: 0.1, max_tokens: 200 });
        const m = txt.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              const id = String(p.id || '').trim();
              if (!id) continue;
              const lm = parseFloat(p.score) || 0;
              if (lm > 0) scoreMap.set(id, lm);
            }
          }
        }
      }
    } catch (e) { console.warn('[scout] LM-скор fallback, остался deterministic:', e.message); }
    const merged = candidates.map(c => ({ ...c, score: scoreMap.get(c.id) || 0 }));
    const kept = scoreMap.size > 0 ? merged.filter(c => c.score >= 6) : merged;
    const curated = kept
      .sort((a, b) => (b.score - a.score) || ((a.prompt + a.completion) - (b.prompt + b.completion)))
      .slice(0, 30);
    if (!curated.length) return;
    // Гарантируем наличие Claude-аналогов в ростере, даже если провайдер в
    // этом часу их не вернул в /v1/models. Подобрано под наш сценарий:
    // vision (читать картинку → строить страницу 1:1), coder (сложный UI/TMA),
    // укладывается в бюджет ≤0.06₽/1K (любой запрос ≤0.07₽).
    const CLAUDE_ANALOGS_FALLBACK = [
      { id: 'anthropic/claude-3-5-sonnet-20241022',     vision: true, coding: true, prompt: 0.018, completion: 0.045, score: 9 },
      { id: 'anthropic/claude-3-5-sonnet-20240620',     vision: true, coding: true, prompt: 0.018, completion: 0.045, score: 9 },
      { id: 'anthropic/claude-3-haiku-20240307',        vision: true, coding: true, prompt: 0.005, completion: 0.025, score: 8 },
      { id: 'openai/gpt-4o',                            vision: true, coding: true, prompt: 0.03,  completion: 0.09,  score: 9 },
      { id: 'openai/gpt-4o-mini',                       vision: true, coding: true, prompt: 0.005, completion: 0.015, score: 9 },
      { id: 'google/gemini-2.5-flash-pre',              vision: true, coding: true, prompt: 0.018, completion: 0.054, score: 9 },
      { id: 'google/gemini-2.5-flash',                  vision: true, coding: true, prompt: 0.015, completion: 0.06,  score: 7 },
      { id: 'mistralai/pixtral-12b-2409',               vision: true, coding: true, prompt: 0.025, completion: 0.025, score: 8 },
      { id: 'qwen/qwen-2.5-vl-72b-instruct',            vision: true, coding: true, prompt: 0.04,  completion: 0.04,  score: 7 },
      { id: 'meta-llama/llama-3.2-90b-vision-instruct', vision: true, coding: true, prompt: 0.05,  completion: 0.05,  score: 6 },
      { id: 'xai/grok-2-vision-1212',                   vision: true, coding: true, prompt: 0.05,  completion: 0.05,  score: 6 },
    ];
    const curatedIds = new Set(curated.map(c => c.id));
    const mergedRoster = curated.slice();
    for (const fb of CLAUDE_ANALOGS_FALLBACK) {
      if (curatedIds.has(fb.id)) continue;
      if (fb.prompt + fb.completion > 0.06) continue; // жёстче BUDGET_RUB
      mergedRoster.push(fb);
    }
    const finalRoster = mergedRoster
      .sort((a, b) => (b.score - a.score) || ((a.prompt + a.completion) - (b.prompt + b.completion)))
      .slice(0, 40);
    await writeRosterState({ scout: finalRoster, scoutAt: Date.now(), model: SCOUT_MODEL });
    console.log('[scout] ростер обновлён:', finalRoster.length, 'моделей (+fallback)', +
      (scoreMap.size ? `top=${finalRoster[0]?.score}` : '[heuristic-only]'));
  } catch (e) { console.warn('[scout] refresh failed:', e.message); }
}

app.get('/api/scout-models', async (req, res) => {
  try {
    const st = await readRosterState();
    const age = Date.now() - (st.scoutAt || 0);
    const fresh = st.scout && st.scout.length && age < SCOUT_CACHE_MS;
    if (fresh) return res.json({ data: st.scout, cached: true, ageMs: age, model: st.model });
    setImmediate(() => { refreshScout().catch(() => {}); });
    if (st.scout && st.scout.length) {
      return res.json({ data: st.scout, cached: true, refreshing: true, ageMs: age, model: st.model });
    }
    res.status(202).json({ data: [], refreshing: true, model: st.model });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cold-start + hourly авто-скан отключены по умолчанию (SCOUT_MODEL пуст).
// Чтобы включить обратно — выставьте SCOUT_MODEL в Replit Secrets.
if (SCOUT_MODEL) {
  setTimeout(() => { refreshScout().catch(() => {}); }, 3000);
  const scoutTimer = setInterval(() => { refreshScout().catch(() => {}); }, SCOUT_CACHE_MS);
  if (scoutTimer.unref) scoutTimer.unref();
}

app.listen(PORT, '0.0.0.0', () => {
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.VSEGPTRU);
  const openaiBaseURL = (process.env.OPENAI_BASE_URL || 'https://api.vsegpt.ru/v1').replace(/\/+$/, '');
  const provider = openaiBaseURL.includes('vsegpt.ru') ? 'vsegpt.ru' : openaiBaseURL;
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`[openai] provider=${provider} key=${hasOpenAI ? 'set' : 'missing'} roster=static`);
});
