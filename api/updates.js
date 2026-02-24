// Consolidated API: update-config, update-schedule, update-settings
// Routes by 'type' parameter in body

const { setIsEnabled, setSchedule, setTelegramConfig, setPunchTimes } = require('../lib/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamTimestamp } = require('../lib/time');
const { authenticate } = require('../lib/auth');

const handlers = {
  async updateConfig(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { isEnabled } = req.body;
    
    if (typeof isEnabled === 'undefined') {
      return bad(400, 'missing isEnabled in body');
    }

    const enabled = !!isEnabled;
    await setIsEnabled(enabled);

    const title = enabled
      ? '🟢 Hệ thống Auto-Punch: ĐÃ BẬT'
      : '🔴 Hệ thống Auto-Punch: ĐÃ TẮT';
    const message = enabled
      ? 'Hệ thống sẽ tự động chạy (WFH T3/T4) và gửi nhắc nhở.'
      : 'Hệ thống đã bị TẮT. Sẽ không có tự động punch hoặc nhắc nhở nào.';

    await sendChat({
      title: title,
      message: message,
      icon: 'config',
    });

    return ok({ isEnabled: enabled, timestamp: getVietnamTimestamp() });
  },

  async updateSchedule(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { schedule } = req.body;
    if (!schedule) {
      return bad(400, 'schedule data missing');
    }

    await setSchedule(schedule);
    return ok({ success: true });
  },

  async updateSettings(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { telegram, times } = req.body;

    const promises = [];
    if (telegram) promises.push(setTelegramConfig(telegram));
    if (times) promises.push(setPunchTimes(times));

    if (promises.length === 0) {
      return bad(400, 'no settings provided (telegram or times expected)');
    }

    await Promise.all(promises);
    return ok({ success: true });
  }
};

module.exports = async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return bad(405, 'method not allowed');
  }

  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return bad(415, 'unsupported content-type. Use application/json');
  }

  try {
    await authenticate(req);

    const updateType = req.body.type || 'updateConfig';
    const handler = handlers[updateType];

    if (!handler) {
      return bad(400, `unknown update type: ${updateType}. Valid types: updateConfig, updateSchedule, updateSettings`);
    }

    return await handler(req, res, rid);

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('unsupported')) return bad(415, msg);
    if (msg.includes('missing') || msg.includes('invalid')) return bad(400, msg);
    return bad(500, 'server error', { detail: msg });
  }
};
