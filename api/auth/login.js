// api/auth/login.js
const { login } = require('../../lib/users');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') try { body = JSON.parse(body); } catch { body = {}; }

  const { username, password } = body || {};
  const result = await login(username, password);
  if (!result.ok) return res.status(401).json(result);
  return res.status(200).json({ ok: true, token: result.token });
};
