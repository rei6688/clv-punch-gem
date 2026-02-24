// File: api/history.js
// Returns punch history for the last N days by reading KV state for each date.

const { getFullDayState } = require('../lib/kv');
const { getPunchHistory } = require('../lib/db');
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

        // Generate date keys for range
        const dateKeys = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dateKeys.push(getVietnamDateKey(d));
        }

        // Get punch history from DB (persistent)
        let dbHistory = [];
        try {
            dbHistory = await getPunchHistory(dateKeys);
        } catch (dbErr) {
            console.warn('[history] DB query failed:', dbErr.message);
        }

        // Build records by merging DB history with KV state
        const dbRecordsByDate = {};
        dbHistory.forEach(entry => {
            if (!dbRecordsByDate[entry.date]) {
                dbRecordsByDate[entry.date] = { am: [], pm: [] };
            }
            dbRecordsByDate[entry.date][entry.period].push(entry);
        });

        // Fetch full day state from KV (for config, off status, etc)
        const records = [];
        const batchSize = 10;
        for (let i = 0; i < dateKeys.length; i += batchSize) {
            const batch = dateKeys.slice(i, i + batchSize);
            const states = await Promise.all(batch.map(dk => getFullDayState(dk)));
            
            // Merge DB history into state
            states.forEach(state => {
                const dbRec = dbRecordsByDate[state.date];
                if (dbRec) {
                    // Use most recent DB entry for each period
                    if (dbRec.am.length > 0) {
                        const latest = dbRec.am[0];
                        state.periods.am = {
                            status: latest.status,
                            recordedPunchTime: latest.punch_time,
                            lastUpdate: new Date(latest.created_at * 1000).toISOString(),
                            source: 'db',
                        };
                    }
                    if (dbRec.pm.length > 0) {
                        const latest = dbRec.pm[0];
                        state.periods.pm = {
                            status: latest.status,
                            recordedPunchTime: latest.punch_time,
                            lastUpdate: new Date(latest.created_at * 1000).toISOString(),
                            source: 'db',
                        };
                    }
                }
            });

            records.push(...states);
        }

        return ok({ days, records });

    } catch (e) {
        const msg = (e && e.message) || 'unknown error';
        if (msg.includes('secret')) return bad(403, msg);
        return bad(500, 'server error', { detail: msg });
    }
}
