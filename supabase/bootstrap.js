// Auto-applies supabase/schema.sql on first startup, idempotent (CREATE ... IF NOT EXISTS).
// Runs as a side effect of starting `server.js` whenever SUPABASE_DB_URL is set.
// SUPABASE_DB_URL is a full Postgres URI of the form:
//   postgresql://postgres:<DB_PASSWORD>@db.<project_ref>.supabase.co:5432/postgres
// Grab it from Supabase dashboard → Project → Settings → Database → Connection string (URI).

const fs = require('fs');
const path = require('path');

let applied = false;
let tried = false;
let errors = null;

async function applySchemaOnce() {
  if (applied) return { alreadyApplied: true };
  if (tried && !applied) return { alreadyAttempted: true, errors };
  tried = true;
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    const known = Object.keys(process.env).filter(k => k.includes('SUPA'));
    console.log('[supabase] SUPABASE_DB_URL not set. Known SUPA* keys:', known);
    return { skipped: true, reason: 'SUPABASE_DB_URL not set', knownKeys: known };
  }

  let Client;
  try {
    ({ Client } = require('pg'));
  } catch (e) {
    return { error: 'pg driver not installed: ' + e.message };
  }

  // Mask password in URL for logging.
  const safeUrl = url.replace(/:[^:@/]+@/, ':***@');
  console.log('[supabase] connecting to', safeUrl);

  // 15-second hard timeout so we never hang the process.
  let timedOut = false;
  const timer = new Promise((_, reject) => setTimeout(() => {
    timedOut = true;
    reject(new Error('connect timeout after 15s'));
  }, 15000));

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000
  });

  try {
    await Promise.race([client.connect(), timer]);
  } catch (e) {
    console.error('[supabase] connect failed:', e.message);
    if (e.code) console.error('[supabase] pg error code:', e.code);
    if (e.stack) console.error('[supabase] stack:', e.stack.split('\n').slice(0, 3).join('\n'));
    errors = e.message;
    try { await client.end(); } catch {}
    return { error: e.message, timedOut };
  }

  // Connectivity verified — now apply schema.
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(Boolean);

  console.log('[supabase] connected; applying', statements.length, 'statements');
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
      } catch (e) {
        if (!/already exists/i.test(String(e.message))) {
          console.error('[supabase] statement ' + (i + 1) + ' failed:', e.message);
          console.error('[supabase] was:', stmt.slice(0, 120));
          throw e;
        }
      }
    }
    applied = true;
    console.log('[supabase] schema applied (' + statements.length + ' statements) ✓');
    return { ok: true, statements: statements.length };
  } catch (e) {
    errors = e.message;
    console.error('[supabase] apply failed:', e.message);
    return { error: e.message };
  } finally {
    try { await client.end(); } catch {}
  }
}

module.exports = { applySchemaOnce, _status: () => ({ applied, tried, errors }) };
