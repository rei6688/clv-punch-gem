// File: public/js/app.js
// SPA router + page renderers for Auto Punch Dashboard

import * as API from './api.js';

// ── Utilities ─────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, type = 'info') {
  const c = $('#toast-container');
  const t = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function statusBadge(status) {
  if (!status || status === 'pending') return `<span class="badge badge-pending">⏳ Pending</span>`;
  if (status === 'success') return `<span class="badge badge-success">✅ Success</span>`;
  if (status === 'fail') return `<span class="badge badge-fail">❌ Failed</span>`;
  if (status === 'manual_done') return `<span class="badge badge-manual">👌 Manual</span>`;
  return `<span class="badge badge-pending">${status}</span>`;
}

function todayVN() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function dayLabel(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(dateStr + 'T00:00:00+07:00');
  return days[d.getDay()];
}

function setLoading(container, text = 'Loading...') {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>${text}</div>`;
}

// ── Auth Modal ────────────────────────────────────────────────
function showAuthModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div style="font-size:2rem;margin-bottom:12px;">🔐</div>
        <div class="modal-title">Enter Secret</div>
        <div class="modal-sub">Enter your <code>PUNCH_SECRET</code> to access the dashboard.</div>
        <div class="form-group">
          <label class="form-label">Secret Key</label>
          <input type="password" id="secret-input" class="form-input" placeholder="Your secret..." autocomplete="current-password">
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-full" id="secret-submit">Unlock Dashboard</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = $('#secret-input', overlay);
    const btn = $('#secret-submit', overlay);
    input.focus();
    const submit = async () => {
      const val = input.value.trim();
      if (!val) return;
      btn.disabled = true;
      btn.textContent = 'Verifying...';
      API.setSecret(val);
      try {
        await API.getState();
        overlay.remove();
        resolve(true);
      } catch (e) {
        if (e.message === 'AUTH_FAIL') {
          btn.disabled = false;
          btn.textContent = 'Unlock Dashboard';
          input.style.borderColor = 'var(--red)';
          toast('Invalid secret. Try again.', 'error');
          API.clearSecret();
        } else {
          overlay.remove();
          resolve(true); // network error, proceed anyway
        }
      }
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => e.key === 'Enter' && submit());
  });
}

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(imageUrl, meta = '') {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <div class="lightbox-inner">
      <img src="${imageUrl}" alt="Punch screenshot" />
      <button class="lightbox-close" title="Close">✕</button>
      ${meta ? `<div class="lightbox-meta">${meta}</div>` : ''}
    </div>`;
  document.body.appendChild(lb);
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  $('.lightbox-close', lb).addEventListener('click', () => lb.remove());
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
  });
}

// ── Clock ─────────────────────────────────────────────────────
function startClock() {
  const el = $('#nav-clock');
  if (!el) return;
  const update = () => {
    el.textContent = new Date().toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' VN';
  };
  update();
  setInterval(update, 1000);
}

// ── Router ────────────────────────────────────────────────────
const routes = {
  dashboard: renderDashboard,
  history: renderHistory,
  settings: renderSettings,
};

function navigate(page) {
  window.location.hash = page;
}

function onHashChange() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const page = routes[hash] ? hash : 'dashboard';
  $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));
  const app = $('#app');
  setLoading(app);
  routes[page](app);
}

