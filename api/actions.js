// Consolidated API: mark-done, mark-off, mark-wfh-today, clear-off
// Routes by 'action' query parameter or body field

const { setPeriodState, setIsOff, setIsOffRange, setDayModeOverride, getTelegramConfig, kv } = require('../lib/kv');
const { saveSwapOverride, deleteSwapOverride, logSystemEvent } = require('../lib/db');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey, getCurrentPeriod } = require('../lib/time');
const { authenticate } = require('../lib/auth');
const { Octokit } = require('@octokit/rest');

const githubPat = process.env.GITHUB_PAT;

const GHA_OWNER = 'rei6868';
const GHA_REPO = 'clv-punch-gem';
const GHA_WORKFLOW_ID = 'wfh-punch.yml';

async function triggerGitHubWorkflow() {
  if (!githubPat) {
    throw new Error('GITHUB_PAT is not configured on Vercel.');
  }
  const octokit = new Octokit({ auth: githubPat });
  try {
    await octokit.actions.createWorkflowDispatch({
      owner: GHA_OWNER,
      repo: GHA_REPO,
      workflow_id: GHA_WORKFLOW_ID,
      ref: 'main',
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Workflow file '${GHA_WORKFLOW_ID}' not found or PAT has wrong permissions.`);
    }
    throw error;
  }
}

async function setWfhOverride(dateKey) {
  const key = `punch:day:${dateKey}:wfh_override`;
  await kv.set(key, true, { ex: 86400 });
}

// Action handlers
const handlers = {
  async markDone(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const dateKey = req.body.date || getVietnamDateKey();
    const period = req.body.period || getCurrentPeriod();
    const clear = !!req.body.clear;

    if (period !== 'am' && period !== 'pm') {
      return bad(400, 'invalid period. Must be "am" or "pm"');
    }

    if (clear) {
      const key = `punch:day:${dateKey}:${period}`;
      await kv.del(key);
      return ok({ date: dateKey, period, status: 'pending', cleared: true });
    }

    const metadata = { message: 'Marked done manually via API' };
    await setPeriodState(dateKey, period, 'manual_done', 'api', metadata);

    const periodText = period === 'am' ? 'Punch In (Sáng)' : 'Punch Out (Chiều)';
    await sendChat({
      title: `👌 Đã xác nhận: ${periodText} (Thủ công)`,
      message: `Đã đánh dấu ${periodText} ngày ${dateKey} là ĐÃ XONG.`,
      icon: 'manual',
    });

    return ok({ date: dateKey, period, status: 'manual_done' });
  },

  async markOff(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { date, startDate, endDate, clear } = req.body;
    const isOff = !clear;

    let chatTitle = '';
    let chatMsg = '';

    if (startDate && endDate) {
      await setIsOffRange(startDate, endDate, isOff);
      chatTitle = isOff ? `🚫 Đã đánh dấu OFF dải ngày` : `✅ Đã xóa OFF dải ngày`;
      chatMsg = `${startDate} đến ${endDate}. Hệ thống sẽ ${isOff ? 'KHÔNG chạy' : 'hoạt động lại'}.`;
      await logSystemEvent('toggle_off', { startDate, endDate, isOff }, 'api').catch(err => console.warn('[markOff] event log skipped:', err.message));
    } else {
      const dateKey = date || getVietnamDateKey();
      await setIsOff(dateKey, isOff);
      chatTitle = isOff ? `🚫 Đã đánh dấu OFF: ${dateKey}` : `✅ Đã xóa OFF: ${dateKey}`;
      chatMsg = `Cách ngày này, hệ thống sẽ ${isOff ? 'KHÔNG chạy' : 'hoạt động lại bình thường'}.`;
      await logSystemEvent('toggle_off', { date: dateKey, isOff }, 'api').catch(err => console.warn('[markOff] event log skipped:', err.message));
    }

    await sendChat({
      title: chatTitle,
      message: chatMsg,
      icon: 'config',
    });

    return ok({ success: true, isOff });
  },

  async markWfhToday(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const dateKey = getVietnamDateKey();
    await setWfhOverride(dateKey);
    await triggerGitHubWorkflow();

    await sendChat({
      title: 'ℹ️ Đã kích hoạt WFH (Sáng)',
      message: `Đã gửi lệnh kích hoạt Punch In (AM) ngay lập tức. Hệ thống cũng sẽ tự động chạy Punch Out (PM) vào khoảng 18:00.`,
      icon: 'info',
    });

    return ok({ triggered: true, override_set: true });
  },

  async swapDay(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { date, toMode } = req.body;
    if (!date || !String(date).match(/^\d{4}-\d{2}-\d{2}$/)) return bad(400, 'invalid or missing date');
    if (toMode !== 'wfh' && toMode !== 'wio') return bad(400, 'toMode must be wfh or wio');

    const dateKey = date;
    const todayKey = getVietnamDateKey();

    // Lưu override — persistent DB + KV cache
    await setDayModeOverride(dateKey, toMode);
    try {
      await saveSwapOverride(dateKey, toMode);
      await logSystemEvent('swap_day', { date: dateKey, toMode }, 'api');
    } catch (dbErr) {
      console.warn('[swapDay] DB persist skipped:', dbErr.message);
    }

    if (toMode === 'wfh') {
      // WIO → WFH: nếu là ngày hôm nay thì kích hoạt GHA luôn
      let autoTriggered = false;
      if (dateKey === todayKey) {
        try {
          await triggerGitHubWorkflow();
          autoTriggered = true;
        } catch (ghaErr) {
          console.warn('[swapDay] GHA trigger skipped:', ghaErr.message);
        }
      }
      await sendChat({
        title: `🔄 Đổi ${dateKey}: WIO → WFH`,
        message: dateKey === todayKey
          ? `Ngày hôm nay (${dateKey}) đã chuyển sang WFH. GHA sẽ tự động Punch.`
          : `Ngày ${dateKey} đã chuyển sang WFH. Hệ thống sẽ tự Punch ngày đó.`,
        icon: 'info',
      });
      return ok({ date: dateKey, toMode, autoTriggered });
    } else {
      // WFH → WIO: chỉ nhắc nhở, không tự punch
      await sendChat({
        title: `🔄 Đổi ${dateKey}: WFH → WIO (Văn phòng)`,
        message: `Ngày ${dateKey} chuyển sang vào VP. Nhớ tự check in thủ công nhé!`,
        icon: 'config',
      });
      return ok({ date: dateKey, toMode, reminder: true });
    }
  },

  async clearOff(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    let dateKey = req.body.date || getVietnamDateKey();
    if (dateKey && !String(dateKey).match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('invalid date format. Use YYYY-MM-DD');
    }

    await setIsOff(dateKey, false);

    const todayKey = getVietnamDateKey();
    const dateText = (dateKey === todayKey) ? `hôm nay (${dateKey})` : `ngày ${dateKey}`;

    await sendChat({
      title: `✅ Đã gỡ OFF: ${dateText}`,
      message: `Hệ thống sẽ hoạt động TRỞ LẠI (nếu được BẬT) cho ${dateText}.`,
      icon: 'success',
    });

    return ok({ date: dateKey, isOff: false });
  },

  async clearSwapOverride(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { date } = req.body;
    if (!date || !String(date).match(/^\d{4}-\d{2}-\d{2}$/)) return bad(400, 'invalid or missing date');

    // Clear KV override (passing null deletes it)
    await setDayModeOverride(date, null);
    // Clear DB override
    try {
      await deleteSwapOverride(date);
      await logSystemEvent('clear_override', { date }, 'api');
    } catch (dbErr) {
      console.warn('[clearSwapOverride] DB delete skipped:', dbErr.message);
    }

    return ok({ date, cleared: true });
  },

  async testTelegram(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const { sendTelegram } = require('../lib/telegram');
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const result = await sendTelegram({
      title: '🧪 Test kết nối từ CLV Punch',
      message: `Telegram bot đã kết nối thành công! ✅\nThời gian: ${now}`,
    });
    if (!result) return bad(400, 'Telegram chưa được cấu hình (token/chatId còn trống)');
    if (result.ok === false) return bad(400, result.description || 'Telegram API error');
    return ok({ sent: true });
  },

  async registerTelegramWebhook(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const config = await getTelegramConfig();
    if (!config || !config.token) return bad(400, 'Token chưa được lưu. Hãy Sync Bot trước.');
    const { webhookUrl } = req.body;
    if (!webhookUrl) return bad(400, 'webhookUrl required');

    const r = await fetch(`https://api.telegram.org/bot${config.token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await r.json();
    if (!data.ok) return bad(400, data.description || 'Telegram setWebhook failed');
    return ok({ webhook: webhookUrl });
  },
};

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
    await authenticate(req);

    const action = req.body.action || 'markDone';
    const handler = handlers[action];

    if (!handler) {
      return bad(400, `unknown action: ${action}. Valid actions: markDone, markOff, markWfhToday, clearOff, swapDay, clearSwapOverride, testTelegram, registerTelegramWebhook`);
    }

    return await handler(req, res, rid);

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    if (msg.includes('unsupported')) return bad(415, msg);
    if (msg.includes('invalid')) return bad(400, msg);
    return bad(500, 'server error', { detail: msg });
  }
};
