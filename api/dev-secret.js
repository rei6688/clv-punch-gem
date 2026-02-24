// api/dev-secret.js
// Returns PUNCH_SECRET for auto-auth in LOCAL DEV only.
// On Vercel (prod), this endpoint is disabled.

const { getSecret } = require('../lib/auth');

module.exports = function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Only allow in local dev — never expose secret on Vercel
    if (process.env.VERCEL) {
        return res.status(404).json({ ok: false, error: 'Not available' });
    }

    const secret = getSecret();
    // No PUNCH_SECRET configured → auth is disabled
    if (!secret) {
        return res.status(200).json({ ok: true, noAuth: true });
    }

    return res.status(200).json({ ok: true, secret });
}
