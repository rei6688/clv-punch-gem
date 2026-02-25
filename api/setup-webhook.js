// api/setup-webhook.js — Register Telegram webhook (call once after deploy)
// Access via: GET /api/setup-webhook?secret=YOUR_PUNCH_SECRET

const { authenticate } = require('../lib/auth');
const { getTelegramConfig } = require('../lib/kv');
const { registerWebhook } = require('../lib/telegram');

module.exports = async function handler(req, res) {
    try {
        await authenticate(req);
    } catch (e) {
        return res.status(403).json({ ok: false, error: e.message });
    }

    const config = await getTelegramConfig();
    if (!config || !config.token) {
        return res.status(400).json({ ok: false, error: 'Telegram not configured. Set token & chatId in Settings first.' });
    }

    // Build webhook URL from request host (works on both Vercel and local)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

    const result = await registerWebhook(config.token, webhookUrl);

    return res.status(200).json({
        ok: result.ok,
        webhookUrl,
        telegram: result,
        note: result.ok
            ? `✅ Webhook đã được đăng ký thành công tại ${webhookUrl}`
            : `❌ Thất bại: ${result.description}`,
    });
};
