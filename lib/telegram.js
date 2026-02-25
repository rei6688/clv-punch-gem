// lib/telegram.js — Telegram Bot API helper

const { getTelegramConfig } = require('./kv');

/**
 * Send a Telegram message with optional inline keyboard buttons.
 * @param {Object} params
 * @param {string} params.text - Message text (HTML parse mode)
 * @param {Array<Array<{text: string, callback_data: string}>>} [params.buttons] - Inline keyboard rows
 * @param {string} [params.chatId] - Override chat ID (uses config by default)
 * @param {string} [params.token] - Override bot token (uses config by default)
 */
async function sendTelegram({ text, buttons = null, chatId: overrideChatId, token: overrideToken } = {}) {
    let token = overrideToken;
    let chatId = overrideChatId;

    if (!token || !chatId) {
        const config = await getTelegramConfig();
        if (!config) {
            console.warn('[telegram] Not configured. Skipping.');
            return null;
        }
        token = token || config.token;
        chatId = chatId || config.chatId;
    }

    if (!token || !chatId) {
        console.warn('[telegram] Missing token or chatId. Skipping.');
        return null;
    }

    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
    };

    if (buttons && buttons.length > 0) {
        body.reply_markup = {
            inline_keyboard: buttons,
        };
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.ok) console.warn('[telegram] sendMessage failed:', json.description);
        return json;
    } catch (e) {
        console.error('[telegram] sendMessage error:', e.message);
        return null;
    }
}

/**
 * Answer a callback query (removes loading spinner on the button).
 */
async function answerCallback(token, callbackQueryId, text = '') {
    try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        });
    } catch (e) {
        console.error('[telegram] answerCallback error:', e.message);
    }
}

/**
 * Edit an existing message (e.g., to update/remove inline buttons after action).
 */
async function editMessage(token, chatId, messageId, text) {
    try {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML',
            }),
        });
    } catch (e) {
        console.error('[telegram] editMessage error:', e.message);
    }
}

/**
 * Register the webhook URL with Telegram (call once after deploy).
 * Uses TELEGRAM_WEBHOOK_SECRET env var for authentication.
 */
async function registerWebhook(token, webhookUrl) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const body = { url: webhookUrl };
    if (secret) body.secret_token = secret;

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

module.exports = { sendTelegram, answerCallback, editMessage, registerWebhook };
