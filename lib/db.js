// lib/db.js — Persistent storage via Turso (LibSQL/SQLite)
// Falls back gracefully if TURSO env vars are not configured.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { createClient } = require('@libsql/client');

// ── Client singleton ─────────────────────────────────────────

let _client = null;
let _initPromise = null;

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    if (!_global.__DB_WARNED__) {
      console.warn('[db] TURSO_DATABASE_URL not found. Persistence disabled (using KV fallback).');
      _global.__DB_WARNED__ = true;
    }
    return null;
  }

  if (!_client) {
    try {
      _client = createClient({
        url,
        authToken: authToken || undefined,
      });
      console.log('[db] Turso client initialized');
    } catch (e) {
      console.error('[db] Failed to initialize Turso client:', e.message);
      return null;
    }
  }
  return _client;
}

// ── Schema bootstrap (runs once) ─────────────────────────────

async function ensureSchema() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const client = getClient();
    if (!client) return;

    try {
      console.log('[db] Initializing schema...');
      // Use separate execute calls to be more robust and trace errors
      await client.execute(`CREATE TABLE IF NOT EXISTS swap_overrides (
        date TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK(mode IN ('wfh','wio')),
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      );`);

      await client.execute(`CREATE TABLE IF NOT EXISTS punch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        period TEXT NOT NULL CHECK(period IN ('am','pm')),
        status TEXT NOT NULL,
        punch_time TEXT,
        source TEXT DEFAULT 'auto' CHECK(source IN ('auto','manual','telegram')),
        created_at INTEGER NOT NULL
      );`);

      await client.execute(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );`);

      await client.execute(`CREATE TABLE IF NOT EXISTS system_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        user_source TEXT,
        created_at INTEGER NOT NULL
      );`);

      await client.execute(`CREATE INDEX IF NOT EXISTS idx_events_type_time ON system_events(event_type, created_at DESC);`);

      console.log('[db] Schema initialized successfully ✓');
    } catch (err) {
      console.error('[db] Schema initialization FAILED:', err.message);
      _initPromise = null; // Allow retry on next call
      throw err;
    }
  })();

  return _initPromise;
}

// ── Swap Override CRUD ───────────────────────────────────────

/**
 * Save a swap override for a specific date.
 * @param {string} dateKey - YYYY-MM-DD
 * @param {'wfh'|'wio'} mode
 */
async function saveSwapOverride(dateKey, mode) {
  await ensureSchema();
  const client = getClient();
  if (!client) return;

  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: `INSERT OR REPLACE INTO swap_overrides (date, mode, created_at, expires_at)
          VALUES (?, ?, ?, NULL)`,
    args: [dateKey, mode, now],
  });
}

/**
 * Get the swap override for a specific date.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<'wfh'|'wio'|null>}
 */
async function getSwapOverride(dateKey) {
  await ensureSchema();
  const client = getClient();
  if (!client) return null;

  const result = await client.execute({
    sql: `SELECT mode FROM swap_overrides WHERE date = ?`,
    args: [dateKey],
  });

  if (result.rows.length === 0) return null;
  return /** @type {'wfh'|'wio'} */ (result.rows[0].mode);
}

/**
 * Delete a swap override for a specific date.
 * @param {string} dateKey - YYYY-MM-DD
 */
async function deleteSwapOverride(dateKey) {
  await ensureSchema();
  const client = getClient();
  if (!client) return;

  await client.execute({
    sql: `DELETE FROM swap_overrides WHERE date = ?`,
    args: [dateKey],
  });
}

/**
 * Get swap overrides for multiple dates at once.
 * @param {string[]} dateKeys - Array of YYYY-MM-DD strings
 * @returns {Promise<Record<string, 'wfh'|'wio'>>}
 */
async function getBulkSwapOverrides(dateKeys) {
  await ensureSchema();
  const client = getClient();
  if (!client) return {};
  if (dateKeys.length === 0) return {};

  const placeholders = dateKeys.map(() => '?').join(',');
  const result = await client.execute({
    sql: `SELECT date, mode FROM swap_overrides WHERE date IN (${placeholders})`,
    args: dateKeys,
  });

  const overrides = {};
  for (const row of result.rows) {
    overrides[/** @type {string} */ (row.date)] = /** @type {'wfh'|'wio'} */ (row.mode);
  }
  return overrides;
}

/**
 * List recent swap history entries.
 * @param {number} [limit=30]
 * @returns {Promise<Array<{date: string, mode: string, created_at: number}>>}
 */
async function listSwapHistory(limit = 30) {
  await ensureSchema();
  const client = getClient();
  if (!client) return [];

  const result = await client.execute({
    sql: `SELECT date, mode, created_at FROM swap_overrides ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });

  return result.rows.map(row => ({
    date: /** @type {string} */ (row.date),
    mode: /** @type {string} */ (row.mode),
    created_at: /** @type {number} */ (row.created_at),
  }));
}

