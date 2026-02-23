// api/dev-secret.js
// Returns PUNCH_SECRET for auto-auth, or noAuth:true if not configured.

const { getSecret } = require('../lib/auth');

module.exports = function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const secret = getSecret();
    // No PUNCH_SECRET configured → auth is disabled, tell client to skip form
    if (!secret) {
        return res.status(200).json({ ok: true, noAuth: true });
    }

    return res.status(200).json({ ok: true, secret });
}
