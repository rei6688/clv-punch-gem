// File: public/js/api.js
// Centralized API client for Auto Punch Dashboard

const BASE = '';

// ── Auth ──────────────────────────────────────────────────────
let _secret = sessionStorage.getItem('punch_secret') || '';

export function getSecret() { return _secret; }
export function setSecret(s) {
    _secret = s;
    sessionStorage.setItem('punch_secret', s);
}
export function clearSecret() {
    _secret = '';
    sessionStorage.removeItem('punch_secret');
}
export function hasSecret() { return !!_secret; }

// ── Fetch helpers ─────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Secret': _secret,
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
    const sep = path.includes('?') ? '&' : '?';
    return apiFetch(`${path}${sep}secret=${encodeURIComponent(_secret)}`, { method: 'GET' });
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
    const q = date ? `?date=${date}&secret=${encodeURIComponent(_secret)}` : `?secret=${encodeURIComponent(_secret)}`;
    return apiFetch(`/api/state${q}`, { method: 'GET' });
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

/** GET /api/dev-secret — get secret from env (dev only) */
export async function getDevSecret() {
    try {
        const res = await fetch('/api/dev-secret');
        if (!res.ok) return null;
        const data = await res.json();
        return data.ok ? data.secret : null;
    } catch {
        return null;
    }
}
