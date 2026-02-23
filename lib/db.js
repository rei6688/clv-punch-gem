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

  if (!url) return null;

  if (!_client) {
    _client = createClient({
      url,
      authToken: authToken || undefined,
    });
  }
  return _client;
}

// ── Schema bootstrap (runs once) ─────────────────────────────

async function ensureSchema() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const client = getClient();
    if (!client) return;

    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS swap_overrides (
        date TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK(mode IN ('wfh','wio')),
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS punch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        period TEXT NOT NULL CHECK(period IN ('am','pm')),
        status TEXT NOT NULL,
        punch_time TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
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
async function savePunchResult(dateKey, period, status, punchTime) {
  await ensureSchema();
  const client = getClient();
  if (!client) return;

  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: `INSERT INTO punch_history (date, period, status, punch_time, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [dateKey, period, status, punchTime || null, now],
  });
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
    return JSON.parse(/** @type {string} */ (result.rows[0].value));
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
      settings[/** @type {string} */ (row.key)] = JSON.parse(/** @type {string} */ (row.value));
    } catch {
      // skip malformed entries
    }
  }
  return settings;
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

// ── Low-level helpers for lib/users.js ───────────────────────

async function _exec(sql, args = []) {
  await ensureSchema();
  const client = getClient();
  if (!client) throw new Error('DB not available');
  await client.execute({ sql, args });
}

async function _queryOne(sql, args = []) {
  await ensureSchema();
  const client = getClient();
  if (!client) throw new Error('DB not available');
  const result = await client.execute({ sql, args });
  return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
  saveSwapOverride,
  getSwapOverride,
  getBulkSwapOverrides,
  listSwapHistory,
  savePunchResult,
  saveSetting,
  getSetting,
  getSettings,
  isAvailable,
  _exec,
  _queryOne,
};
