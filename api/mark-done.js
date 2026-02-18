const { setPeriodState, getPeriodState } = require('../lib/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey, getCurrentPeriod } = require('../lib/time');
const { kv } = require('@vercel/kv');

const expected = process.env.PUNCH_SECRET || 'Thanhnam0';

// Helper xác thực
function authenticate(req) {
  const hdrSecret = req.headers['x-secret'] || '';
  if (hdrSecret !== expected) throw new Error('invalid secret');
}

module.exports = async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return bad(405, 'method not allowed');
  }

  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return bad(415, 'unsupported content-type. Use application/json');
  }

  try {
    authenticate(req);

    const dateKey = req.body.date || getVietnamDateKey();
    const period = req.body.period || getCurrentPeriod();
    const clear = !!req.body.clear;

    if (period !== 'am' && period !== 'pm') {
      return bad(400, 'invalid period. Must be "am" or "pm"');
    }

    if (clear) {
      // RESET STATE: delete the key from KV
      const key = `punch:day:${dateKey}:${period}`;
      await kv.del(key);
      return ok({ date: dateKey, period, status: 'pending', cleared: true });
    }

    // Mark manual_done
    const metadata = { message: 'Marked done manually via API' };
    await setPeriodState(dateKey, period, 'manual_done', 'api', metadata);

    const periodText = period === 'am' ? 'Punch In (Sáng)' : 'Punch Out (Chiều)';
    await sendChat({
      title: `👌 Đã xác nhận: ${periodText} (Thủ công)`,
      message: `Đã đánh dấu ${periodText} ngày ${dateKey} là ĐÃ XONG.`,
      icon: 'manual',
    });

    return ok({ date: dateKey, period, status: 'manual_done' });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    return bad(500, 'server error', { detail: msg });
  }
}