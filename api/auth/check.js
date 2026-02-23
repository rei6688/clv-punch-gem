// api/auth/check.js — returns setup status and auth state
const { hasAnyUser, verifySession } = require('../../lib/users');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const hasUser = await hasAnyUser();
  if (!hasUser) return res.status(200).json({ ok: true, needsSetup: true });

  const token = (req.headers['x-session'] || '').trim();
  const valid = token ? await verifySession(token) : false;
  return res.status(200).json({ ok: true, needsSetup: false, authenticated: valid });
};
