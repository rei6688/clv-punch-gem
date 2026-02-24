// GET /api/events?types=swap_day,toggle_off&limit=50
// Returns system events log (swap overrides, off toggles, settings changes, etc.)

const { authenticate } = require('../lib/auth');
const { getSystemEvents } = require('../lib/db');

module.exports = async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return bad(405, 'method not allowed');
  }

  try {
    await authenticate(req);

    const { types, limit } = req.query;
    const eventTypes = types ? types.split(',').map(t => t.trim()) : null;
    const maxLimit = limit ? parseInt(limit, 10) : 100;

    const events = await getSystemEvents(eventTypes, maxLimit);

    return ok({
      events,
      count: events.length,
      filters: { types: eventTypes, limit: maxLimit },
    });
  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('invalid')) return bad(400, msg);
    return bad(500, 'server error');
  }
};
