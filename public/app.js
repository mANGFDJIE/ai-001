(() => {
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const modelSelector = document.getElementById('modelSelector');
  const modelLabel = document.getElementById('modelLabel');
  const modelDot = document.getElementById('modelDot');
  const modelDropdown = document.getElementById('modelDropdown');
  const micBtn = document.getElementById('micBtn');
  const planCheck = document.getElementById('planMode');
  const tabs = document.querySelectorAll('.tab[data-tab]');
  const toolsView = document.getElementById('toolsView');
  const previewView = document.getElementById('previewView');
  let previewFrame = document.getElementById('previewFrame');
  const previewChanges = document.getElementById('previewChanges');
  const previewStatus = document.getElementById('previewStatus');
  const previewConsole = document.getElementById('previewConsole');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const providerGrid = document.getElementById('providerGrid');
  const scanBtn = document.getElementById('scanModels');
  const scanStatus = document.getElementById('scanStatus');

  let currentModel = 'multi';
  let sending = false;
  let modelPresets = {};
  let config = { hasLocalLLM: false, llmModel: '', hasOpenAI: false, openaiBaseURL: '' };
  let lastReplyModel = '';
  const llm = new WebLLMClient();
  let chatAbort = null;
  function setStopVisible(v) {
    const el = document.getElementById('stopBtn');
    if (!el) return;
    el.style.display = v ? 'inline-flex' : 'none';
    el.classList.toggle('is-running', !!v);
  }
  // Короткий промпт для slim multi-запросов (≤400 токенов) — не превышает per-query лимит VseGPT 0.060₽
  const SLIM_SYSTEM_PROMPT = 'You are an AI coding agent. Code blocks MUST start with `// file: path` or `<!-- file: path -->`. Use plain HTML+CSS+JS unless explicitly asked otherwise. Keep prose to 2-4 sentences. Reply in Russian if asked in Russian.';
  const COMPACT_SYSTEM_PROMPT = 'You are a coding agent. Build plain HTML+CSS+JS. Every code block MUST start with `// file: path` or `<!-- file: path -->`. No React/Next/TS unless explicitly requested. Keep prose to 2-4 sentences, with no intro or follow-up questions. Reply in Russian. If a target file is specified, edit only that file.';

  const LLM_SYSTEM_PROMPT = 'You are an autonomous AI coding agent embedded in a web-based IDE. You build modern web apps, landing pages, dashboards, and full-stack applications.\n\n=== CODE OUTPUT (REQUIRED) ===\nWhen you return ANY code for a file, you MUST include a path marker — one of two ways:\n(1) in the info-string: ```html // file: index.html\n(2) first line inside the block: // file: index.html  OR  <!-- file: index.html -->\nWithout the marker the file will NOT save to workspace. Marker is REQUIRED for any code that lands on disk.\nDefault auto-naming: HTML → index.html, CSS → styles.css, JS → script.js, JSON → data.json.\nIf the file already exists in workspace, EDIT it — do not create a duplicate.\n\n=== PREVIEW ENVIRONMENT (CRITICAL) ===\nThe preview is a STATIC Express server that serves plain HTML/CSS/JS files from workspace/preview/.\nDO NOT generate React, Next.js, Vue, Svelte, TypeScript (.tsx/.jsx/.ts) files — they CANNOT be rendered.\nNEVER output paths like app/page.tsx, pages/index.tsx, src/App.jsx — these will show as raw code, not a page.\nALWAYS output: index.html (+ styles.css + script.js if needed). One self-contained HTML file works best.\nExceptions: only use JSX/TSX if the user explicitly says "React project" AND the workspace already has package.json with React.\n\n=== MODERN STACK (HTML-first defaults) ===\n• Structure: single index.html with embedded or linked CSS/JS — fully self-contained, no build step\n• CSS: modern CSS (custom properties, grid, flexbox, container queries, @keyframes) — NO Tailwind unless CDN-linked\n• JS: vanilla ES6+ with CDN libraries where needed (e.g. <script src="https://unpkg.com/...">)\n• Design: dark theme by default; Google Fonts via <link>; smooth CSS transitions; glassmorphism/neumorphism if "modern" requested\n• Icons: Lucide via CDN (<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js">) or inline SVG\n• Palette: sophisticated dark (#0a0a0f bg, #7c3aed accent) or premium light — avoid basic neon unless cyberpunk requested\n• Landing pages: hero with gradient text, bento grid, feature cards, social proof section, CTA — Vercel/Linear/Stripe aesthetic\n• Components: fully functional, not placeholder — real interactivity with JS where needed\n• Mobile-first responsive: use CSS clamp(), min(), max() for fluid typography; media queries for layout\n\n=== MOBILE UI LEVEL (REQUIRED) ===\nThe user expects production-quality mobile app interfaces comparable to the attached screenshots: polished profile cards, marketplace service cards, bottom tab navigation, gradient backgrounds, rounded corners, soft shadows, clear hierarchy, and premium feel. When asked for a mobile UI or mini-app, you MUST deliver at least this level:\n• Full mobile viewport simulation (width ~375-430px), centered on desktop, full bleed on mobile.\n• Header card with large gradient or photo + avatar, name, status badge, stats row (likes, views, matches).\n• Rounded large cards (border-radius 16-24px) with soft shadows, clear sections, and ample whitespace.\n• Bottom tab navigation with 3-5 icons and active state indicator.\n• Top-tier typography: bold headings, subtle labels, harmonious Russian text.\n• Material 3 / iOS style: switch toggles, list items with chevrons, icons from Lucide.\n• Color: either vibrant gradient (pink, blue, purple) or premium dark theme; avoid flat, ugly, default browser styles.\n• If a screenshot/reference is attached, replicate its visual structure, proportions, and color mood — not just the layout idea.\n\n=== TONE (STRICT) ===\nWrite like a Replit agent engineer. Max 2-4 prose sentences. No leads (Let us, Well, Currently I, I will review, We should, Here is my plan, Let us begin). No explaining the obvious. No follow-up questions.\nFormat: what changed (filename — one-line gist, comma-separated if multiple). If error: one sentence on what failed.\n\n=== TARGET-FILE RULE ===\nWhen user-content carries a [🎯 ЦЕЛЬ ОПЕРАЦИИ] block with explicit Fayl-cel: ...path.ext, edit STRICTLY that file. Do not ask which file. Just modify it.\n\n=== SELECTED-ELEMENT HINT ===\nIf user mentions ⌖ <tag> in their text, treat it as a soft pointer to the attached selected-element chip. Use pagePath from the chip, not inferred from tag.\n\nReply in Russian if the request is in Russian.\n';

  // Склеивает текст + прикреплённые картинки в OpenAI multimodal content
  // (image_url parts), чтобы модель реально видела скриншоты в диалоге, а не
  // только имя файла в системном промпте. Берём максимум 4 картинки — иначе
  // токены раздуваются.

  // Канвасный downsample для больших картинок: ≥≈600 КБ base64 уменьшаем до
  // maxDim=1024 JPEG quality=0.7 — типичный паст-скриншот падает с 200+ КБ
  // до 30-60 КБ и перестаёт ломать контекстные окна VseGPT.
  function downsampleImage(dataUrl, maxDim, quality) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        const mime = /data:([^;]+);/i.exec(dataUrl);
        const isPng = mime && /png/i.test(mime[1]);
        img.onload = () => {
          const big = Math.max(img.width, img.height);
          const scale = Math.min(1, maxDim / (big || 1));
          if (scale >= 1 && dataUrl.length < 700000) return resolve(dataUrl);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const out = isPng ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', quality);
          resolve(out);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch { resolve(dataUrl); }
    });
  }

  async function attachImagesToUser(text, atts) {
    const imgs = (atts || []).filter(a => a && /^image\//i.test(a.type || '') && a.dataUrl).slice(0, 2);
    if (!imgs.length) return text;
    const parts = [];
    if (text) parts.push({ type: 'text', text });
    for (const a of imgs) {
      let url = a.dataUrl;
      if (url.length > 400000) {
        url = await downsampleImage(url, 768, 0.7);
      }
      if (url.length > 600000) {
        // Даже после downsample картинка огромная — не пихаем её в контекст,
        // только текстовое предупреждение для модели.
        const name = a.name || a.path || 'image';
        parts.push({ type: 'text', text: '[Изображение ' + name + ' не прикреплено: превышает контекстное окно модели]' });
      } else {
        parts.push({ type: 'image_url', image_url: { url } });
      }
    }
    return parts;
  }

  // Текст + images в multimodal form (или просто строка). Флаг wantImages
  // нужен, чтобы НЕ пихать image_url в модели без vision — DeepSeek/Claude
  // отвечают ошибкой 'unknown variant `image_url`, expected text'.
  async function userContentFor(text, atts, wantImages) {
    return !!wantImages ? await attachImagesToUser(text, atts) : (text || '');
  }

  const colorMap = { economy: '#4ade80', standard: '#3b82f6', pro: '#a78bfa', auto: 'linear-gradient(135deg,#4ade80,#3b82f6,#a78bfa)' };

  async function loadConfig() {
    // Браузерный WebLLM-каталог (29 моделей) выключен — переключаемся на облачные.
    modelPresets = {};

    // Fetch server config (local LLM status, supabase, etc.)
    try {
      const r = await fetch('/api/config');
      config = await r.json();
    } catch {}

    // Загружаем курированный ростер (с сервера, scout-LLM ранжировала)
    // и fallback на старый /api/models если scout-индекс ещё пуст.
    async function scanModelCatalog() {
      try {
        let modelsData = null;
        // 1) Приоритет — серверный scout (бесплатная LLM раз в час обновляет).
        try {
          const mr = await fetch('/api/scout-models');
          if (mr.ok) {
            const j = await mr.json();
            if (j && Array.isArray(j.data) && j.data.length) modelsData = j.data;
          }
        } catch {}
        // 2) Fallback — прямой /v1/models + клиентский heuristic.
        if (!modelsData) {
          try {
            const mr2 = await fetch('/api/models');
            if (mr2.ok) {
              const j = await mr2.json();
              if (j && Array.isArray(j.data)) modelsData = j.data;
            }
          } catch {}
        }
        if (modelsData && modelsData.length) {
          refreshOrchestratorModels(modelsData);
          rebuildDirectModelPresets();
          renderModelDropdown();
          console.log('[models] ростер обновлён:', modelsData.length);
        }
      } catch (e) { console.log('[models] авто-сканер не смог загрузить каталог:', e); }
    }
    if (config.hasOpenAI) {
      await scanModelCatalog();
      // Повторный скан каждый час — ловим новые дешёвые модели и убираем исчезнувшие.
      if (!window.__modelScanInterval) {
        window.__modelScanInterval = setInterval(scanModelCatalog, 60 * 60 * 1000); // мониторинг каждый час
      }
    }

    // Add local LLM preset if available
    if (config.hasLocalLLM) {
      modelPresets['local'] = {
        name: 'Локально (сервер)', label: 'Локально', color: 'economy',
        desc: `Серверная модель ${config.llmModel} — без ключей и без WebGPU`,
        local: true
      };
    }
    // Add OpenAI-compatible models (DeepSeek, OpenAI, OpenRouter…)
    if (config.hasOpenAI) {
      // ── Мульти AI — выбор 1–3 моделей для синтеза лучшего ответа (с бюджетным контролем).
      modelPresets['multi'] = {
        name: '⭐ Мульти AI', label: '⭐ Мульти AI', color: 'pro',
        desc: 'Параллельно 1–3 модели + vision для скриншотов; синтез лучшего ответа',
        openai: true,
        apiModel: 'openai/gpt-4.1-nano',
        router: 'multi',
        featured: true
      };
      // Default — google/gemini-2.5-flash-lite как надёжный и дешёвый кодер.
      // Если сохранённое значение — устаревший single-model дефолт
      // или старые ключи (auto / orchestrator / openai-chat / featured-*),
      // мигрируем в режим Мульти AI — пользователь явно попросил multi по умолчанию.
      if (
        currentModel === 'auto' ||
        currentModel === 'orchestrator' ||
        currentModel === 'openai-chat' ||
        currentModel === 'deepseek-reasoner' ||
        currentModel === 'direct:google/gemini-2.5-flash-lite' ||
        currentModel.startsWith('featured-')
      ) {
        currentModel = 'multi';
      }
    }

    renderModelDropdown();
    renderProviders();
    updateModelDisplay();
    if (!window.WEBLLM_SUPPORTED && !config.hasLocalLLM && !config.hasOpenAI) showNoProviderBanner();
    if (window.SupabaseSync) await window.SupabaseSync.init();
    subscribeWorkspace();
    wirePreviewExtras();
  }

  // ── Replit-exact preview extras: tree + source + layout + console filters ──
  const previewTreeList = () => document.getElementById('previewTreeList');
  const previewTreeCount = () => document.getElementById('previewTreeCount');
  const previewSource = () => document.getElementById('previewSource');
  const previewViewport = () => document.getElementById('previewViewport');
  const previewExternal = () => document.getElementById('previewExternal');

  let _activeFile = null;
  const _fileCache = new Map();
  let _consoleFilter = 'all';

  function iconFor(name) {
    if (/\.html?$/i.test(name)) return 'html';
    if (/\.css$/i.test(name)) return 'css';
    if (/\.m?js$/i.test(name)) return 'js';
    if (/\.json$/i.test(name)) return 'json';
    if (/\.md$/i.test(name)) return 'md';
    return 'txt';
  }
  function extIconText(ext) {
    return ext === 'js' ? 'JS' : ext === 'css' ? '#' : ext === 'html' ? '<>' : ext === 'json' ? '{}' : ext === 'md' ? 'M' : '·';
  }
  function fmtSize(n) {
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'K';
    return (n / 1024 / 1024).toFixed(1) + 'M';
  }
  function badgeFor(name) {
    if (/^package(-lock)?\.json$/i.test(name)) return { kind: 'M', cls: 'badge-pkg' };
    if (/\.json$/i.test(name)) return { kind: '{}', cls: 'badge-json' };
    if (/\.md$/i.test(name)) return { kind: 'M', cls: 'badge-md' };
    if (/\.sql$/i.test(name)) return { kind: 'A', cls: 'badge-aid' };
    if (/\.zip$/i.test(name)) return { kind: 'A', cls: 'badge-zip' };
    if (/\.js$/i.test(name)) return { kind: 'JS', cls: 'badge-js' };
    if (/\.css$/i.test(name)) return { kind: '#', cls: 'badge-css' };
    if (/\.html?$/i.test(name)) return { kind: '<>', cls: 'badge-html' };
    if (/\.ts$/i.test(name)) return { kind: 'TS', cls: 'badge-js' };
    return { kind: '·', cls: 'badge-default' };
  }
  function isPackagerFile(name) {
    return /^package(-lock)?\.json$/i.test(name);
  }
  function renderFileTree(files) {
    window.__lastFiles = files;
    const list = previewTreeList();
    const count = previewTreeCount();
    const filterEl = document.getElementById('librarySearch');
    const filter = (filterEl?.value || '').trim().toLowerCase();
    if (!list) return;
    if (count) count.textContent = files.length;
    if (!files.length) {
      list.innerHTML = '';
      return;
    }

    const buildRow = (f) => {
      const item = document.createElement('div');
      item.className = 'library-row';
      item.dataset.name = f.name;
      if (_activeFile === f.name) item.classList.add('active');

      const icon = document.createElement('span');
      const ext = iconFor(f.name);
      icon.className = 'library-row-icon ' + ext;
      icon.textContent = extIconText(ext);

      const name = document.createElement('span');
      name.className = 'library-row-name';
      name.textContent = f.name;
      name.title = f.name;

      const badge = document.createElement('span');
      const b = badgeFor(f.name);
      badge.className = 'library-badge ' + b.cls;
      badge.textContent = b.kind;

      const actions = document.createElement('span');
      actions.className = 'library-row-actions';

      const dl = document.createElement('button');
      dl.className = 'library-action';
      dl.title = 'Скачать';
      dl.textContent = '↓';
      dl.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open('/api/workspace/download?path=' + encodeURIComponent(f.name), '_blank');
      });

      const del = document.createElement('button');
      del.className = 'library-action library-action-del';
      del.title = 'Удалить';
      del.textContent = '×';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Удалить «' + f.name + '»?')) return;
        try {
          const r = await fetch('/api/workspace/file?path=' + encodeURIComponent(f.name), { method: 'DELETE' });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
        } catch (err) {
          pushConsoleLine('error', ['Delete failed', f.name, err.message || String(err)]);
        }
      });

      actions.appendChild(dl);
      actions.appendChild(del);

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(badge);
      item.appendChild(actions);
      item.addEventListener('click', () => openFileInSource(f.name));
      return item;
    };

    const others = files.filter(f => !isPackagerFile(f.name));
    const packager = files.filter(f => isPackagerFile(f.name));

    list.innerHTML = '';
    let anyRendered = false;
    const section = (title, items) => {
      const matches = items.filter(f => !filter || f.name.toLowerCase().includes(filter));
      if (!matches.length) return;
      const sec = document.createElement('div');
      sec.className = 'library-section';
      if (title) {
        const h = document.createElement('div');
        h.className = 'library-section-title';
        h.textContent = title;
        sec.appendChild(h);
      }
      for (const f of matches) sec.appendChild(buildRow(f));
      list.appendChild(sec);
      anyRendered = true;
    };
    section(null, others);
    section('Packager files', packager);
    if (!anyRendered) {
      list.innerHTML = '';
    }
  }
  function highlightSource(text, ext) {
    const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (ext === 'html') {
      let h = esc(text);
      h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-com">$1</span>');
      h = h.replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '$1<span class="tok-tag">$2</span>');
      h = h.replace(/(\s)([a-zA-Z-]+)=("[^"]*")/g, '$1<span class="tok-attr">$2</span>=<span class="tok-str">$3</span>');
      return h;
    }
    if (ext === 'js' || ext === 'json') {
      let h = esc(text);
      h = h.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>');
      h = h.replace(/("(?:\\.|[^"\\])*")/g, '<span class="tok-str">$1</span>');
      h = h.replace(/\b(true|false|null|undefined|function|return|var|let|const|if|else|for|while|switch|case|break|new|class|this|import|from|export|async|await|try|catch|throw)\b/g, '<span class="tok-key">$1</span>');
      h = h.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
      return h;
    }
    if (ext === 'css') {
      let h = esc(text);
      h = h.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>');
      h = h.replace(/(^|\n)(\.[\w-]+|@[\w-]+|#[\w-]+|[\w-]+)(?=[\s{:])/g, '$1<span class="tok-sel">$2</span>');
      h = h.replace(/("[^"]*"|'[^']*')/g, '<span class="tok-str">$1</span>');
      h = h.replace(/\b(\d+(?:\.\d+)?(?:px|em|rem|%|deg|s|ms)?)\b/g, '<span class="tok-num">$1</span>');
      return h;
    }
    return esc(text);
  }
  async function openFileInSource(name) {
    _activeFile = name;
    renderFileTree(window._lastFiles || []);
    const ext = iconFor(name);
    const src = previewSource();
    const viewport = previewViewport();
    let content;
    if (_fileCache.has(name)) {
      content = _fileCache.get(name);
    } else {
      try {
        const res = await fetch(`/api/workspace/raw?path=${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        content = await res.text();
        _fileCache.set(name, content);
      } catch (e) {
        if (src) src.innerHTML = '<code>// Не удалось открыть ' + name + ': ' + (e.message || e) + '</code>';
        return;
      }
    }
    if (src) src.innerHTML = '<code>' + highlightSource(content, ext) + '</code>';
    // Auto-switch layout to "code" so the user actually sees it.
    if (viewport && viewport.dataset.layout === 'preview') {
      setLayout('split');
    }
  }
  function setLayout(mode) {
    (void mode<'split'?'split':'code');  // legacy: no-op; preview layout switched to tabs
  }
  // Switch between right-panel tabs: Превью / Файлы
  function setRightTab(name) {
    document.querySelectorAll('.topbar-tabs button[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.right-panel-inner[data-tab]').forEach(p => {
      p.classList.toggle('active', p.dataset.tab === name);
    });
  }
  function setConsoleFilter(f) {
    _consoleFilter = f;
    document.querySelectorAll('#previewConsoleFilters .filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === f);
    });
    const root = document.getElementById('previewConsole');
    if (!root) return;
    for (const line of root.querySelectorAll('.preview-console-line')) {
      const lvl = line.dataset.lvl || '';
      line.style.display = (f === 'all' || lvl === f || (f === 'error' && lvl === 'unhandledrejection')) ? '' : 'none';
    }
  }
  function wirePreviewExtras() {
    // Expose last files for openFileInSource re-render after item click reset.
    const orig = renderFileTree;
    // Layout tabs
    document.querySelectorAll('.right-tab-bar button').forEach(btn => {
      btn.addEventListener('click', () => setRightTab(btn.dataset.tab));
    });
    // Console filters
    document.querySelectorAll('#previewConsoleFilters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => setConsoleFilter(btn.dataset.filter));
    });
    // Console clear
    document.getElementById('previewConsoleClear')?.addEventListener('click', () => {
      const c = document.getElementById('previewConsole');
      if (!c) return;
      c.innerHTML = '<div class="preview-console-empty">Логи очищены</div>';
    });
    // Console collapse/expand toggle
    document.getElementById('previewConsoleToggle')?.addEventListener('click', () => {
      const c = document.querySelector('.preview-console');
      if (!c) return;
      if (c.classList.contains('collapsed')) {
        c.classList.remove('collapsed');
        c.classList.add('expanded');
      } else {
        c.classList.remove('expanded');
        c.classList.add('collapsed');
      }
    });
    // ── Drag-to-resize splitter ──
    const rp = document.getElementById('rightPanel');
    const handle = document.getElementById('panelResizeHandle');
    if (handle && rp) {
      let dragging = false, startX = 0, startW = 0;
      handle.addEventListener('mousedown', (e) => {
        dragging = true;
        startX = e.clientX;
        startW = rp.getBoundingClientRect().width;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = startX - e.clientX; // handle moves left → right panel grows
        const newW = Math.max(280, Math.min(window.innerWidth - 320, startW + dx));
        rp.style.flex = '0 0 ' + newW + 'px';
      });
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      });
    }

    // ── File explorer: upload (button + drag-drop) ──
    function uploadFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.onload = async () => {
          try {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : dataUrl;
            const res = await fetch('/api/workspace/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: file.name, data: base64 })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) throw new Error(json.error || ('HTTP ' + res.status));
            pushConsoleLine('info', ['Uploaded', file.name, '(' + fmtSize(file.size) + ')']);
            resolve(json);
          } catch (e) { reject(e); }
        };
        reader.readAsDataURL(file);
      });
    }
    const uploadBtn = document.getElementById('previewUpload');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    uploadBtn?.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const batch = Array.from(fileInput.files || []);
      for (let i = 0; i < batch.length; i++) {
        try { await uploadFile(batch[i]); }
        catch (e) { pushConsoleLine('error', ['Upload failed', batch[i].name, e.message || String(e)]); }
      }
      fileInput.value = '';
    });
    // Drag-and-drop into the tree panel
    const treePanel = document.getElementById('previewTree');
    if (treePanel) {
      ['dragenter','dragover'].forEach(ev => treePanel.addEventListener(ev, (e) => {
        e.preventDefault();
        treePanel.classList.add('drag-over');
      }));
      ['dragleave','dragend','drop'].forEach(ev => treePanel.addEventListener(ev, (e) => {
        if (ev === 'dragleave' && treePanel.contains(e.relatedTarget)) return;
        treePanel.classList.remove('drag-over');
      }));
      treePanel.addEventListener('drop', async (e) => {
        e.preventDefault();
        const batch = Array.from(e.dataTransfer.files || []);
        for (let i = 0; i < batch.length; i++) {
          try { await uploadFile(batch[i]); }
          catch (err) { pushConsoleLine('error', ['Upload failed', batch[i].name, err.message || String(err)]); }
        }
      });
    }
  }

  // ── Live preview via SSE + postMessage console bridge ──
  // Mirrors Replit-like behaviour: when an agent writes a file in
  // workspace/preview/, the iframe auto-updates and the console-output
  // strip captures iframe-side logs/errors.
  let _sse = null;
  let _lastFilesSig = '';
  function setPreviewStatus(state, label) {
    const el = previewStatus;
    if (!el) return;
    el.classList.remove('syncing', 'error');
    if (state === 'syncing') el.classList.add('syncing');
    else if (state === 'error') el.classList.add('error');
    el.querySelector('.label').textContent = label;
  }
  function subscribeWorkspace() {
    try {
      if (_sse) _sse.close();
      _sse = new EventSource('/api/workspace/events');
      _sse.addEventListener('files', (e) => {
        const files = JSON.parse(e.data || '[]');
        const sig = files.map(f => f.name + ':' + f.mtime + ':' + f.size).join('|');
        if (sig !== _lastFilesSig) {
          _lastFilesSig = sig;
          // Invalidate file-viewer cache so source panel shows fresh content.
          _fileCache.clear();
          renderChangesPanel(files);
          renderFileTree(files);
          window._lastFiles = files;
          // Only reload preview iframe when actual code/markup files changed —
          // not for attached/ uploads or other non-renderable assets.
          const hasCodeChange = files.some(f =>
            /\.(html?|css|js|mjs|jsx|ts|tsx|svg|json)$/i.test(f.name) &&
            !/^attached\//i.test(f.name)
          );
          if (hasCodeChange) {
            setPreviewStatus('syncing', 'Reload');
            reloadPreview();
          }
        }
      });
      _sse.addEventListener('error', () => setPreviewStatus('error', 'Offline'));
      _sse.addEventListener('open', () => setPreviewStatus('live', 'Live'));
    } catch (err) {
      console.warn('SSE subscribe failed:', err);
      setPreviewStatus('error', 'Offline');
      if (_sse) try { _sse.close(); } catch {}
      setTimeout(subscribeWorkspace, 3000);
    }
  }
  function pushConsoleLine(type, args) {
    if (!previewConsole) return;
    const empty = previewConsole.querySelector('.preview-console-empty');
    if (empty) empty.remove();
    const line = document.createElement('div');
    line.className = 'preview-console-line ' + type;
    const lvl = document.createElement('span');
    lvl.className = 'lvl';
    lvl.textContent = type;
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = (args || []).join(' ');
    line.appendChild(lvl);
    line.appendChild(msg);
    previewConsole.appendChild(line);
    while (previewConsole.childElementCount > 200) previewConsole.removeChild(previewConsole.firstChild);
    previewConsole.scrollTop = previewConsole.scrollHeight;
  }
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.source !== 'preview-iframe') return;
    if (d.type === 'ready') { setPreviewStatus('live', 'Live'); return; }
    if (['log','warn','error','info','unhandledrejection'].includes(d.type)) {
      pushConsoleLine(d.type, d.args || []);
    }
  });

  function showNoProviderBanner() {
    const existing = document.getElementById('noProviderBanner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'noProviderBanner';
    banner.className = 'no-provider-banner';
    banner.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/>
        <path d="M7 4v3M7 9v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>WebGPU недоступен. Чат работает в браузерах Chrome/Edge с включённым WebGPU.</span>
    `;
    banner.addEventListener('click', () => settingsPanel.classList.add('open'));
    document.querySelector('.chat-panel').insertBefore(banner, messagesEl);
  }

  async function loadMessages() {
    const msgs = await loadHistory();
    if (!Array.isArray(msgs) || msgs.length === 0) { showEmptyState(); return; }
    for (const m of msgs) {
      if (m.role === 'user') {
        // Восстанавливаем превью картинок из workspace на сервере — после
        // перезагрузки страницы исходный dataUrl уже утерян, но файл
        // всё ещё лежит в attached/.
        const att = await reloadHistoryAttaches(m.attachments || []);
        appendUserMsg(m.content, Date.now(), att);
      } else {
        appendAgentMsg(m.content, 0, 'Локально', false);
      }
    }
    scrollBottom();
  }

  // Подгружает dataUrl для картинок из истории. Текстовые и бинарные
  // вложения проходят как есть, превью не рисуется (видна иконка + имя).
  async function reloadHistoryAttaches(att) {
    if (!att || !att.length) return att;
    const out = [];
    for (const a of att) {
      if (a && /^image\//i.test(a.type || '') && a.path && !a.dataUrl) {
        try {
          const r = await fetch('/api/workspace/raw?path=' + encodeURIComponent(a.path));
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            let bin = '';
            for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            out.push({ ...a, dataUrl: 'data:' + (a.type || 'image/png') + ';base64,' + btoa(bin) });
            continue;
          }
        } catch (_) { /* fallthrough ниже */ }
      }
      out.push(a);
    }
    return out;
  }

  async function loadWorkspaceFiles() {
    try {
      const res = await fetch('/api/workspace/files');
      const data = await res.json().catch(() => ({}));
      renderChangesPanel(data.files || []);
      renderFileTree(data.files || []);
      window._lastFiles = data.files || [];
      invalidateWorkspaceSnapshot();
    } catch (e) { console.error(e); }
  }

  // ── Снимок проекта для системного контекста модели. ──
  // Кешируем на короткое время — чтобы соседние запросы в одной сессии не
  // тянули снапшот заново. Инвалидируется после любой записи (applyCodeChanges)
  // или ручного refresh проводника.
  function invalidateWorkspaceSnapshot() {
    window._workspaceSnapshot = null;
    window._workspaceSnapshotT = 0;
  }
  async function loadWorkspaceSnapshot(opts = {}) {
    const maxAgeMs = (opts && opts.maxAgeMs != null) ? opts.maxAgeMs : 15_000;
    const cached = window._workspaceSnapshot;
    if (!opts.force && cached && Date.now() - (window._workspaceSnapshotT || 0) < maxAgeMs) return cached;
    try {
      const res = await fetch('/api/workspace/snapshot');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status));
      const parts = [];
      parts.push('Файлов в проекте: ' + (data.totalFiles || 0));
      for (const f of (data.files || [])) {
        parts.push('\n--- FILE: ' + f.path + ' (' + f.size + ' байт) ---');
        parts.push(f.content);
        parts.push('--- END FILE: ' + f.path + ' ---');
      }
      if (data.skipped && data.skipped.length) {
        parts.push('\nПропущены (слишком большие): ' + data.skipped.map(s => s.path + ' [' + s.reason + ']').join(', '));
      }
      const snapshot = Object.assign({}, data, { contextText: parts.join('\n') });
      window._workspaceSnapshot = snapshot;
      window._workspaceSnapshotT = Date.now();
      return snapshot;
    } catch (e) {
      return null;
    }
  }
  async function buildWorkspaceContextMessages() {
    const snap = await loadWorkspaceSnapshot({ maxAgeMs: 15000 });
    if (!snap || !snap.files) return [];
    const fileList = snap.files.map(f => f.path + ' (' + f.size + ' байт)').join('\n');
    const content = 'Файлов в проекте: ' + (snap.totalFiles || 0) + '\n' + fileList +
      (snap.skipped && snap.skipped.length ? '\n\nПропущены (слишком большие): ' + snap.skipped.map(s => s.path).join(', ') : '');
    return [{ role: 'system', content: 'Текущее состояние проекта (workspace). Используй как контекст. Прежде чем создавать файлы, проверь — нет ли уже подходящего, и не дублируй содержимое.\n\n' + content }];
  }

  function showEmptyState() {
    const suggestions = [
      { icon: '🚀', text: 'Современный SaaS-лендинг в стиле Linear' },
      { icon: '⚡', text: 'React-дашборд с графиками и Tailwind CSS' },
      { icon: '🎨', text: 'Портфолио-сайт с анимациями' },
      { icon: '🔐', text: 'Форма авторизации с валидацией' },
      { icon: '📦', text: 'Современный лендинг с бенто-сеткой и CTA' },
      { icon: '🌐', text: 'Адаптивный лендинг с hero и bento-сеткой' },
    ];
    messagesEl.innerHTML = `
      <div class="empty-chat">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="2" y="2" width="32" height="32" rx="7" stroke="#3b4258" stroke-width="2"/>
          <path d="M8 12h20M8 18h14M8 24h10" stroke="#3b4258" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <p>Создайте что-то крутое</p>
        <span>Агент автоматически подбирает лучшую модель — лендинги, мини-апы, дашборды, веб-страницы.</span>
        <div class="empty-suggestions">
          ${suggestions.map(s => `<button class="suggestion-chip" data-text="${escHtml(s.text)}">${s.icon} ${escHtml(s.text)}</button>`).join('')}
        </div>
      </div>`;
    messagesEl.querySelectorAll('.suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        inputEl.value = btn.dataset.text || '';
        autoResize();
        inputEl.focus();
      });
    });
  }

  function renderModelDropdown() {
    modelDropdown.innerHTML = '';
    const entries = Object.entries(modelPresets).sort((a, b) => {
      const rank = k => k.startsWith('direct:') ? 2 : (modelPresets[k]?.featured ? 0 : 1);
      return rank(a[0]) - rank(b[0]);
    });
    let featuredHeaderShown = false;
    let directHeaderShown = false;
    entries.forEach(([key, p]) => {
      if (p.featured && !featuredHeaderShown) {
        const sep = document.createElement('div');
        sep.className = 'dropdown-section-label';
        sep.textContent = '⭐ Топ-режимы';
        modelDropdown.appendChild(sep);
        featuredHeaderShown = true;
      }
      if (key.startsWith('direct:') && !directHeaderShown) {
        const sep = document.createElement('div');
        sep.className = 'dropdown-section-label';
        sep.textContent = '🤖 Выбрать модель вручную';
        modelDropdown.appendChild(sep);
        directHeaderShown = true;
      }
      const div = document.createElement('div');
      div.className = 'dropdown-item' + (key === currentModel ? ' active' : '');
      div.dataset.model = key;
      div.innerHTML = `<span class="dot ${p.color}"></span>${p.label}<span class="desc">${p.desc}</span>`;
      div.addEventListener('click', () => selectModel(key));
      modelDropdown.appendChild(div);
    });
  }

  function selectModel(key) {
    currentModel = key;
    updateModelDisplay();
    document.querySelectorAll('.dropdown-item').forEach(x => x.classList.toggle('active', x.dataset.model === key));
    modelDropdown.classList.remove('open');
  }

  function modelLogoLetter(key, label) {
    if (/deepseek/i.test(label)) return 'R';
    if (/qwen/i.test(label)) return 'Q';
    if (/llama/i.test(label)) return 'L';
    if (/phi/i.test(label)) return 'Φ';
    if (/mistral/i.test(label)) return 'M';
    if (/gemma/i.test(label)) return 'G';
    return (label || 'A')[0].toUpperCase();
  }

  function findModelById(modelId) {
    return window.WEBLLM_MODELS?.find(m => m.model_id === modelId) || null;
  }

  function tagsToTasks(tags) {
    if (!Array.isArray(tags) || !tags.length) return null;
    const map = {
      general: 'общие задачи',
      code: 'код и дебаг',
      reasoning: 'сложные рассуждения',
      analysis: 'анализ данных',
      ui: 'UI/дизайн',
      debug: 'исправление ошибок',
      economy: 'быстрые и лёгкие задачи'
    };
    const tasks = tags.map(t => map[t] || t).filter(Boolean);
    if (!tasks.length) return null;
    return 'Идеально для: ' + tasks.join(', ');
  }

  const modelTypeLabels = { auto: 'Auto', economy: 'Economy', standard: 'Standard', pro: 'Pro' };

  function setActiveModel(modelId, label) {
    const activeModelLabel = document.getElementById('activeModelLabel');
    const activeModelType = document.getElementById('activeModelType');
    const activeModelDesc = document.getElementById('activeModelDesc');
    const modelLogo = document.getElementById('modelLogo');
    if (!activeModelLabel || !modelLogo) return;
    const model = findModelById(modelId);
    const displayLabel = label || model?.label || 'gemini-2.5-flash-lite';
    const key = model?.key || currentModel;
    const type = model?.color || 'standard';
    const color = colorMap[type] || colorMap.auto;
    activeModelLabel.textContent = displayLabel;
    if (activeModelType) {
      activeModelType.textContent = modelTypeLabels[type] || 'Auto';
      activeModelType.style.background = color + '33';
      activeModelType.style.color = color;
    }
    if (activeModelDesc) {
      const taskDesc = tagsToTasks(model?.tags || modelPresets[currentModel]?.tags);
      activeModelDesc.textContent = taskDesc || model?.desc || modelPresets[currentModel]?.desc || 'Выбранная модель';
    }
    modelLogo.textContent = modelLogoLetter(key, displayLabel);
    modelLogo.style.background = color;
    modelLogo.style.boxShadow = `0 0 10px ${color}88`;
    modelLogo.classList.remove('is-loading');
    delete modelLogo.dataset.savedLetter;
    if (!modelLogo.dataset.letter) modelLogo.dataset.letter = modelLogo.textContent;
  }

  // Превращаем логотип активной модели в сегментный спиннер во время генерации.
  // После finalizeStreaming возвращаем исходную букву.
  const MODEL_LOGO_LOADER_HTML = '<span class="model-logo-spin">'
    + '<svg class="ring" viewBox="0 0 30 30" width="28" height="28">'
    + '<circle cx="15" cy="15" r="11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>'
    + '</svg>'
    + '<span class="play"><svg viewBox="0 0 30 30" width="12" height="12"><polygon points="10.5,6 10.5,24 24,15"/></svg></span>'
    + '</span>';
  function setLogoLoading(loading) {
    const el = document.getElementById('modelLogo');
    if (!el) return;
    if (loading) {
      if (!el.dataset.savedLetter) el.dataset.savedLetter = (el.dataset.letter || el.textContent || 'A');
      el.innerHTML = MODEL_LOGO_LOADER_HTML;
      el.classList.add('is-loading');
    } else {
      el.classList.remove('is-loading');
      const letter = el.dataset.savedLetter || el.dataset.letter || 'A';
      el.textContent = letter;
      delete el.dataset.savedLetter;
    }
  }

  function updateModelDisplay() {
    const p = modelPresets[currentModel] || modelPresets['direct:google/gemini-2.5-flash-lite'] || { label: 'gemini-2.5-flash-lite', color: 'standard', desc: 'Выбранная модель' };
    const color = colorMap[p.color] || colorMap.auto;
    modelLabel.textContent = p.label;
    modelDot.style.background = color;
    setActiveModel(p.model_id || currentModel, p.label);
  }

  function renderProviders() {
    const providers = [
      { name: 'WebLLM', models: 'Llama, Phi, Qwen, Mistral, Gemma (в браузере)', link: 'github.com/mlc-ai/web-llm', ok: window.WEBLLM_SUPPORTED },
      { name: 'Локально (сервер)', models: `Transformers.js · ${config.llmModel || 'CPU'}`, link: 'huggingface.co', ok: config.hasLocalLLM },
      { name: 'OpenAI-API', models: `DeepSeek / GPT / другое · ${config.openaiBaseURL || 'прокси'}`, link: 'platform.openai.com', ok: config.hasOpenAI }
    ];
    providerGrid.innerHTML = providers.map(p => `
      <div class="provider-card">
        <div class="info">
          <div class="name">${p.name}</div>
          <div class="models">${p.models}</div>
          <div class="link">${p.link}</div>
        </div>
        <div class="status ${p.ok ? 'ok' : 'missing'}">${p.ok ? 'Готов' : 'Недоступен'}</div>
      </div>`).join('');
  }

  // ── Code change extraction ───────────────────────────
  function extractCodeChanges(content) {
    const changes = [];
    // Тройные бэктики + опц. lang + опц. info-string (где может жить `// file: x`).
    const codeBlockRegex = /```\s*([a-zA-Z0-9+_-]*)([^\n]*)\n([\s\S]*?)```/g;
    let match;
    const seenPathCounts = Object.create(null);
    // Дефолты, если модель забыла явный `// file:` (часто Claude/DeepSeek
    // отдают чистый ```html`` без маркера).
    const langToPath = {
      html: 'index.html', htm: 'index.html', css: 'styles.css',
      js: 'script.js', javascript: 'script.js', mjs: 'script.js',
      ts: 'script.ts', typescript: 'script.ts',
      jsx: 'App.jsx', tsx: 'App.tsx',
      svelte: 'App.svelte', vue: 'App.vue',
      json: 'data.json', md: 'README.md', markdown: 'README.md'
    };
    const uniquePath = (base) => {
      const seen = (seenPathCounts[base] = (seenPathCounts[base] || 0) + 1);
      if (seen === 1) return base;
      // Повторов одного типа кода в одном ответе обычно не бывает, но на
      // случай нескольких HTML-страниц / CSS-файлов — нумеруем.
      if (base === 'index.html') return 'index' + (seen === 2 ? '2' : seen) + '.html';
      if (base === 'styles.css') return 'styles' + (seen === 2 ? '2' : seen) + '.css';
      if (base === 'script.js')  return 'script'  + (seen === 2 ? '2' : seen) + '.js';
      return base.replace(/\.(\w+)$/, (_, e) => (seen === 2 ? '.2' : '.' + seen) + '.' + e);
    };
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = (match[1] || '').trim().toLowerCase();
      const infoStr = match[2] || '';
      let code = match[3];
      const firstLineEnd = code.indexOf('\n');
      const firstLine = (firstLineEnd >= 0 ? code.slice(0, firstLineEnd) : code).trim();
      let filePath = null;
      // a) маркер внутри info-string: ```html // file: x
      {
        const m = infoStr.match(/(?:\/\/|<!--)\s*file:\s*([^\s>]+)(?:\s*-->)?/i)
              || infoStr.match(/file:\s*([^\s`'"]+\.[a-z0-9]+)/i);
        if (m) filePath = m[1].replace(/\*+$/, '').trim();
      }
      // b) маркер `// file: …` / `<!-- file: … -->` / `# file: …` в первой строке блока
      if (!filePath) {
        const m = firstLine.match(/(?:\/\/|#|<!--)\s*file:\s*(.+?)(?:\s*-->)?\s*$/i);
        if (m) filePath = m[1].trim().replace(/\*+$/, '');
      }
      if (!filePath) {
        const m = firstLine.match(/file:\s*([^\s`'"]+\.[a-z0-9]+)/i);
        if (m) filePath = m[1];
      }
      // c) дефолт по языку
      if (!filePath && langToPath[lang]) filePath = uniquePath(langToPath[lang]);
      // d) HTML-эвристика по первой строке кода
      if (!filePath) {
        const htmlLike = /^<(?:!doctype\s+html|html|head|body|main|section|article|nav|header|footer|aside|form|div|p|h[1-6])/i.test(firstLine);
        if (htmlLike) filePath = uniquePath('index.html');
      }
      if (!filePath) continue;
      // Если первая строка — маркер-комментарий (а не полезный код), срезаем её.
      if (firstLineEnd > 0 && /^\s*(?:\/\/|#|<!--)\s*file\s*:/i.test(firstLine)) {
        code = code.slice(firstLineEnd + 1);
      }
      changes.push({ path: filePath, content: code, lang: lang || (filePath.split('.').pop() || '') });
    }
    // Fallback 4: модель выдала код БЕЗ ```lang``` обёртки (сплошной HTML/SVG).
    // Это часто бывает у Claude/DeepSeek/GPT — тогда блоков ноль и пользователь
    // видит простыню кода в чате. Ловим по сигнатуре начала.
    if (!changes.length) {
      const trimmed = content.trim();
      if (/^<!doctype\s+html|^<html\b/i.test(trimmed)) {
        changes.push({ path: 'index.html', content: trimmed, lang: 'html' });
      } else if (/^<\?xml\b|^<svg\b/i.test(trimmed)) {
        changes.push({ path: 'image.svg', content: trimmed, lang: 'xml' });
      }
    }
    // ── Normalize paths so the static preview can render what we save ──
    // LLM часто выдаёт Next.js / React / Svelte / Vue файлы, которые статический
    // Express-превью НЕ умеет рендерить. Поэтому перед записью:
    //   1) срезаем framework-префиксы (`app/`, `src/`, `pages/`, `components/`, `public/`)
    //   2) `.tsx`/`.jsx`/`.vue`/`.svelte`/`.astro` → `.html`, ЕСЛИ содержимое похоже
    //      на HTML (есть теги) и не содержит ESM-импортов
    //   3) чистый `.ts` отбрасываем — Node-статикой всё равно не выполнится
    //   4) чистый JSX/TSX (`import React`, `export default function`, 'use client')
    //      отбрасываем — даже после переименования не отрендерится
    //   5) де-дупликация по итоговому пути
    const FRAMEWORK_PREFIX = /^(app|pages|src|components|public)\//i;
    const REWRITE_EXT = /\.(tsx|jsx|vue|svelte|astro)$/i;
    const TS_ONLY_EXT = /\.(ts)$/i;
    const normalized = [];
    const seen = Object.create(null);
    for (const c of changes) {
      let p = String(c.path || '').trim();
      if (!p) continue;
      const content = String(c.content || '').trim();
      const looksLikeFramework = /^\s*import\s+(React|[\{\*])/m.test(content)
                              || /^\s*['"]use\s+client['"]/m.test(content)
                              || /^\s*export\s+default\s+(function\s+\w+|class\s+\w+|\(\w*\s*=>)/m.test(content)
                              || /^\s*<\?xml\b/im.test(content);
      if (looksLikeFramework) continue;
      if (TS_ONLY_EXT.test(p)) continue;
      // срезаем framework prefix ДО проверки расширения
      p = p.replace(FRAMEWORK_PREFIX, '');
      if (REWRITE_EXT.test(p)) {
        const hasTags = /<\/?[a-z][^>]*>/i.test(content);
        const hasEsmImport = /^\s*(import|export)\s/m.test(content);
        if (!hasTags || hasEsmImport) continue;
        p = p.replace(REWRITE_EXT, '.html');
      }
      // защищаемся от выхода из workspace
      p = p.replace(/^\.+/, '').replace(/^\/+/, '');
      if (!p) continue;
      const dupCount = (seen[p] = (seen[p] || 0) + 1);
      // первый — оставляем, повторы скипаем
      if (dupCount === 1) normalized.push({ ...c, path: p });
    }
    return normalized;
  }

  async function applyCodeChanges(changes) {
    if (!changes.length) return;
    try {
      const res = await fetch('/api/apply-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes })
      });
      const data = await res.json().catch(() => ({}));
      if (data.applied && data.applied.length) {
        reloadPreview();
        redirectPreviewToHtml(data.applied);
        invalidateWorkspaceSnapshot();
        loadWorkspaceFiles();
        // Best-effort backup to Supabase. Failure here never blocks the user.
        if (window.SupabaseSync?.enabled) {
          for (let i = 0; i < changes.length; i++) {
            const safe = data.applied[i];
            if (!safe) continue;
            window.SupabaseSync.backupFile(safe, changes[i].content).catch(() => {});
          }
        }
      }
      return data;
    } catch (e) {
      console.error(e);
    }
  }

  // showChangesNotification removed (body-level div was unwanted)

  function renderChangesPanel(files) {
    if (!files.length) {
      previewChanges.innerHTML = '<div class="no-changes">Нет изменений в workspace</div>';
      return;
    }
    previewChanges.innerHTML = files.map(f => `
      <div class="change-file">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        <span>${f ? escHtml(String(f.name || f)) : ''}</span>
      </div>
    `).join('');
  }

  // Жесткая перезагрузка iframe: создаём НОВЫЙ узел iframe с тем же src +
  // cache-bust query и подменяем старый. Это единственный способ обойти
  // кеширование, "same URL = no fetch" no-op и iframe-кеш браузера.
  function hardReloadIframe(basePath) {
    if (!previewFrame) return;
    const parent = previewFrame.parentNode;
    if (!parent) return;
    const newSrc = basePath.split('?')[0] + '?v=' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const clone = previewFrame.cloneNode(false);
    clone.removeAttribute('src');
    parent.replaceChild(clone, previewFrame);
    previewFrame = clone;
    previewFrame.addEventListener('load', () => { try { scrollBottom && scrollBottom(); } catch {} }, { once: true });
    previewFrame.src = newSrc;
  }

  function reloadPreview() {
    const cur = previewFrame.getAttribute('src') || previewFrame.src || '/preview/index.html';
    hardReloadIframe(cur.split('?')[0] || '/preview/index.html');
  }

  // Если среди только что записанных файлов есть *.html — редиректим iframe
  // на самый подходящий. previewStatic инициализируется один раз при загрузке
  // страницы и без нашего участия останется на старом index.html; пользователь
  // тогда справедливо пишет «превью не меняется», даже если агент успешно
  // записал новый login.html / ai.html / index.html.
  function redirectPreviewToHtml(applied) {
    if (!previewFrame) return;
    if (!Array.isArray(applied) || !applied.length) return;
    const htmls = applied.filter(p => /\.html?$/i.test(p));
    if (!htmls.length) return;
    const target = htmls.find(p => /(^|\/)index\.html?$/i.test(p))
                || htmls.find(p => /(^|\/)login\.html?$/i.test(p))
                || htmls[0];
    hardReloadIframe('/preview/' + String(target).replace(/^\/+/, ''));
  }

  // ── Messages ──────────────────────────────────────────
  function appendUserMsg(content, ts, attachments) {
    const div = document.createElement('div');
    div.className = 'msg-user';
    // Превью картинок — сразу под метаданными, до текста. Современный UX
    // (как в Replit Agent / ChatGPT): пользователь видит то, что отправил.
    const imgs = (attachments || []).filter(a => a && a.dataUrl);
    const files = (attachments || []).filter(a => a && !a.dataUrl);
    const attachHtml = imgs.length || files.length
      ? `<div class="msg-user-attach">`
          + imgs.map(a => {
              const fname = (a.name || a.path || 'image').split('/').pop();
              return `<div class="msg-user-attach-cell" title="${escHtml(a.path || fname)}">`
                + `<img src="${a.dataUrl}" alt="${escHtml(fname)}">`
                + `<span>${escHtml(fname)}</span></div>`;
            }).join('')
          + files.map(a => {
              const fname = (a.name || a.path || 'file').split('/').pop();
              const sz = a.size < 1024 ? a.size + ' Б' : Math.round(a.size / 1024) + ' КБ';
              return `<div class="msg-user-attach-cell file" title="${escHtml(a.path || fname)}">`
                + `<div class="msg-user-attach-icon">📎</div>`
                + `<span>${escHtml(fname)} <em>${sz}</em></span></div>`;
            }).join('')
        + `</div>`
      : '';
    div.innerHTML = `
      <div class="msg-user-meta">
        <span class="msg-user-name">Вы</span>
        <span class="msg-user-time">${formatTime(ts)}</span>
      </div>
      ${attachHtml}
      <div class="msg-user-bubble">${escHtml(content)}</div>`;
    removeEmptyState();
    messagesEl.appendChild(div);
  }

  function appendThinking(thinkingId, modelName) {
    const div = document.createElement('div');
    div.className = 'msg-agent';
    div.id = `thinking-${thinkingId}`;
    div.innerHTML = `
      <div class="msg-agent-status">
        <div class="status-icon"><div class="spinner"></div></div>
        <span class="status-text">Думаю…</span>
      </div>
      <div class="acti-live" hidden></div>
      <div class="load-bar"><div class="load-bar-fill"></div></div>`;
    messagesEl.appendChild(div);
    scrollBottom();
    setLogoLoading(true);
    document.getElementById('modelLoader')?.classList.add('show');
    // Подключаем activity tracker к этой пузырьке.
    activityTracker.setContainer(div.querySelector('.acti-live'));
    return div;
  }

  // Показываем/прячем сегментный спиннер рядом с логотипом активной модели.
  function showModelLoader() { document.getElementById('modelLoader')?.classList.add('show'); }
  function hideModelLoader() { document.getElementById('modelLoader')?.classList.remove('show'); }

  function resolveThinking(thinkingId, content, worked, model, error) {
    const div = document.getElementById(`thinking-${thinkingId}`);
    if (!div) return;
    div.className = 'msg-agent' + (error ? ' error-bubble' : '');
    div.innerHTML = `
      <div class="msg-agent-status">
        <div class="status-icon">
          <div class="check-icon">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <span>Подтверждение присутствия</span>
        ${model ? `<span class="model-tag">${model}</span>` : ''}
      </div>
      <div class="msg-agent-bubble">${renderMarkdown(content)}</div>
      <div class="worked-label">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1"/>
          <path d="M5 3v2l1.5 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
        Работал ${worked} сек
      </div>`;
    scrollBottom();
  }


  // ╔══ Replit-style live activity status bar ════════════════════════════════╗
  // Пока агент работает — компактная строка с иконками + "Thinking..".
  // Кнопка "N шагов" разворачивает полный список. После завершения
  // спиннер сменяется галочкой, текст "Thinking.." исчезает.

  // SVG-иконки для каждого типа шага (12×12, currentColor)
  const STEP_SVG = {
    connect:  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><ellipse cx="6" cy="6" rx="2" ry="4.5" stroke="currentColor" stroke-width="1"/><path d="M1.5 6h9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    read:     '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 9.5V3L6 1.5 10.5 3v6.5" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M6 1.5v8" stroke="currentColor" stroke-width="1"/><path d="M1.5 9.5c1.5-.5 3-.7 4.5-.7s3 .2 4.5.7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
    shell:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M3.5 5l1.5 1-1.5 1M6.5 7h2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    skill:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9.5 2.5L6 6M2.5 9.5L6 6M6 6L9.5 9.5M6 6L2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    restart:  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10.5 6a4.5 4.5 0 1 1-1.7-3.5L10.5 1v3.5H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    route:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7.5 3.5L10 6l-2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    delegate: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 9L9 3M9 3H5.5M9 3v3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    write:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 2L10 3.5 4.5 9H3v-1.5L8.5 2z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M2 11h8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>',
    synth:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.2 3H10l-2.4 1.8.9 3L6 7.2 4.5 8.8l.9-3L3 4h2.8L6 1z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="none"/></svg>',
    parallel: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 2.5v7M6 2.5v7M9 2.5v7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    vision:   '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><ellipse cx="6" cy="6" rx="4.5" ry="3" stroke="currentColor" stroke-width="1.1"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/></svg>',
    error:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M6 3.5v3M6 8.2h.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    retry:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10.5 6a4.5 4.5 0 1 1-1.7-3.5L10.5 1v3.5H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    answer:   '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    work:     '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="4" width="10" height="7" rx="1.2" stroke="currentColor" stroke-width="1.1"/><path d="M4 4V3a2 2 0 0 1 4 0v1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
    idle:     '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M6 3.5v2.7l1.5 1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
    thinking: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="2.5" cy="2.5" r="1" fill="currentColor"/><circle cx="6" cy="2.5" r="1" fill="currentColor"/><circle cx="9.5" cy="2.5" r="1" fill="currentColor"/><circle cx="2.5" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="9.5" cy="6" r="1" fill="currentColor"/><circle cx="2.5" cy="9.5" r="1" fill="currentColor"/><circle cx="6" cy="9.5" r="1" fill="currentColor"/><circle cx="9.5" cy="9.5" r="1" fill="currentColor"/></svg>',
  };

  const activityTracker = {
    container: null,
    steps: [],
    reset() { this.container = null; this.steps = []; },
    setContainer(el) { this.container = el; },
    push(status) {
      if (!this.container) return;
      this.steps.push(classifyStep(status));
      this.container.innerHTML = activityTimelineHTML(this.steps, { live: true });
    },
    finish() {
      if (!this.container) return;
      this.container.innerHTML = activityTimelineHTML(this.steps, { live: false });
    }
  };

  function classifyStep(status) {
    if (!status) return { kind:'idle', svgIcon: STEP_SVG.idle, label:'Работаю' };
    const rules = [
      [/vsegpt|api\.|connect|http/i,                       { kind:'connect',  svgIcon: STEP_SVG.connect  }],
      [/открыл|открываю|читаю|opened|read|\.md|\.js|\.html|\.css|\.json/i, { kind:'read', svgIcon: STEP_SVG.read }],
      [/url|fetch|запрос/i,                                { kind:'shell',    svgIcon: STEP_SVG.shell    }],
      [/skill|навык/i,                                     { kind:'skill',    svgIcon: STEP_SVG.skill    }],
      [/restart|restarting|перезапуск/i,                   { kind:'restart',  svgIcon: STEP_SVG.restart  }],
      [/Маршрутизация|маршрутизатор|router/i,              { kind:'route',    svgIcon: STEP_SVG.route    }],
      [/Делегирование/i,                                   { kind:'delegate', svgIcon: STEP_SVG.delegate }],
      [/Записываю файлы/i,                                 { kind:'write',    svgIcon: STEP_SVG.write    }],
      [/Синтез/i,                                          { kind:'synth',    svgIcon: STEP_SVG.synth    }],
      [/Параллельный/i,                                    { kind:'parallel', svgIcon: STEP_SVG.parallel }],
      [/[Vv]ision/i,                                       { kind:'vision',   svgIcon: STEP_SVG.vision   }],
      [/Переход →/i,                                       { kind:'retry',    svgIcon: STEP_SVG.retry    }],
      [/ошибка|error|упал/i,                               { kind:'error',    svgIcon: STEP_SVG.error    }],
      [/Прямой ответ/i,                                    { kind:'answer',   svgIcon: STEP_SVG.answer   }],
    ];
    for (const [re, def] of rules) {
      if (re.test(status)) return { ...def, label: status.length > 80 ? status.slice(0,77)+'…' : status };
    }
    return { kind:'work', svgIcon: STEP_SVG.work, label: status.length > 80 ? status.slice(0,77)+'…' : status };
  }

  function ruPlural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function activityTimelineHTML(steps, opts) {
    if (!steps || !steps.length) return '';
    const isLive = !!(opts && opts.live);
    const total = steps.length;
    const CHIP_MAX = 5;
    const chipSteps = steps.slice(-CHIP_MAX);
    const countLabel = ruPlural(total, 'шаг', 'шага', 'шагов');

    // Compact chip row (last N icons + optional thinking chip)
    const chips = chipSteps.map(s =>
      `<span class="acti-chip kind-${s.kind}" title="${escHtml(s.label)}">${s.svgIcon}</span>`
    ).join('');
    const thinkChip = isLive
      ? `<span class="acti-chip kind-thinking" title="Обрабатываю">${STEP_SVG.thinking}</span>`
      : '';

    // Pulse indicator SVG
    const pulseSVG = isLive
      ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M11 6A5 5 0 1 1 9 2.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9 1v3H6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Chevrons
    const chevUp   = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 7L5.5 3.5 9 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const chevDown = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 4L5.5 7.5 9 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Full step list for expanded panel
    const stepItems = steps.map(s =>
      `<li class="acti-step-row">
        <span class="acti-step-icon kind-${s.kind}">${s.svgIcon}</span>
        <span class="acti-step-label">${escHtml(s.label)}</span>
      </li>`
    ).join('');

    const fnOpen  = `(function(b){var w=b.closest('.acti-wrap');w.querySelector('.acti-expanded').hidden=false;w.classList.add('open');})(this)`;
    const fnClose = `(function(b){var w=b.closest('.acti-wrap');w.querySelector('.acti-expanded').hidden=true;w.classList.remove('open');})(this)`;

    return `<div class="acti-wrap">
      <div class="acti-expanded" hidden>
        <button class="acti-show-less" onclick="${fnClose}">${chevUp} Show less</button>
        <ol class="acti-steps-list">${stepItems}</ol>
      </div>
      <div class="acti-compact">
        <span class="acti-pulse-dot ${isLive ? 'live' : 'done'}">${pulseSVG}</span>
        <span class="acti-chip-row">${chips}${thinkChip}</span>
        ${isLive ? '<span class="acti-thinking-label">Thinking<span class="acti-dots-anim"><span>.</span><span>.</span><span>.</span></span></span>' : ''}
        <button class="acti-expand-btn" onclick="${fnOpen}">${chevDown} ${total} ${countLabel}</button>
      </div>
    </div>`;
  }
  // ╚════════════════════════════════════════════════════════════════════════╝

  function appendAgentMsg(content, worked, model, error) {
    const div = document.createElement('div');
    div.className = 'msg-agent' + (error ? ' error-bubble' : '');
    div.innerHTML = `
      <div class="msg-agent-status">
        <div class="status-icon">
          <div class="check-icon">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <span>Подтверждение присутствия</span>
        ${model ? `<span class="model-tag">${model}</span>` : ''}
      </div>
      <div class="msg-agent-bubble">${renderMarkdown(content)}</div>
      ${worked ? `<div class="worked-label">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1"/>
          <path d="M5 3v2l1.5 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
        Работал ${worked} сек
      </div>` : ''}`;
    messagesEl.appendChild(div);
    scrollBottom();
  }

  function renderMarkdown(text) {
    if (!text) return '';
    let html = escHtml(text);
    // Fenced code-блоки заворачиваем в <details> — код свёрнут по умолчанию,
    // пользователь сам решает, развернуть ли. Если провайдер выдаёт код в
    // чате (вместо файлов), пузырь не превращается в простыню.
    html = html.replace(/```([a-zA-Z0-9+_-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      const body = code.trim();
      const lines = (body.match(/\n/g) || []).length + 1;
      const bytes = body.length;
      const tag = (lang || 'code').toLowerCase();
      return `<details class="codefold"><summary>📄 <b>${tag}</b> · ${lines} стр · ${fmtSize(bytes)} · развернуть</summary><pre><code class="language-${lang}">${body}</code></pre></details>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    html = html.split(/\n\n+/).map(p => p.trim() ? `<p>${p}</p>` : '').join('');
    html = html.replace(/<p>([^]*?)<\/p>/g, (m, c) => `<p>${c.replace(/\n/g, '<br>')}</p>`);
    return html;
  }

  // ── Чистим «код в чате» после applyCodeChanges ─────────────────────────
  // Replit Agent-стиль: если ассистент создал/обновил файлы — в пузыре чата НЕ
  // показываем ни ```fenced``` блоки, ни большие простыни CSS/JS/HTML. Только
  // краткое резюме «📁 Записано в workspace: index.html, …» в конце. Prose
  // (объяснения, инструкции, приветствия) остаётся как есть.
  // Эвристика: похоже, что задача требует кода (UI/правки/создание).
  // Используется в делегате/мульти, чтобы ПЕРЕПРОСИТЬ модель, если она вернула prose без кода.
  // Провайдер (vsegpt) возвращает разные сообщения, когда модель недоступна
  // по лимиту: «Exceeded soft user limit», «expected price», и т.п.
  // Ловим одной предикатной функцией — единое правило fallback.
  function isBudgetOrModelError(msg) {
    if (!msg) return false;
    return /Exceeded|soft user limit|expected price|expected_cost|insufficient|not enough|balance|not available|upgrade.*subscription|subscription plan|model.*not.*supported|Rate.limit|rate limit|too many requests|недоступн|не хватает|лимит|лими/i.test(String(msg));
  }

  // Чёрный список моделей, которые вернули ошибку доступности/плана.
  // Храним в sessionStorage, чтобы не пытаться их повторно в рамках сессии.
  function unavailableModels() {
    try {
      const raw = sessionStorage.getItem('orchestrator_unavailable_models');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }
  function markUnavailable(id) {
    try {
      const s = unavailableModels();
      s.add(id);
      sessionStorage.setItem('orchestrator_unavailable_models', JSON.stringify([...s]));
    } catch {}
  }
  function isAvailableModel(id) { return !unavailableModels().has(id); }

  // Когда VseGPT «Exceeded soft user limit» — пробовать тот же тяжёлый
  // delegateMessages с полным workspace-контекстом бессмысленно (входной контекст
  // стоит денег, и даже дешёвая модель перевалит за 10 ₽). Для таких случаев —
  // облегчённая версия без buildWorkspaceContextMessages(): только system prompt
  // и сам пользовательский запрос + attachments. Если удалось — модель вернёт код,
  // и applyCodeChanges всё равно запишет его в workspace, где мы его прочитаем.
  async function slimDelegateMessages(id, supportsVision, baseContent, attachments) {
    // Используем SLIM_SYSTEM_PROMPT (≤400 токенов) вместо полного LLM_SYSTEM_PROMPT,
    // чтобы не превышать per-query лимит 0.060₽ на аккаунте VseGPT.
    let listingLine = '';
    try {
      let snap = window._workspaceSnapshot;
      if (!snap) snap = await loadWorkspaceSnapshot({ maxAgeMs: 15000 });
      if (snap && Array.isArray(snap.files) && snap.files.length) {
        // Ограничиваем листинг: только имена файлов, max 300 символов.
        const fileList = snap.files.map(f => f.path).join(', ');
        listingLine = 'Файлы: ' + (fileList.length > 300 ? fileList.slice(0, 300) + '…' : fileList);
      }
    } catch (e) { /* нет листинга — не страшно */ }
    const sysContent = SLIM_SYSTEM_PROMPT + (listingLine ? '\n' + listingLine : '');
    return [
      { role: 'system', content: sysContent },
      { role: 'user', content: await userContentFor(baseContent, attachments, supportsVision) }
    ];
  }

    function looksLikeCodeTask(text) {
    if (!text) return false;
    const t = String(text).toLowerCase();
    return /\b(создай|сделай|сделайте|измени|измените|удали|удалите|переименуй|переименуйте|добавь|добавьте|замени|замените|переделай|переделайте|допиши|допишите|исправь|исправьте|почини|почините|доделай|доделайте|верстай|верстайте|отрисуй|отрисуйте|стилизуй|нарисуй|нужна|нужно|требуется|напиши|пиши|оформи|изменить|закоди|закодируй|закодируйте|стиль|страница|страницу|лэ?ндинг|форму|кнопк|button|сделай так|чтобы был[аои]?|верни|пришли|сверстай|доработай|перепиши|правь|правка|выведи|вывести|форму|форму|стилизац|тёмн|темн|светл|гладк|кругл|блок|секция|hero|меню|footer)\b/.test(t)
      || /\b(create|edit|modify|update|delete|remove|add|build|implement|change|refactor|rewrite|fix|repair|design|style|render|draw)\b/.test(t)
      || /`?\/?[\w.-]+\.(html|css|js|json|jsx|tsx|md)`?/i.test(t);
  }

  function stripCodeFromChat(text, changes) {
    if (!text) return text;
    // Всегда режем fenced-блоки из чата — даже если extractCodeChanges их не
    // распознал (бывает у нестандартных провайдеров / нетипичных форматов).
    // Если файл распознан — дописываем в конец список записанных файлов.
    let out = text.replace(/```[\s\S]*?```/g, '');
    out = out.replace(/\n{3,}/g, '\n\n').trim();
    if (!out) out = 'Готово.';
    const list = changes && changes.length ? changes.map(c => '`' + c.path + '`').join(', ') : '';
    return list ? (out + '\n\n📁 **Записано в workspace**: ' + list + '\n') : out;
  }

  // ── Оркестратор (deepseek-coder как маршрутизатор) ────────────────
  // Список моделей, реально доступных на базовом тарифе vsegpt
  // (gpt-5.4-pro-high, claude-opus-4.6, deepseek-v4-pro и v3.2-alt-thinking
  // требуют upgrade — проверено эмпирически).
  // coding:true = сильные на современном коде/UI/архитектуре (агентская работа).
  // Ростер моделей для авто-оркестратора (VseGPT-базовый тариф).
  //
  // Дешёвые модели ВЫШЕ, дорогие НИЖЕ. Router (deepseek-coder) выбирает
  // по цене-вверху. Vision-фильтр `pickVision` тоже идёт сверху — теперь
  // Sonnet 4.6 H идёт первым при наличии картинки.
  //
  // coding=true  -> сильный современный код/UI/архитектура (агентская работа).
  // tier:
  //   premium  -> Sonnet 4.6 H (дорого, но топ кодинг/vision).
  //   strong   -> Sonnet 4.x (тоже coding-агент, но дешевле премиума).
  //   mid      -> рабочая лошадка для код-тасков.
  //   light    -> для мелких Q&A.
  //   reasoning-> пошаговое планирование.
  // Ordered by cost (ascending) — router prefers cheapest model that can handle the task.
  // Falls back up the list on budget/availability errors (isBudgetOrModelError).
  // Бюджет на один запрос (руб). Жёсткий лимит: один запрос не дороже 0.07₽.
  const BUDGET_RUB = 0.07;
  // Цены prompt/completion в ₽ за 1000 токенов — актуальны для VseGPT.ru.
  // Список урезан: только дешёвые и эффективные модели для кода/UI/vision.
  // Мульти-AI отключён — оркестратор выбирает ОДНУ модель под задачу.
  const BASELINE_ORCHESTRATOR_MODELS = [
    // ── Сверхдёшевые кодеры (выбор по умолчанию для экономии)
    { id: 'amazon/nova-micro-v1',                         tier: 'cheap',  coding: true,  vision: false, prompt: 0.012, completion: 0.03  },
    { id: 'cohere/command-r7b-12-2024',                   tier: 'cheap',  coding: true,  vision: false, prompt: 0.01,  completion: 0.025 },
    { id: 'qwen/qwen3-14b',                               tier: 'cheap',  coding: true,  vision: false, prompt: 0.012, completion: 0.033 },
    // ── Рабочие лошадки для UI/лендингов/mini-app
    { id: 'openai/gpt-4.1-nano',                          tier: 'mid',    coding: true,  vision: false, prompt: 0.015, completion: 0.06  },
    { id: 'google/gemini-2.5-flash-lite',                 tier: 'mid',    coding: true,  vision: false, prompt: 0.015, completion: 0.06  },
    { id: 'mistralai/devstral-small',                     tier: 'mid',    coding: true,  vision: false, prompt: 0.015, completion: 0.045 },
    // ── Мощные кодеры (используются только для сложных задач, дороже)
    { id: 'deepseek/deepseek-coder',                      tier: 'strong', coding: true,  vision: false, prompt: 0.04,  completion: 0.05  },
    { id: 'qwen/qwen-2.5-coder-32b-instruct',             tier: 'strong', coding: true,  vision: false, prompt: 0.05,  completion: 0.05  },
    // ── Vision — для скриншотов и картинок (используются только когда есть изображение)
    { id: 'vis-openai/gpt-5-nano',                        tier: 'vision', coding: true,  vision: true,  prompt: 0.015, completion: 0.12  },
    { id: 'vis-meta-llama/llama-3.2-11b-vision-instruct', tier: 'vision', coding: false, vision: true,  prompt: 0.055, completion: 0.055 },
    // ── Бесплатные (0₽) — только для веб-поиска/фактов, не для генерации кода
    { id: 'perplexity/latest-small-online',               tier: 'free',   coding: false, vision: false, prompt: 0,     completion: 0     },
    { id: 'perplexity/latest-large-online',               tier: 'free',   coding: false, vision: false, prompt: 0,     completion: 0     },
  ];
  // Активный ростер. Инициализируется baseline, потом обновляется через /api/models.
  let ORCHESTRATOR_MODELS = BASELINE_ORCHESTRATOR_MODELS.slice();

  // Авто-сканер каталога VseGPT. Загружает /api/models (бесплатно), фильтрует
  // новые дешёвые сильные текстовые модели, добавляет в ростер, удаляет исчезнувшие.
  // Защищён от мультимодальных и embedding-моделей.
  function refreshOrchestratorModels(catalog) {
    if (!Array.isArray(catalog)) return;
    const textProviders = /^(openai|google|qwen|deepseek|meta-llama|mistralai|anthropic|perplexity|vis-openai|vis-google|vis-meta-llama|vis-qwen|vis-anthropic|amazon|cohere|xai|moonshotai|minimax|xiaomi)/i;
    const bannedPrefixes = ['emb-', 'img-', 'img2', 'txt2', 'tta-', 'tts-', 'stt-', 'utils/', 'text-embedding'];
    const strongFamilies = ['coder', 'code', 'flash', 'nano', 'mini', 'maverick', 'scout', 'sonnet', 'opus', 'reasoner', 'r1', 'large-online', 'small-online', 'vision', 'vl'];
    const scored = catalog
      .filter(m => {
        const id = m.id || '';
        if (!textProviders.test(id)) return false;
        if (bannedPrefixes.some(p => id.toLowerCase().startsWith(p))) return false;
        const p = parseFloat(m.pricing?.prompt || 0);
        const c = parseFloat(m.pricing?.completion || 0);
        return p + c <= 0.25; // дешево
      })
      .map(m => {
        const id = m.id;
        const p = parseFloat(m.pricing?.prompt || 0);
        const c = parseFloat(m.pricing?.completion || 0);
        const feats = m.features || [];
        const hasVision = feats.includes('vision');
        const isCoding = /(coder|code|flash|nano|mini|maverick|scout|sonnet|opus|reasoner|r1)/i.test(id) || feats.includes('tools') || feats.includes('structured');
        const familyScore = strongFamilies.reduce((s, f) => s + (id.toLowerCase().includes(f) ? 1 : 0), 0);
        const score = (isCoding ? 3 : 0) + (hasVision ? 1 : 0) + familyScore - (p + c) * 2;
        return { id, prompt: p, completion: c, vision: hasVision, coding: isCoding, tier: 'mid', score };
      })
      .sort((a, b) => b.score - a.score);
    // Сохраняем baseline-модели наверху, добавляем новые уникальные.
    const baselineIds = new Set(BASELINE_ORCHESTRATOR_MODELS.map(m => m.id));
    const newOnes = scored.filter(m => !baselineIds.has(m.id)).slice(0, 12);
    // Убираем исчезнувшие из baseline, но не трогаем baseline-модели даже если их нет в каталоге
    // (они могли быть временно скрыты). Авто-добавленные удаляем, если их нет в каталоге.
    const catalogIds = new Set(catalog.map(m => m.id));
    const kept = ORCHESTRATOR_MODELS.filter(m => {
      if (baselineIds.has(m.id)) return true; // baseline всегда сохраняем
      return catalogIds.has(m.id); // авто-модели только если есть в каталоге
    });
    // Обновляем цены у всех моделей по актуальному каталогу.
    for (const m of kept) {
      const cat = catalog.find(c => c.id === m.id);
      if (cat && cat.pricing) {
        m.prompt = parseFloat(cat.pricing.prompt || 0);
        m.completion = parseFloat(cat.pricing.completion || 0);
      }
    }
    ORCHESTRATOR_MODELS = kept.concat(newOnes);
    console.log('[orchestrator] ростер обновлён:', ORCHESTRATOR_MODELS.length, 'моделей. Новых:', newOnes.length);
  }

  // Перестраивает записи modelPresets['direct:*'] из текущего ростера ORCHESTRATOR_MODELS,
  // чтобы пользователь мог выбрать конкретную модель вручную из дропдауна.
  function rebuildDirectModelPresets() {
    if (!modelPresets) return;
    // Удаляем устаревшие direct-пресеты
    for (const k of Object.keys(modelPresets)) {
      if (k.startsWith('direct:')) delete modelPresets[k];
    }
    // Добавляем все модели из ростера
    for (const m of ORCHESTRATOR_MODELS) {
      const key = 'direct:' + m.id;
      const cost = ((m.prompt || 0) + (m.completion || 0)).toFixed(3);
      const shortName = m.id.includes('/') ? m.id.split('/')[1] : m.id;
      const provider = m.id.includes('/') ? m.id.split('/')[0] : '';
      modelPresets[key] = {
        name: shortName, label: shortName,
        color: m.vision ? 'pro' : (m.prompt === 0 ? 'economy' : 'standard'),
        desc: (m.vision ? '👁 ' : '') + (m.coding ? '💻 ' : '') + provider + (m.prompt === 0 ? ' · бесплатно' : ' · ~' + cost + '₽/1K'),
        openai: true,
        apiModel: m.id,
        directVision: m.vision
      };
    }
  }

  function estimateCost(modelId, promptTokens, completionTokens) {
    const m = ORCHESTRATOR_MODELS.find(x => x.id === modelId);
    if (!m) return Infinity;
    return ((m.prompt || 0) * promptTokens + (m.completion || 0) * completionTokens) / 1000;
  }

  // Подбирает 2–3 модели. Сначала coding-модели, vision при необходимости.
  function pickModelsUnderBudget(hasImage, budgetRub = BUDGET_RUB, minCount = 2, maxCount = 3) {
    const candidates = ORCHESTRATOR_MODELS.filter(m => isAvailableModel(m.id))
      .filter(m => hasImage ? m.vision : true)
      .filter(m => m.coding)
      .slice(); // копия
    // Предполагаем: prompt ~1500 ток, completion ~1500 ток на старте; потом подгоним max_tokens.
    const assumedPrompt = 1500;
    const assumedCompletion = 1500;
    const picked = [];
    let spent = 0;
    for (const m of candidates) {
      const cost = estimateCost(m.id, assumedPrompt, assumedCompletion);
      if (picked.length >= maxCount) break;
      if (picked.length >= minCount && spent + cost > budgetRub) break;
      if (picked.length < minCount || spent + cost <= budgetRub) {
        picked.push(m.id);
        spent += cost;
      }
    }
    // Если ничего не выбрали — возвращаем самую дешёвую подходящую.
    if (!picked.length && candidates.length) picked.push(candidates[0].id);
    return picked;
  }

  // Вычисляет max_tokens для каждой модели в multi-режиме, чтобы общий completion-расход
  // не превысил лимит. Предполагаем prompt фиксированным.
  function allocateMaxTokens(modelIds, budgetRub = BUDGET_RUB, promptTokens = 1500) {
    const remaining = budgetRub - modelIds.reduce((sum, id) => sum + estimateCost(id, promptTokens, 0), 0);
    if (remaining <= 0) return modelIds.map(() => 256);
    // Распределяем бюджет на completion пропорционально цене completion.
    const rates = modelIds.map(id => {
      const m = ORCHESTRATOR_MODELS.find(x => x.id === id);
      return m && m.completion > 0 ? 1 / m.completion : 1;
    });
    const totalRate = rates.reduce((a, b) => a + b, 0);
    const tokens = modelIds.map((id, i) => {
      const m = ORCHESTRATOR_MODELS.find(x => x.id === id);
      const share = rates[i] / totalRate;
      const completionBudget = remaining * share;
      return Math.max(256, Math.min(4096, Math.floor(completionBudget / (m.completion || 0.001) * 1000)));
    });
    return tokens;
  }

  // Ограничивает max_tokens для одной модели, чтобы запрос уложился в BUDGET_RUB.
  // Используется вместо allocateMaxTokens, т.к. мульти-AI отключён.
  function capMaxTokens(modelId, budgetRub = BUDGET_RUB, promptTokens = 1500) {
    const m = ORCHESTRATOR_MODELS.find(x => x.id === modelId);
    if (!m || !m.completion) return 1024;
    const promptCost = (m.prompt * promptTokens) / 1000;
    const remaining = budgetRub - promptCost;
    if (remaining <= 0) return 256;
    // Vision-модели: картинка жрёт токены, completion ограничиваем жёстче
    // VseGPT enforces a soft per-query price limit before generation. Keep
    // completion conservative; a long prompt already consumes most of 0.07₽.
    const hardCap = m.vision ? 768 : 1024;
    return Math.max(256, Math.min(hardCap, Math.floor((remaining / m.completion) * 1000)));
  }

  function estimatePromptTokens(messages) {
    try {
      // Conservative approximation for text. Base64 image payloads are
      // intentionally counted too, so large images get a small completion
      // budget instead of being rejected by VseGPT pre-flight pricing.
      return Math.max(1, Math.ceil(JSON.stringify(messages || []).length / 4));
    } catch {
      return 1500;
    }
  }

  function budgetedMaxTokens(modelId, messages, requested = 1024) {
    const m = ORCHESTRATOR_MODELS.find(x => x.id === modelId);
    if (!m || !m.completion) return Math.max(128, Math.min(512, requested));
    const promptTokens = estimatePromptTokens(messages);
    const promptCost = (m.prompt * promptTokens) / 1000;
    const remaining = BUDGET_RUB - promptCost;
    if (remaining <= 0) return 128;
    const hardCap = m.vision ? 768 : 1536;
    return Math.max(128, Math.min(hardCap, requested, Math.floor((remaining / m.completion) * 1000)));
  }

  function orchestratorPrompt(mode) {
    const list = ORCHESTRATOR_MODELS.map(m => {
      const tag = m.coding ? '(coding)' : m.tier === 'free' ? '(free)' : m.tier === 'mid' ? '(mid)' : '(light)';
      const extra = m.vision ? '·vision' : '';
      const price = m.prompt === 0 ? '·free' : '';
      return '- ' + m.id + ' ' + tag + (extra ? ' ' + extra : '') + (price ? ' ' + price : '');
    }).join('\n');
    return [
      'ЖЁСТКОЕ ПРАВИЛО: ответ должен состоять ИСКЛЮЧИТЕЛЬНО из одного валидного JSON. Никаких пояснений, размышлений, prose, Markdown-обёрток до или после JSON. Только JSON.',
      '',
      'Ты лёгкий маршрутизатор (gpt-4.1-nano). Реши, что делать с запросом пользователя.',
      '',
      'Правила:',
      '- "direct" ТОЛЬКО для чистого Q&A без кода: приветствие, перевод одной фразы, математика в одно действие, общий факт. Поле answer содержит КРАТКИЙ ответ.',
      '- Любая задача про СОЗДАТЬ / ИЗМЕНИТЬ / УДАЛИТЬ / ОТЛАДИТЬ / ОБЪЯСНИТЬ код/UI/файл/страницу — ОБЯЗАТЕЛЬНО delegate или multi.',
      '- Если в задаче картинка (vision) — обязательно включи модель с меткой ·vision. Лучшие vision-варианты: vis-openai/gpt-5-nano, vis-meta-llama/llama-3.2-11b-vision-instruct.',
      '- Для веб-приложений/лендингов/mini-app — предпочитай mistralai/devstral-small, google/gemini-2.5-flash-pre, deepseek/deepseek-chat.',
      '- Для быстрых/мелких задач — openai/gpt-4.1-nano, google/gemini-2.5-flash-lite или qwen/qwen3-14b.',
      '- Для мощного кода — qwen/qwen3-32b, mistralai/devstral-small, meta-llama/llama-4-scout.',
      '- При нулевом балансе — perplexity/latest-large-online (0₽, GPT-4 class, веб-поиск) или perplexity/latest-small-online (0₽, быстрый).',
      '- Если задача содержит «[🎯 ЦЕЛЬ ОПЕРАЦИИ]» или «⌖ <tag>» — это указатель на конкретный файл. Игнорировать нельзя.',
      '',
      'ВАЖНО: платформа заточена под разработку современных веб-приложений, лендингов, mini-app. По умолчанию delegate или multi. Direct — только для чистого Q&A без кода.',
      '',
      mode === 'auto'
        ? 'Верни ОДИН JSON-объект: {"action":"direct"|"delegate"|"multi", "answer":"...", "model":"<id>", "models":["<id>","<id>"]}. Правила: direct — только для короткого Q&A без кода (поле answer). delegate — одна лучшая модель для задачи. multi — 1–3 модели для сложных/UI/лендингов/миниапсов. Если есть картинка — включи vision-модель. Всё должно уложиться в 0.07₽ на запрос.'
        : 'Верни ОДИН JSON-объект: {"action":"multi","models":["<id>","<id>","<id>"]} — выбери 1–3 id (coding, и vision если есть картинка). Бюджет: 0.07₽ суммарно.',
      '',
      'Без prose. Без тройных бэктиков. Без пояснений. Без "Мы видим, что...". Один JSON от первого до последнего символа.',
      '',
      'Список доступных id:',
      list
    ].join('\n');
  }

  // VseGPT rate-limit: 1 запрос в секунду на весь аккаунт. Глобальный
  // rate-limiter гарантирует, что между любыми исходящими запросами не
  // менее 1.1 секунды — независимо от модели и параллельности.
  let _lastApiCallTime = 0;
  let _apiCallQueue = Promise.resolve();
  async function rateLimitedApiCall(fn) {
    return _apiCallQueue = _apiCallQueue.then(async () => {
      const now = Date.now();
      const elapsed = now - _lastApiCallTime;
      const minInterval = 1100; // 1.1 с запасом под сетевой jitter
      if (elapsed < minInterval) {
        await new Promise(r => setTimeout(r, minInterval - elapsed));
      }
      const result = await fn();
      _lastApiCallTime = Date.now();
      return result;
    });
  }

  async function callOpenAI(model, messages, maxTokens = 1024) {
    return rateLimitedApiCall(async () => {
    const safeMaxTokens = budgetedMaxTokens(model, messages, maxTokens);
    const resp = await fetch('/api/chat/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: safeMaxTokens })
    });
    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.text()).slice(0, 200); } catch {}
      throw new Error('HTTP ' + resp.status + (detail ? ' · ' + detail : ''));
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '', errorMsg = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buf.search(/\r?\n\r?\n/)) !== -1) {
        const event = buf.slice(0, sep);
        buf = buf.slice(sep).replace(/^\r?\n\r?\n/, '');
        for (const rawLine of event.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }
          // Апстрим-ошибка в потоке (например, Rate-limit, e-mail not confirmed и т.п.)
          if (parsed && parsed.error) {
            errorMsg = (parsed.error && (parsed.error.message || parsed.error)) || JSON.stringify(parsed.error);
            continue;
          }
          // Некоторые модели (DeepSeek-V4, gpt-5-mini с включённым reasoning) прячут
          // часть ответа в `reasoning_content`, при этом `content` может быть null.
          // Сливаем оба поля — чтобы роутер/делегат никогда не возвращал пустоту
          // из-за внутреннего reasoning.
          const reasonDelta = parsed.choices?.[0]?.delta?.reasoning_content || '';
          const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
          if (reasonDelta) full += reasonDelta;
          if (delta) full += delta;
        }
      }
    }
    return { text: full, error: errorMsg, model };
    });
  }

  async function runOrchestrator(content, mode, onStep, attachments, history) {
    // Маршрутизатор: deepseek/deepseek-coder — НЕ тратит токены на скрытое «reasoning»
    // (deepseek-coder дешевле и без encrypted reasoning)
    // и не выдавал JSON). Проверено эмпирически через прямой curl.
    const routerModel = 'openai/gpt-4.1-nano'; // 0.015₽/1K, 1M ctx, стабильный JSON
    // Снимок проекта нужен только экспертам и синтезатору — роутер не должен
    // тратить токены на чужой код, его задача только классифицировать запрос.
    const ctx = await buildWorkspaceContextMessages();
    const hasImageAttachment = !!(attachments || []).some(a => a && /^image\//i.test(a.type || ''));
    // Если в сообщении есть картинка, а выбранная модель без vision — поднимаем
    // первую vision-capable из списка. Иначе агент получит «не вижу картинку».
    const pickVision = (id, preferCoding) => {
      if (!hasImageAttachment) return id;
      const cur = ORCHESTRATOR_MODELS.find(m => m.id === id);
      if (cur && cur.vision && isAvailableModel(cur.id)) return id;
      // Берём САМУЮ СИЛЬНУЮ доступную vision-модель из ростера (порядок = сила сверху-вниз).
      // Если доступных vision-моделей нет — оставляем текущую модель: текстовые модели
      // справятся по описанию, а недоступная vision-модель только сломает запрос.
      const candidates = ORCHESTRATOR_MODELS.filter(m => m.vision && isAvailableModel(m.id));
      const alt = (preferCoding ? candidates.find(m => m.coding) || candidates[0] : candidates[0]) || null;
      if (!alt || alt.id === id) return id;
      onStep && onStep('Замена делегата на vision-модель: ' + id + ' → ' + alt.id);
      return alt.id;
    };
    const attachHistory = async () => {
      // Исторические картинки НЕ передаём повторно — они раздувают контекст
      // до 5+ ₽ за запрос. Оставляем только текстовые описания.
      const hist = (history || []).slice(-3);
      return hist.map(m => ({
        role: m.role,
        content: (m.role === 'user' && m.attachments && m.attachments.length)
          ? (m.content || '') + '\n\n[Прикреплено ' + m.attachments.length + ' изображение: ' + m.attachments.map(a => a.name || a.path).join(', ') + ']'
          : m.content
      }));
    };
    const delegateMessages = async (id) => {
      const realId = pickVision(id, true);
      const supportsVision = !!ORCHESTRATOR_MODELS.find(m => m.id === realId)?.vision;
      return [
        { role: 'system', content: COMPACT_SYSTEM_PROMPT + '\n\n(Запрос делегирован оркестратором модели ' + realId + '.)' },
        ...ctx,
        ...(await attachHistory(supportsVision)),
        { role: 'user', content: await userContentFor(content, attachments, supportsVision) }
      ];
    };
    // В режиме Мульти AI не нужен router — сразу запускаем подбор моделей.
    if (mode === 'multi') {
      return await runMulti(content, onStep, attachments, history, hasImageAttachment, routerModel);
    }

    onStep && onStep('Маршрутизация (gpt-4.1-nano)…');
    let routerResp = '';
    let routerR;
    try {
      routerR = await callOpenAI(routerModel, [
        { role: 'system', content: orchestratorPrompt(mode) },
        // The router only classifies the current request. History and project
        // files needlessly increase VseGPT's pre-flight price calculation.
        { role: 'user', content: await userContentFor(content, attachments, false) }
      ], 512);
    } catch (err) {
      onStep && onStep('Маршрутизатор недоступен: ' + err.message);
      return { text: '', error: 'Маршрутизатор gpt-4.1-nano: ' + err.message, model: routerModel };
    }
    if (routerR.error) {
      onStep && onStep('Маршрутизатор: ' + routerR.error);
      return { text: '', error: routerR.error, model: routerModel };
    }
    routerResp = routerR.text;
    let decision = {};
    try {
      const m = routerResp.match(/\{[\s\S]*?\}/);
      decision = JSON.parse(m ? m[0] : routerResp);
    } catch {}
    if (decision.action === 'direct') {
      const directText = (decision.answer && decision.answer.trim()) || routerResp || '';
      // Если задача явно про код, а ответ маршрутизатора — verbose prose
      // ("Мы видим, что...", "Нужно помнить, о какой странице речь...") вместо
      // короткого ответа или блоков кода — это НЕ direct, прокинем в delegate.
      // Расширенный список — ловим и 'verbose leak', и 'agent give-up'-режим,
      // в котором модель вместо конкретного действия пишет «не могу/не указано».
      // Сюда попадают: «Мы получили запрос», «Возможно, подразумевается», «Нет конкретного
      // описания», «Давайте уточним», «без дополнительной информации» и т.д.
      const verboseLeak = /Мы видим|Из файлов видно|Нужно помнить|Привет студент|Давайте разберёмся|Модель\s+\S+\s+недоступна|Повторная попытка на другой|Я рассмотрю|Ниже представлено|Ниже приведён|Мы получили запрос|В сообщении нет|Нет конкретного|Нет описания|Возможно,?\s*подразумевается|Возможно,?\s*имелось в виду|подразумевается последний|Давайте уточним|без дополнительной информации|не могу выполнить|не удалось выполнить|Не удалось выполнить|нужно больше контекста|Мы должны|Скорее всего,?\s*для|Я предлагаю|Поэтому,?\s*нужно|Давайте я|Наша задача|Для этой задачи|Давайте (создам|сделаю|сверстаем)|привет студент/i.test(directText);
      const hasCodeBlock = /```[\s\S]+?(```|$)/.test(directText) || /<!--\s*file:|\/\/\s*file:/.test(directText)
                        || /^<!doctype\s+html/i.test(directText.trim()) || /^<html\b/i.test(directText.trim());
      if (verboseLeak || (looksLikeCodeTask(content) && !hasCodeBlock)) {
        onStep && onStep('Маршрутизатор вернул prose/give-up вместо кода → делегирую сильной модели');
        const firstStrong = ORCHESTRATOR_MODELS.find(m => m.coding) || ORCHESTRATOR_MODELS[0];
        const strongId = pickVision(firstStrong.id, true);
        try {
          const r = await callOpenAI(strongId, await delegateMessages(strongId));
          if (!r.error) {
            // тот же retry-once через coercion, чтобы получить код
            const codeImplied = looksLikeCodeTask(content);
            const rHasCb = /```[\s\S]+?(```|$)/.test(r.text) || /<!--\s*file:|\/\/\s*file:/.test(r.text);
            if (codeImplied && !rHasCb) {
              try {
                const r2 = await callOpenAI(strongId, [
                  ...(await delegateMessages(strongId)),
                  { role: 'user', content: 'PREVIOUS ANSWER HAD NO CODE OR WAS FUZZY PROSE (variant: vezde/poluchili/net-konkretnogo/podrazumevaetsya). Repeat strictly: full code blocks inside triple backticks with "// file: path" or "<!-- file: path -->" on the first line. No thinking-out-loud prose. Only code + one final line. If the target file is unclear, pick the most likely HTML file from the workspace listing above and write its full content with the correct path.' }
                ], capMaxTokens(strongId));
                if (!r2.error && r2.text) return { text: r2.text, model: strongId };
              } catch {}
            }
            return { text: r.text, model: strongId };
          }
        } catch (e) { onStep && onStep('Strong delegate упал: ' + e.message); }
      }
      onStep && onStep('Прямой ответ маршрутизатора');
      return { text: directText, model: routerModel };
    }
    if (decision.action === 'delegate') {
      // Если маршрутизатор не указал модель — берём самую сильную coding-вариант.
      const firstStrong = ORCHESTRATOR_MODELS.find(m => m.coding) || ORCHESTRATOR_MODELS[0];
      const id = pickVision(decision.model || firstStrong.id, true);
      if (!ORCHESTRATOR_MODELS.find(m => m.id === id)) {
        onStep && onStep('Маршрутизатор выбрал неизвестную модель: ' + id + ' — возвращаю прямой ответ');
        return { text: routerResp, model: routerModel };
      }
      onStep && onStep('Делегирование → ' + id);
      let r;
      try { r = await callOpenAI(id, await delegateMessages(id), capMaxTokens(id)); }
      catch (err) {
        onStep && onStep('Делегат ' + id + ' ошибка: ' + err.message);
        return { text: '', error: id + ': ' + err.message, model: id };
      }
      if (r.error) {
        onStep && onStep('Делегат ' + id + ': ' + r.error);
        // Если ошибка «not available / upgrade plan» — заносим модель в чёрный список
        // на сессию и идём по ростеру вниз, пока не найдём доступного.
        const isUnavailable = isBudgetOrModelError(r.error);
        if (isUnavailable) {
          markUnavailable(id);
          const tried = new Set([id]);
          let fallbackId = null, fallbackResp = null;
          for (const m of ORCHESTRATOR_MODELS) {
            if (tried.has(m.id)) continue;
            tried.add(m.id);
            onStep && onStep('Переход → ' + m.id);
            const supportsVision = !!m.vision;
            try {
              // Сначала slim — без workspace-контекста, чтобы не пухнуть выше
              // лимита VseGPT.
              const slim = await slimDelegateMessages(m.id, supportsVision, content, attachments);
              const nr = await callOpenAI(m.id, slim, capMaxTokens(m.id));
              if (!nr.error) { fallbackId = m.id; fallbackResp = nr; break; }
              // Если slim тоже упирается в лимит → пробуем FULL delegateMessages
              // (только если экзек не повторяется дословно).
              if (isBudgetOrModelError(nr.error)) continue;
            } catch (e) { /* keep walking */ }
          }
          if (fallbackId) return { text: fallbackResp.text, model: fallbackId };
        }
        return { text: '', error: id + ': ' + r.error, model: id };
      }
      // Retry-once: если задача про код, а делегат вернул prose без блоков кода,
      // пере-спрашиваем его с жёстким требованием вернуть код.
      const codeImplied = looksLikeCodeTask(content);
      const hasCodeBlock = /```[\s\S]+?(```|$)/.test(r.text) || /<!--\s*file:|\/\/\s*file:|<!--\s*file\s*-->/.test(r.text)
                        || /^<!doctype\s+html/i.test(r.text.trim()) || /^<html\b/i.test(r.text.trim());
      if (codeImplied && !hasCodeBlock) {
        onStep && onStep('Делегат ' + id + ' ответил без кода — повтор с требованием кода…');
        try {
          const forcedMsgs = [
            ...(await delegateMessages(id)),
            { role: 'user', content: 'ПРЕДЫДУЩИЙ ОТВЕТ НЕ СОДЕРЖАЛ КОДА — только prose «опишу что сделаю». Повтори ответ строго в формате: полный блок кода (или несколько) в тройных бэктиках, каждый с пометкой `// file: path` или `<!-- file: path -->` в первой строке, и одно предложение итога. Без планов, без перечислений, без "Главные изменения:". Если ничего не нужно менять — напиши код, который ничего не меняет.' }
          ];
          const r2 = await callOpenAI(id, forcedMsgs, capMaxTokens(id));
          if (!r2.error && r2.text) r = r2;
        } catch (e) { onStep && onStep('Повторный запрос делегата упал: ' + e.message); }
      }
      return { text: r.text, model: id };
    }
    if (decision.action === 'multi') {
      let ids = Array.isArray(decision.models) ? decision.models : [];
      if (hasImageAttachment) ids = ids.map(id => pickVision(id, false));
      ids = ids.filter(id => ORCHESTRATOR_MODELS.find(m => m.id === id)).slice(0, 3);
      return await runMulti(content, onStep, attachments, history, hasImageAttachment, routerModel, ids);
    }
    return { text: '', error: 'Неизвестное действие: ' + decision.action, model: routerModel };
  }

  async function runMulti(content, onStep, attachments, history, hasImageAttachment, routerModel, suggestedIds = null) {
    let ids = Array.isArray(suggestedIds) && suggestedIds.length
      ? suggestedIds.filter(id => ORCHESTRATOR_MODELS.find(m => m.id === id)).slice(0, 3)
      : pickModelsUnderBudget(hasImageAttachment, BUDGET_RUB, 2, 3);
    const estimatedCost = ids.reduce((sum, id) => sum + estimateCost(id, 1500, 1500), 0);
    if (estimatedCost > BUDGET_RUB) {
      onStep && onStep('Router выбрал неподходящие модели → пересобираю');
      ids = pickModelsUnderBudget(hasImageAttachment, BUDGET_RUB, 2, 3);
    }
    const maxTokensList = allocateMaxTokens(ids, BUDGET_RUB, 600); // меньше токенов → ниже expected price
    onStep && onStep('Параллельный опрос моделей…');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const results = await Promise.all(ids.map(async (id, idx) => {
      await sleep(idx * 2500); // 2.5с между запросами — VseGPT rate-limit: 1 req/sec
      try {
        const supportsVision = !!ORCHESTRATOR_MODELS.find(m => m.id === id)?.vision;
        const msgs = await slimDelegateMessages(id, supportsVision, content, attachments);
        const r = await callOpenAI(id, msgs, maxTokensList[idx]);
        if (r.error) return { id, error: r.error };
        return { id, text: r.text };
      } catch (err) {
        return { id, error: err.message };
      }
    }));
    const ok = results.filter(r => r.text && !r.error);
    const failed = results.filter(r => r.error);
    // Жёсткая экономия: режем мусор до того, как он сожжёт синтез.
    // Многие провайдеры на «сделай Next.js» возвращают либо отказ («к сожа-
    // лению, я не могу…»), либо прозу с маркерами файлов без кода. И то, и
    // другое бесполезно как материал для синтеза — отдаём самый длинный
    // «полезный» ответ напрямую вместо ещё одного платного round-trip.
    const REFUSAL_RE = /^\s*(К\s+сожалению[, ]*я\s+(не\s+могу|не\s+в\s+состоянии)|I\s+(can'?t|cannot|won'?t|will\s+not)|Sorry[, ]+I\b|Извините[, ]+я\b|I'?m\s+sorry\b|я\s+(не\s+буду|не\s+стану)\s+|Как\s+(ИИ|LLM)[-\s]?модель)/i;
    const isUsefulResponse = (t) => {
      const s = String(t || '').trim();
      if (s.length < 200) return false;
      // Только маркеры файлов в prose без какого-либо кода — заглушка.
      const onlyMarkers = /^\s*(?:<!--\s*file:|\/\/\s*file:|#\s*file:)[^\n]*$/m.test(s)
                       && !/```|<html|<!doctype|<svg|<\w+/i.test(s);
      if (onlyMarkers) return false;
      if (REFUSAL_RE.test(s)) return false;
      return true;
    };
    const usefulOk = ok.filter(r => isUsefulResponse(r.text));
    if (ok.length && !usefulOk.length) {
      ok.sort((a, b) => b.text.length - a.text.length);
      onStep && onStep('Делегаты вернули отказ/заглушки → отдаю самый длинный ответ напрямую (синтез пропущен)');
      return { text: ok[0].text, model: ok[0].id };
    }
    // Сжимаем ok до полезных, чтобы дальнейший synth/retry не сжигал токены.
    ok.length = 0; ok.push(...usefulOk);
    if (failed.length) {
      failed.forEach(f => { if (isBudgetOrModelError(f.error)) markUnavailable(f.id); });
      onStep && onStep('Часть моделей вернула ошибку: ' + failed.map(f => f.id + ' (' + f.error + ')').join(', '));
    }
    if (!ok.length) {
      return { text: '', error: 'Все модели в multi-опросе упали: ' + failed.map(f => f.id + ' [' + f.error + ']').join('; '), model: ids.join(',') };
    }
    try {
      const allChanges = [];
      for (const r of ok) {
        const ch = extractCodeChanges(r.text);
        if (ch.length) {
          onStep && onStep('Записываю файлы из ' + r.id + ': ' + ch.map(c => c.path).join(', '));
          allChanges.push(...ch);
        }
      }
      if (allChanges.length) await applyCodeChanges(allChanges);
      if (looksLikeCodeTask(content) && !allChanges.length) {
        onStep && onStep('Ни один эксперт не выдал код — повтор одной сильной модели с требованием…');
        const forced = ORCHESTRATOR_MODELS.find(m => m.coding && m.vision) || ORCHESTRATOR_MODELS.find(m => m.coding) || ORCHESTRATOR_MODELS[0];
        try {
          const fr = await callOpenAI(forced.id, [
            ...(await delegateMessages(forced.id)),
            { role: 'user', content: 'ПРЕДЫДУЩИЕ ОТВЕТЫ НЕ СОДЕРЖАЛИ КОДА. Повтори ответ строго в формате: полный блок кода в тройных бэктиках с пометкой `// file: path` или `<!-- file: path -->` в первой строке. Код полностью: HTML+CSS+JS в одном или двух блоках. Минимум prose — одна итоговая строка в конце.' }
          ]);
          if (!fr.error && fr.text) {
            const fch = extractCodeChanges(fr.text);
            if (fch.length) {
              onStep && onStep('Записываю файлы из повтора: ' + fch.map(c => c.path).join(', '));
              const safe = await sanitizeChanges(fch, onStep);
              if (safe.length) await applyCodeChanges(safe);
              ok.push({ id: forced.id, text: fr.text });
            }
          }
        } catch (e) { onStep && onStep('Повтор multi упал: ' + e.message); }
      }
    } catch (e) {
      console.warn('[orchestrator] pre-write failed:', e);
    }
    // Если в multi-опросе выжил только один делегат — синтез не нужен,
    // экономим запрос и не мнём успешный ответ через дорогой round-trip.
    if (ok.length === 1) {
      onStep && onStep('Один делегат успешен → отдаю его ответ напрямую (без синтеза)');
      return { text: ok[0].text, model: ok[0].id };
    }
    const rawBlocks = ok.map(r => '### ' + r.id + '\n' + r.text).join('\n\n---\n\n');
    // VseGPT делает soft pre-flight по (prompt + max_completion). Жёстко
    // урезаем блоки: gpt-4.1-nano берёт ≈0.015₽/1K prompt, а ещё vsegpt
    // принудительно ставит min max_completion ≈700 для этой модели, т.е.
    // completion стоит 0.06₽/1K * 0.7 ≈ 0.042₽. Лимит пользователя 0.07₽
    // → на input остаётся ≈0.028₽ ≈ 1860 токенов ≈ 1700 символов смешанного
    // русского+кода. Поэтому trim ≤1200 символов и системный промпт короткий.
    const MAX_BLOCK_CHARS = 1200;
    const blocks = rawBlocks.length > MAX_BLOCK_CHARS
      ? rawBlocks.slice(0, MAX_BLOCK_CHARS) + '\n\n[… урезано для бюджета …]'
      : rawBlocks;
    const sysForSynth = 'Синтезатор двух ответов. Сохрани все блоки кода с пометкой `// file:` или `<!-- file:-->` КАК ЕСТЬ, не перефразируй. Объедини лучшее в один точный ответ на русском. Не упоминай другие модели. Тон Replit-агент: 2-4 коротких предложения, без вступлений. Формат: что изменено одной строкой через запятую.';
    const userForSynth = 'Запрос:\n' + content + '\n\nОтветы:\n' + blocks;
    const totalInChars = sysForSynth.length + userForSynth.length;
    // Если даже после trim input превышает бюджет — НЕ делаем синтез
    // вообще, отдаём лучший ответ делегата напрямую. Это гарантированно
    // проходит soft-limit, и пользователь получает ответ, а не ошибку.
    if (totalInChars > 1700) {
      onStep && onStep('Синтез: input слишком большой (' + totalInChars + ' символов) → отдаю прямой ответ делегата');
      return { text: ok[0].text, model: ok[0].id };
    }
    const synthMsgs = [
      { role: 'system', content: sysForSynth },
      { role: 'user', content: userForSynth }
    ];
    onStep && onStep('Синтез финального ответа…');
    let synth;
    // VseGPT для gpt-4.1-nano игнорирует max_tokens ниже ~700 (smoke-test
    // показал 2254→700 при max=256). Поэтому сразу передаём 700, а
    // budgetedMaxTokens используется как sanity-cap на случай дороже.
    const synthMax = Math.max(700, budgetedMaxTokens(routerModel, synthMsgs, 700));
    try { synth = await callOpenAI(routerModel, synthMsgs, synthMax); }
    catch (err) {
      onStep && onStep('Синтез упал: ' + err.message);
      return { text: ok[0].text, model: ok[0].id };
    }
    if (synth.error) {
      onStep && onStep('Синтез: ' + synth.error);
      return { text: ok[0].text, error: 'Синтез: ' + synth.error, model: synth.model };
    }
    return { text: synth.text, model: routerModel };
  }

  async function sendMessage() {
    const rawContent = inputEl.value.trim();
    const allAttach = (window.__getPendingAttachments && window.__getPendingAttachments()) || [];
    // ── Сборка текста из select-element chips (виртуальные «⌖ <button>» чипы).
    // Каждый такой чип превращаем в блок `[Selected <tag>]\n​```html\n<outerHTML>​```\
    // и приклеиваем сверху пользовательского текста — чтобы LLM получил outerHTML
    // явно, без inline-кода в textarea (Replit Agent стиль).
    const snippetBlocks = [];
    const attachments = allAttach.filter(a => {
      if (a && a.type === 'select-element' && a.html) {
        const tagLabel = a.name || ('<' + (a.tag || 'div') + '>');
        const target = a.pagePath || '(неизвестно)';
        // Целевой блок-инструкция: модель должна править ТОЛЬКО указанный файл,
        // а пользовательский текст ниже — это действие (удалить / изменить / …).
      snippetBlocks.push(
        '[🎯 ЦЕЛЬ ОПЕРАЦИИ]\n' +
        'Файл-цель: `' + target + '`\n' +
        'Выделенный элемент: ' + tagLabel + '\n' +
        'outerHTML элемента (как он сейчас в файле):\n```html\n' + a.html + '\n```\n' +
        'Править ТОЛЬКО файл `' + target + '`. Не трогать другие файлы в проекте.\n' +
        '[/🎯 ЦЕЛЬ ОПЕРАЦИИ]\n'
      );
      return false;
    }
      return true;
    });
    // Просто текст пользователя — без префикса со списком путей. Файлы уже
    // отрисованы в пузыре сообщения как превью, а их содержимое попадает в
    // модель через workspace-snapshot (system-message). Повторять пути в
    // самом запросе — шум.
    const content = snippetBlocks.concat(rawContent ? [rawContent] : []).join('\n\n');
    if (!content || sending) return;
    // Снимем чипы сразу — повторно слать одни и те же вложения не надо.
    if (attachments.length) {
      window.__renderAttachChips && window.__renderAttachChips([]);
      window.__clearPendingAttachments && window.__clearPendingAttachments();
    }

    const selectedPreset = modelPresets[currentModel] || modelPresets['direct:google/gemini-2.5-flash-lite'] || { name: 'gemini-2.5-flash-lite' };

    // DeepSeek / local LLM работают без WebGPU
    const isApiModel = selectedPreset.openai || selectedPreset.local;
    if (!window.WEBLLM_SUPPORTED && !isApiModel) {
      appendAgentMsg('Для работы чата нужен браузер с WebGPU (Chrome 113+ или Edge) или выберите DeepSeek / Локально.', 0, 'Система', true);
      sending = false;
      sendBtn.disabled = false;
      setStopVisible(false);
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    if (chatAbort) chatAbort.abort();
    chatAbort = new AbortController();
    setStopVisible(true);
    inputEl.value = '';
    autoResize();

    appendUserMsg(content, Date.now(), attachments);
    saveMessages('user', content, { model: currentModel, task: window.WEBLLM_classify?.(content)?.task }, attachments);
    scrollBottom();

    const thinkEl = appendThinking('temp', selectedPreset.name);
    thinkEl.id = 'thinking-stream';

    let modelId;
    let autoInfo = null;
    let decoration = selectedPreset.name;

    try {
      // Choose model: explicit preset for direct models, or auto-pick WebLLM by task.
      if (selectedPreset.openai && currentModel.startsWith('direct:')) {
        modelId = selectedPreset.apiModel || currentModel.replace('direct:', '');
        decoration = selectedPreset.name;
        setActiveModel(modelId, selectedPreset.name);
      } else if (selectedPreset.openai || selectedPreset.local || selectedPreset.router) {
        // API-оркестратор / local backend / preset-router — реальная модель
        // выбирается ниже (runOrchestrator или /api/chat/local). Здесь только
        // создаём заглушку, чтобы блок WebLLM auto-pick ниже не пытался
        // взять модель из пустого MODELS (= []) и не падал с
        // "Cannot read properties of undefined (reading 'key')".
        modelId = currentModel;
        decoration = selectedPreset.name;
      } else {
        autoInfo = (typeof llm.pickAuto === 'function') ? await llm.pickAuto(content) : null;
        if (autoInfo) {
          modelId = autoInfo.model_id;
          decoration = `Авто: ${autoInfo.label}`;
          setActiveModel(modelId, autoInfo.label);
        } else {
          modelId = 'webllm-default';
          decoration = 'WebLLM (локально)';
        }
      }

      const labelEl = thinkEl.querySelector('.status-text');
      updateThinkingModel(thinkEl, decoration);

      const history = await loadHistory();
      let full = '';
      const start = Date.now();

      // Try the chosen model, and on shader-compile failure walk through a chain of
      // progressively lighter models until one compiles or the queue runs out.
      // TVM emits different WGSL kernels per model; some hit driver bugs like
      // "index_kernel" compute-stage errors on integrated / older GPUs.
      const isShaderError = (err) => {
        const s = String(err?.message || err || '');
        return /ShaderModule|index_kernel|Invalid\s*Shader|WGSL|compute stage|GPU/i.test(s);
      };
      const fallbackChainKeys = ['qwen3-1.7b', 'llama-3.2-1b', 'qwen-coder-3b'];
      const fallbackModels = fallbackChainKeys
        .map(k => window.WEBLLM_MODELS?.find((m) => m && m.key === k))
        .filter(Boolean);
      // Build a queue of fallback model_ids, excluding the originally chosen one.
      const fallbackQueue = fallbackModels
        .map(m => m.model_id)
        .filter(id => id !== modelId);
      const triedModelIds = [modelId];

      // ── Local server-side LLM (Transformers.js) ────────────────
      if (selectedPreset.local || currentModel === 'local') {
        if (labelEl) labelEl.textContent = 'Модель загружается на сервере…';
        try {
           const contextMessages = await buildWorkspaceContextMessages();
          const resp = await fetch('/api/chat/local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: COMPACT_SYSTEM_PROMPT },
                ...contextMessages,
                ...history.map(m => ({ role: m.role, content: m.content }))
              ],
              max_tokens: 2048
            }),
            signal: chatAbort ? chatAbort.signal : undefined
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data.error) throw new Error(data.error);
          full = data.reply || '';
          if (full) {
            updateStreaming();
          }
          const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
          // Сначала извлекаем файлы, очищаем пузырь от кода, и только потом
          // рендерим и сохраняем в localStorage — иначе старый код всплывает
          // при reload.
          const lChanges = extractCodeChanges(full);
          if (lChanges.length) {
            await applyCodeChanges(lChanges);
            full = stripCodeFromChat(full, lChanges);
          }
          finalizeStreaming(thinkEl, full, elapsed, decoration, false);
          saveMessages('assistant', full, { model: 'local' });
          sending = false;
          sendBtn.disabled = false;
          return;
        } catch (e) {
          sending = false;
          sendBtn.disabled = false;
          console.error(e);
          finalizeStreaming(thinkEl, 'Ошибка: ' + (e.message || e), 0, 'Локально', true);
          return;
        }
      }

      // ── OpenAI-compatible API: оркестратор (router) или прямой стрим ────
      if (selectedPreset.openai) {
        if (labelEl) labelEl.textContent = 'Внешний API…';
        try {
          // ── Оркестратор (deepseek-coder сам решает: direct / delegate / multi).
          if (selectedPreset.router) {
            const reply = await runOrchestrator(content, selectedPreset.router, (status) => {
              if (labelEl) labelEl.textContent = status;
              // «Переход → model-id» — рендерим только новую модель, без дубля
              // с acti-step и/или телом.
              // Параллельный статус не трогает .model-tag — иначе в живом пузырьке вылезет
              // плашка «⭐ Мульти AI — Параллельный опрос моделей…». Шапка оркестратора
              // и лента шагов уже обновляются на этом же событии.
              if (!/^\s*Параллельный/i.test(status || '')) {
                const m = /^\s*Переход\s*→\s*([^\s..]+)/i.exec(status || '');
                if (m) {
                  updateThinkingModel(thinkEl, m[1]);
                } else {
                  updateThinkingModel(thinkEl, decoration + ' — ' + status);
                }
              }
              updateOrchestratorActiveModel(status);
              activityTracker.push(status);
              scrollBottom();
            }, attachments, history);
            if (reply && reply.error) {
              // Показываем ошибку как содержимое пузыря — иначе выглядит как «пустой ответ».
              const ftxt = String(reply.error);
              if (/doesn't allow input more than|input_too_long|context_length_exceeded|reduce length of your input/i.test(ftxt)) {
                full = '⚠️ Контекст переполнен: выбранная модель не принимает такой объём входных данных.\n\nЧто делать: уменьшите размер прикреплённых картинок или переключитесь в шапке на модель `anthropic/claude-sonnet-4.5-1m` (расширенный контекст).';
              } else {
                full = '⚠️ ' + reply.error;
              }
            } else {
              full = (reply && reply.text) || '';
            }
            // Шапку возвращаем в нормальное AUTO-состояние (модель только что
            // поработала, теперь снова ждёт следующего запроса).
            try { setActiveModel('direct:google/gemini-2.5-flash-lite', 'gemini-2.5-flash-lite'); } catch (_) {}
          } else {
            // ── Прямой SSE-стрим к выбранной модели ────────────────
            // Шлём реальный id модели у провайдера (deepseek-chat / deepseek-reasoner),
            // а не UI-ключ (openai-chat / deepseek-reasoner) — иначе upstream вернёт model-not-found.
            const apiModel = selectedPreset.apiModel || currentModel;
          const contextMessages = await buildWorkspaceContextMessages();
            const resp = await fetch('/api/chat/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: apiModel,
              messages: [
                 { role: 'system', content: COMPACT_SYSTEM_PROMPT },
                ...contextMessages,
                ...await Promise.all(history.slice(-3).map(async (m, i, arr) => {
                  const last = i === arr.length - 1 && m.role === 'user';
                  // Только текущее сообщение отправляем с картинками;
                  // исторические картинки заменяем на текстовое описание,
                  // иначе контекст раздувается до 5+ ₽ за запрос.
                  // directVision:false → модель без vision, не отправляем image_url.
                  const wantsImages = selectedPreset.directVision !== false;
                  const atts = (last && attachments.length && wantsImages) ? attachments : [];
                  const content = atts.length
                    ? await attachImagesToUser(m.content, atts)
                    : ((m.role === 'user' && m.attachments && m.attachments.length)
                        ? (m.content || '') + '\n\n[Прикреплено ' + m.attachments.length + ' изображение: ' + m.attachments.map(a => a.name || a.path).join(', ') + ']'
                        : m.content);
                  return { role: m.role, content };
                }))
              ],
              max_tokens: 700
            }),
            signal: chatAbort ? chatAbort.signal : undefined
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          // SSE-буфер: ивенты могут приходить кусками между чанками, а DeepSeek шлёт \r\n.
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // Режем по границе ивента (пустая строка между \n\n / \r\n\r\n)
            let sep;
            while ((sep = buf.search(/\r?\n\r?\n/)) !== -1) {
              const event = buf.slice(0, sep);
              buf = buf.slice(sep).replace(/^\r?\n\r?\n/, '');
              for (const rawLine of event.split(/\r?\n/)) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                let parsed;
                try { parsed = JSON.parse(data); }
                catch (err) { console.warn('[sse] bad chunk:', data.slice(0, 120), err.message); continue; }
                const delta = parsed.choices?.[0]?.delta?.content
                           || parsed.choices?.[0]?.text
                           || '';
                if (delta) full += delta;
                const finish = parsed.choices?.[0]?.finish_reason;
                if (finish === 'stop' || finish === 'length') break;
              }
            }
          }
          // в конце — добрать остаток буфера на случай последнего ивента без пустой строки
          if (buf.trim()) {
            for (const rawLine of buf.split(/\r?\n/)) {
              const line = rawLine.trim();
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content
                           || parsed.choices?.[0]?.text
                           || '';
                if (delta) full += delta;
              } catch {}
            }
          }
          }
          if (full) updateStreaming();
          const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
          // Извлекаем файлы ДО рендера/save — иначе код всплывает в пузыре
          // и в localStorage.
          const dChanges = extractCodeChanges(full);
          if (dChanges.length) {
            await applyCodeChanges(dChanges);
            full = stripCodeFromChat(full, dChanges);
          }
          finalizeStreaming(thinkEl, full, elapsed, decoration, false);
          saveMessages('assistant', full, { model: currentModel });
        } catch (e) {
          console.error(e);
          finalizeStreaming(thinkEl, 'Ошибка DeepSeek: ' + (e.message || e), 0, decoration, true);
        }
        sending = false;
        sendBtn.disabled = false;
        return;
      }

      // function-объявления (а не const-стрелки), чтобы они были доступны
      // из orchestrator-ветки в этом же try-блоке раньше по тексту, чем они
      // объявлены ниже — иначе TDZ «Cannot access 'updateStreaming' before initialization».
      function updateLoading(report) {
        if (!labelEl) return;
        const pct = report?.progress != null ? ` (${Math.round(report.progress * 100)}%)` : '';
        labelEl.textContent = `Загружаю ${decoration}${pct}…`;
        const bar = thinkEl.querySelector('.load-bar-fill');
        if (bar && report?.progress != null) bar.style.width = `${Math.round(report.progress * 100)}%`;
      }
      function updateStreaming() {
        if (labelEl) labelEl.textContent = `Генерирую ответ… · ${full.length} симв.`;
        replaceStreamingContent(thinkEl, full);
        scrollBottom();
      }

      let exhausted = false;
      while (true) {
        try {
          await llm.ensureEngine(modelId, updateLoading);
          if (labelEl) labelEl.textContent = 'Генерирую ответ…';
          for await (const delta of llm.stream(modelId, history)) {
            full += delta;
            updateStreaming();
          }
          break; // success — exit chain
        } catch (err) {
          if (!isShaderError(err)) throw err;
          // Not a shader error — propagate immediately
          const nextId = fallbackQueue.shift();
          if (!nextId) {
            exhausted = true;
            break;
          }
          const nextModel = fallbackModels.find(m => m.model_id === nextId);
          console.warn('Shader compile failed for', modelId, '— falling back to', nextModel.label);
          if (labelEl) labelEl.textContent = `Compute shader не скомпилировался. Перехожу на ${nextModel.label}…`;
          modelId = nextId;
          decoration = `Tier-${triedModelIds.length}: ${nextModel.label}`;
          setActiveModel(modelId, nextModel.label);
          updateThinkingModel(thinkEl, decoration);
          triedModelIds.push(nextId);
        }
      }

      if (exhausted) {
        const triedList = triedModelIds.map((id, i) => `  • ${i === 0 ? '[auto]' : '[Tier-' + i + ']'} \`${id}\``).join('\n');
        const msg = [
          '🚫 **GPU не поддерживает WGSL compute-shader** — все модели выдали один и тот же shader-ошибку.',
          '',
          'Цепочка попыток:',
          triedList,
          '',
          '**Что можно сделать:**',
          '• Откройте Chrome / Edge Beta ≥ 121 (там свежий WGSL-валидатор)',
          '• Перезапустите Chrome с флагами `--use-angle=vulkan --enable-features=Vulkan,WebGPU`',
          '• Проверьте, что WebGPU включён в `chrome://flags/#enable-webgpu-developer-features`',
          '• Или попробуйте на машине с дискретной NVIDIA / AMD'
        ].join('\n');
        if (labelEl) labelEl.textContent = 'GPU несовместима с WGSL compute';
        throw new Error(msg);
      }

      const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
      const cls = window.WEBLLM_classify?.(content) || {};

      if (window.SupabaseSync?.enabled && currentModel.startsWith('direct:') && autoInfo) {
        window.SupabaseSync.markModelLoaded(modelId, autoInfo.label, autoInfo.vram).catch(() => {});
      }

      // Сначала файлы и очистка пузыря, потом render/save — иначе код
      // всплывает и в чате, и при reload из localStorage.
      const oChanges = extractCodeChanges(full);
      if (oChanges.length) {
        await applyCodeChanges(oChanges);
        full = stripCodeFromChat(full, oChanges);
      }
      finalizeStreaming(thinkEl, full, elapsed, decoration, false);
      saveMessages('assistant', full, { model: modelId, task: cls.task, complexity: cls.complexity });

      sending = false;
      sendBtn.disabled = false;
      setStopVisible(false);
    } catch (e) {
      console.error(e);
      finalizeStreaming(thinkEl, 'Ошибка: ' + (e.message || e), 0, 'Локально', true);
      sending = false;
      sendBtn.disabled = false;
      setStopVisible(false);
    }
  }

  function replaceStreamingContent(bubbleEl, text) {
    let body = bubbleEl.querySelector('.msg-agent-bubble');
    if (!body) {
      body = document.createElement('div');
      body.className = 'msg-agent-bubble';
      const status = bubbleEl.querySelector('.msg-agent-status');
      if (status) status.after(body);
      else bubbleEl.appendChild(body);
    }
    body.innerHTML = renderMarkdown(text);
  }

  function updateThinkingModel(bubbleEl, modelName) {
    const tag = bubbleEl.querySelector('.model-tag');
    if (tag) tag.textContent = modelName;
    else {
      const status = bubbleEl.querySelector('.msg-agent-status');
      if (status) {
        const span = document.createElement('span');
        span.className = 'model-tag';
        span.textContent = modelName;
        status.appendChild(span);
      }
    }
  }

  // Обновляет шапку «Active model» по статус-строке оркестратора, чтобы пользователь
  // видел кто сейчас реально работает (роутер / делегат / синтезатор / мульти),
  // а не застывший «Авто» от момента отправки.
  function updateOrchestratorActiveModel(status) {
    const lab = document.getElementById('activeModelLabel');
    const desc = document.getElementById('activeModelDesc');
    const type = document.getElementById('activeModelType');
    const logo = document.getElementById('modelLogo');
    if (!lab || !status) return;
    const PRETTY = {
      'perplexity/latest-large-online':            'Perplexity Large',
      'perplexity/latest-small-online':            'Perplexity Small',
      'openai/gpt-4.1-nano':                       'GPT-4.1 Nano',
      'vis-openai/gpt-5-nano':                     'GPT-5 Nano 👁',
      'mistralai/devstral-small':                  'Devstral Small',
      'google/gemini-2.5-flash-lite':              'Gemini 2.5 Lite',
      'google/gemini-2.5-flash-pre':               'Gemini 2.5 Flash',
      'qwen/qwen3-32b':                            'Qwen3 32B',
      'qwen/qwen3-14b':                            'Qwen3 14B',
      'mistralai/mistral-small-3.2-24b-instruct':  'Mistral Small 24B',
      'deepseek/deepseek-chat':                    'DeepSeek Chat',
      'meta-llama/llama-4-scout':                  'Llama 4 Scout',
      'amazon/nova-micro-v1':                      'Nova Micro',
      'cohere/command-r7b-12-2024':                'Command R 7B',
      'vis-meta-llama/llama-3.2-11b-vision-instruct': 'Llama Vision 11B 👁',
    };
    const STRENGTHS = {
      'perplexity/latest-large-online':            '🆓 0₽ — GPT-4 класс, веб-поиск, 32K',
      'perplexity/latest-small-online':            '🆓 0₽ — быстрый, веб-поиск, 32K',
      'openai/gpt-4.1-nano':                       '0.015₽/1K — роутер, structured JSON, 1M ctx',
      'vis-openai/gpt-5-nano':                     '0.015₽/1K — GPT-5 Nano + vision 👁, 400K ctx',
      'mistralai/devstral-small':                  '0.015₽/1K — кодер Mistral, tools, 128K',
      'google/gemini-2.5-flash-lite':              '0.015₽/1K — Google, structured, 1M ctx',
      'google/gemini-2.5-flash-pre':               '0.018₽/1K — Google Flash, мощный кодер, 1M ctx',
      'qwen/qwen3-32b':                            '0.015₽/1K — Qwen3 32B, сильный кодер',
      'qwen/qwen3-14b':                            '0.012₽/1K — Qwen3 14B, быстрый, дешёвый',
      'mistralai/mistral-small-3.2-24b-instruct':  '0.015₽/1K — Mistral 24B, tools+structured',
      'deepseek/deepseek-chat':                    '0.03₽/1K — DeepSeek, код и логика, 1M ctx',
      'meta-llama/llama-4-scout':                  '0.022₽/1K — Llama 4 Scout, tools, 328K ctx',
      'amazon/nova-micro-v1':                      '0.012₽/1K — Nova Micro, дешевейший, tools',
      'cohere/command-r7b-12-2024':                '0.01₽/1K — Command R 7B, ультра-дешёвый',
      'vis-meta-llama/llama-3.2-11b-vision-instruct': '0.055₽/1K — Llama Vision 11B 👁, скриншоты',
    };

    const swap = /vision-модель:\s*[^\s··]+\s*→\s*([^\s·]+(?:\.[\w/-]+)?)/i.exec(status);
    const deleg = /Делегирование\s*→\s*([^\s·]+(?:\.[\w/-]+)?)/i.exec(status);
    const writes = /Записываю файлы из\s+([^\s:]+)/i.exec(status);

    let label = null, sub = null, badge = null;
    const id = (swap && swap[1]) || (deleg && deleg[1]) || (writes && writes[1]);
    if (id && PRETTY[id]) {
      label = PRETTY[id];
      badge = /devstral|gpt-oss|qwen3-coder/i.test(id) ? 'Coding'
            : /deepseek-v4|maverick/i.test(id) ? 'Coding'
            : /gemini-2\.5-flash/i.test(id) ? 'Coding'
            : /perplexity.*large/i.test(id) ? 'Free'
            : /perplexity.*small/i.test(id) ? 'Free'
            : /vision|gpt-5-nano|gpt-4o-mini/i.test(id) ? 'Vision'
            : 'Active';
      // Вместо «Делегирование → …» показываем реальные сильные стороны.
      sub = 'Сильные стороны: ' + (STRENGTHS[id] || 'мульти-задачи');
    } else if (/Маршрутизаци/.test(status)) {
      label = 'Маршрутизация'; badge = 'Router';
      sub = 'Сильные стороны: ' + (STRENGTHS['openai/gpt-4.1-nano'] || 'роутер, 1M контекст');
    } else if (/Синтез/.test(status)) {
      label = 'Синтез'; badge = 'Router';
      sub = 'Сильные стороны: ' + (STRENGTHS['openai/gpt-4.1-nano'] || 'роутер, 1M контекст');
    } else if (/часть моделей/i.test(status)) {
      label = 'Мульти AI'; badge = 'Multi';
      sub = 'Сильные стороны: ' + (STRENGTHS['mistralai/devstral-small'] || 'код, UI, лендинги');
    } else {
      return;
    }

    lab.textContent = label;
    if (desc) desc.textContent = sub;
    if (type) {
      type.textContent = badge;
      type.style.background = 'rgba(167,139,250,0.18)';
      type.style.color = '#cbb6ff';
    }
    if (logo) {
      logo.textContent = (label || 'A')[0].toUpperCase();
      logo.style.background = 'linear-gradient(135deg,#a78bfa,#3b82f6)';
      logo.style.boxShadow = '0 0 10px rgba(167,139,250,0.5)';
    }
  }

  function finalizeStreaming(bubbleEl, content, worked, modelName, error) {
    bubbleEl.className = 'msg-agent' + (error ? ' error-bubble' : '');
    setLogoLoading(false);
    hideModelLoader();
    bubbleEl.innerHTML = `
      <div class="msg-agent-status">
        <div class="status-icon">
          <div class="check-icon">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <span>Подтверждение присутствия</span>
        ${modelName ? `<span class="model-tag">${modelName}</span>` : ''}
      </div>
      <div class="acti-final">${activityTracker.steps.length ? activityTimelineHTML(activityTracker.steps, { live: false }) : ''}</div>
      <div class="msg-agent-bubble">${renderMarkdown(content)}</div>
      <div class="worked-label">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1"/>
          <path d="M5 3v2l1.5 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
        Работал ${worked} сек
      </div>`;
    scrollBottom();
    activityTracker.reset();
  }

  async function loadHistory() {
    let all = [];
    if (window.SupabaseSync?.enabled) {
      try { all = await window.SupabaseSync.loadHistory(20); }
      catch (e) { console.warn('Sync loadHistory failed, using local', e); }
    }
    if (!all.length) {
      try { all = JSON.parse(localStorage.getItem('chat_history') || '[]'); }
      catch { all = []; }
    }
    // Не подгружаем dataUrl для исторических картинок — они раздувают контекст.
    // В UI превью всё ещё работает через reloadHistoryAttaches при рендере.
    return all.slice(-20);
  }

  function saveMessages(role, content, meta, attachments) {
    // Always update local cache so we never block on network.
    try {
      const all = JSON.parse(localStorage.getItem('chat_history') || '[]');
      const entry = { role, content };
      // Прикреплённые файлы записываем рядом с сообщением (без dataUrl —
      // он пережимает localStorage на большие картинки). После перезагрузки
      // страница подтянет dataUrl из workspace — см. reloadHistoryAttaches.
      if (role === 'user' && attachments && attachments.length) {
        entry.attachments = attachments.map(a => ({
          path: a.path, name: a.name, type: a.type, size: a.size
        }));
      }
      all.push(entry);
      localStorage.setItem('chat_history', JSON.stringify(all.slice(-40)));
    } catch {}
    // Then mirror to Supabase if configured (fire-and-forget).
    if (window.SupabaseSync?.enabled) {
      window.SupabaseSync.pushMessage(role, content, meta).catch(() => {});
    }
  }

  function clearLocalHistory() {
    localStorage.removeItem('chat_history');
    if (window.SupabaseSync?.enabled) {
      localStorage.removeItem('supabase_session_id');
    }
  }

  function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatTime(ts) {
    const d = new Date(ts), now = new Date(), diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff} сек назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  function scrollBottom() {
    const el = messagesEl;
    if (!el) return;
    // Реплит-агент стиль: всегда подтягиваем чат вниз на программных апдейтах.
    // Несколько setTimeout покрывают:
    //   • позднюю отрисовку картинок / markdown;
    //   • streaming-чанки, дорастающие scrollHeight после первого скролла;
    //   • загрузку истории (часто layout пересчитывается после монтирования).
    const scrollNow = () => {
      try { el.scrollTo({ top: el.scrollHeight, behavior: 'auto' }); } catch {}
    };
    scrollNow();
    [0, 50, 150, 300, 600].forEach(ms => setTimeout(scrollNow, ms));
  }
  function removeEmptyState() { messagesEl.querySelector('.empty-chat')?.remove(); }
  function autoResize() { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + 'px'; }
  function countModels() { return (window.WEBLLM_PRESETS && Object.keys(window.WEBLLM_PRESETS).length) || 0; }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  inputEl.addEventListener('input', autoResize);

  tabs.forEach(tab => tab.addEventListener('click', () => {
    const t = tab.dataset.tab; if (t === 'new') return;
    setRightTab(t);
  }));

  modelSelector.addEventListener('click', e => {
    e.stopPropagation();
    const rect = modelSelector.getBoundingClientRect();
    modelDropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    modelDropdown.style.left = rect.left + 'px';
    modelDropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => modelDropdown.classList.remove('open'));

  let recording = false;
  micBtn.addEventListener('click', () => {
    recording = !recording;
    micBtn.classList.toggle('recording', recording);
    micBtn.title = recording ? 'Остановить' : 'Голосовой ввод';
  });

  planCheck.addEventListener('change', () => {
    document.querySelector('.toggle-label').textContent = planCheck.checked ? 'Планировщик ✓' : 'Планировщик';
  });

  // Re-run preview when user clicks "Run" / Publish / Canvas (no broken reference)
  const switchToPreview = () => {
    if (typeof reloadPreview === 'function') reloadPreview();
    setRightTab('preview');
  };
  document.getElementById('canvasPill')?.addEventListener('click', () => setRightTab('tools'));

  // Project-name dblclick-rename lives in settings panel now (topbar no longer has it)
  const nameEl = document.getElementById('projectName');
  if (nameEl) {
    nameEl.addEventListener('dblclick', () => {
      const input = document.createElement('input');
      input.value = nameEl.textContent;
      input.style.cssText = `background:transparent;border:none;border-bottom:1px solid var(--accent);color:var(--text);font-size:13px;font-weight:500;width:120px;outline:none;`;
      nameEl.replaceWith(input);
      input.focus(); input.select();
      const done = () => {
        const span = document.createElement('span');
        span.id = 'projectName'; span.className = 'project-name'; span.textContent = input.value || 'МойПроект';
        span.title = 'Двойной клик для редактирования';
        input.replaceWith(span);
        span.addEventListener('dblclick', nameEl.ondblclick);
        document.title = span.textContent + ' — Агент';
      };
      input.addEventListener('blur', done);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    });
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      clearLocalHistory();
      messagesEl.innerHTML = '';
      showEmptyState();
    }
  });

  settingsBtn.addEventListener('click', () => settingsPanel.classList.add('open'));
  closeSettings.addEventListener('click', () => settingsPanel.classList.remove('open'));
  document.addEventListener('click', e => { if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) settingsPanel.classList.remove('open'); });

  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanBtn.innerHTML = `<div class="spinner" style="width:12px;height:12px;border-width:1.5px;"></div> Проверка...`;
    scanStatus.textContent = 'Проверяю WebGPU...';
    try {
      const supported = window.WEBLLM_SUPPORTED;
      const presets = (window.WEBLLM_PRESETS && Object.keys(window.WEBLLM_PRESETS).length) || 0;
      modelPresets = window.WEBLLM_PRESETS || {};
      renderModelDropdown();
      renderProviders();
      updateModelDisplay();
      if (supported) {
        scanStatus.innerHTML = `WebGPU поддерживается.<br>Доступно моделей: ${presets}. Скачиваются один раз (1–6 ГБ), потом работают офлайн.`;
      } else {
        scanStatus.innerHTML = 'WebGPU недоступен. Откройте в браузере Chrome 113+ или Edge 113+.';
      }
    } catch (e) {
      scanStatus.textContent = 'Ошибка проверки: ' + e.message;
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = 'Проверить WebGPU';
    }
  });

  // ── Прикрепление файлов / картинок / paste-скриншотов ────────────
  // Поддерживает:
  //   • 📎 «скрепка» — любой файл (открывает обычный file picker)
  //   • 🖼️ «картинка» — только image/* (открывает image picker)
  //   • Ctrl+V — перехватываем только картинки из буфера; текст вставляется обычным путём
  // Все вложения уходят в /workspace/attached/, чипы добавляются над textarea.
  // При отправке текст запроса получает префикс со списком путей; сами файлы
  // модель видит через snapshot, который обновляется сразу после записи.
  (function bindAttachments() {
    const inputBox = document.querySelector('.input-box');
    if (!inputBox) return;

    const filePicker = document.createElement('input');
    filePicker.type = 'file'; filePicker.multiple = true; filePicker.style.display = 'none';
    const imgPicker = document.createElement('input');
    imgPicker.type = 'file'; imgPicker.accept = 'image/*'; imgPicker.multiple = true; imgPicker.style.display = 'none';
    document.body.appendChild(filePicker); document.body.appendChild(imgPicker);

    const chipRow = document.createElement('div');
    chipRow.className = 'attach-chips';
    inputBox.insertBefore(chipRow, inputBox.firstChild);

    const pending = [];

    function safeBase(name) {
      const base = String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
      return (base || 'file').slice(-80);
    }
    function stampPath(name) {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const tag = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${Date.now().toString(36)}`;
      return 'attached/' + tag + '-' + safeBase(name);
    }
    function isImage(p) { return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(p); }
    function fmtSize(n) {
      if (n < 1024) return n + ' Б';
      if (n < 1024 * 1024) return Math.round(n / 1024) + ' КБ';
      return (n / (1024 * 1024)).toFixed(1) + ' МБ';
    }
    function fileToBase64(file) {
      return new Promise((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result || ''));
        rd.onerror = () => rej(rd.error || new Error('read failed'));
        rd.readAsDataURL(file);
      });
    }
    async function uploadOne(file) {
      const path = stampPath(file.name);
      const rawDataUrl = await fileToBase64(file);
      const isImage = /^image\//i.test(file.type || '');
      // Большие картинки сразу ресайзим, чтобы dataUrl не раздувал контекст LLM
      // (см. attachImagesToUser) и не возвращал 216k-chars «input too long».
      let dataUrl = rawDataUrl;
      if (isImage && dataUrl.length > 600000) {
        dataUrl = await downsampleImage(dataUrl, 1280, 0.75);
      }
      const b64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
      const r = await fetch('/api/workspace/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, data: b64 })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
      return {
        path: (j.path || path),
        size: file.size,
        name: file.name,
        type: file.type || '',
        dataUrl: isImage ? dataUrl : null,
        resized: dataUrl.length < rawDataUrl.length
      };
    }
    function render() {
      const list = pending.map((p, i) => {
        if (p.type === 'select-element') {
          // Текст чипа обёрнут в .attach-chip-text — он сжимается и получает
          // ellipsis при длинном имени. Кнопка «×» живёт снаружи, всегда видна.
          return `<span class="attach-chip chip-select" data-i="${i}" title="Выбран: ${escHtml(p.name)}"><span class="attach-chip-text">⌖ ${escHtml(p.name)}</span><button type="button" class="attach-chip-x" data-i="${i}" title="Убрать">×</button></span>`;
        }
        const icon = isImage(p.path) ? '🖼' : '📎';
        const fname = p.path.split('/').pop();
        return `<span class="attach-chip" data-i="${i}" title="${escHtml(p.path)}"><span class="attach-chip-text">${icon} ${escHtml(fname)} <em>${fmtSize(p.size)}</em></span><button type="button" class="attach-chip-x" data-i="${i}" title="Убрать вложение">×</button></span>`;
      }).join('');
      chipRow.innerHTML = list;
      chipRow.querySelectorAll('.attach-chip-x').forEach(b => {
        b.addEventListener('click', () => { pending.splice(Number(b.dataset.i), 1); render(); });
      });
    }
    async function handleFiles(files) {
      const arr = Array.from(files || []);
      for (const f of arr) {
        try {
          const r = await uploadOne(f);
          pending.push(r);
          render();
        } catch (e) {
          const showErr = window.pushConsoleLine || ((t, a) => console[t || 'log'](...a));
          showErr('error', ['Upload failed', f.name, e.message || String(e)]);
        }
      }
      if (pending.length) loadWorkspaceFiles();
    }

    const attachBtn = document.querySelector('.attach-btn');
    const imgBtn = document.querySelector('.img-btn');
    if (attachBtn) attachBtn.addEventListener('click', (e) => { e.preventDefault(); filePicker.click(); });
    if (imgBtn) imgBtn.addEventListener('click', (e) => { e.preventDefault(); imgPicker.click(); });
    filePicker.addEventListener('change', () => { handleFiles(filePicker.files); filePicker.value = ''; });
    imgPicker.addEventListener('change', () => { handleFiles(imgPicker.files); imgPicker.value = ''; });

    // Кнопка «Выбрать элемент» в превью. По клику шлёт в iframe сообщение —
    // там мост (PREVIEW_BRIDGE в server.js) включает режим выбора: курсор
    // crosshair, подсветка под наведением, клик элемента → outerHTML улетает
    // обратно, мы заворачиваем его в HTML-сниппет и кладём в workspace.
    const selectBtn = document.getElementById('selectBtn');
    function postToPreview(msg) {
      const iframe = document.getElementById('previewFrame');
      if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
    }
    function setSelectMode(on) {
      selectBtn?.classList.toggle('is-on', !!on);
      postToPreview({ source: 'agent', type: 'select-mode', on: !!on });
    }
    if (selectBtn) {
      selectBtn.addEventListener('click', () => setSelectMode(!selectBtn.classList.contains('is-on')));
    }
    async function handleElementSelected(detail) {
      try {
        const tag = (detail && detail.tag || 'div').toLowerCase();
        const idAttr = detail && detail.id ? ` id="${String(detail.id).replace(/"/g, '&quot;')}"` : '';
        // Bridge-скрипт превью помечает hover-элемент классом `_sel-outline` /
        // `glitch__sel-outline` — это подсветка, а не реальный класс страницы.
        // Без фильтрации модель видит `<h1._sel-outline>` и считает, что такой
        // класс существует в коде → отказывается редактировать («пользователь
        // не указал файл»). Отфильтровываем и в label, и в передаваемом outerHTML.
        const syntheticClass = /(?:^|_)glitch__?sel[-_]outline$|(?:^|_)sel[-_]outline$/i;
        const filterClassList = (cls) => (cls || '').split(/\s+/)
          .filter(c => c && !syntheticClass.test(c)).join(' ');
        const realClasses = filterClassList(detail && detail.classes);
        const clsAttr = realClasses ? ` class="${realClasses.replace(/"/g, '&quot;')}"` : '';
        const outer = (detail && detail.html) || '';
        const cleanOuter = outer.replace(/\s+class="([^"]*)"/g, (m, cls) => {
          const f = cls.split(/\s+/).filter(c => c && !syntheticClass.test(c)).join(' ');
          return f ? ' class="' + f + '"' : '';
        });
        const safeOuter = cleanOuter.length > 12000 ? cleanOuter.slice(0, 12000) + '\n<!-- …обрезано… -->' : cleanOuter;
        // Где был сделан выбор — это самая важная подсказка агенту: в каком
        // файле редактировать (login.html, index.html, …) иначе он отвечает
        // «пользователь не указал файл».
        const previewFrame = document.getElementById('previewFrame');
        const pagePath = (previewFrame && (previewFrame.getAttribute('src') || previewFrame.src)) || 'preview/';
        const snippet =
          `<!doctype html><meta charset="utf-8"><title>selection</title>` +
          `<style>body{font:13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;background:#0e1117;color:#c9d1d9;padding:18px}` +
          ` .sel-head{opacity:.6;font-size:11px;margin-bottom:10px}` +
          ` .sel-box{border:1px solid #2a313c;border-radius:8px;padding:10px;background:#161b22}</style>` +
          `<div class="sel-head">Выбранный элемент: &lt;${tag}${idAttr}${clsAttr}&gt; <em style="opacity:.5">из ${escHtml(pagePath)}</em></div>` +
          `<div class="sel-box">${safeOuter}</div>`;
        const path = 'attached/' + Date.now().toString(36) + '-selection.html';
        const r = await fetch('/api/workspace/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, data: btoa(unescape(encodeURIComponent(snippet))) })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
        const idShort = detail && detail.id ? '#' + detail.id : '';
        const clsShort = realClasses ? '.' + realClasses.trim().split(/\s+/).join('.') : '';
        const label = '<' + tag + idShort + clsShort + '>';
        const size = new Blob([snippet]).size;
        const pending = (window.__getPendingAttachments && window.__getPendingAttachments()) || [];
        // ── Replit-Agent-стиль: выбранный элемент становится виртуальным
        // attach-chip («⌖ <button> ×») рядом с другими вложениями; в textarea
        // НИЧЕГО не вставляем. outerHTML хранится в .html — он попадёт в
        // user-content автоматически при Send (см. sendMessage).
        pending.push({
          path: (j.path || path),
          size,
          name: label,
          type: 'select-element',
          dataUrl: null,
          html: safeOuter,
          tag, id: detail && detail.id || '', classes: realClasses,
          pagePath
        });
        if (window.__renderAttachChips) window.__renderAttachChips();
        if (window.pushConsoleLine) window.pushConsoleLine('log', ['Выбран ' + label]);
        // ── Короткий визуальный маркер в textarea, чтобы пользователь сразу
        // видел: выделение зафиксировано. Полный outerHTML подтянется в
        // user-content только при Send (см. snippetBlocks в sendMessage) —
        // тут НЕ вставляем, чтобы не превращать поле ввода в помойку кода.
        try {
          const prev = inputEl.value || '';
          // Tag-style: «⌖ <button#id.cls>» — выглядит как вложенный тег/чип.
          const marker = '⌖ ' + label;
          // Дедуп: не пишем тот же тег дважды, и обновляем существующий маркер,
          // если выделили другой элемент.
          const re = /\n?⌖ <[a-z][\w-]*(?:#[\w-]+)?(?:\.[\w.-]+)*>\s*$/i;
          let base = prev;
          if (re.test(base)) base = base.replace(re, '');
          else base = base.replace(/\s+$/, '');
          inputEl.value = (base ? base : '') + (base ? '\n' : '') + marker + '\n';
          autoResize();
          const end = inputEl.value.length;
          inputEl.setSelectionRange(end, end);
          inputEl.focus();
        } catch (_) { /* textarea-edit опционален, чип уже показан */ }
        setSelectMode(false);
      } catch (e) {
        if (window.pushConsoleLine) window.pushConsoleLine('error', ['Selection failed', e.message || String(e)]);
        setSelectMode(false);
      }
    }
    window.addEventListener('message', (e) => {
      const m = e && e.data;
      if (!m || m.source !== 'preview-iframe') return;
      if (m.type === 'element-selected') {
        const args = Array.isArray(m.args) ? m.args : [];
        handleElementSelected({ tag: args[0], html: args[1], id: args[2], classes: args[3] });
      }
    });

    // Ctrl+V: только картинки. Текст вставляется браузером обычным путём.
    document.addEventListener('paste', async (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      let imageFile = null;
      for (const it of items) {
        if (it.kind === 'file' && /^image\//i.test(it.type)) { imageFile = it.getAsFile(); break; }
      }
      if (!imageFile) return;
      e.preventDefault();
      const extFromMime = (m) => {
        const x = /^image\/(png|jpe?g|gif|webp|bmp)$/i.exec(m || '');
        return x ? (x[1].toLowerCase() === 'jpeg' ? 'jpg' : x[1].toLowerCase()) : 'png';
      };
      const fakeName = 'paste-' + Date.now().toString(36) + '.' + extFromMime(imageFile.type);
      try { await handleFiles([new File([imageFile], fakeName, { type: imageFile.type })]); }
      catch (err) { console.warn('[paste] upload failed:', err.message || err); }
    });

    if (attachBtn) attachBtn.title = 'Прикрепить файл (картинку можно вставить через Ctrl+V)';
    if (imgBtn) imgBtn.title = 'Прикрепить изображение (или Ctrl+V)';

    // Хелперы для sendMessage: при отправке чипы очищаются.
    window.__getPendingAttachments = () => pending.slice();
    window.__renderAttachChips = (fresh) => {
      if (Array.isArray(fresh)) {
        pending.length = 0;
        for (const p of fresh) pending.push(p);
        render();
      } else { render(); }
    };
    window.__clearPendingAttachments = () => { pending.length = 0; render(); };
  })();

  // Keep the file tree available to the small chrome helpers below while
  // retaining its private cache and rendering state inside this module.
  window.renderFileTree = renderFileTree;
  loadConfig();
  loadMessages();
  loadWorkspaceFiles();
  setRightTab('preview');
})();
// Wire new Replit-style chrome buttons (Publish / Invite / search) — no-op funcs they exist only for visual parity
document.querySelector('.invite-btn')?.addEventListener('click', () => {
  console.info('[invite] share menu would open here');
});
document.querySelector('.publish-btn')?.addEventListener('click', () => {
  console.info('[publish] deploy workflow would open here');
  if (typeof switchToPreview === 'function') switchToPreview();
});

// Library search filter + Ctrl+Shift+L to toggle right panel
(function wireLibrarySearchAndShortcut() {
  const searchEl = document.getElementById('librarySearch');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      // Re-render the current file list with the new filter
      if (typeof window.__lastFiles !== 'undefined' && Array.isArray(window.__lastFiles)) {
        window.renderFileTree(window.__lastFiles || []);
      } else {
        // If nothing cached, at least re-emit an empty render so the empty state shows
        window.renderFileTree([]);
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l' || e.key === 'К' || e.key === 'к')) {
      e.preventDefault();
      const rp = document.getElementById('rightPanel');
      if (rp) rp.classList.toggle('collapsed');
    }
  });
})();