// ── Punch History ────────────────────────────────────────────

/**
 * Save a punch result entry.
 * @param {string} dateKey - YYYY-MM-DD
 * @param {'am'|'pm'} period
 * @param {string} status
 * @param {string|null} punchTime
 */
async function savePunchResult(dateKey, period, status, punchTime, source = 'auto') {
  await ensureSchema();
  const client = getClient();
  if (!client) return;

  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: `INSERT INTO punch_history (date, period, status, punch_time, source, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [dateKey, period, status, punchTime || null, source, now],
  });
}

/**
 * Get punch history for a specific date range.
 * @param {string[]} dateKeys - Array of YYYY-MM-DD strings
 * @returns {Promise<Array<{date: string, period: string, status: string, punch_time: string|null, source: string, created_at: number}>>}
 */
async function getPunchHistory(dateKeys) {
  await ensureSchema();
  const client = getClient();
  if (!client) return [];
  if (dateKeys.length === 0) return [];

  const placeholders = dateKeys.map(() => '?').join(',');
  const result = await client.execute({
    sql: `SELECT date, period, status, punch_time, source, created_at 
          FROM punch_history 
          WHERE date IN (${placeholders})
          ORDER BY created_at DESC`,
    args: dateKeys,
  });

  return result.rows.map(row => ({
    date: /** @type {string} */ (row.date),
    period: /** @type {string} */ (row.period),
    status: /** @type {string} */ (row.status),
    punch_time: /** @type {string|null} */ (row.punch_time),
    source: /** @type {string} */ (row.source),
    created_at: /** @type {number} */ (row.created_at),
  }));
}

// ── Settings CRUD ────────────────────────────────────────────

/**
 * Save a setting to the DB. Value is stored as JSON string.
 * @param {string} key - e.g. 'isEnabled', 'schedule', 'telegram', 'times'
 * @param {any} value - Will be JSON-stringified
 */
async function saveSetting(key, value) {
  await ensureSchema();
  const client = getClient();
  if (!client) return;

  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
    args: [key, JSON.stringify(value), now],
  });
}

/**
 * Get a setting from the DB.
 * @param {string} key
 * @returns {Promise<any|null>} Parsed JSON value, or null if not found
 */
async function getSetting(key) {
  await ensureSchema();
  const client = getClient();
  if (!client) return null;

  const result = await client.execute({
    sql: `SELECT value FROM settings WHERE key = ?`,
    args: [key],
  });

  if (result.rows.length === 0) return null;
  try {
    return JSON.parse(/** @type {string} */(result.rows[0].value));
  } catch {
    return null;
  }
}

/**
 * Get multiple settings at once.
 * @param {string[]} keys
 * @returns {Promise<Record<string, any>>}
 */
async function getSettings(keys) {
  await ensureSchema();
  const client = getClient();
  if (!client) return {};
  if (keys.length === 0) return {};

  const placeholders = keys.map(() => '?').join(',');
  const result = await client.execute({
    sql: `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    args: keys,
  });

  const settings = {};
  for (const row of result.rows) {
    try {
      settings[/** @type {string} */ (row.key)] = JSON.parse(/** @type {string} */(row.value));
    } catch {
      // skip malformed entries
    }
  }
  return settings;
}

