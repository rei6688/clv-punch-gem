// api/telegram-webhook.js — Telegram Bot webhook handler with auth + interactive commands

const { getTelegramConfig, getFullDayState, setPeriodState, setIsEnabled, setIsOff } = require('../lib/kv');
const { getVietnamDateKey, getCurrentPeriod } = require('../lib/time');
const { answerCallback, editMessage, sendTelegram } = require('../lib/telegram');

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

        const buttons = state.config.isEnabled
            ? [[{ text: '⏸ Tạm dừng hệ thống', callback_data: 'sys_disable' }]]
            : [[{ text: '▶️ Bật lại hệ thống', callback_data: 'sys_enable' }]];

        await sendTelegram({ text, buttons, token: config.token, chatId: message.chat.id });
    },

    /**
     * /help — List all commands
     */
    async help(message, config) {
        const text = `🤖 <b>Auto Punch Bot — Danh sách lệnh</b>

/status — Xem trạng thái hôm nay
/enable — Bật hệ thống
/disable — Tắt hệ thống
/off — Đánh dấu hôm nay nghỉ
/punch — Punch thủ công ngay bây giờ
/done — Đánh dấu phiên hiện tại hoàn thành
/help — Xem danh sách lệnh này`;

        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    },

    /**
     * /enable — Enable the system
     */
    async enable(message, config) {
        await setIsEnabled(true);
        const text = `✅ <b>Hệ thống đã được BẬT lại.</b>
Lần chạy cron tiếp theo sẽ tự động punch.`;
        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    },

    /**
     * /disable — Disable the system
     */
    async disable(message, config) {
        await setIsEnabled(false);
        const text = `⏸ <b>Hệ thống đã được TẮT.</b>
Cron sẽ skip cho đến khi bạn /enable lại.`;
        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    },

    /**
     * /off — Mark today as vacation/off
     */
    async off(message, config) {
        const dateKey = getVietnamDateKey();
        await setIsOff(dateKey, true);
        const text = `🌴 <b>Đã đánh dấu hôm nay (${dateKey}) là NGHỈ.</b>
Hệ thống sẽ skip tất cả cron hôm nay.

<i>Dùng /enable để bật lại hệ thống cho ngày khác.</i>`;
        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    },

    /**
     * /punch — Manual WFH punch now
     */
    async punch(message, config) {
        const dateKey = getVietnamDateKey();
        const period = getCurrentPeriod();
        await setPeriodState(dateKey, period, 'manual_done', 'telegram');
        const periodLabel = period === 'am' ? 'Sáng (AM)' : 'Chiều (PM)';
        const text = `🚀 <b>Đã ghi nhận Punch thủ công — ${periodLabel}</b>
Phiên ${period.toUpperCase()} hôm nay (${dateKey}) đã được đánh dấu <b>manual_done</b>.`;
        await sendTelegram({ text, token: config.token, chatId: message.chat.id });
    },

    /**
     * /done — Mark current period as done
     */
    async done(message, config) {
        return commands.punch(message, config);
    },
};

// ─── Callback query handler (inline button presses) ──────────────────────────
async function handleCallback(callback_query, config) {
    const { data, message: msg, id: queryId } = callback_query;
    const token = config.token;
    let responseText = '';
    let newMsgText = msg.text;

    if (data === 'sys_enable') {
        await setIsEnabled(true);
        responseText = '✅ Hệ thống đã BẬT!';
        newMsgText += '\n\n<b>✅ ACTION: Hệ thống đã được BẬT lại.</b>';
    } else if (data === 'sys_disable') {
        await setIsEnabled(false);
        responseText = '⏸ Hệ thống đã TẮT!';
        newMsgText += '\n\n<b>⏸ ACTION: Hệ thống đã được TẮT.</b>';
    } else if (data === 'punch_now' || data === 'mark_done') {
        const dateKey = getVietnamDateKey();
        const period = getCurrentPeriod();
        await setPeriodState(dateKey, period, 'manual_done', 'telegram');
        responseText = '✅ Đã ghi nhận Punch!';
        newMsgText += `\n\n<b>✅ ACTION: ${period.toUpperCase()} đã được mark DONE.</b>`;
    } else if (data === 'mark_done_am') {
        const dateKey = getVietnamDateKey();
        await setPeriodState(dateKey, 'am', 'manual_done', 'telegram');
        responseText = '🏢 Đã ghi nhận sáng DONE!';
        newMsgText += '\n\n<b>✅ ACTION: AM đã được mark DONE.</b>';
    } else if (data === 'mark_off_today') {
        const dateKey = getVietnamDateKey();
        await setIsOff(dateKey, true);
        responseText = '🌴 Đã đánh dấu nghỉ hôm nay!';
        newMsgText += '\n\n<b>🌴 ACTION: Hôm nay đã đánh dấu NGHỈ.</b>';
    }

    await Promise.all([
        answerCallback(token, queryId, responseText),
        editMessage(token, msg.chat.id, msg.message_id, newMsgText),
    ]);
}

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
        // 3. Handle inline button presses
        if (callback_query) {
            await handleCallback(callback_query, config);
            return res.status(200).json({ ok: true });
        }

        // 4. Handle text commands
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
