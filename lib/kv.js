require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// In-memory fallback when KV env vars are not configured
// Keep storage on global object so data survives module cache busting in local dev server.
const _global = globalThis;
if (!_global.__CLV_KV_MEM__) _global.__CLV_KV_MEM__ = new Map();
const _mem = _global.__CLV_KV_MEM__;
const MAX_TIMEOUT_MS = 2147483647;

function readEntry(k) {
  const entry = _mem.get(k);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt) {
    _mem.delete(k);
    return null;
  }
  return entry;
}

const kvStub = {
  get: async (k) => {
    const entry = readEntry(k);
    return entry ? entry.value : null;
  },
  set: async (k, v, o) => {
    const expiresAt = o?.ex ? Date.now() + (o.ex * 1000) : null;
    _mem.set(k, { value: v, expiresAt });

    if (expiresAt) {
      const delay = expiresAt - Date.now();
      if (delay > 0 && delay <= MAX_TIMEOUT_MS) {
        setTimeout(() => {
          const current = _mem.get(k);
          if (current && current.expiresAt && Date.now() >= current.expiresAt) {
            _mem.delete(k);
          }
        }, delay);
      }
    }

    return 'OK';
  },
  del: async (k) => {
    _mem.delete(k);
    return 1;
  },
};

let kv;
try {
  if (!process.env.KV_REST_API_URL) throw new Error('KV not configured');
  kv = require('@vercel/kv').kv;
} catch (e) {
  if (process.env.NODE_ENV !== 'test') console.warn('[kv] Not configured — using in-memory fallback');
  kv = kvStub;
}

const { getVietnamDateKey } = require('./time');

// --- Định nghĩa Key ---

/**
 * Key lưu trạng thái BẬT/TẮT chung của hệ thống.
 * @returns {string}
 */
const configKey = () => `punch:config:isEnabled`;

/**
 * Key lưu trạng thái OFF (nghỉ) cho một ngày cụ thể.
 * @param {string} dateKey - Định dạng YYYY-MM-DD
 * @returns {string}
 */
const offDayKey = (dateKey) => `punch:day:${dateKey}:off`;

/**
 * Key lưu trạng thái của một phiên (sáng/chiều) trong ngày.
 * @param {string} dateKey - Định dạng YYYY-MM-DD
 * @param {'am' | 'pm'} period - 'am' hoặc 'pm'
 * @returns {string}
 */
const periodStateKey = (dateKey, period) => `punch:day:${dateKey}:${period}`;

// --- Hàm đọc/ghi ---

/**
 * Lấy trạng thái BẬT/TẮT chung.
 * Tries Turso first, falls back to KV.
 * @returns {Promise<boolean>}
 */
async function getIsEnabled() {
  try {
    const db = require('./db');
    const val = await db.getSetting('isEnabled');
    if (val !== null) return !!val;
  } catch (e) { /* DB not available — fall through */ }
  const isEnabled = await kv.get(configKey());
  return isEnabled === null ? true : !!isEnabled; // Mặc định là BẬT nếu chưa set
}

/**
 * Set trạng thái BẬT/TẮT chung.
 * Writes to both Turso (persistent) and KV (cache).
 * @param {boolean} isEnabled
 */
async function setIsEnabled(isEnabled) {
  try {
    const db = require('./db');
    await db.saveSetting('isEnabled', isEnabled);
  } catch (e) { /* DB not available — KV only */ }
  return kv.set(configKey(), isEnabled);
}

/**
 * Kiểm tra xem một ngày có bị đánh dấu OFF không.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
async function getIsOff(dateKey) {
  const isOff = await kv.get(offDayKey(dateKey));
  return !!isOff;
}

/**
 * Đánh dấu OFF/Clear OFF cho một ngày.
 * @param {string} dateKey - YYYY-MM-DD
 * @param {boolean} isOff
 */
async function setIsOff(dateKey, isOff) {
  if (isOff) {
    // Set OFF, cho TTL 3 ngày (tự xóa sau 3 ngày)
    return kv.set(offDayKey(dateKey), true, { ex: 86400 * 3 });
  } else {
    // Clear OFF
    return kv.del(offDayKey(dateKey));
  }
}

/**
 * Đánh dấu OFF cho một dải ngày.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {boolean} isOff
 */
async function setIsOffRange(startDate, endDate, isOff) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const dates = [];

  let curr = new Date(start);
  while (curr <= end) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    curr.setDate(curr.getDate() + 1);
  }

  const promises = dates.map(dk => setIsOff(dk, isOff));
  return Promise.all(promises);
}

/**
 * Lấy trạng thái của một phiên (sáng/chiều).
 * @param {string} dateKey - YYYY-MM-DD
 * @param {'am' | 'pm'} period
 * @returns {Promise<{status: string, lastUpdate: string, source: string, [key: string]: any} | null>}
 */
async function getPeriodState(dateKey, period) {
  return kv.get(periodStateKey(dateKey, period));
}

/**
 * Cập nhật trạng thái cho một phiên.
 * @param {string} dateKey - YYYY-MM-DD
 * @param {'am' | 'pm'} period
 * @param {'pending' | 'success' | 'fail' | 'manual_done'} status
 * @param {string} source - 'gha' | 'cron' | 'shortcut' | 'api'
 * @param {Object} metadata - Dữ liệu bổ sung (ví dụ: imageUrl, message)
 */
