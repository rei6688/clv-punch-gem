// File: public/js/app.js
// Modern SPA for Auto Punch Dashboard (Tailwind + Lucide)

import * as API from './api.js';

// ── Utilities ─────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, type = 'info') {
  const c = $('#toast-container');
  const t = document.createElement('div');
  t.className = `toast`;

  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  const color = type === 'success' ? 'text-success' : type === 'error' ? 'text-destructive' : 'text-blue-400';

  t.innerHTML = `
        <i data-lucide="${icon}" class="${color} w-5 h-5"></i>
        <span>${msg}</span>
    `;
  c.appendChild(t);
  lucide.createIcons();
  setTimeout(() => {
    t.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

function statusBadge(status) {
  let cls = "bg-slate-800 text-slate-400";
  let icon = "clock";
  let text = "Pending";

  if (status === 'success') {
    cls = "bg-success/20 text-success border-success/30";
    icon = "check-circle";
    text = "Success";
  } else if (status === 'fail') {
    cls = "bg-destructive/20 text-destructive border-destructive/30";
    icon = "x-circle";
    text = "Failed";
  } else if (status === 'manual_done') {
    cls = "bg-blue-500/20 text-blue-400 border-blue-500/30";
    icon = "check";
    text = "Manual Done";
  }

  return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}">
            <i data-lucide="${icon}" class="w-3 h-3"></i>
            ${text}
        </span>
    `;
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
  container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-12 gap-4">
            <div class="spinner"></div>
            <p class="text-sm text-muted-foreground animate-pulse">${text}</p>
        </div>
    `;
}

// ── Components ────────────────────────────────────────────────

/**
 * Creates a standard card shell
 */
function Card({ title, subtitle, content, actions }) {
  return `
        <div class="card p-6 flex flex-col gap-4">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-semibold text-lg leading-tight">${title}</h3>
                    ${subtitle ? `<p class="text-sm text-muted-foreground">${subtitle}</p>` : ''}
                </div>
                ${actions || ''}
            </div>
            <div class="flex-1">${content}</div>
        </div>
    `;
}

// ── Modals & Dialogs ──────────────────────────────────────────

async function showAuthModal() {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div class="glass w-full max-w-sm p-8 rounded-2xl flex flex-col gap-6 shadow-2xl scale-in-95 animate-in">
                    <div class="flex flex-col items-center text-center gap-2">
                        <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-2">
                            <i data-lucide="lock" class="w-6 h-6"></i>
                        </div>
                        <h2 class="text-2xl font-bold">Unlock Dashboard</h2>
                        <p class="text-sm text-muted-foreground leading-relaxed">Please enter your <b>PUNCH_SECRET</b> to access the application.</p>
                    </div>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" for="secret-input">Secret Key</label>
                            <input type="password" id="secret-input" class="flex h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Type secret here..." autocomplete="current-password">
                        </div>
                        <button id="secret-submit" class="btn btn-primary w-full">Unlock Now</button>
                    </div>
                </div>
            </div>
        `;
    lucide.createIcons();
    const input = $('#secret-input');
    const btn = $('#secret-submit');
    input.focus();

    const submit = async () => {
      const val = input.value.trim();
      if (!val) return;
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner !h-4 !w-4 border-white mr-2"></div> Verifying...`;
      API.setSecret(val);
      try {
        await API.getState();
        root.innerHTML = '';
        resolve(true);
      } catch (e) {
        if (e.message === 'AUTH_FAIL' || (e.message && e.message.toLowerCase().includes('secret'))) {
          btn.disabled = false;
          btn.textContent = 'Unlock Now';
          input.classList.add('border-destructive');
          toast('Invalid secret key. Please check and try again.', 'error');
          API.clearSecret();
        } else {
          root.innerHTML = '';
          resolve(true); // Proceed on network errors
        }
      }
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => e.key === 'Enter' && submit());
  });
}

