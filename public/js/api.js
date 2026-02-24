// File: public/js/api.js
// Centralized API client for Auto Punch Dashboard

const BASE = '';

// ── Auth (PUNCH_SECRET) ──────────────────────────────────────
let _secret = localStorage.getItem('punch_secret') || '';

export function getSecret()  { return _secret; }
export function setSecret(s) { _secret = s; localStorage.setItem('punch_secret', s); }
export function clearSecret() { _secret = ''; localStorage.removeItem('punch_secret'); }
export function hasSecret()  { return !!_secret; }

// ── Fetch helpers ─────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(_secret ? { 'X-Secret': _secret } : {}),
        ...(options.headers || {}),
    };
    const res = await fetch(BASE + path, { ...options, headers });

    // Check if response is JSON
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned non-JSON response (${res.status})`);
    }

    const data = await res.json();
    if (!data.ok && res.status === 403) {
        throw new Error('AUTH_FAIL');
    }
    if (!data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

async function apiGet(path) {
    if (_secret) {
        const sep = path.includes('?') ? '&' : '?';
        return apiFetch(`${path}${sep}secret=${encodeURIComponent(_secret)}`, { method: 'GET' });
    }
    return apiFetch(path, { method: 'GET' });
}

async function apiPost(path, body = {}) {
    return apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

// ── API methods ───────────────────────────────────────────────

/** GET /api/state — today's full state */
export async function getState(date) {
    const q = date ? `?date=${date}` : '';
    return apiGet(`/api/state${q}`);
}

/** GET /api/state?dates= — bulk effective modes for multiple dates */
export async function getBulkState(dates) {
    return apiGet(`/api/state?dates=${dates.join(',')}`);
}

/** GET /api/history — last N days */
export async function getHistory(days = 30) {
    return apiGet(`/api/history?days=${days}`);
}

/** POST /api/updates — enable/disable system */
export async function updateConfig(isEnabled) {
    return apiPost('/api/updates', { type: 'updateConfig', isEnabled });
}

/** POST /api/actions — mark period as manually done */
export async function markDone(period, date, clear = false) {
    const body = { action: 'markDone', period };
    if (date) body.date = date;
    if (clear) body.clear = true;
    return apiPost('/api/actions', body);
}

/** POST /api/actions — mark a day as OFF */
export async function markOff(date) {
    return apiPost('/api/actions', { action: 'markOff', date });
}

/** POST /api/actions — dải ngày */
export async function markOffRange(startDate, endDate) {
    return apiPost('/api/actions', { action: 'markOff', startDate, endDate });
}

/** POST /api/actions — clear OFF for a day */
export async function clearOff(date) {
    return apiPost('/api/actions', { action: 'clearOff', date });
}

/** POST /api/actions — trigger immediate WFH punch */
export async function markWfhToday() {
    return apiPost('/api/actions', { action: 'markWfhToday' });
}

/** POST /api/actions — swap a specific date between wfh and wio mode */
export async function swapDay(date, toMode) {
    return apiPost('/api/actions', { action: 'swapDay', date, toMode });
}

/** POST /api/actions — update weekly schedule */
export async function updateSchedule(schedule) {
    return apiPost('/api/updates', { type: 'updateSchedule', schedule });
}

/** POST /api/updates — update settings (telegram/times) */
export async function updateSettings(settings) {
    return apiPost('/api/updates', { type: 'updateSettings', ...settings });
}

/** GET /api/dev-secret — get secret from env (local dev auto-auth) */
export async function getDevSecret() {
    try {
        const res = await fetch('/api/dev-secret');
        if (!res.ok) return null;
        const data = await res.json();
        if (data.noAuth) return { noAuth: true };
        return data.ok ? data.secret : null;
    } catch {
        return null;
    }
}

/** GET /api/auth/check — check if PUNCH_SECRET is required */
export async function authCheck() {
    try {
        const res = await fetch('/api/auth/check');
        return await res.json();
    } catch {
        return { ok: false };
    }
}

/** POST /api/actions — send a Telegram test message */
export async function testTelegram() {
    return apiPost('/api/actions', { action: 'testTelegram' });
}

/** POST /api/actions — clear a swap override for a specific date */
export async function clearSwapOverride(date) {
    return apiPost('/api/actions', { action: 'clearSwapOverride', date });
}

/** POST /api/actions — register Telegram webhook URL */
export async function registerTelegramWebhook(webhookUrl) {
    return apiPost('/api/actions', { action: 'registerTelegramWebhook', webhookUrl });
}
