// api/dev-secret.js
// DEV ONLY — returns PUNCH_SECRET so the local dashboard can auto-fill.
// This endpoint is BLOCKED in production (returns 404).

export default function handler(req, res) {
    // Hard-block in production
    if (process.env.VERCEL_ENV === 'production') {
        return res.status(404).json({ ok: false, error: 'Not found' });
    }

    const secret = process.env.PUNCH_SECRET;
    if (!secret) {
        return res.status(500).json({ ok: false, error: 'PUNCH_SECRET not set in env' });
    }

    return res.status(200).json({ ok: true, secret });
}
