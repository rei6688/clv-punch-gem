require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { kv } = require('@vercel/kv');
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
 * @returns {Promise<boolean>}
 */
async function getIsEnabled() {
  const isEnabled = await kv.get(configKey());
  return isEnabled === null ? true : !!isEnabled; // Mặc định là BẬT nếu chưa set
}

/**
 * Set trạng thái BẬT/TẮT chung.
 * @param {boolean} isEnabled
 */
async function setIsEnabled(isEnabled) {
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
  // Set state, cho TTL 3 ngày (tự xóa sau 3 ngày)
  return kv.set(periodStateKey(dateKey, period), newState, { ex: 86400 * 3 });
}

/**
 * Lấy toàn bộ trạng thái của một ngày (dùng cho debug).
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
async function getFullDayState(dateKey) {
  const [isEnabled, isOff, am, pm] = await Promise.all([
    getIsEnabled(),
    getIsOff(dateKey),
    getPeriodState(dateKey, 'am'),
    getPeriodState(dateKey, 'pm'),
  ]);

  return {
    date: dateKey,
    config: {
      isEnabled,
    },
    day: {
      isOff,
    },
    periods: {
      am: am || { status: 'pending' },
      pm: pm || { status: 'pending' },
    },
  };
}

module.exports = {
  getIsEnabled,
  setIsEnabled,
  getIsOff,
  setIsOff,
  setIsOffRange,
  getPeriodState,
  setPeriodState,
  getFullDayState,
};