// ── System Events ────────────────────────────────────────────

/**
 * Log a system event (swap, off toggle, settings change, etc).
 * @param {string} eventType - 'swap_day', 'settings_change', 'toggle_off', 'toggle_half', 'clear_override'
 * @param {Object} eventData - Event-specific data
 * @param {string} userSource - 'api', 'telegram', 'cron', 'manual'
 */
async function logSystemEvent(eventType, eventData, userSource = 'api') {
  await ensureSchema();
  const now = Math.floor(Date.now() / 1000);
  const event = { event_type: eventType, event_data: eventData, user_source: userSource, created_at: now };

  // 1. Try Turso DB
  try {
    const client = getClient();
    if (client) {
      await client.execute({
        sql: `INSERT INTO system_events (event_type, event_data, user_source, created_at) VALUES (?, ?, ?, ?)`,
        args: [eventType, JSON.stringify(eventData), userSource, now],
      });
    } else {
      console.warn('[logSystemEvent] Turso client not initialized');
    }
  } catch (e) {
    console.warn('[logSystemEvent] DB log failed:', e.message);
  }

  // 2. Always fallback to KV (limited history)
  try {
    const { kv } = require('./kv');
    const EVENTS_KEY = 'punch:events:limited';
    let events = await kv.get(EVENTS_KEY) || [];
    if (!Array.isArray(events)) events = [];
    events.unshift(event);
    await kv.set(EVENTS_KEY, events.slice(0, 50), { ex: 86400 * 7 }); // Keep 50 events for 7 days
  } catch (e) {
    console.warn('[logSystemEvent] KV fallback failed:', e.message);
  }
}

/**
 * Get recent system events.
 * @param {string[]} [eventTypes] - Filter by event types (optional)
 * @param {number} [limit=100] - Max number of events to return
 * @returns {Promise<Array<{id: number, event_type: string, event_data: any, user_source: string, created_at: number}>>}
 */
async function getSystemEvents(eventTypes = null, limit = 100) {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('DB_NOT_AVAILABLE');
    }

    if (typeof client.execute !== 'function') {
      throw new Error('INVALID_CLIENT');
    }

    await ensureSchema();

    let sql = `SELECT id, event_type, event_data, user_source, created_at 
               FROM system_events`;
    let args = [];

    if (eventTypes && eventTypes.length > 0) {
      const placeholders = eventTypes.map(() => '?').join(',');
      sql += ` WHERE event_type IN (${placeholders})`;
      args = eventTypes;
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    args.push(limit);

    const result = await client.execute({ sql, args });

    return result.rows.map(row => ({
      id: /** @type {number} */ (row.id),
      event_type: /** @type {string} */ (row.event_type),
      event_data: typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data,
      user_source: /** @type {string} */ (row.user_source),
      created_at: /** @type {number} */ (row.created_at),
    }));
  } catch (err) {
    // Fallback to KV
    try {
      const { kv } = require('./kv');
      const events = await kv.get('punch:events:limited') || [];
      if (!eventTypes || eventTypes.length === 0) return events.slice(0, limit);
      return events.filter(e => eventTypes.includes(e.event_type)).slice(0, limit);
    } catch (kvErr) {
      console.warn('[getSystemEvents] KV fallback failed:', kvErr.message);
      return [];
    }
  }
}

/**
 * Check if Turso DB is configured and reachable.
 * @returns {Promise<boolean>}
 */
async function isAvailable() {
  try {
    const client = getClient();
    if (!client) return false;
    await ensureSchema();
    return true;
  } catch (e) {
    console.warn('[db] Turso not available:', e.message);
    return false;
  }
}

module.exports = {
  saveSwapOverride,
  getSwapOverride,
  deleteSwapOverride,
  getBulkSwapOverrides,
  listSwapHistory,
  savePunchResult,
  getPunchHistory,
  saveSetting,
  getSetting,
  getSettings,
  logSystemEvent,
  getSystemEvents,
  isAvailable,
};