// ── Dashboard Page ────────────────────────────────────────────
async function renderDashboard(container) {
  try {
    const data = await API.getState();
    const { config, day, periods, date } = data;
    const isEnabled = config.isEnabled;
    const am = periods.am || { status: 'pending' };
    const pm = periods.pm || { status: 'pending' };

    container.innerHTML = `
      <div class="stack">

        <!-- System Status -->
        <div class="card">
          <div class="card-title">System Status</div>
          <div class="status-hero">
            <div class="status-hero-left">
              <div class="status-hero-title">
                ${isEnabled
        ? '<span class="badge badge-enabled">🟢 System Enabled</span>'
        : '<span class="badge badge-disabled">🔴 System Disabled</span>'}
              </div>
              <div class="status-hero-sub">
                ${day.isOff
        ? `<span class="badge badge-off">🚫 Day OFF — ${date}</span>`
        : `Today: <strong>${date}</strong> (${dayLabel(date)})`}
              </div>
            </div>
            <div class="toggle-wrap">
              <label class="toggle" title="${isEnabled ? 'Disable system' : 'Enable system'}">
                <input type="checkbox" id="system-toggle" ${isEnabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Period Status -->
        <div class="grid-2">
          <div class="card period-card">
            <div class="period-icon">☀️</div>
            <div class="period-label">Punch In (AM)</div>
            ${statusBadge(am.status)}
            ${am.recordedPunchTime ? `<div class="period-time">🕐 ${am.recordedPunchTime}</div>` : ''}
            ${am.imageUrl ? `<button class="btn btn-secondary btn-sm" onclick="window._openLightbox('${am.imageUrl}', 'AM — ${date}')">📷 View Screenshot</button>` : ''}
          </div>
          <div class="card period-card">
            <div class="period-icon">🌙</div>
            <div class="period-label">Punch Out (PM)</div>
            ${statusBadge(pm.status)}
            ${pm.recordedPunchTime ? `<div class="period-time">🕐 ${pm.recordedPunchTime}</div>` : ''}
            ${pm.imageUrl ? `<button class="btn btn-secondary btn-sm" onclick="window._openLightbox('${pm.imageUrl}', 'PM — ${date}')">📷 View Screenshot</button>` : ''}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-title">Quick Actions</div>
          <div class="actions-grid">
            <button class="btn btn-blue" id="qa-mark-am">👌 Mark Done AM</button>
            <button class="btn btn-blue" id="qa-mark-pm">👌 Mark Done PM</button>
            <button class="btn btn-purple" id="qa-wfh">🏠 WFH Punch Now</button>
            <button class="btn btn-danger" id="qa-off">🚫 Mark Today OFF</button>
            ${day.isOff ? `<button class="btn btn-secondary" id="qa-clear-off">✅ Clear OFF</button>` : ''}
            <button class="btn btn-secondary" onclick="navigate('history')">📋 View History</button>
            <button class="btn btn-secondary" onclick="navigate('settings')">⚙️ Settings</button>
          </div>
        </div>

      </div>`;

    // System toggle
    $('#system-toggle', container).addEventListener('change', async (e) => {
      const val = e.target.checked;
      try {
        await API.updateConfig(val);
        toast(`System ${val ? 'enabled' : 'disabled'}`, 'success');
        setTimeout(() => renderDashboard(container), 500);
      } catch (err) {
        toast(err.message, 'error');
        e.target.checked = !val;
      }
    });

    // Mark Done AM
    $('#qa-mark-am', container).addEventListener('click', async () => {
      try {
        await API.markDone('am');
        toast('AM marked as done ✅', 'success');
        setTimeout(() => renderDashboard(container), 500);
      } catch (err) { toast(err.message, 'error'); }
    });

    // Mark Done PM
    $('#qa-mark-pm', container).addEventListener('click', async () => {
      try {
        await API.markDone('pm');
        toast('PM marked as done ✅', 'success');
        setTimeout(() => renderDashboard(container), 500);
      } catch (err) { toast(err.message, 'error'); }
    });

    // WFH Now
    $('#qa-wfh', container).addEventListener('click', async () => {
      const btn = $('#qa-wfh', container);
      btn.disabled = true; btn.textContent = '⏳ Triggering...';
      try {
        await API.markWfhToday();
        toast('WFH punch triggered! GHA is running 🚀', 'success');
      } catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = '🏠 WFH Punch Now'; }
    });

    // Mark OFF
    $('#qa-off', container).addEventListener('click', async () => {
      if (!confirm(`Mark ${date} as OFF? No reminders will be sent.`)) return;
      try {
        await API.markOff(date);
        toast(`${date} marked as OFF 🚫`, 'success');
        setTimeout(() => renderDashboard(container), 500);
      } catch (err) { toast(err.message, 'error'); }
    });

    // Clear OFF
    const clearBtn = $('#qa-clear-off', container);
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        try {
          await API.clearOff(date);
          toast(`OFF cleared for ${date} ✅`, 'success');
          setTimeout(() => renderDashboard(container), 500);
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // Expose lightbox globally for inline onclick
    window._openLightbox = openLightbox;

  } catch (err) {
    container.innerHTML = `<div class="card"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${err.message}</div></div></div>`;
  }
}

