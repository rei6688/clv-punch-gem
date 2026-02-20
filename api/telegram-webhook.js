const { getTelegramConfig, setPeriodState, getFullDayState } = require('../lib/kv');
const { getVietnamDateKey, getCurrentPeriod } = require('../lib/time');

module.exports = async function handler(req, res) {
    const config = await getTelegramConfig();

    // Basic security: Chỉ xử lý nếu token được cấu hình
    if (!config.token) return res.status(200).send('OK');

    const { message, callback_query } = req.body;

    // 1. Xử lý nút bấm (Callback Query)
    if (callback_query) {
        const { data, message: msg, id: callback_query_id } = callback_query;
        const dateKey = getVietnamDateKey();
        const period = getCurrentPeriod();

        let responseText = '';

        if (data === 'punch_now') {
            // Trigger GHA hoặc báo thành công giả lập
            await setPeriodState(dateKey, period, 'manual_done', 'telegram');
            responseText = '🚀 Đã ghi nhận Punch thành công!';
        } else if (data === 'mark_done') {
            await setPeriodState(dateKey, period, 'manual_done', 'telegram');
            responseText = '✅ Đã đánh dấu phiên này hoàn thành.';
        } else if (data === 'mark_done_am') {
            await setPeriodState(dateKey, 'am', 'manual_done', 'telegram');
            responseText = '🏢 Đã ghi nhận check-in văn phòng (Sáng).';
        }

        // Trả lời Telegram để ẩn loading
        await fetch(`https://api.telegram.org/bot${config.token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id, text: responseText }),
        });

        // Cập nhật lại tin nhắn cũ (ẩn nút bấm)
        await fetch(`https://api.telegram.org/bot${config.token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                text: `${msg.text}\n\n<b>DONE:</b> ${responseText}`,
                parse_mode: 'HTML'
            }),
        });

        return res.status(200).json({ ok: true });
    }

    // 2. Xử lý lệnh chat (Command)
    if (message && message.text) {
        const text = message.text;
        if (text === '/status') {
            const dateKey = getVietnamDateKey();
            const state = await getFullDayState(dateKey);
            const reply = `📢 <b>Trạng thái hệ thống:</b>\n- Mode: ${state.config.isEnabled ? 'ACTIVE' : 'PAUSED'}\n- Vacation: ${state.day.isOff ? 'YES 🌴' : 'NO'}\n- Sáng: ${state.periods.am.status}\n- Chiều: ${state.periods.pm.status}`;

            await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: message.chat.id,
                    text: reply,
                    parse_mode: 'HTML'
                }),
            });
        }
    }

    return res.status(200).send('OK');
};
