// lib/users.js — User auth: register, login, sessions
// Uses Turso when available, falls back to in-memory store for local dev.

const crypto = require('crypto');

// ── Password hashing ──────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  return crypto.createHash('sha256').update(password + salt).digest('hex') === hash;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── In-memory fallback ────────────────────────────────────────

const _users    = new Map(); // username → { id, username, password_hash }
const _sessions = new Map(); // token → { user_id, expires_at }
let _nextId = 1;

// ── DB wrapper ────────────────────────────────────────────────

async function dbExec(sql, args = []) {
  const db = require('./db');
  return db._exec(sql, args);
}

async function dbQueryOne(sql, args = []) {
  const db = require('./db');
  return db._queryOne(sql, args);
}

async function isDbAvailable() {
  try {
    const db = require('./db');
    return await db.isAvailable();
  } catch { return false; }
}

// ── Public API ────────────────────────────────────────────────

async function register(username, password) {
  if (!username || !password)    return { ok: false, error: 'Username and password required' };
  if (username.length < 3)       return { ok: false, error: 'Username must be at least 3 characters' };
  if (password.length < 6)       return { ok: false, error: 'Password must be at least 6 characters' };

  const hash = hashPassword(password);
  const now  = Math.floor(Date.now() / 1000);

  if (await isDbAvailable()) {
    try {
      await dbExec(
        `INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`,
        [username, hash, now]
      );
      return { ok: true };
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return { ok: false, error: 'Username already taken' };
      console.warn('[users] DB error in register, using memory fallback:', e.message);
    }
  }

  if (_users.has(username)) return { ok: false, error: 'Username already taken' };
  _users.set(username, { id: _nextId++, username, password_hash: hash });
  return { ok: true };
}

async function login(username, password) {
  if (!username || !password) return { ok: false, error: 'Username and password required' };

  const now     = Math.floor(Date.now() / 1000);
  const expires = now + 60 * 60 * 24 * 30; // 30 days
  const token   = generateToken();

  if (await isDbAvailable()) {
    try {
      const row = await dbQueryOne(
        `SELECT id, password_hash FROM users WHERE username = ?`, [username]
      );
      if (!row) return { ok: false, error: 'Invalid username or password' };
      if (!verifyPassword(password, String(row.password_hash))) {
        return { ok: false, error: 'Invalid username or password' };
      }
      await dbExec(
        `INSERT OR REPLACE INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
        [token, row.id, now, expires]
      );
      return { ok: true, token };
    } catch (e) {
      console.warn('[users] DB error in login, using memory fallback:', e.message);
    }
  }

  const user = _users.get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, error: 'Invalid username or password' };
  }
  _sessions.set(token, { user_id: user.id, expires_at: expires });
  return { ok: true, token };
}

async function verifySession(token) {
  if (!token) return false;
  const now = Math.floor(Date.now() / 1000);

  if (await isDbAvailable()) {
    try {
      const row = await dbQueryOne(
        `SELECT expires_at FROM sessions WHERE token = ?`, [token]
      );
      if (row !== null) return Number(row.expires_at) > now;
    } catch (e) {
      console.warn('[users] DB error in verifySession, using memory fallback:', e.message);
    }
  }

  const s = _sessions.get(token);
  return !!(s && s.expires_at > now);
}

async function hasAnyUser() {
  if (await isDbAvailable()) {
    try {
      const row = await dbQueryOne(`SELECT id FROM users LIMIT 1`, []);
      return row !== null;
    } catch (e) {
      console.warn('[users] DB error in hasAnyUser, using memory fallback:', e.message);
    }
  }
  return _users.size > 0;
}

module.exports = { register, login, verifySession, hasAnyUser };