// ── History Page ──────────────────────────────────────────────
async function renderHistory(container) {
  container.innerHTML = `
    <div class="stack">
      <div class="section-header">
        <div class="section-title">📋 Punch History</div>
        <div style="display:flex;gap:8px;align-items:center">
          <select class="form-select" id="hist-days" style="width:auto">
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30" selected>Last 30 days</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="hist-refresh">🔄</button>
        </div>
      </div>
      <div class="filter-bar">
        <span class="filter-chip active" data-filter="all">All</span>
        <span class="filter-chip" data-filter="success">✅ Success</span>
        <span class="filter-chip" data-filter="fail">❌ Failed</span>
        <span class="filter-chip" data-filter="manual_done">👌 Manual</span>
        <span class="filter-chip" data-filter="off">🚫 OFF</span>
      </div>
      <div id="hist-list"><div class="loading"><div class="spinner"></div>Loading history...</div></div>
    </div>`;

  let currentFilter = 'all';
  let records = [];

  const loadHistory = async () => {
    const days = parseInt($('#hist-days', container).value, 10);
    const list = $('#hist-list', container);
    setLoading(list, 'Fetching records...');
    try {
      const data = await API.getHistory(days);
      records = data.records || [];
      renderList();
    } catch (err) {
      list.innerHTML = `<div class="card"><div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">${err.message}</div></div></div>`;
    }
  };

  const renderList = () => {
    const list = $('#hist-list', container);
    let filtered = records;
    if (currentFilter === 'off') filtered = records.filter(r => r.day.isOff);
    else if (currentFilter === 'success') filtered = records.filter(r => r.periods.am.status === 'success' || r.periods.pm.status === 'success');
    else if (currentFilter === 'fail') filtered = records.filter(r => r.periods.am.status === 'fail' || r.periods.pm.status === 'fail');
    else if (currentFilter === 'manual_done') filtered = records.filter(r => r.periods.am.status === 'manual_done' || r.periods.pm.status === 'manual_done');

    if (!filtered.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No records found</div></div>`;
      return;
    }

    list.innerHTML = `<div class="history-list">${filtered.map(r => {
      const am = r.periods.am || { status: 'pending' };
      const pm = r.periods.pm || { status: 'pending' };
      const isOff = r.day.isOff;
      const label = dayLabel(r.date);
      const isToday = r.date === todayVN();

      return `<div class="history-row ${isToday ? 'card' : ''}">
        <div>
          <div class="history-date">${r.date} ${isToday ? '🔵' : ''}</div>
          <div class="history-day-label">${label}${isOff ? ' · <span class="badge badge-off" style="font-size:0.65rem;padding:2px 6px">OFF</span>' : ''}</div>
        </div>
        <div class="history-period">
          <div class="history-period-label">AM</div>
          ${isOff ? '<span class="badge badge-off" style="font-size:0.65rem">—</span>' : statusBadge(am.status)}
        </div>
        <div class="history-period">
          <div class="history-period-label">PM</div>
          ${isOff ? '<span class="badge badge-off" style="font-size:0.65rem">—</span>' : statusBadge(pm.status)}
        </div>
        <div class="history-actions">
          ${am.imageUrl ? `<button class="thumb-btn" title="AM Screenshot" onclick="window._openLightbox('${am.imageUrl}', 'AM — ${r.date}')">📷</button>` : ''}
          ${pm.imageUrl ? `<button class="thumb-btn" title="PM Screenshot" onclick="window._openLightbox('${pm.imageUrl}', 'PM — ${r.date}')">📷</button>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  };

  // Filter chips
  $$('.filter-chip', container).forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.filter-chip', container).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderList();
    });
  });

  $('#hist-days', container).addEventListener('change', loadHistory);
  $('#hist-refresh', container).addEventListener('click', loadHistory);
  window._openLightbox = openLightbox;

  await loadHistory();
}

