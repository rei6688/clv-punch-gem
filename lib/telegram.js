const { getTelegramConfig } = require('./kv');

/**
 * Gửi thông báo qua Telegram Bot
 * @param {Object} params
 * @param {string} params.title - Tiêu đề
 * @param {string} params.message - Nội dung
 * @param {Array} params.buttons - Nút bấm tương tác (Inline Keyboard)
 */
async function sendTelegram({ title, message, buttons = [] }) {
    const config = await getTelegramConfig();
    if (!config.token || !config.chatId) {
        console.warn('⚠️ Telegram chưa được cấu hình. Bỏ qua.');
        return null;
    }

    const text = `<b>${title}</b>\n\n${message}`;

    const payload = {
        chat_id: config.chatId,
        text: text,
        parse_mode: 'HTML',
    };

    if (buttons.length > 0) {
        payload.reply_markup = {
            inline_keyboard: buttons
        };
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return await res.json();
    } catch (error) {
        console.error('❌ Telegram error:', error);
        return null;
    }
}

module.exports = { sendTelegram };