async function setPeriodState(dateKey, period, status, source, metadata = {}) {
  const { getVietnamTimestamp } = require('./time'); // Tránh circular dependency

  const newState = {
    status,
    source,
    lastUpdate: getVietnamTimestamp(),
    ...metadata,
  };

  // Persist to DB for long-term storage (except pending resets)
  if (status !== 'pending') {
    try {
      const db = require('./db');
      const punchTime = metadata.recordedPunchTime || null;
      await db.savePunchResult(dateKey, period, status, punchTime, source);
    } catch (dbErr) {
      console.warn('[setPeriodState] DB persist skipped:', dbErr.message);
    }
  }

  // Set state in KV cache with TTL 3 days
  return kv.set(periodStateKey(dateKey, period), newState, { ex: 86400 * 3 });
}

// --- Schedule & Settings Keys ---
const scheduleKey = () => `punch:config:schedule`;
const telegramKey = () => `punch:config:telegram`;
const timesKey = () => `punch:config:times`;

async function getSchedule() {
  const defaultSchedule = { 0: 'off', 1: 'wfh', 2: 'wfh', 3: 'wfh', 4: 'wfh', 5: 'wfh', 6: 'off' };
  try {
    const db = require('./db');
    const val = await db.getSetting('schedule');
    if (val && typeof val === 'object') return val;
  } catch (e) { /* DB not available — fall through */ }
  const s = await kv.get(scheduleKey());
  return (s && typeof s === 'object') ? s : defaultSchedule;
}
async function setSchedule(schedule) {
  try {
    const db = require('./db');
    await db.saveSetting('schedule', schedule);
  } catch (e) { /* DB not available — KV only */ }
  return kv.set(scheduleKey(), schedule);
}
async function getTelegramConfig() {
  try {
    const db = require('./db');
    const val = await db.getSetting('telegram');
    if (val && val.token) return val;
  } catch (e) { /* DB not available — fall through */ }

  const kvVal = await kv.get(telegramKey());
  if (kvVal && kvVal.token) return kvVal;

  // Fallback to Env Vars if DB/KV is empty
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID
    };
  }
  return null;
}
async function setTelegramConfig(telegram) {
  try {
    const db = require('./db');
    await db.saveSetting('telegram', telegram);
  } catch (e) { /* DB not available — KV only */ }
  return kv.set(telegramKey(), telegram);
}
async function getPunchTimes() {
  try {
    const db = require('./db');
    const val = await db.getSetting('times');
    if (val !== null) return val;
  } catch (e) { /* DB not available — fall through */ }
  return kv.get(timesKey());
}
async function setPunchTimes(times) {
  try {
    const db = require('./db');
    await db.saveSetting('times', times);
  } catch (e) { /* DB not available — KV only */ }
  return kv.set(timesKey(), times);
}

/**
 * Key lưu mode override cho một ngày (wfh / wio).
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {string}
 */
const modeOverrideKey = (dateKey) => `punch:day:${dateKey}:mode_override`;

/**
 * Set mode override cho một ngày cụ thể.
 * Writes to both Turso DB (persistent) and KV (cache, 30-day TTL).
 * @param {string} dateKey - YYYY-MM-DD
 * @param {'wfh'|'wio'|null} mode - null để xoá override
 */
async function setDayModeOverride(dateKey, mode) {
  if (!mode) return kv.del(modeOverrideKey(dateKey));
  // KV as cache with 30-day TTL (was 7 days)
  return kv.set(modeOverrideKey(dateKey), mode, { ex: 86400 * 30 });
}

/**
 * Đọc mode override cho một ngày.
 * Tries Turso DB first (persistent), falls back to KV cache.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<'wfh'|'wio'|null>}
 */
async function getDayModeOverride(dateKey) {
  // Try persistent DB first
  try {
    const db = require('./db');
    const dbMode = await db.getSwapOverride(dateKey);
    if (dbMode) return dbMode;
  } catch (e) {
    // DB not available — fall through to KV
  }
  return kv.get(modeOverrideKey(dateKey));
}

/**
 * Lấy toàn bộ trạng thái của một ngày (dùng cho debug).
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
async function getFullDayState(dateKey) {
  const [isEnabled, isOff, am, pm, schedule, telegram, times, modeOverride] = await Promise.all([
    getIsEnabled(),
    getIsOff(dateKey),
    getPeriodState(dateKey, 'am'),
    getPeriodState(dateKey, 'pm'),
    getSchedule(),
    getTelegramConfig(),
    getPunchTimes(),
    getDayModeOverride(dateKey),
  ]);

  // Compute effectiveMode server-side: override wins, fallback to schedule, default wio
  const d = new Date(dateKey + 'T00:00:00+07:00');
  const dayIdx = d.getDay(); // 0=Sun … 6=Sat
  const scheduleMode = (schedule && (schedule[String(dayIdx)] || schedule[dayIdx])) || 'wio';
  const effectiveMode = modeOverride || scheduleMode;

  return {
    date: dateKey,
    config: {
      isEnabled,
      schedule,
      telegram: telegram || null,
      times: times || null,
    },
    day: {
      isOff,
      modeOverride: modeOverride || null,
      scheduleMode,
      effectiveMode,
    },
    periods: {
      am: am || { status: 'pending' },
      pm: pm || { status: 'pending' },
    },
  };
}

module.exports = {
  kv,
  getIsEnabled,
  setIsEnabled,
  getIsOff,
  setIsOff,
  setIsOffRange,
  getPeriodState,
  setPeriodState,
  getFullDayState,
  getSchedule,
  setSchedule,
  getTelegramConfig,
  setTelegramConfig,
  getPunchTimes,
  setPunchTimes,
  setDayModeOverride,
  getDayModeOverride,
};