// ── Settings Page ─────────────────────────────────────────────
async function renderSettings(container) {
  const today = todayVN();
  container.innerHTML = `
    <div class="stack">
      <div class="section-title">⚙️ Settings & Controls</div>

      <!-- System ON/OFF -->
      <div class="card">
        <div class="card-title">System Control</div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:16px">
          Enable or disable the entire auto-punch system. When disabled, no reminders or auto-punches will run.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" id="s-enable">🟢 Enable System</button>
          <button class="btn btn-danger" id="s-disable">🔴 Disable System</button>
        </div>
      </div>

      <!-- Mark OFF -->
      <div class="card">
        <div class="card-title">Mark Day as OFF</div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:16px">
          Mark a specific day as OFF (holiday/leave). No auto-punch or WFH reminders will run.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="s-off-date" value="${today}">
          </div>
          <button class="btn btn-danger" id="s-mark-off">🚫 Mark OFF</button>
          <button class="btn btn-secondary" id="s-clear-off">✅ Clear OFF</button>
        </div>
      </div>

      <!-- Mark Done -->
      <div class="card">
        <div class="card-title">Mark Done Manually</div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:16px">
          Manually confirm that a punch period is done. Stops reminders for that period.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" id="s-done-date" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Period</label>
            <select class="form-select" id="s-done-period" style="width:auto">
              <option value="am">☀️ AM (Morning)</option>
              <option value="pm">🌙 PM (Evening)</option>
            </select>
          </div>
          <button class="btn btn-blue" id="s-mark-done">👌 Mark Done</button>
        </div>
      </div>

      <!-- WFH Override -->
      <div class="card">
        <div class="card-title">WFH Override</div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:16px">
          Trigger an immediate WFH punch (AM) right now. The system will also automatically run PM punch at ~18:00.
          Use this on days you're unexpectedly working from home.
        </p>
        <button class="btn btn-purple btn-lg" id="s-wfh">🏠 Trigger WFH Punch Now</button>
      </div>

      <!-- Debug State -->
      <div class="card">
        <div class="section-header" style="margin-bottom:12px">
          <div class="card-title" style="margin:0">🔍 Debug — Raw State</div>
          <button class="btn btn-secondary btn-sm" id="s-debug-load">Load</button>
        </div>
        <div id="s-debug-output" class="debug-json" style="display:none"></div>
      </div>

      <!-- Change Secret -->
      <div class="card">
        <div class="card-title">🔐 Change Secret</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">New Secret</label>
            <input type="password" class="form-input" id="s-new-secret" placeholder="Enter new secret...">
          </div>
          <button class="btn btn-secondary" id="s-save-secret">Save</button>
        </div>
      </div>

    </div>`;

  // Enable
  $('#s-enable', container).addEventListener('click', async () => {
    try { await API.updateConfig(true); toast('System enabled 🟢', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });

  // Disable
  $('#s-disable', container).addEventListener('click', async () => {
    if (!confirm('Disable the auto-punch system?')) return;
    try { await API.updateConfig(false); toast('System disabled 🔴', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });

  // Mark OFF
  $('#s-mark-off', container).addEventListener('click', async () => {
    const date = $('#s-off-date', container).value;
    if (!date) return toast('Select a date', 'error');
    try { await API.markOff(date); toast(`${date} marked as OFF 🚫`, 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });

  // Clear OFF
  $('#s-clear-off', container).addEventListener('click', async () => {
    const date = $('#s-off-date', container).value;
    if (!date) return toast('Select a date', 'error');
    try { await API.clearOff(date); toast(`OFF cleared for ${date} ✅`, 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });

  // Mark Done
  $('#s-mark-done', container).addEventListener('click', async () => {
    const date = $('#s-done-date', container).value;
    const period = $('#s-done-period', container).value;
    try { await API.markDone(period, date); toast(`${period.toUpperCase()} on ${date} marked done 👌`, 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });

  // WFH
  $('#s-wfh', container).addEventListener('click', async () => {
    const btn = $('#s-wfh', container);
    btn.disabled = true; btn.textContent = '⏳ Triggering...';
    try { await API.markWfhToday(); toast('WFH punch triggered! GHA running 🚀', 'success'); }
    catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🏠 Trigger WFH Punch Now'; }
  });

  // Debug
  $('#s-debug-load', container).addEventListener('click', async () => {
    const out = $('#s-debug-output', container);
    out.style.display = 'block';
    out.textContent = 'Loading...';
    try {
      const data = await API.getState();
      out.textContent = JSON.stringify(data, null, 2);
    } catch (e) { out.textContent = `Error: ${e.message}`; }
  });

  // Change secret
  $('#s-save-secret', container).addEventListener('click', () => {
    const val = $('#s-new-secret', container).value.trim();
    if (!val) return toast('Enter a secret', 'error');
    API.setSecret(val);
    toast('Secret updated ✅', 'success');
    $('#s-new-secret', container).value = '';
  });
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  startClock();

  // Dev-only: try to auto-fill secret from /api/dev-secret
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    if (!API.hasSecret()) {
      try {
        const res = await fetch('/api/dev-secret');
        const data = await res.json();
        if (data.ok && data.secret) {
          API.setSecret(data.secret);
          console.log('🏗️ Dev Mode: PUNCH_SECRET auto-filled from env');
        }
      } catch (e) {
        // Silently fail in dev if endpoint not available
      }
    }
  }

  // Nav tab clicks
  $$('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => navigate(tab.dataset.page));
  });

  // Auth check
  if (!API.hasSecret()) {
    await showAuthModal();
  }

  // Initial route
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}

boot();
