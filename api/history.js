// File: api/history.js
// Returns punch history for the last N days by reading KV state for each date.

const { getFullDayState } = require('../lib/kv');
const { getVietnamDateKey, getVietnamTime } = require('../lib/time');
const { authenticate } = require('../lib/auth');

module.exports = async function handler(req, res) {
    const rid = req.headers['x-vercel-id'] || Date.now().toString();
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg, extra = {}) => res.status(code).json({ ok: false, error: msg, requestId: rid, ...extra });

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return bad(405, 'method not allowed');
    }

    try {
        await authenticate(req);

        const days = Math.min(parseInt(req.query.days || '30', 10), 90);
        const now = getVietnamTime();
        const records = [];

        // Fetch last N days in parallel (batches of 10)
        const dateKeys = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dateKeys.push(getVietnamDateKey(d));
        }

        // Batch fetch (10 at a time to avoid KV rate limits)
        const batchSize = 10;
        for (let i = 0; i < dateKeys.length; i += batchSize) {
            const batch = dateKeys.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(dk => getFullDayState(dk)));
            records.push(...results);
        }

        return ok({ days, records });

    } catch (e) {
        const msg = (e && e.message) || 'unknown error';
        if (msg.includes('secret') || msg.includes('session')) return bad(403, msg);
        return bad(500, 'server error', { detail: msg });
    }
}