function showRangeOffModal() {
  const root = $('#modal-root');
  const today = todayVN();

  root.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div class="glass w-full max-w-md p-6 rounded-xl flex flex-col gap-6 shadow-2xl">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-bold">Mark OFF Range</h2>
                    <button class="modal-close p-1 hover:bg-slate-800 rounded-md"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
                <p class="text-sm text-muted-foreground">Select a range of dates to set as OFF. The system will skip all punches during this period.</p>
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-xs font-medium text-muted-foreground">Start Date</label>
                        <input type="date" id="range-start" class="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm" value="${today}">
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-medium text-muted-foreground">End Date</label>
                        <input type="date" id="range-end" class="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm" value="${today}">
                    </div>
                </div>
                <div class="bg-primary/10 border border-primary/20 p-3 rounded-lg flex gap-3 text-xs leading-relaxed text-primary">
                    <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                    <span>Sau dải ngày này, hệ thống sẽ <b>tự động hoạt động lại</b> vào ngày WFH/lên văn phòng tiếp theo.</span>
                </div>
                <div class="flex justify-end gap-3 mt-2">
                    <button class="btn btn-outline modal-close">Cancel</button>
                    <button id="range-submit" class="btn btn-primary px-6">Set OFF Days</button>
                </div>
            </div>
        </div>
    `;
  lucide.createIcons();
  const close = () => root.innerHTML = '';
  $$('.modal-close').forEach(b => b.onclick = close);

  $('#range-submit').onclick = async () => {
    const start = $('#range-start').value;
    const end = $('#range-end').value;
    if (!start || !end) return;

    $('#range-submit').disabled = true;
    $('#range-submit').textContent = 'Saving...';

    try {
      await API.markOffRange(start, end);
      toast(`Successfully set OFF from ${start} to ${end}`, 'success');
      close();
      onHashChange(); // Refresh current page
    } catch (err) {
      toast(err.message, 'error');
      $('#range-submit').disabled = false;
      $('#range-submit').textContent = 'Set OFF Days';
    }
  };
}

function openLightbox(imageUrl, meta = '') {
  const lb = document.createElement('div');
  lb.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300';
  lb.innerHTML = `
        <div class="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
            <img src="${imageUrl}" class="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10 object-contain animate-in zoom-in-95" />
            <div class="flex items-center gap-4 text-white">
                <span class="text-sm font-medium bg-white/10 px-3 py-1 rounded-full border border-white/20">${meta}</span>
                <button class="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors lb-close"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
        </div>
    `;
  document.body.appendChild(lb);
  lucide.createIcons();
  const close = () => { lb.classList.add('fade-out'); setTimeout(() => lb.remove(), 300); };
  lb.onclick = e => { if (e.target === lb) close(); };
  $('.lb-close', lb).onclick = close;
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

// ── Pages ─────────────────────────────────────────────────────

async function renderDashboard(container) {
  try {
    const data = await API.getState();
    const { config, day, periods, date } = data;
    const isEnabled = config.isEnabled;
    const am = periods.am || { status: 'pending' };
    const pm = periods.pm || { status: 'pending' };

    container.innerHTML = `
            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                <!-- Hero / Status Section -->
                <div class="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-8 shadow-2xl">
                    <div class="absolute top-0 right-0 p-4 opacity-5">
                        <i data-lucide="shield-check" class="w-64 h-64"></i>
                    </div>
                    <div class="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div class="flex items-center gap-6 text-center sm:text-left">
                            <div class="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]">
                                <i data-lucide="${isEnabled ? 'zap' : 'zap-off'}" class="w-10 h-10"></i>
                            </div>
                            <div class="space-y-1">
                                <h1 class="text-3xl font-bold tracking-tight">${isEnabled ? 'System Active' : 'System Paused'}</h1>
                                <p class="text-muted-foreground">Today is <span class="text-foreground font-medium">${date}</span> (${dayLabel(date)})</p>
                                ${day.isOff ? '<span class="inline-block mt-2 px-3 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-md border border-destructive/20 uppercase tracking-wider">🚫 Day OFF</span>' : ''}
                            </div>
                        </div>
                        <div class="flex flex-col items-center gap-3">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="system-toggle" class="sr-only peer" ${isEnabled ? 'checked' : ''}>
                                <div class="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]"></div>
                            </label>
                            <span class="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">${isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- AM Period -->
                    <div class="card p-6 flex items-center justify-between group">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <i data-lucide="sun" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Punch In (AM)</p>
                                <div class="mt-1">${statusBadge(am.status)}</div>
                            </div>
                        </div>
                        <div class="text-right">
                           ${am.recordedPunchTime ? `<p class="text-sm font-mono text-foreground">${am.recordedPunchTime}</p>` : '<p class="text-xs text-muted-foreground">No data</p>'}
                           ${am.imageUrl ? `<button class="mt-2 text-[10px] text-primary hover:underline" onclick="window._openLightbox('${am.imageUrl}', 'AM — ${date}')">View Evidence</button>` : ''}
                        </div>
                    </div>

                    <!-- PM Period -->
                    <div class="card p-6 flex items-center justify-between group">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <i data-lucide="moon" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Punch Out (PM)</p>
                                <div class="mt-1">${statusBadge(pm.status)}</div>
                            </div>
                        </div>
                        <div class="text-right">
                           ${pm.recordedPunchTime ? `<p class="text-sm font-mono text-foreground">${pm.recordedPunchTime}</p>` : '<p class="text-xs text-muted-foreground">No data</p>'}
                           ${pm.imageUrl ? `<button class="mt-2 text-[10px] text-primary hover:underline" onclick="window._openLightbox('${pm.imageUrl}', 'PM — ${date}')">View Evidence</button>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Action Hub -->
                <div class="space-y-4">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i data-lucide="layout-grid" class="w-5 h-5"></i>
                        Quick Commands
                    </h2>
                    
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <button id="qa-mark-am" class="btn btn-outline flex-col h-auto py-6 gap-2 hover:border-blue-500/50 hover:bg-blue-500/5 group">
                            <i data-lucide="sun" class="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform"></i>
                            <span>Mark AM Done</span>
                        </button>
                        <button id="qa-mark-pm" class="btn btn-outline flex-col h-auto py-6 gap-2 hover:border-indigo-500/50 hover:bg-indigo-500/5 group">
                            <i data-lucide="moon" class="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform"></i>
                            <span>Mark PM Done</span>
                        </button>
                        <button id="qa-wfh" class="btn btn-outline flex-col h-auto py-6 gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 group">
                            <i data-lucide="home" class="w-6 h-6 text-primary group-hover:scale-110 transition-transform"></i>
                            <span>WFH Punch Now</span>
                        </button>
                         <button id="qa-range-off" class="btn btn-outline flex-col h-auto py-6 gap-2 hover:border-orange-500/50 hover:bg-orange-500/5 group">
                            <i data-lucide="calendar-days" class="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform"></i>
                            <span>Multi-day OFF</span>
                        </button>
                    </div>

                    <div class="flex flex-wrap gap-4 pt-4">
                         <button id="qa-off" class="btn btn-secondary gap-2 flex-1 min-w-[140px]">
                            <i data-lucide="ban" class="w-4 h-4"></i>
                            Mark Today OFF
                        </button>
                        ${day.isOff ? `
                        <button id="qa-clear-off" class="btn btn-outline gap-2 flex-1 min-w-[140px] text-success hover:bg-success/5">
                            <i data-lucide="check" class="w-4 h-4"></i>
                            Clear OFF Status
                        </button>` : ''}
                    </div>
                </div>

            </div>`;

    lucide.createIcons();

    // System toggle
    $('#system-toggle').addEventListener('change', async (e) => {
      const val = e.target.checked;
      try {
        await API.updateConfig(val);
        toast(`System ${val ? 'enabled' : 'disabled'}`, 'success');
        setTimeout(() => onHashChange(), 500);
      } catch (err) {
        toast(err.message, 'error');
        e.target.checked = !val;
      }
    });

    $('#qa-mark-am').onclick = async () => {
      try { await API.markDone('am'); toast('AM marked done ✅', 'success'); setTimeout(() => onHashChange(), 500); }
      catch (e) { toast(e.message, 'error'); }
    };

    $('#qa-mark-pm').onclick = async () => {
      try { await API.markDone('pm'); toast('PM marked done ✅', 'success'); setTimeout(() => onHashChange(), 500); }
      catch (e) { toast(e.message, 'error'); }
    };

    $('#qa-wfh').onclick = async () => {
      const btn = $('#qa-wfh');
      btn.disabled = true;
      try { await API.markWfhToday(); toast('WFH punch triggered 🚀', 'success'); }
      catch (e) { toast(e.message, 'error'); }
      finally { btn.disabled = false; }
    };

    $('#qa-off').onclick = async () => {
      if (!confirm(`Mark ${date} as OFF?`)) return;
      try { await API.markOff(date); toast('Marked OFF', 'success'); setTimeout(() => onHashChange(), 500); }
      catch (e) { toast(e.message, 'error'); }
    };

    const clearOff = $('#qa-clear-off');
    if (clearOff) clearOff.onclick = async () => {
      try { await API.clearOff(date); toast('OFF cleared', 'success'); setTimeout(() => onHashChange(), 500); }
      catch (e) { toast(e.message, 'error'); }
    };

    $('#qa-range-off').onclick = showRangeOffModal;

    window._openLightbox = openLightbox;

  } catch (err) {
    container.innerHTML = `
            <div class="max-w-md mx-auto card p-12 flex flex-col items-center gap-6 text-center">
                <div class="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <i data-lucide="alert-triangle" class="w-8 h-8"></i>
                </div>
                <div class="space-y-2">
                    <h3 class="text-xl font-bold">Failed to load data</h3>
                    <p class="text-sm text-muted-foreground">${err.message}</p>
                </div>
                <button class="btn btn-primary" onclick="window.location.reload()">Retry Connection</button>
            </div>
        `;
    lucide.createIcons();
  }
}

async function renderHistory(container) {
  container.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 class="text-2xl font-bold flex items-center gap-3">
                    <i data-lucide="history" class="w-6 h-6 text-primary"></i>
                    Punch History
                </h2>
                <div class="flex items-center gap-2">
                    <select id="hist-days" class="bg-slate-900 border border-slate-800 text-sm rounded-lg p-2 focus:ring-primary focus:border-primary">
                        <option value="7">Last 7 Days</option>
                        <option value="14">Last 14 Days</option>
                        <option value="30" selected>Last 30 Days</option>
                    </select>
                    <button id="hist-refresh" class="btn btn-outline h-9 w-9 p-0 hover:text-primary"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 w-fit">
                <button class="filter-chip active" data-filter="all">All</button>
                <button class="filter-chip" data-filter="success">Success</button>
                <button class="filter-chip" data-filter="fail">Failures</button>
                <button class="filter-chip" data-filter="off">Days OFF</button>
            </div>

            <div id="hist-list" class="grid grid-cols-1 gap-3"></div>
        </div>
    `;

  lucide.createIcons();

  let currentFilter = 'all';
  let records = [];

  const loadHistory = async () => {
    const days = parseInt($('#hist-days').value, 10);
    const list = $('#hist-list');
    setLoading(list, 'Scanning history data...');
    try {
      const data = await API.getHistory(days);
      records = data.records || [];
      renderList();
    } catch (err) {
      list.innerHTML = `<div class="card p-12 text-center text-destructive">${err.message}</div>`;
    }
  };

  const renderList = () => {
    const list = $('#hist-list');
    let filtered = records;
    if (currentFilter === 'off') filtered = records.filter(r => r.day.isOff);
    else if (currentFilter === 'success') filtered = records.filter(r => r.periods.am.status === 'success' || r.periods.pm.status === 'success');
    else if (currentFilter === 'fail') filtered = records.filter(r => r.periods.am.status === 'fail' || r.periods.pm.status === 'fail');

    if (!filtered.length) {
      list.innerHTML = `
                <div class="card p-20 flex flex-col items-center gap-4 text-center border-dashed">
                    <i data-lucide="folder-open" class="w-12 h-12 text-slate-800"></i>
                    <p class="text-sm text-muted-foreground">No records found for this criteria.</p>
                </div>`;
      lucide.createIcons();
      return;
    }

    list.innerHTML = filtered.map(r => {
      const am = r.periods.am || { status: 'pending' };
      const pm = r.periods.pm || { status: 'pending' };
      const isOff = r.day.isOff;
      const isToday = r.date === todayVN();

      return `
                <div class="card p-4 flex items-center justify-between hover:border-slate-700 transition-colors ${isToday ? 'bg-primary/5 border-primary/20' : ''}">
                    <div class="flex items-center gap-4 min-w-[140px]">
                        <div class="w-10 h-10 rounded-lg flex flex-col items-center justify-center bg-slate-900 border border-slate-800 text-[10px] font-bold">
                           <span class="text-muted-foreground uppercase leading-none">${dayLabel(r.date)}</span>
                           <span class="mt-0.5 text-xs text-foreground uppercase">${r.date.split('-')[2]}</span>
                        </div>
                        <div>
                            <p class="text-sm font-semibold">${r.date}</p>
                            <p class="text-[10px] font-bold opacity-50 uppercase tracking-tighter">${isToday ? 'TODAY' : isOff ? 'SYSTEM OFF' : ''}</p>
                        </div>
                    </div>

                    <div class="hidden sm:flex items-center gap-8 flex-1 justify-center">
                        <div class="flex flex-col items-center gap-1.5">
                            <span class="text-[9px] uppercase font-bold text-muted-foreground">AM</span>
                            ${isOff ? '<span class="text-slate-800">—</span>' : statusBadge(am.status)}
                        </div>
                        <div class="flex flex-col items-center gap-1.5">
                            <span class="text-[9px] uppercase font-bold text-muted-foreground">PM</span>
                            ${isOff ? '<span class="text-slate-800">—</span>' : statusBadge(pm.status)}
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                         ${am.imageUrl ? `
                            <button class="w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:border-primary transition-colors group relative" onclick="window._openLightbox('${am.imageUrl}', 'AM — ${r.date}')">
                                <img src="${am.imageUrl}" class="w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100"><i data-lucide="maximize" class="w-4 h-4 text-white"></i></div>
                            </button>` : ''}
                         ${pm.imageUrl ? `
                            <button class="w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:border-primary transition-colors group relative" onclick="window._openLightbox('${pm.imageUrl}', 'PM — ${r.date}')">
                                <img src="${pm.imageUrl}" class="w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100"><i data-lucide="maximize" class="w-4 h-4 text-white"></i></div>
                            </button>` : ''}
                    </div>
                </div>
            `;
    }).join('');
    lucide.createIcons();
  };

  $$('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      $$('.filter-chip').forEach(c => c.classList.remove('active', 'bg-primary/20', 'text-primary', 'border-primary/30'));
      $$('.filter-chip').forEach(c => c.classList.add('bg-transparent', 'text-muted-foreground'));

      chip.classList.add('active', 'bg-primary/20', 'text-primary', 'border-primary/30');
      chip.classList.remove('text-muted-foreground');
      currentFilter = chip.dataset.filter;
      renderList();
    };
  });

  // Initial active state for filter
  $('.filter-chip[data-filter="all"]').click();

  $('#hist-days').onchange = loadHistory;
  $('#hist-refresh').onclick = loadHistory;
  await loadHistory();
}

async function renderSettings(container) {
  const data = await API.getState();
  const config = data.config;

  container.innerHTML = `
        <div class="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
            <h2 class="text-2xl font-bold flex items-center gap-3">
                <i data-lucide="settings-2" class="w-6 h-6 text-primary"></i>
                Settings
            </h2>

            <div class="space-y-6">
                <!-- System Config -->
                <div class="card p-6 space-y-4">
                    <h3 class="font-bold flex items-center gap-2">
                         <i data-lucide="shield" class="w-4 h-4 text-primary"></i>
                         Core Configuration
                    </h3>
                    <div class="flex items-center justify-between py-4 border-y border-slate-900">
                        <div>
                            <p class="font-medium">System Auto-Punch</p>
                            <p class="text-xs text-muted-foreground">Toggle the entire automation engine ON or OFF.</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="s-toggle" class="sr-only peer" ${config.isEnabled ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                    <div class="pt-2">
                        <button id="s-reset-state" class="btn btn-outline w-full text-destructive hover:bg-destructive/5 gap-2">
                            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                            Reset Current Day State
                        </button>
                    </div>
                </div>

                <!-- Auth -->
                <div class="card p-6 space-y-4">
                    <h3 class="font-bold flex items-center gap-2">
                         <i data-lucide="key-round" class="w-4 h-4 text-primary"></i>
                         Access Security
                    </h3>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-xs font-semibold text-muted-foreground uppercase">Update Secret Key</label>
                            <div class="flex gap-2">
                                <input type="password" id="s-new-secret" class="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm" placeholder="••••••••">
                                <button id="s-save-secret" class="btn btn-primary h-9">Update</button>
                            </div>
                        </div>
                        <p class="text-[10px] text-muted-foreground leading-relaxed italic">The secret is stored in your browser session and used for API authentication.</p>
                    </div>
                </div>

                <!-- Footer Info -->
                <div class="text-center space-y-2 pt-4">
                    <p class="text-xs text-muted-foreground">Auto Punch v4.0.0 — Premium Dashboard</p>
                    <p class="text-[10px] text-muted-foreground/40">Powered by Vercel Serverless & Cloudinary</p>
                </div>
            </div>
        </div>
    `;

  lucide.createIcons();

  $('#s-toggle').onchange = async (e) => {
    const val = e.target.checked;
    try { await API.updateConfig(val); toast(`System ${val ? 'active' : 'paused'}`, 'success'); }
    catch (err) { toast(err.message, 'error'); e.target.checked = !val; }
  };

  $('#s-save-secret').onclick = () => {
    const val = $('#s-new-secret').value.trim();
    if (!val) return toast('Input cannot be empty', 'error');
    API.setSecret(val);
    toast('Security secret updated', 'success');
    $('#s-new-secret').value = '';
  };

  $('#s-reset-state').onclick = async () => {
    if (!confirm("Are you sure? This will clear today's status for both AM and PM.")) return;
    try {
      await API.clearOff(todayVN());
      await API.markDone('am', todayVN(), true); // clear
      await API.markDone('pm', todayVN(), true); // clear
      toast('Day state reset successfully', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
}

// ── Boot ──────────────────────────────────────────────────────

async function boot() {
  startClock();

  // Try to auto-fill secret from /api/dev-secret
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    if (!API.hasSecret()) {
      try {
        const res = await fetch('/api/dev-secret');
        const data = await res.json();
        if (data.ok && data.secret) {
          API.setSecret(data.secret);
          console.log('🏗️ Dev Mode: auto-filled secret from local API');
        }
      } catch (e) { }
    }
  }

  // Auth check
  if (!API.hasSecret()) {
    await showAuthModal();
  }

  // Tabs setup
  $$('.nav-tab').forEach(tab => {
    tab.onclick = () => {
      window.location.hash = tab.dataset.page;
    };
  });

  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}

function onHashChange() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const page = routes[hash] ? hash : 'dashboard';

  // Update nav UI
  $$('.nav-tab').forEach(t => {
    if (t.dataset.page === page) {
      t.classList.add('text-primary', 'bg-primary/10');
      t.classList.remove('text-muted-foreground');
    } else {
      t.classList.remove('text-primary', 'bg-primary/10');
      t.classList.add('text-muted-foreground');
    }
  });

  const app = $('#app');
  setLoading(app);
  routes[page](app);
}

const routes = {
  dashboard: renderDashboard,
  history: renderHistory,
  settings: renderSettings,
};

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

boot();
