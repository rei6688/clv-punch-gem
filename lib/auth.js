// lib/auth.js — Shared authentication helper
// Supports both legacy PUNCH_SECRET and new session token auth.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const rawSecret = process.env.PUNCH_SECRET;
const secret     = rawSecret ? rawSecret.trim() : null;
const cronSecret = process.env.CRON_SECRET ? process.env.CRON_SECRET.trim() : secret;

function getSecret() { return secret; }

/**
 * Authenticate via X-Session token (new) OR legacy X-Secret / ?secret= (old).
 * If neither PUNCH_SECRET is set AND no users registered → open access.
 */
async function authenticate(req) {
  // 1. Try new session token
  const sessionToken = (req.headers['x-session'] || '').trim();
  if (sessionToken) {
    const { verifySession } = require('./users');
    if (await verifySession(sessionToken)) return; // ✅
    throw new Error('invalid session');
  }

  // 2. Legacy PUNCH_SECRET (no session token sent at all)
  if (!secret) return; // auth disabled — no PUNCH_SECRET and no session → open access

  const hdrSecret = (req.headers['x-secret'] || '').trim();
  const qSecret   = ((req.query && req.query.secret) || '').trim();
  const provided  = hdrSecret || qSecret;

  if (!provided) throw new Error('missing secret');
  if (provided !== secret) {
    console.error(`[auth] FAIL — expected(${secret.length}): "${secret.slice(0,4)}…" | got(${provided.length}): "${provided.slice(0,4)}…"`);
    throw new Error('invalid secret');
  }
}

/**
 * Authenticate cron via Authorization: Bearer.
 * Also accepts X-Session token.
 */
async function authenticateCron(req) {
  const sessionToken = (req.headers['x-session'] || '').trim();
  if (sessionToken) {
    const { verifySession } = require('./users');
    if (await verifySession(sessionToken)) return;
    throw new Error('invalid session');
  }

  if (!secret) return;

  const auth  = (req.headers.authorization || '').trim();
  const token = auth.replace(/^Bearer\s+/, '').trim();
  if (!token) throw new Error('missing secret');
  if (token !== cronSecret) throw new Error('invalid cron secret');
}

module.exports = { getSecret, authenticate, authenticateCron };

