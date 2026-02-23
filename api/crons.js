// Consolidated API: cron-check-wfh, cron-reminder, cron-reset
// Routes by 'cron' parameter

const { getIsEnabled, getIsOff, getPeriodState, setPeriodState, getPunchTimes, kv } = require('../lib/kv');
const { getVietnamDateKey, getVietnamTime, isWFHDay, getCurrentPeriod, isWeekend } = require('../lib/time');
const { sendChat } = require('../lib/chat');
const { authenticateCron } = require('../lib/auth');
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

async function getWfhOverride(dateKey) {
  const key = `punch:day:${dateKey}:wfh_override`;
  return kv.get(key);
}

async function sendNotificationWithLock(lockKey, ttl, chatParams) {
  const lock = await kv.get(lockKey);
  if (lock) {
    console.log(`Notification locked (${lockKey}). Skipping.`);
    return { message: 'Skipped: Notification is locked.' };
  }
  await Promise.all([
    sendChat(chatParams),
    kv.set(lockKey, true, { ex: ttl })
  ]);
  return { message: `Sent notification: ${chatParams.title}` };
}

const handlers = {
  async checkWfh(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const dateKey = getVietnamDateKey();
    const now = getVietnamTime();

    const isEnabled = await getIsEnabled();
    if (!isEnabled) {
      return ok({ message: 'Skipped: System is disabled.' });
    }

    const isOff = await getIsOff(dateKey);
    if (isOff) {
      return ok({ message: `Day ${dateKey} is OFF.` });
    }

    const wfhOverride = await getWfhOverride(dateKey);
    if (wfhOverride) {
      return ok({ message: 'WFH override already set.' });
    }

    if (!isWFHDay(now)) {
      return ok({ message: `Not a WFH day (${dateKey}).` });
    }

    await triggerGitHubWorkflow();
    await sendChat({
      title: '✅ Auto kích hoạt WFH',
      message: `Tự động kích hoạt Punch In (AM) cho ngày ${dateKey}.`,
      icon: 'success',
    });

    return ok({ triggered: true });
  },

  async reminder(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const dateKey = getVietnamDateKey();
    const now = getVietnamTime();
    const currentHour = now.getHours();
    const nowMin = currentHour * 60 + now.getMinutes();

    const isEnabled = await getIsEnabled();
    if (!isEnabled) {
      return ok({ message: 'Skipped reminder: System is disabled.' });
    }

    const isOff = await getIsOff(dateKey);

    if (isOff) {
      if (currentHour === 18) {
        const lockKey = `lock:off:${dateKey}`;
        return ok(await sendNotificationWithLock(lockKey, 3600 * 6, {
          title: '🔔 Nhắc nhở (Ngày OFF)',
          message: `Hôm nay (${dateKey}) đã được đánh dấu OFF. Nếu mai đi làm (WFH T3/T4), hãy nhớ BẬT lại hệ thống.`,
          icon: 'config',
        }));
      }
      return ok({ message: `Skipped reminder: Day ${dateKey} is OFF.` });
    }

    if (isWFHDay(now)) {
      const period = (currentHour < 13) ? 'am' : 'pm';
      const state = await getPeriodState(dateKey, period);
      const status = (state && state.status) || 'pending';

      if (status === 'success' || status === 'manual_done') {
        return ok({ message: `Skipped reminder: Period ${period} is already '${status}'.` });
      }

      // Read configurable deadline times (fall back to defaults if not set)
      const savedTimes = await getPunchTimes();
      const amStr = (savedTimes && savedTimes.am) || '08:30';
      const pmStr = (savedTimes && savedTimes.pm) || '20:00';
      const [amH, amM] = amStr.split(':').map(Number);
      const [pmH, pmM] = pmStr.split(':').map(Number);
      const amDeadlineMin = amH * 60 + (amM || 0);
      const pmDeadlineMin = pmH * 60 + (pmM || 0);

      let chatParams = null;
      let lockKey = `lock:${dateKey}:${period}`;
      const lockTTL = 60 * 15;

      if (period === 'am' && currentHour >= 6 && currentHour <= amH) {
        if (nowMin >= amDeadlineMin) {
          lockKey = `lock:${dateKey}:am:final`;
          chatParams = {
            title: '⛔ CẢNH BÁO (AM) - TRỄ DEADLINE',
            message: `Đã ${amStr}. GHA đã thất bại hoặc không chạy. Vui lòng tự Punch In và "Mark DONE" thủ công ngay!`,
            icon: 'failure',
          };
        } else {
          chatParams = {
            title: '🔔 Nhắc nhở Punch In (Sáng)',
            message: `Hệ thống đang ở trạng thái "${status}". Vui lòng kiểm tra, hoặc "Mark DONE" nếu đã làm thủ công.`,
            icon: 'info',
          };
        }
      } else if (period === 'pm' && currentHour >= 18 && currentHour <= pmH) {
        if (nowMin >= pmDeadlineMin) {
          lockKey = `lock:${dateKey}:pm:final`;
          chatParams = {
            title: '⛔ CẢNH BÁO (PM) - TRỄ DEADLINE',
            message: `Đã ${pmStr}. Vui lòng tự Punch Out và "Mark DONE" thủ công ngay!`,
            icon: 'failure',
          };
        } else {
          chatParams = {
            title: '🔔 Nhắc nhở Punch Out (Chiều)',
            message: `Hệ thống đang ở trạng thái "${status}". Vui lòng kiểm tra, hoặc "Mark DONE" nếu đã làm thủ công.`,
            icon: 'info',
          };
        }
      }

      if (chatParams) {
        return ok(await sendNotificationWithLock(lockKey, lockTTL, chatParams));
      }
      return ok({ message: `Skipped WFH reminder: Not in valid time window (Hour: ${currentHour}).` });
    }

    if (isWeekend(now)) {
      return ok({ message: `Skipped: It's the weekend (${dateKey}).` });
    }

    if (currentHour < 10) {
      const lockKey = `lock:office:${dateKey}`;
      return ok(await sendNotificationWithLock(lockKey, 3600 * 12, {
        title: '🏢 Nhắc nhở (Ngày Văn Phòng)',
        message: 'Hôm nay là ngày lên văn phòng. Đừng quên tự check-in nhé!',
        icon: 'info',
      }));
    }

    return ok({ message: `Skipped: No action defined for this time (Hour: ${currentHour}).` });
  },

  async reset(req, res, rid) {
    const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
    const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

    const dateKey = getVietnamDateKey();

    const [isEnabled, isOff] = await Promise.all([
      getIsEnabled(),
      getIsOff(dateKey)
    ]);

    if (!isEnabled) {
      return ok({ message: 'Skipped reset: System is disabled.' });
    }
    if (isOff) {
      return ok({ message: `Skipped reset: Day ${dateKey} is marked as OFF.` });
    }

    if (!isWFHDay()) {
      return ok({ message: `Skipped reset: Not a WFH day (${dateKey}).` });
    }

    await Promise.all([
      setPeriodState(dateKey, 'am', 'pending', 'cron-reset'),
      setPeriodState(dateKey, 'pm', 'pending', 'cron-reset')
    ]);

    return ok({ date: dateKey, status_am: 'pending', status_pm: 'pending' });
  }
};

module.exports = async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'GET' && req.method !== 'POST') {
    return bad(405, 'method not allowed');
  }

  try {
    await authenticateCron(req);

    const cronType = (req.query && req.query.cron) || req.body.cron || 'reminder';
    const handler = handlers[cronType];

    if (!handler) {
      return bad(400, `unknown cron type: ${cronType}. Valid types: checkWfh, reminder, reset`);
    }

    return await handler(req, res, rid);

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret') || msg.includes('session')) return bad(403, msg);
    if (msg.includes('method not allowed')) return bad(405, msg);
    return bad(500, 'cron error', { detail: msg });
  }
};
