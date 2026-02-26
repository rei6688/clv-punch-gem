// api/telegram-webhook.js — Telegram Bot webhook handler with auth + interactive commands

const { getTelegramConfig, getFullDayState, setPeriodState, setIsEnabled, setIsOff } = require('../lib/kv');
const { getVietnamDateKey, getCurrentPeriod } = require('../lib/time');
const { answerCallback, editMessage, sendTelegram } = require('../lib/telegram');
const { logSystemEvent } = require('../lib/db');

// ─── Security: verify Telegram's built-in secret token (Option B) ────────────
function verifyWebhookSecret(req) {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) return true; // Not set → allow (open dev mode)

    const incoming = req.headers['x-telegram-bot-api-secret-token'] || '';
    return incoming === expectedSecret;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function statusEmoji(status) {
    if (status === 'success' || status === 'manual_done') return '✅';
    if (status === 'fail') return '❌';
    return '⏳';
}

function modeLabel(state) {
    if (state.day.isOff) return '🌴 Nghỉ (OFF)';
    if (state.day.effectiveMode === 'wfh') return '🏠 WFH (Tự động)';
    return '🏢 Văn phòng (Thủ công)';
}

// ─── Commands ─────────────────────────────────────────────────────────────────
const commands = {
    /**
     * /status — Show today's full status
     */
    async status(message, config) {
        const dateKey = getVietnamDateKey();
        const state = await getFullDayState(dateKey);

        const am = state.periods.am;
        const pm = state.periods.pm;
        const systemState = state.config.isEnabled ? '🟢 <b>ACTIVE</b>' : '🔴 <b>PAUSED</b>';

        const text = `📊 <b>Trạng thái hệ thống hôm nay</b>
━━━━━━━━━━━━━━━━
📅 <b>Ngày:</b> ${dateKey}
💡 <b>Hệ thống:</b> ${systemState}
🗓 <b>Mode:</b> ${modeLabel(state)}
━━━━━━━━━━━━━━━━
${statusEmoji(am.status)} <b>Sáng (AM):</b> ${am.status} ${am.recordedPunchTime ? '— ' + am.recordedPunchTime : ''}
${statusEmoji(pm.status)} <b>Chiều (PM):</b> ${pm.status} ${pm.recordedPunchTime ? '— ' + pm.recordedPunchTime : ''}`;

        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    },

    /**
     * /help — List all commands
     */
    async help(message, config) {
        const text = `🤖 <b>Auto Punch Bot — Danh sách lệnh (Chỉ xem)</b>

/status — Xem trạng thái hôm nay
/help — Xem danh sách lệnh này

💡 <i>Mọi thao tác thay đổi (Punch, OFF, Swap, Settings...) nay chỉ thực hiện thông qua Web Dashboard để đảm bảo đồng bộ!</i>`;

        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    }
};

// ─── Main handler ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
    // 1. Verify Telegram webhook secret (Option B auth)
    if (!verifyWebhookSecret(req)) {
        console.warn('[telegram-webhook] 403 — invalid webhook secret');
        return res.status(403).send('Forbidden');
    }

    // Must be POST
    if (req.method !== 'POST') {
        return res.status(200).send('OK'); // Telegram sends GET to test connectivity
    }

    // 2. Load config
    const config = await getTelegramConfig();
    if (!config || !config.token) {
        return res.status(200).send('OK'); // graceful no-op
    }

    const { message, callback_query } = req.body || {};

    try {
        // Handle text commands
        if (message && message.text) {
            const rawText = message.text.trim();
            // Commands: /status, /help, /enable, etc. (strip @BotUsername if present)
            const cmdMatch = rawText.match(/^\/([a-z_]+)(@\S+)?/i);
            if (cmdMatch) {
                const cmdName = cmdMatch[1].toLowerCase();
                const handler = commands[cmdName];
                if (handler) {
                    await handler(message, config);
                } else {
                    await sendTelegram({
                        text: `❓ Lệnh không hợp lệ: <code>${cmdName}</code>\nDùng /help để xem danh sách.`,
                        token: config.token,
                        chatId: message.chat.id,
                    });
                }
            }
        }
    } catch (e) {
        console.error('[telegram-webhook] Error:', e.message);
    }

    return res.status(200).send('OK');
};
