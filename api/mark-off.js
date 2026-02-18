const { setIsOff, setIsOffRange } = require('../lib/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey } = require('../lib/time');

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

    const { date, startDate, endDate, clear } = req.body;
    const isOff = !clear;

    let chatTitle = '';
    let chatMsg = '';

    if (startDate && endDate) {
      // Range OFF
      await setIsOffRange(startDate, endDate, isOff);
      chatTitle = isOff ? `🚫 Đã đánh dấu OFF dải ngày` : `✅ Đã xóa OFF dải ngày`;
      chatMsg = `${startDate} đến ${endDate}. Hệ thống sẽ ${isOff ? 'KHÔNG chạy' : 'hoạt động lại'}.`;
    } else {
      // Single date
      const dateKey = date || getVietnamDateKey();
      await setIsOff(dateKey, isOff);
      chatTitle = isOff ? `🚫 Đã đánh dấu OFF: ${dateKey}` : `✅ Đã xóa OFF: ${dateKey}`;
      chatMsg = `Cách ngày này, hệ thống sẽ ${isOff ? 'KHÔNG chạy' : 'hoạt động lại bình thường'}.`;
    }

    await sendChat({
      title: chatTitle,
      message: chatMsg,
      icon: 'config',
    });

    return ok({ success: true, isOff });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    return bad(500, 'server error', { detail: msg });
  }
}