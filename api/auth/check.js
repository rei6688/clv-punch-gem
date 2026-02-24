// api/auth/check.js — returns whether PUNCH_SECRET is configured
const { getSecret } = require('../../lib/auth');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const secret = getSecret();
  // No PUNCH_SECRET → open access, no auth needed
  if (!secret) return res.status(200).json({ ok: true, noAuth: true });
  // PUNCH_SECRET is set → client needs to provide it
  return res.status(200).json({ ok: true, needsSecret: true });
};
