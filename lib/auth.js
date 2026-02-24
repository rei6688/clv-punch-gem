// lib/auth.js — Shared authentication helper (PUNCH_SECRET only)

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const rawSecret = process.env.PUNCH_SECRET;
const secret     = rawSecret ? rawSecret.trim() : null;
const cronSecret = process.env.CRON_SECRET ? process.env.CRON_SECRET.trim() : secret;

function getSecret() { return secret; }

/**
 * Authenticate via X-Secret header or ?secret= query param.
 * If PUNCH_SECRET is not configured → open access.
 */
async function authenticate(req) {
  if (!secret) return; // no PUNCH_SECRET set → open access

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
 * Authenticate cron via Authorization: Bearer token.
 */
async function authenticateCron(req) {
  if (!secret) return;

  const auth  = (req.headers.authorization || '').trim();
  const token = auth.replace(/^Bearer\s+/, '').trim();
  if (!token) throw new Error('missing secret');
  if (token !== cronSecret) throw new Error('invalid cron secret');
}

module.exports = { getSecret, authenticate, authenticateCron };
