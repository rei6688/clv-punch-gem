// File: api/state/report.js

const { setPeriodState, getIsOff, getIsEnabled } = require('../../lib/kv');
const { sendChat } = require('../../lib/chat');
const { getVietnamDateKey, getCurrentPeriod, getVietnamTimestamp } = require('../../lib/time');
const { authenticateCron } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  const rid = req.headers['x-vercel-id'] || Date.now().toString();
  const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
  const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return bad(405, 'method not allowed');
  }
  
  try {
    // 1. Xác thực
    await authenticateCron(req);

    // 2. Lấy dữ liệu
    let body = req.body;
    if (typeof req.body === 'string' && req.body.length > 0) {
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        return bad(400, 'invalid JSON body');
      }
    }

    const { 
      status, // 'success' | 'fail'
      message = '', 
      imageUrl = '',
      recordedPunchTime = '',
    } = body;

    if (!status || (status !== 'success' && status !== 'fail')) {
      return bad(400, 'invalid status. Must be "success" or "fail"');
    }

    const dateKey = (body && body.date) 
      ? String(body.date) 
      : getVietnamDateKey();
      
    const period = (body && body.period) 
      ? String(body.period) 
      : getCurrentPeriod();

    if (period !== 'am' && period !== 'pm') {
      return bad(400, 'invalid period. Must be "am" or "pm"');
    }
    
    // 3. Kiểm tra điều kiện
    const [isEnabled, isOff] = await Promise.all([
      getIsEnabled(),
      getIsOff(dateKey)
    ]);
    
    if (!isEnabled) {
      return ok({ message: 'Skipped: System is disabled.' });
    }
    if (isOff) {
      return ok({ message: `Skipped: Day ${dateKey} is marked as OFF.` });
    }

    // 4. Lưu vào KV
    const metadata = { message, imageUrl, recordedPunchTime };
    await setPeriodState(dateKey, period, status, 'gha', metadata);

    // 5. Gửi thông báo Chat
    const periodText = period === 'am' ? 'Punch In (Sáng)' : 'Punch Out (Chiều)';
    
    if (status === 'success') {
      const recordedTime = recordedPunchTime ? new Date(recordedPunchTime) : null;
      const isValidDate = recordedTime && !isNaN(recordedTime);
      
      const subtitle = isValidDate
        ? `Ghi nhận lúc ${getVietnamDateKey(recordedTime)} (auto-time)`
        : getVietnamTimestamp();

      // --- BẮT ĐẦU SỬA (THÊM NÚT BẤM) ---
      let linkButton = null;
      if (imageUrl) {
        linkButton = {
          text: 'View Screenshot',
          url: imageUrl,
        };
      }

      // --- BẮT ĐẦU SỬA (THÊM EMOJI) ---
      const successIcon = period === 'am' ? 'success_am' : 'success_pm';
      const successEmoji = period === 'am' ? '☀️' : '🌙'; // <-- Emoji cho tiêu đề

      await sendChat({
        title: `${successEmoji} ${periodText} Thành Công (Auto)`, // <-- Thêm emoji vào title
        // --- KẾT THÚC SỬA ---
        subtitle: subtitle,
        imageUrl: imageUrl || undefined, 
        icon: successIcon, // <-- Icon (to, đen)
        linkButton: linkButton,
      });
      // --- KẾT THÚC SỬA ---

    } else {
      // (Xử lý lỗi: cũng thêm nút bấm nếu có ảnh lỗi)
      let linkButton = null;
      if (imageUrl) {
        linkButton = {
          text: 'View Error Screenshot',
          url: imageUrl,
        };
      }
      
      await sendChat({
        title: `🚨 ${periodText} Thất Bại (Auto)`,
        message: `<b>Error:</b> ${message || 'No details from GHA.'}`,
        imageUrl: imageUrl || undefined,
        icon: 'failure',
        linkButton: linkButton, // <-- Gửi nút bấm
      });
    }

    // 6. Trả về kết quả
    return ok({ date: dateKey, period, status });

  } catch (e) {
    const msg = (e && e.message) || 'unknown error';
    if (msg.includes('secret')) return bad(403, msg);
    return bad(500, 'server error', { detail: msg });
  }
}
