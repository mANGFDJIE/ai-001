// Browser → server sync. The browser no longer touches Supabase directly;
// every call below hits /api/sync/* on the same origin which forwards to
// Supabase with the service_role key. When the server says 503 / PGRST205
// (typically because the schema isn't applied yet), the browser fails open
// and the UI keeps working on localStorage.

(function () {
  const SYNC = {
    enabled: false,
    deviceId: null,
    sessionId: null,
    authError: false,

    async init() {
      try {
        const r = await fetch('/api/supabase-status');
        const s = await r.json();
        SYNC.enabled = !!s.admin && !!s.project;
        if (!SYNC.enabled) return;
        SYNC.deviceId = localStorage.getItem('device_id') ||
          (() => {
            const id = crypto.randomUUID();
            localStorage.setItem('device_id', id);
            return id;
          })();
      } catch (e) {
        SYNC.enabled = false;
      }
    },

    async _post(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body)
      });
      if (res.status === 401 || res.status === 403) {
        SYNC.authError = true;
        console.warn('Sync auth rejected:', res.status);
        return null;
      }
      if (res.status === 503) { SYNC.authError = true; return null; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // PGRST205 = "table not found" — schema not yet applied. Disable sync
        // for this session so we stop pinging.
        if (data && data.code === 'PGRST205') {
          console.warn('Supabase schema missing — sync disabled until SQL is applied. Local mode active.');
          SYNC.enabled = false;
          SYNC.authError = true;
        }
        return null;
      }
      return data;
    },

    async ensureSession() {
      if (!SYNC.enabled || SYNC.authError) return null;
      if (SYNC.sessionId) return SYNC.sessionId;
      const cached = localStorage.getItem('supabase_session_id');
      if (cached) { SYNC.sessionId = cached; return cached; }
      const data = await SYNC._post('/api/sync/session', { device_id: SYNC.deviceId });
      if (data?.id) {
        SYNC.sessionId = data.id;
        localStorage.setItem('supabase_session_id', data.id);
        return data.id;
      }
      return null;
    },

    pushMessage(role, content, meta) {
      if (!SYNC.enabled || SYNC.authError) return Promise.resolve();
      return SYNC.ensureSession().then(sid => {
        if (!sid) return;
        return SYNC._post('/api/sync/chat', {
          session_id: sid,
          device_id: SYNC.deviceId,
          role, content,
          model: meta?.model || null,
          task: meta?.task || null,
          complexity: meta?.complexity || null
        });
      }).catch(() => {});
    },

    async loadHistory(limit = 20) {
      if (!SYNC.enabled || SYNC.authError) return [];
      const sid = localStorage.getItem('supabase_session_id');
      if (!sid) return [];
      const data = await SYNC._post('/api/sync/chat/list', { session_id: sid, limit });
      return Array.isArray(data) ? data : [];
    },

    markModelLoaded(modelId, label, vram) {
      if (!SYNC.enabled || SYNC.authError) return Promise.resolve();
      return SYNC._post('/api/sync/model', {
        model_id: modelId, device_id: SYNC.deviceId, label, vram_gb: vram || null
      }).then(() => {}).catch(() => {});
    },

    backupFile(path, content) {
      if (!SYNC.enabled || SYNC.authError) return Promise.resolve();
      return SYNC._post('/api/sync/file', {
        device_id: SYNC.deviceId, path, content
      }).then(() => {}).catch(() => {});
    },

    clearSession() {
      SYNC.sessionId = null;
      localStorage.removeItem('supabase_session_id');
    }
  };

  window.SupabaseSync = SYNC;
})();
