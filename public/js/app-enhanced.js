// File: public/js/app-enhanced.js
// Enhanced Auto Punch Dashboard with comprehensive UI/UX improvements

import * as API from './api.js';
import * as Utils from './utils.js';
import * as Charts from './charts.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ══════════════════════════════════════════════════════════════
// Global State
// ══════════════════════════════════════════════════════════════

let globalState = {
    currentPage: 'dashboard',
    historyRecords: [],
    countdownInterval: null,
    calendarMonth: new Date()
};

// ══════════════════════════════════════════════════════════════
// Toast Notifications
// ══════════════════════════════════════════════════════════════

function toast(msg, type = 'info') {
    const c = $('#toast-container');
    const t = document.createElement('div');
    t.className = `toast`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    const color = type === 'success' ? 'text-green-500' : type === 'error' ? 'text-red-500' : 'text-blue-500';
    t.innerHTML = `<i data-lucide="${icon}" class="${color} w-5 h-5"></i><span>${msg}</span>`;
    c.appendChild(t);
    lucide.createIcons();
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// ══════════════════════════════════════════════════════════════
// Helper Functions
// ══════════════════════════════════════════════════════════════

function statusBadge(status, source) {
    let cls = "badge-pending", icon = "clock", text = "Pending";
    const isManual = status === 'manual_done' || source === 'api' || source === 'telegram';

    if (status === 'success' || status === 'manual_done') {
        if (isManual) {
            cls = "badge-success !bg-blue-500/10 !text-blue-600 !border-blue-500/20";
            icon = "check";
            text = "Manual";
        } else {
            cls = "badge-success";
            icon = "check-circle";
            text = (source === 'gha' || source === 'cron-reset' || source === 'auto') ? "Auto" : "Success";
        }
    }
    else if (status === 'fail') { cls = "badge-fail"; icon = "x-circle"; text = "Failed"; }
    return `<span class="badge ${cls}"><i data-lucide="${icon}" class="w-3 h-3"></i>${text}</span>`;
}

function showSkeleton(container) {
    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 py-10">
            <div class="skeleton skeleton-card"></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
            </div>
            <div class="skeleton skeleton-card"></div>
        </div>
    `;
}

// ══════════════════════════════════════════════════════════════
// Status Bar
// ══════════════════════════════════════════════════════════════

function renderStatusGuide(data) {
    const container = $('#status-bar-container');
    if (!container) return;
    const { config, day, date, periods } = data;
    const isEnabled = config.isEnabled;
    const times = config.times || { am: '08:30', pm: '20:00' };
    const p = periods || {};
    const amStatus = p.am ? p.am.status : 'pending';
    const pmStatus = p.pm ? p.pm.status : 'pending';

    // Use server-computed effectiveMode (override > schedule) — most reliable
    const dayType = day.effectiveMode || day.modeOverride || (() => {
        const schedule = config.schedule || {};
        const dayIdx = new Date(date + 'T00:00:00+07:00').getDay();
        return schedule[String(dayIdx)] || schedule[dayIdx] || 'wio';
    })();
    const isSwapped = !!day.modeOverride && day.modeOverride !== day.scheduleMode;

    let modeIcon, modeLabel, modeBg;
    if (day.isOff) {
        modeIcon = 'umbrella'; modeLabel = 'Day Off'; modeBg = 'bg-orange-500/10 text-orange-600';
    } else if (dayType === 'wfh') {
        modeIcon = 'laptop';
        modeLabel = isSwapped ? 'WFH — Auto-Punch 🔄' : 'WFH — Auto-Punch';
        modeBg = 'bg-primary/10 text-primary';
    } else {
        modeIcon = 'building-2';
        modeLabel = isSwapped ? 'Văn Phòng — Manual 🔄' : 'Văn Phòng — Manual';
        modeBg = 'bg-muted text-muted-foreground';
    }

    const autoRun = isEnabled && !day.isOff && dayType === 'wfh';
    const punchIcon = (st) => {
        if (st === 'success' || st === 'manual_done') return `<i data-lucide="check-circle" class="w-3 h-3 text-green-500"></i>`;
        if (st === 'fail') return `<i data-lucide="x-circle" class="w-3 h-3 text-red-500"></i>`;
        return `<i data-lucide="clock" class="w-3 h-3 text-muted-foreground/40"></i>`;
    };

    container.innerHTML = `
        <div class="status-bar">
            <div class="container flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}"></div>
                        <span class="font-black uppercase tracking-tight text-[11px] ${isEnabled ? 'text-primary' : 'text-red-500'}">${isEnabled ? 'Active' : 'Paused'}</span>
                    </div>
                    <span class="opacity-20">|</span>
                    <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full ${modeBg} shrink-0">
                        <i data-lucide="${modeIcon}" class="w-3 h-3"></i>
                        <span class="text-[10px] font-black uppercase tracking-wider">${modeLabel}</span>
                    </div>
                    <span class="opacity-20 hidden sm:block">|</span>
                    <div class="hidden sm:flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
                        <div class="flex items-center gap-1">${punchIcon(amStatus)}<span>AM ${amStatus === 'pending' ? times.am : (p.am && p.am.recordedPunchTime) || '✓'}</span></div>
                        <div class="flex items-center gap-1">${punchIcon(pmStatus)}<span>PM ${pmStatus === 'pending' ? times.pm : (p.pm && p.pm.recordedPunchTime) || '✓'}</span></div>
                        <div class="flex items-center gap-1">
                            <i data-lucide="${autoRun ? 'zap' : 'hand'}" class="w-3 h-3 ${autoRun ? 'text-primary' : 'text-muted-foreground/60'}"></i>
                            <span>${autoRun ? 'Auto' : 'Manual'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 text-muted-foreground/60 font-mono text-[10px] shrink-0">
                    <span class="hidden md:block">${date}</span>
                    <span class="hidden lg:block">v4.4.0</span>
                </div>
            </div>
        </div>`;
    lucide.createIcons({ nodes: [container] });
}


function showMarkOffModal(dateHint = Utils.todayVN()) {
    const root = $('#modal-root');
    root.innerHTML = `
        <div class="modal-overlay animate-in">
            <div class="modal-content scale-in-95 animate-in">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-2xl">🌴</span>
                        <h2 class="text-xl font-black">Set Vacation</h2>
                    </div>
                    <button class="modal-close p-1 hover:bg-muted rounded-full transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
                
                <div class="flex p-1 bg-muted rounded-xl gap-1">
                    <button class="mode-tab flex-1 active" data-mode="range">
                        <i data-lucide="calendar-range" class="w-3.5 h-3.5 mr-1.5 inline-block"></i>Strict Range
                    </button>
                    <button class="mode-tab flex-1" data-mode="partial">
                        <i data-lucide="timer" class="w-3.5 h-3.5 mr-1.5 inline-block"></i>Partial Skip
                    </button>
                </div>

                <div id="mode-content-range" class="mode-section space-y-4">
                    <div class="relative">
                        <i data-lucide="calendar" class="w-4 h-4 absolute left-3 top-3.5 text-primary"></i>
                        <input type="text" id="off-range-picker" class="input !pl-10" placeholder="Select dates...">
                    </div>
                    <div id="range-preview" class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Select start & end date</div>
                </div>

                <div id="mode-content-partial" class="mode-section hidden space-y-4">
                    <div class="relative">
                        <i data-lucide="calendar-days" class="w-4 h-4 absolute left-3 top-3.5 opacity-40"></i>
                        <input type="date" id="off-partial-date" class="input !pl-10" value="${dateHint}">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button class="btn btn-outline h-14 flex-col !gap-1 partial-opt" data-period="am">
                            <i data-lucide="sun" class="w-4 h-4 text-orange-500"></i>
                            <span class="text-[10px] font-black uppercase">Morning</span>
                        </button>
                        <button class="btn btn-outline h-14 flex-col !gap-1 partial-opt" data-period="pm">
                            <i data-lucide="moon" class="w-4 h-4 text-indigo-500"></i>
                            <span class="text-[10px] font-black uppercase">Evening</span>
                        </button>
                    </div>
                </div>

                <div class="p-4 bg-primary/5 rounded-2xl flex gap-3 text-[11px] leading-snug font-medium text-primary/80">
                    <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                    <p>Hệ thống tự động Pause và Resume vào ngày WFH tiếp theo.</p>
                </div>

                <div class="flex flex-col gap-2 pt-2">
                    <button id="off-submit" class="btn btn-primary w-full h-11">Save Vacation</button>
                    <button id="off-clear" class="text-[10px] font-black uppercase text-red-500/60 hover:text-red-500 transition-colors w-full py-1">Clear today status</button>
                </div>
            </div>
        </div>`;
    lucide.createIcons();

    let selectedDates = [];
    const fp = flatpickr("#off-range-picker", {
        mode: "range", dateFormat: "Y-m-d", minDate: "today",
        onChange: (dates) => {
            selectedDates = dates;
            const p = $('#range-preview');
            if (dates.length === 2) {
                const diff = Math.ceil((dates[1] - dates[0]) / 86400000) + 1;
                p.textContent = `${diff} days of vacation selected`;
                p.classList.add('text-primary');
            } else { p.textContent = "Select end date"; p.classList.remove('text-primary'); }
        }
    });

    const tabs = $$('.mode-tab'), sections = $$('.mode-section');
    tabs.forEach(t => t.onclick = () => {
        tabs.forEach(b => b.classList.remove('active')); t.classList.add('active');
        sections.forEach(s => s.id === `mode-content-${t.dataset.mode}` ? s.classList.remove('hidden') : s.classList.add('hidden'));
    });

    const close = () => { if (fp) fp.destroy(); root.innerHTML = ''; };
    $$('.modal-close').forEach(b => b.onclick = close);

    let selectedPartial = null;
    $$('.partial-opt').forEach(b => b.onclick = () => {
        $$('.partial-opt').forEach(btn => btn.classList.remove('border-primary', 'text-primary', 'bg-primary/5'));
        b.classList.add('border-primary', 'text-primary', 'bg-primary/5');
        selectedPartial = b.dataset.period;
    });

    $('#off-clear').onclick = async () => { if (confirm('Clear OFF?')) { await API.clearOff(Utils.todayVN()); toast('Cleared', 'success'); close(); onHashChange(); } };
    $('#off-submit').onclick = async () => {
        const btn = $('#off-submit'); btn.disabled = true;
        try {
            if (tabs[0].classList.contains('active')) {
                if (selectedDates.length < 2) throw new Error('Choose range');
                await API.markOffRange(selectedDates[0].toLocaleDateString('en-CA'), selectedDates[1].toLocaleDateString('en-CA'));
            } else {
                if (!selectedPartial) throw new Error('Select session');
                await API.markDone(selectedPartial, $('#off-partial-date').value);
            }
            toast('Vacation Saved 🌴', 'success'); close(); onHashChange();
        } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
    };
}

// ══════════════════════════════════════════════════════════════
// Swap Day Modal
// ══════════════════════════════════════════════════════════════

function showSwapDayModal(schedule = {}) {
    const root = $('#modal-root');

    // Build next 14 days — includes weekends
    const days = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const iso = d.toLocaleDateString('en-CA');
        const dayIdx = d.getDay();
        const isWeekend = dayIdx === 0 || dayIdx === 6;
        const baseMode = schedule[String(dayIdx)] || schedule[dayIdx] || 'wio';
        // effectiveMode will be patched after bulk fetch; starts as baseMode
        days.push({ iso, dayIdx, isWeekend, baseMode, effectiveMode: baseMode, label: d.toLocaleDateString('vi-VN', { weekday: 'short' }), num: d.getDate(), month: d.getMonth() + 1 });
    }

    // pendingSwaps: { [iso]: toMode }
    let pendingSwaps = {};
    let weekendPicking = null; // iso of weekend day currently showing picker

    const modeBadge = (mode) => {
        if (mode === 'wfh') return `<span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">WFH</span>`;
        if (mode === 'off') return `<span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500">OFF</span>`;
        return `<span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">VP</span>`;
    };

    const renderBtn = (d, i) => {
        const isWeekendOff = d.isWeekend && d.baseMode === 'off';
        const isBlockedWeekday = !d.isWeekend && d.baseMode === 'off';
        const selected = !!pendingSwaps[d.iso];
        const toMode = pendingSwaps[d.iso];
        const isToday = i === 0;
        const hasOverride = d.effectiveMode !== d.baseMode;

        let borderCls, bgCls;
        if (selected) { borderCls = 'border-primary'; bgCls = 'bg-primary/5 shadow-sm shadow-primary/10'; }
        else if (isBlockedWeekday) { borderCls = 'border-transparent'; bgCls = 'bg-muted/20 opacity-30 cursor-not-allowed'; }
        else if (isWeekendOff) { borderCls = 'border-dashed border-orange-300/60'; bgCls = 'bg-orange-500/5 hover:border-orange-400/60 hover:bg-orange-500/10'; }
        else { borderCls = `border-transparent ${hasOverride ? 'ring-1 ring-primary/30' : ''}`; bgCls = 'bg-muted/40 hover:border-primary/30 hover:bg-muted/60'; }

        const todayDot = isToday ? `<span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-background"></span>` : '';
        const swapDot = (!selected && hasOverride) ? `<span class="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-primary/60"></span>` : '';
        const icon = selected
            ? `<i data-lucide="check" class="w-2.5 h-2.5 text-primary mt-0.5"></i>`
            : isWeekendOff
                ? `<i data-lucide="plus" class="w-2.5 h-2.5 text-orange-400 mt-0.5"></i>`
                : `<span class="h-3"></span>`;

        // Show effectiveMode as current badge (reflects KV override)
        const displayMode = (isWeekendOff && !hasOverride) ? 'off' : d.effectiveMode;
        return `<button class="swap-day-btn relative flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all ${borderCls} ${bgCls}" data-idx="${i}" ${isBlockedWeekday ? 'disabled' : ''}>
            ${todayDot}${swapDot}
            <span class="text-[8px] font-black uppercase ${d.isWeekend ? 'text-orange-400' : 'opacity-40'}">${d.label}</span>
            <span class="text-sm font-black leading-none">${d.num}</span>
            ${selected ? modeBadge(toMode) : modeBadge(displayMode)}
            ${icon}
        </button>`;
    };

    const buildSummary = () => {
        const keys = Object.keys(pendingSwaps);
        if (!keys.length) return `<p class="text-[11px] text-muted-foreground text-center py-1">Chọn ngày để đổi chế độ</p>`;
        return keys.map(iso => {
            const d = days.find(x => x.iso === iso);
            const toMode = pendingSwaps[iso];
            // fromMode = current effectiveMode (reflects existing KV override)
            const fromMode = d.effectiveMode;
            return `<div class="flex items-center justify-between text-[11px] py-1.5 border-b border-border/50 last:border-0">
                <span class="font-bold">${d.label} ${d.num}/${d.month}</span>
                <div class="flex items-center gap-2">
                    ${modeBadge(fromMode)}
                    <i data-lucide="arrow-right" class="w-3 h-3 opacity-30"></i>
                    ${modeBadge(toMode)}
                </div>
            </div>`;
        }).join('');
    };

    root.innerHTML = `
        <div class="modal-overlay animate-in">
            <div class="modal-content scale-in-95 animate-in max-w-md">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <i data-lucide="arrow-left-right" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-black leading-none">Swap Work Mode</h2>
                            <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Chọn nhiều ngày cùng lúc</p>
                        </div>
                    </div>
                    <button class="modal-close p-1 hover:bg-muted rounded-full transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <!-- Day Grid: 2 rows × 7 -->
                <div id="swap-day-grid" class="grid grid-cols-7 gap-1"></div>

                <!-- Weekend VP/WFH picker -->
                <div id="weekend-picker" class="hidden p-3 rounded-xl bg-orange-500/5 border border-orange-200/40 space-y-2">
                    <p class="text-[10px] font-black uppercase tracking-widest text-orange-500">Làm bù cuối tuần — chọn chế độ</p>
                    <div class="flex gap-2">
                        <button id="weekend-pick-wio" class="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-transparent bg-muted/60 hover:border-foreground/30 transition-all text-[11px] font-black">
                            <i data-lucide="building-2" class="w-4 h-4 text-muted-foreground"></i> Lên Văn Phòng
                        </button>
                        <button id="weekend-pick-wfh" class="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-transparent bg-primary/10 hover:border-primary/40 transition-all text-[11px] font-black text-primary">
                            <i data-lucide="laptop" class="w-4 h-4"></i> WFH (Auto Punch)
                        </button>
                    </div>
                </div>

                <!-- Summary list -->
                <div id="swap-summary" class="min-h-[44px] px-1"></div>

                <div id="swap-warning" class="hidden p-3 rounded-xl bg-orange-500/5 text-orange-600 flex gap-2 text-[11px] font-medium">
                    <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0 mt-0.5"></i>
                    <span>Một số ngày đổi về VP — nhớ check-in thủ công!</span>
                </div>

                <div class="flex gap-2">
                    <button class="modal-close btn btn-outline flex-1 h-10 font-black">Hủy</button>
                    <button id="swap-confirm" class="btn btn-primary flex-[2] h-10 font-black" disabled>Xác nhận đổi</button>
                </div>
            </div>
        </div>`;
    lucide.createIcons();

    const rerender = () => {
        const grid = $('#swap-day-grid');
        grid.innerHTML = days.map((d, i) => renderBtn(d, i)).join('');
        lucide.createIcons({ nodes: [grid] });
        attachGridListeners();

        const keys = Object.keys(pendingSwaps);
        $('#swap-confirm').disabled = keys.length === 0;
        const summary = $('#swap-summary');
        summary.innerHTML = buildSummary();
        lucide.createIcons({ nodes: [summary] });

        const hasWio = keys.some(iso => pendingSwaps[iso] === 'wio');
        $('#swap-warning').classList.toggle('hidden', !hasWio);
    };

    const showWeekendPicker = (iso) => {
        weekendPicking = iso;
        const picker = $('#weekend-picker');
        picker.classList.remove('hidden');
        lucide.createIcons({ nodes: [picker] });
        $('#weekend-pick-wio').onclick = () => {
            pendingSwaps[iso] = 'wio';
            weekendPicking = null;
            picker.classList.add('hidden');
            rerender();
        };
        $('#weekend-pick-wfh').onclick = () => {
            pendingSwaps[iso] = 'wfh';
            weekendPicking = null;
            picker.classList.add('hidden');
            rerender();
        };
    };

    const attachGridListeners = () => {
        $$('.swap-day-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.idx);
                const d = days[i];
                if (btn.disabled) return;

                if (pendingSwaps[d.iso]) {
                    // Deselect
                    delete pendingSwaps[d.iso];
                    if (weekendPicking === d.iso) {
                        weekendPicking = null;
                        $('#weekend-picker').classList.add('hidden');
                    }
                    rerender();
                    return;
                }

                if (d.isWeekend && d.baseMode === 'off') {
                    showWeekendPicker(d.iso);
                } else {
                    // Toggle from effectiveMode (respects existing KV override)
                    pendingSwaps[d.iso] = d.effectiveMode === 'wfh' ? 'wio' : 'wfh';
                    rerender();
                }
            });
        });
    };

    rerender();

    // Async-load KV overrides for all 14 days, patch effectiveMode, re-render
    (async () => {
        try {
            const res = await API.getBulkState(days.map(d => d.iso));
            if (res.byDate) {
                days.forEach(d => {
                    const s = res.byDate[d.iso];
                    if (s) {
                        d.effectiveMode = s.effectiveMode || d.baseMode;
                        d.modeOverride = s.modeOverride || null;
                    }
                });
                rerender();
            }
        } catch (e) { /* silently ignore — schedule-based fallback already rendered */ }
    })();

    const close = () => root.innerHTML = '';
    $$('.modal-close').forEach(b => b.onclick = close);

    $('#swap-confirm').onclick = async () => {
        const btn = $('#swap-confirm');
        btn.disabled = true;
        btn.textContent = 'Đang xử lý...';
        try {
            const entries = Object.entries(pendingSwaps);
            await Promise.all(entries.map(([date, toMode]) => API.swapDay(date, toMode)));
            const wfhCount = entries.filter(([, m]) => m === 'wfh').length;
            const wioCount = entries.filter(([, m]) => m === 'wio').length;
            const parts = [];
            if (wfhCount) parts.push(`${wfhCount} ngày → WFH`);
            if (wioCount) parts.push(`${wioCount} ngày → VP`);
            toast('🔄 ' + parts.join(', '), 'success');
            close();
            onHashChange();
        } catch (e) {
            toast(e.message || 'Có lỗi xảy ra', 'error');
            btn.disabled = false;
            btn.textContent = 'Xác nhận đổi';
        }
    };
}

// ══════════════════════════════════════════════════════════════
// Dashboard Page - ENHANCED
// ══════════════════════════════════════════════════════════════

async function renderDashboard(container) {
    try {
        showSkeleton(container);

        const [data, historyData] = await Promise.all([
            API.getState(),
            API.getHistory(30)
        ]);

        renderStatusGuide(data);
        globalState.historyRecords = historyData.records || [];

        const { config, day, periods, date } = data;
        const { records } = historyData;
        const schedule = config.schedule || {};
        const times = config.times || { am: '08:30', noon: '13:30', pm: '20:00' };

        // Fetch monthly state for calendar fallback
        let calendarBulkState = {};
        const fetchMonthBulkState = async (monthDate) => {
            const d = new Date(monthDate);
            const y = d.getFullYear(), m = d.getMonth();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const dates = Array.from({ length: daysInMonth }, (_, i) => `${y}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
            try {
                return await API.getBulkState(dates);
            } catch { return {}; }
        };
        calendarBulkState = await fetchMonthBulkState(date);

        // Stats
        const successRate = Utils.calculateSuccessRate(records);
        const streak = Utils.calculateStreak(records);
        const monthlyStats = Utils.getMonthlyStats(records);

        // Fetch recent changes
        let recentEvents = [];
        try {
            const evRes = await fetch('/api/events?limit=4');
            const evData = await evRes.json();
            recentEvents = evData.events || [];
        } catch (e) { console.warn('Fail to load recent events'); }

        container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <!-- 1. Top Calendar Section -->
            <div class="space-y-4">
                <div class="flex items-center justify-between px-1">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"></div>
                        <h3 class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Lịch tuần / Week View</h3>
                    </div>
                    <button id="toggle-calendar-view" class="text-[9px] font-black uppercase bg-primary/10 text-primary px-3 py-1 rounded-full hover:bg-primary hover:text-white transition-all flex items-center gap-1.5">
                        <span id="calendar-toggle-text">Xem tháng</span>
                        <i data-lucide="calendar" class="w-3 h-3"></i>
                    </button>
                </div>
                
                <div id="calendar-view-container" class="animate-in zoom-in-95 duration-500">
                    ${Charts.renderWeekView(records, date, calendarBulkState, config)}
                </div>
                
                <div id="full-calendar-wrapper" class="hidden animate-in slide-in-from-top-4 duration-500">
                    <div class="card !p-2 bg-gradient-to-br from-card to-muted/30">
                        <div id="mini-calendar-container">
                            ${Charts.renderMiniCalendar(records, date, calendarBulkState, config)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Status Hub -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Today Premium Card -->
                <div class="card bg-gradient-to-br from-primary/10 via-card to-card border-none shadow-xl shadow-primary/5 group">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-[10px] font-black text-primary/60 uppercase tracking-widest">Hôm nay / Today</span>
                        <div class="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-black animate-pulse">LIVE</div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-500">
                            <i data-lucide="${day.isOff ? 'umbrella' : (day.effectiveMode === 'wfh' ? 'laptop' : 'building-2')}" class="w-8 h-8"></i>
                        </div>
                        <div class="space-y-0.5">
                            <h4 class="text-xl font-black tracking-tight">${day.isOff ? 'Day Off 🌴' : (day.effectiveMode === 'wfh' ? 'WFH Home' : 'Office Work')}</h4>
                            <p class="text-xs font-semibold text-muted-foreground">${day.isOff ? 'Relax & Enjoy!' : 'Tracking session active'}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 mt-6">
                        <div class="p-3 rounded-xl bg-card border border-border/50 flex flex-col gap-1">
                            <span class="text-[8px] font-black text-muted-foreground uppercase">Sáng (AM)</span>
                            <div class="flex items-center justify-between">
                                <span class="text-sm font-black italic tabular-nums">${periods.am.recordedPunchTime || times.am}</span>
                                <i data-lucide="${periods.am.status === 'success' ? 'check-circle' : 'clock'}" class="w-3.5 h-3.5 ${periods.am.status === 'success' ? 'text-green-500' : 'text-muted-foreground/30'}"></i>
                            </div>
                        </div>
                        <div class="p-3 rounded-xl bg-card border border-border/50 flex flex-col gap-1">
                            <span class="text-[8px] font-black text-muted-foreground uppercase">Chiều (PM)</span>
                            <div class="flex items-center justify-between">
                                <span class="text-sm font-black italic tabular-nums">${periods.pm.recordedPunchTime || times.pm}</span>
                                <i data-lucide="${periods.pm.status === 'success' ? 'check-circle' : 'clock'}" class="w-3.5 h-3.5 ${periods.pm.status === 'success' ? 'text-green-500' : 'text-muted-foreground/30'}"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tomorrow Premium Card -->
                <div id="tomorrow-card" class="card bg-card border-none shadow-lg">
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Ngày mai / Tomorrow</span>
                        <i data-lucide="calendar-days" class="w-3.5 h-3.5 text-muted-foreground/30"></i>
                    </div>
                    <div id="tomorrow-content">
                        <div class="flex items-center gap-4 animate-pulse">
                            <div class="w-14 h-14 rounded-2xl bg-muted"></div>
                            <div class="space-y-2">
                                <div class="w-32 h-4 bg-muted rounded-full"></div>
                                <div class="w-20 h-3 bg-muted rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Bottom Grid: History & Actions -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Recent Changes Line Feed -->
                <div class="lg:col-span-1 space-y-6">
                    <div class="space-y-4">
                        <h3 class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Tiếp theo / Next Session</h3>
                        <div class="card p-5 bg-primary shadow-xl shadow-primary/20 text-primary-foreground border-none overflow-hidden relative group">
                            <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                            <div class="relative z-10 space-y-3">
                                <div class="flex items-center justify-between">
                                    <span class="countdown-label text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Next Punch In</span>
                                    <i data-lucide="timer" class="w-4 h-4 opacity-50"></i>
                                </div>
                                <div class="flex items-center gap-1">
                                    <span id="cd-hours" class="text-3xl font-black tabular-nums tracking-tighter">00</span>
                                    <span class="text-xl font-black opacity-30">:</span>
                                    <span id="cd-minutes" class="text-3xl font-black tabular-nums tracking-tighter">00</span>
                                    <span class="text-xl font-black opacity-30">:</span>
                                    <span id="cd-seconds" class="text-3xl font-black tabular-nums tracking-tighter">00</span>
                                </div>
                                <div class="countdown-target text-[9px] font-black uppercase opacity-60 tracking-wider">Target: --:--</div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h3 class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Thay đổi gần đây / Recent</h3>
                        <div class="card !p-4 border-dashed bg-transparent shadow-none hover:bg-muted/10">
                            <div class="space-y-1">
                                ${Charts.renderRecentHistoryChanges(recentEvents)}
                            </div>
                            <a href="#history" class="block text-center text-[9px] font-black uppercase text-primary mt-4 hover:underline py-2 border-t border-border/50">Details</a>
                        </div>
                    </div>
                </div>

                <!-- Actions & Stats Combined -->
                <div class="lg:col-span-2 space-y-5">
                    <div class="space-y-4">
                         <h3 class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Công cụ / Quick Tools</h3>
                         <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            <button id="qa-wfh" class="btn btn-primary btn-action shadow-lg shadow-primary/20 hover:scale-105 transition-transform h-14">
                                <i data-lucide="zap" class="w-4 h-4"></i>
                                <span>Punch</span>
                            </button>
                            <button id="qa-swap-day" class="btn btn-outline btn-action hover:border-primary/50 group h-14">
                                <i data-lucide="arrow-left-right" class="w-4 h-4 text-primary group-hover:rotate-180 transition-transform duration-500"></i>
                                <span>Swap</span>
                            </button>
                            <button id="qa-range-off" class="btn btn-outline btn-action group h-14">
                                <i data-lucide="umbrella" class="w-4 h-4 text-orange-400 group-hover:scale-110"></i>
                                <span>Vacay</span>
                            </button>
                            <button id="qa-mark-am" class="btn btn-outline btn-action h-14">
                                <i data-lucide="sun" class="w-4 h-4 text-amber-500"></i>
                                <span>Skip A</span>
                            </button>
                            <button id="qa-mark-pm" class="btn btn-outline btn-action h-14">
                                <i data-lucide="moon" class="w-4 h-4 text-indigo-500"></i>
                                <span>Skip P</span>
                            </button>
                         </div>
                    </div>

                    <div class="grid grid-cols-3 gap-3">
                        <div class="p-3 rounded-2xl bg-card border border-border shadow-sm text-center">
                            <div class="text-[8px] font-black text-muted-foreground uppercase">Success</div>
                            <div class="text-base font-black text-foreground">${successRate}%</div>
                        </div>
                        <div class="p-3 rounded-2xl bg-card border border-border shadow-sm text-center">
                            <div class="text-[8px] font-black text-muted-foreground uppercase">Streak</div>
                            <div class="text-base font-black text-foreground">${streak}d</div>
                        </div>
                        <div class="p-3 rounded-2xl bg-card border border-border shadow-sm text-center">
                            <div class="text-[8px] font-black text-muted-foreground uppercase">Work Days</div>
                            <div class="text-base font-black text-foreground">${monthlyStats.workDays}</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>`;

        lucide.createIcons();

        // Expand Calendar Logic
        let calendarExpanded = false;
        $('#toggle-calendar-view').onclick = () => {
            calendarExpanded = !calendarExpanded;
            const text = $('#calendar-toggle-text');
            const wrapper = $('#full-calendar-wrapper');
            const weekView = $('#calendar-view-container');

            if (calendarExpanded) {
                text.textContent = 'Thu gọn';
                wrapper.classList.remove('hidden');
                weekView.classList.add('opacity-30', 'pointer-events-none', 'scale-95');
            } else {
                text.textContent = 'Xem tháng';
                wrapper.classList.add('hidden');
                weekView.classList.remove('opacity-30', 'pointer-events-none', 'scale-95');
            }
        };

        startCountdownTimer(times.am, times.pm);

        const loadTomorrowInfo = async () => {
            try {
                const tom = new Date(date + 'T00:00:00+07:00');
                tom.setDate(tom.getDate() + 1);
                const tomISO = tom.toISOString().split('T')[0];
                const res = await API.getBulkState([tomISO]);
                const st = res.byDate && res.byDate[tomISO];

                if (st && $('#tomorrow-content')) {
                    const mode = st.effectiveMode || st.scheduleMode || 'wio';
                    const icon = mode === 'wfh' ? 'laptop' : mode === 'off' ? 'moon' : 'building-2';
                    const color = mode === 'wfh' ? 'text-primary' : mode === 'off' ? 'text-orange-500' : 'text-muted-foreground';
                    const label = mode === 'wfh' ? 'Home Office' : mode === 'off' ? 'Day Off' : 'At Office';

                    const container = $('#tomorrow-content');
                    container.innerHTML = `
                        <div class="flex items-center gap-4 animate-in slide-in-from-right-4 duration-500">
                            <div class="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                                <i data-lucide="${icon}" class="w-7 h-7 ${color}"></i>
                            </div>
                            <div class="space-y-0.5">
                                <h4 class="text-xl font-black">${label}</h4>
                                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">${tom.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                            </div>
                        </div>
                    `;
                    lucide.createIcons({ nodes: [container] });
                }
            } catch (e) {
                const container = $('#tomorrow-content');
                if (container) container.innerHTML = `<p class="text-xs text-red-500 italic">Error loading schedule</p>`;
            }
        };
        loadTomorrowInfo();

        const attachNavListeners = () => {
            $$('.calendar-nav').forEach(btn => {
                btn.onclick = () => {
                    const nav = btn.dataset.nav;
                    if (nav === 'prev') globalState.calendarMonth.setMonth(globalState.calendarMonth.getMonth() - 1);
                    else globalState.calendarMonth.setMonth(globalState.calendarMonth.getMonth() + 1);
                    rerenderCalendar();
                };
            });
        };
        const rerenderCalendar = async () => {
            const mStr = globalState.calendarMonth.toISOString().split('T')[0];
            const bs = await fetchMonthBulkState(mStr);
            $('#mini-calendar-container').innerHTML = Charts.renderMiniCalendar(records, mStr, bs, config);
            lucide.createIcons();
            attachNavListeners();
            attachCalendarCellListeners(records, bs);
        };
        attachNavListeners();

        function attachCalendarCellListeners(recs, bulkSt) {
            const recMap = {};
            recs.forEach(r => { recMap[r.date] = r; });
            const byDate = (bulkSt && bulkSt.byDate) || {};

            const showPopup = (cell) => {
                const existing = document.querySelector('.calendar-popup');
                if (existing) existing.remove();
                const dt = cell.dataset.date;
                const rec = recMap[dt];
                const st = byDate[dt];
                const d = new Date(dt + 'T00:00:00+07:00');
                const dayLabelsPopup = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                const dayLabel = dayLabelsPopup[d.getDay()];
                const dd = dt.split('-');

                const mode = (st && (st.effectiveMode || st.scheduleMode)) || '—';
                const isSwapped = st && st.modeOverride && st.modeOverride !== st.scheduleMode;
                const modeText = mode === 'wfh' ? 'WFH' : mode === 'off' ? 'OFF' : 'Office';
                const modeColor = mode === 'wfh' ? 'text-primary' : mode === 'off' ? 'text-orange-500' : 'text-muted-foreground';

                const amP = rec?.periods?.am;
                const pmP = rec?.periods?.pm;
                const isOff = rec?.isOff || (rec?.day && rec.day.isOff) || (st && st.isOff);
                const autoRun = config.isEnabled && !isOff && mode === 'wfh';
                const systemLabel = autoRun ? 'Auto ⚡' : 'Manual ✋';

                const popupHtml = `
                    <div class="popup-header">
                        <div class="flex items-center gap-2">
                             <div class="w-2 h-2 rounded-full ${isOff ? 'bg-orange-500' : (mode === 'wfh' ? 'bg-primary' : 'bg-muted-foreground')}"></div>
                             <span>${dayLabel} ${dd[2]}/${dd[1]}</span>
                        </div>
                        <button class="popup-close"><i data-lucide="x" class="w-3 h-3"></i></button>
                    </div>
                    <div class="space-y-1.5 pt-1">
                        <div class="popup-row"><span>Chế độ / Mode</span><span class="${modeColor} font-black uppercase text-[10px]">${modeText}</span></div>
                        <div class="popup-row"><span>Hệ thống / System</span><span class="font-black text-[10px] uppercase">${systemLabel}</span></div>
                        <div class="popup-row"><span>Đã Swap / Swap</span><span class="font-black text-[10px] uppercase ${isSwapped ? 'text-amber-500' : 'text-muted-foreground/40'}">${isSwapped ? 'Đã đổi 🔄' : 'Gốc'}</span></div>
                        
                        ${!isOff ? `
                            <div class="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                                <div class="popup-row">
                                    <span class="flex items-center gap-1.5"><i data-lucide="sun" class="w-3 h-3 text-amber-500"></i> Sáng (AM)</span>
                                    <span class="font-mono font-bold">${amP?.recordedPunchTime || '—'}</span>
                                </div>
                                <div class="popup-row">
                                    <span class="flex items-center gap-1.5"><i data-lucide="moon" class="w-3 h-3 text-indigo-500"></i> Chiều (PM)</span>
                                    <span class="font-mono font-bold">${pmP?.recordedPunchTime || '—'}</span>
                                </div>
                            </div>
                        ` : `
                            <div class="mt-3 py-2 text-center bg-orange-500/10 rounded-lg">
                                <span class="text-[9px] font-black text-orange-600 uppercase">🌴 Day Off / Nghỉ</span>
                            </div>
                        `}
                    </div>
                `;
                const popup = document.createElement('div');
                popup.className = 'calendar-popup animate-in';
                popup.innerHTML = popupHtml;
                document.body.appendChild(popup);
                lucide.createIcons({ nodes: [popup] });

                const rect = cell.getBoundingClientRect();
                popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 200))}px`;
                popup.style.top = `${rect.bottom + 6}px`;

                popup.querySelector('.popup-close').onclick = () => popup.remove();

                const dismiss = (ev) => {
                    if (!popup.contains(ev.target) && !cell.contains(ev.target)) {
                        popup.remove();
                        document.removeEventListener('click', dismiss);
                    }
                };
                setTimeout(() => document.addEventListener('click', dismiss), 10);
            };

            $$('.calendar-cell[data-date], .week-cell[data-date]').forEach(cell => {
                cell.onclick = (e) => {
                    e.stopPropagation();
                    showPopup(cell);
                };
            });
        }
        attachCalendarCellListeners(records, calendarBulkState);

        $('#qa-range-off').onclick = () => showMarkOffModal(date);
        $('#qa-swap-day').onclick = () => showSwapDayModal(schedule);
        $('#qa-wfh').onclick = async () => { try { await API.markWfhToday(); toast('Manual Punch Sent!', 'success'); } catch (e) { toast(e.message, 'error'); } };
        $('#qa-mark-am').onclick = async () => { await API.markDone('am', date); onHashChange(); };
        $('#qa-mark-pm').onclick = async () => { await API.markDone('pm', date); onHashChange(); };

    } catch (e) {
        console.error('Dash error:', e);
        container.innerHTML = `<div class="p-20 text-center text-red-500">${e.message}</div>`;
    }
}

// Calculate statistics

function startCountdownTimer(amTime, pmTime) {
    if (globalState.countdownInterval) {
        clearInterval(globalState.countdownInterval);
    }

    const updateCountdown = () => {
        const now = Utils.getVietnamTime();
        const currentHour = now.getHours();

        let targetTime = amTime;
        let label = 'Next Punch In';

        if (currentHour >= 13) {
            targetTime = pmTime;
            label = 'Next Punch Out';
        } else if (currentHour >= 8) {
            targetTime = pmTime;
            label = 'Next Punch Out';
        }

        const countdown = Utils.getTimeUntil(targetTime);
        const hEl = $('#cd-hours'), mEl = $('#cd-minutes'), sEl = $('#cd-seconds');

        if (hEl) hEl.textContent = String(countdown.hours).padStart(2, '0');
        if (mEl) mEl.textContent = String(countdown.minutes).padStart(2, '0');
        if (sEl) sEl.textContent = String(countdown.seconds).padStart(2, '0');

        const labelEl = $('.countdown-label');
        if (labelEl) labelEl.textContent = label;

        const targetEl = $('.countdown-target');
        if (targetEl) targetEl.textContent = `Target: ${targetTime}`;
    };

    updateCountdown();
    globalState.countdownInterval = setInterval(updateCountdown, 1000);
}

function renderRecentActivity(records) {
    const container = $('#recent-activity');
    if (!container || !records.length) return;

    const activities = [];
    records.forEach(r => {
        if (r.periods?.am?.status === 'success' || r.periods?.am?.status === 'manual_done') {
            activities.push({
                icon: '☀️',
                title: `AM Punch: ${r.periods.am.recordedPunchTime || 'N/A'}`,
                time: r.date,
                color: 'bg-orange-500/10'
            });
        }
        if (r.periods?.pm?.status === 'success' || r.periods?.pm?.status === 'manual_done') {
            activities.push({
                icon: '🌙',
                title: `PM Punch: ${r.periods.pm.recordedPunchTime || 'N/A'}`,
                time: r.date,
                color: 'bg-indigo-500/10'
            });
        }
    });

    container.innerHTML = activities.slice(0, 5).map(a => `
        <div class="activity-item">
            <div class="activity-icon ${a.color}">${a.icon}</div>
            <div class="activity-details">
                <div class="activity-title">${a.title}</div>
                <div class="activity-time">${Utils.formatDate(a.time, 'medium')}</div>
            </div>
        </div>
    `).join('');
}

// ══════════════════════════════════════════════════════════════
// History Page - ENHANCED
// ══════════════════════════════════════════════════════════════

async function renderHistory(container) {
    showSkeleton(container);

    const historyData = await API.getHistory(90);
    const { records } = historyData;

    globalState.historyRecords = records;

    container.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-8 animate-in pb-20">
            <!-- Header with Tabs -->
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 class="text-3xl font-black tracking-tight">Activity Log</h2>
                    <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Timeline of work sessions and schedule changes</p>
                </div>
                <div class="flex gap-3">
                    <button id="export-csv" class="export-btn">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export CSV
                    </button>
                    <button id="export-json" class="export-btn">
                        <i data-lucide="file-json" class="w-4 h-4"></i>
                        Export JSON
                    </button>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="flex gap-2 border-b border-border">
                <button id="tab-punches" class="history-tab-btn py-3 px-4 font-black border-b-2 border-primary text-primary" data-tab="punches">
                    <i data-lucide="clock" class="w-4 h-4 inline mr-2"></i>Punch Records
                </button>
                <button id="tab-changes" class="history-tab-btn py-3 px-4 font-black border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors" data-tab="changes">
                    <i data-lucide="repeat-2" class="w-4 h-4 inline mr-2"></i>Schedule Changes
                </button>
            </div>

            <!-- Punches Tab -->
            <div id="tab-content-punches" class="tab-content active">
                <!-- Filter Panel -->
                <div class="filter-panel">
                    <div class="filter-group">
                        <label class="filter-label">Date Range</label>
                        <select id="hist-range" class="filter-input">
                            <option value="7">Last 7 Days</option>
                            <option value="30" selected>Last 30 Days</option>
                            <option value="60">Last 60 Days</option>
                            <option value="90">Last 90 Days</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">Status Filter</label>
                        <select id="status-filter" class="filter-input">
                            <option value="all">All Status</option>
                            <option value="success">Success Only</option>
                            <option value="fail">Failed Only</option>
                            <option value="pending">Pending Only</option>
                        </select>
                    </div>
                    <div class="filter-group flex-1">
                        <label class="filter-label">Search</label>
                        <input type="text" id="search-input" class="filter-input" placeholder="Search by date...">
                    </div>
                </div>

                <!-- Stats Overview -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="stat-card">
                        <div class="stat-icon success">
                            <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Total Success</div>
                            <div class="stat-value" id="total-success">0</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning">
                            <i data-lucide="alert-circle" class="w-5 h-5"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Total Failed</div>
                            <div class="stat-value" id="total-failed">0</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info">
                            <i data-lucide="clock" class="w-5 h-5"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Avg Punch Time</div>
                            <div class="stat-value text-lg" id="avg-time">--:--</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <i data-lucide="percent" class="w-5 h-5"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-label">Success Rate</div>
                            <div class="stat-value" id="hist-success-rate">0</div>
                            <div class="stat-subtitle">%</div>
                        </div>
                    </div>
                </div>

                <!-- Timeline List -->
                <div id="hist-list" class="space-y-3"></div>
                
                <!-- Load More -->
                <div class="text-center pt-6">
                    <button id="load-more" class="btn btn-outline">
                        <i data-lucide="arrow-down" class="w-4 h-4"></i>
                        Load More
                    </button>
                </div>
            </div>

            <!-- Changes Tab -->
            <div id="tab-content-changes" class="tab-content hidden">
                <div class="space-y-4">
                    <div id="changes-list" class="space-y-3">
                        <p class="text-xs text-muted-foreground text-center py-8">Loading...</p>
                    </div>
                </div>
            </div>
        </div>`;

    lucide.createIcons();

    let displayCount = 15;
    let filteredRecords = records;

    const updateHistoryStats = (recs) => {
        let successCount = 0, failCount = 0, totalTime = 0, timeCount = 0;

        recs.forEach(r => {
            ['am', 'pm'].forEach(period => {
                if (r.periods?.[period]) {
                    const status = r.periods[period].status;
                    if (status === 'success' || status === 'manual_done') successCount++;
                    if (status === 'fail') failCount++;

                    if (r.periods[period].recordedPunchTime) {
                        const mins = Utils.timeToMinutes(r.periods[period].recordedPunchTime);
                        totalTime += mins;
                        timeCount++;
                    }
                }
            });
        });

        const avgMins = timeCount > 0 ? Math.round(totalTime / timeCount) : 0;
        const successRate = (successCount + failCount) > 0 ? Math.round((successCount / (successCount + failCount)) * 100) : 0;

        Utils.animateValue($('#total-success'), 0, successCount, 800);
        Utils.animateValue($('#total-failed'), 0, failCount, 800);
        Utils.animateValue($('#hist-success-rate'), 0, successRate, 800);
        $('#avg-time').textContent = avgMins > 0 ? Utils.minutesToTime(avgMins) : '--:--';
    };

    const renderHistoryList = () => {
        const list = $('#hist-list');
        const toDisplay = filteredRecords.slice(0, displayCount);

        if (!toDisplay.length) {
            list.innerHTML = `<div class="card !border-dashed text-center opacity-40 font-bold py-20">No logs found</div>`;
            return;
        }

        list.innerHTML = toDisplay.map(r => {
            const am = r.periods.am || { status: 'pending' }, pm = r.periods.pm || { status: 'pending' };
            const isLateAM = am.recordedPunchTime && Utils.timeToMinutes(am.recordedPunchTime) > Utils.timeToMinutes('08:30');
            const isLatePM = pm.recordedPunchTime && Utils.timeToMinutes(pm.recordedPunchTime) > Utils.timeToMinutes('20:00');

            return `
            <div class="timeline-item group hover:border-primary/20 transition-all ${r.isOff ? 'opacity-50' : ''}">
                <div class="flex flex-col">
                    <span class="text-[9px] font-black uppercase opacity-30">${Utils.getDayOfWeek(r.date)}</span>
                    <span class="text-lg font-black tracking-tighter">${r.date.split('-')[2]}</span>
                    <span class="text-[9px] font-mono opacity-20">${r.date.slice(5, 7)}/${r.date.slice(2, 4)}</span>
                </div>
                <div class="flex items-center gap-6 flex-1">
                    <div class="flex-1 space-y-1">
                        <div class="flex items-center gap-2">
                            ${statusBadge(am.status, am.source)}
                            <span class="text-[10px] font-mono ${isLateAM ? 'text-red-500 font-bold' : 'opacity-20'}">${am.recordedPunchTime || '--:--'}</span>
                            ${isLateAM ? '<i data-lucide="alert-triangle" class="w-3 h-3 text-red-500"></i>' : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            ${statusBadge(pm.status, pm.source)}
                            <span class="text-[10px] font-mono ${isLatePM ? 'text-red-500 font-bold' : 'opacity-20'}">${pm.recordedPunchTime || '--:--'}</span>
                            ${isLatePM ? '<i data-lucide="alert-triangle" class="w-3 h-3 text-red-500"></i>' : ''}
                        </div>
                    </div>
                    ${r.isOff ? '<span class="badge badge-pending">🌴 OFF</span>' : ''}
                </div>
                <div class="flex gap-2">
                    ${am.imageUrl ? `<button class="w-10 h-10 rounded-lg overflow-hidden border border-border hover:border-primary transition-all" onclick="openLightbox('${am.imageUrl}')"><img src="${am.imageUrl}" class="w-full h-full object-cover"></button>` : ''}
                    ${pm.imageUrl ? `<button class="w-10 h-10 rounded-lg overflow-hidden border border-border hover:border-primary transition-all" onclick="openLightbox('${pm.imageUrl}')"><img src="${pm.imageUrl}" class="w-full h-full object-cover"></button>` : ''}
                </div>
            </div>`;
        }).join('');

        lucide.createIcons();

        const loadMoreBtn = $('#load-more');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = displayCount >= filteredRecords.length ? 'none' : 'flex';
        }
    };

    const applyFilters = () => {
        const range = parseInt($('#hist-range').value);
        const statusFilter = $('#status-filter').value;
        const searchTerm = $('#search-input').value.toLowerCase();

        filteredRecords = records.slice(0, range).filter(r => {
            // Status filter
            if (statusFilter !== 'all') {
                const amMatch = r.periods?.am?.status === statusFilter;
                const pmMatch = r.periods?.pm?.status === statusFilter;
                if (!amMatch && !pmMatch) return false;
            }

            // Search filter
            if (searchTerm && !r.date.includes(searchTerm)) {
                return false;
            }

            return true;
        });

        displayCount = 15;
        renderHistoryList();
        updateHistoryStats(filteredRecords);
    };

    // ── Load Changes History from system_events ──────────────────────
    const loadChangesHistory = async () => {
        const changesList = $('#changes-list');
        try {
            const events = await API.getEvents(['swap_day'], 100);
            if (!events || !events.events || events.events.length === 0) {
                changesList.innerHTML = '<div class="card !border-dashed text-center opacity-40 font-bold py-20">No schedule changes recorded</div>';
                return;
            }

            const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            const modeBadge = (m) => m === 'wfh'
                ? '<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary"><i data-lucide="laptop" class="w-3 h-3"></i>WFH</span>'
                : m === 'off'
                    ? '<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-orange-500/10 text-orange-500"><i data-lucide="moon" class="w-3 h-3"></i>OFF</span>'
                    : '<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-muted text-muted-foreground"><i data-lucide="building-2" class="w-3 h-3"></i>OFFICE</span>';

            changesList.innerHTML = events.events.map(ev => {
                const data = ev.event_data ? (typeof ev.event_data === 'string' ? JSON.parse(ev.event_data) : ev.event_data) : {};
                const date = data.date || ev.created_at;
                const fromMode = data.from || 'unknown';
                const toMode = data.to || data.toMode || 'unknown';
                const timestamp = new Date(ev.created_at * 1000 || ev.created_at);
                const timeStr = timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const dateStr = timestamp.toLocaleDateString('vi-VN', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });

                return `<div class="timeline-item group hover:border-amber-500/20 transition-all">
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black uppercase opacity-30">${dateStr.split(',')[0]}</span>
                        <span class="text-lg font-black tracking-tighter">${dateStr.split('/')[0]}</span>
                        <span class="text-[9px] font-mono opacity-20">${timeStr}</span>
                    </div>
                    <div class="flex items-center gap-6 flex-1">
                        <div class="flex-1 space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400">Schedule change</span>
                            </div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                ${modeBadge(fromMode)}
                                <i data-lucide="arrow-right" class="w-3 h-3 text-muted-foreground"></i>
                                ${modeBadge(toMode)}
                                <span class="text-[9px] text-muted-foreground ml-1">on ${date}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
            lucide.createIcons();
        } catch (e) {
            changesList.innerHTML = `<div class="card !border-dashed text-center text-red-500 py-8">Error loading changes: ${e.message}</div>`;
        }
    };

    // ── Tab Switching ───────────────────────────────────────────
    const tabs = $$('.history-tab-btn');
    tabs.forEach(tab => {
        tab.onclick = () => {
            const tabName = tab.dataset.tab;

            // Update tab active state
            tabs.forEach(t => {
                t.classList.remove('border-primary', 'text-primary');
                t.classList.add('border-transparent', 'text-muted-foreground');
            });
            tab.classList.remove('border-transparent', 'text-muted-foreground');
            tab.classList.add('border-primary', 'text-primary');

            // Update tab content
            $$('.tab-content').forEach(c => c.classList.add('hidden'));
            const tabContent = $(`#tab-content-${tabName}`);
            if (tabContent) tabContent.classList.remove('hidden');

            // Load changes on first view
            if (tabName === 'changes') {
                loadChangesHistory();
            }
        };
    });

    updateHistoryStats(records);
    renderHistoryList();

    // Event listeners
    $('#hist-range').onchange = applyFilters;
    $('#status-filter').onchange = applyFilters;
    $('#search-input').oninput = Utils.debounce(applyFilters, 300);

    $('#load-more').onclick = () => {
        displayCount += 15;
        renderHistoryList();
    };

    $('#export-csv').onclick = () => {
        const csv = Utils.exportToCSV(filteredRecords);
        Utils.downloadFile(csv, `punch-history-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        toast('CSV Exported', 'success');
    };

    $('#export-json').onclick = () => {
        const json = JSON.stringify(filteredRecords, null, 2);
        Utils.downloadFile(json, `punch-history-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        toast('JSON Exported', 'success');
    };
}

// ══════════════════════════════════════════════════════════════
// Settings Page - With Settings vs Overrides Distinction
// ══════════════════════════════════════════════════════════════

async function renderSettings(container) {
    const data = await API.getState();
    const cfg = (data && data.config) || {};
    const telegram = (cfg.telegram && typeof cfg.telegram === 'object') ? cfg.telegram : { token: '', chatId: '' };
    const finalTimes = { am: '08:30', noon: '13:30', pm: '20:00', offsetMin: 60, ...(cfg.times && typeof cfg.times === 'object' ? cfg.times : {}) };
    const finalSchedule = (cfg.schedule && typeof cfg.schedule === 'object') ? cfg.schedule : { 0: 'off', 1: 'wfh', 2: 'wfh', 3: 'wfh', 4: 'wfh', 5: 'wfh', 6: 'off' };

    container.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-8 animate-in pb-20">
            <h2 class="text-3xl font-black tracking-tight mb-8">Preferences</h2>
            
            <!-- Telegram Section -->
            <div class="settings-section">
                <div class="settings-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center"><i data-lucide="send" class="w-5 h-5"></i></div>
                        <div><p class="font-black">Telegram Bot</p><p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Notifications & Control</p></div>
                    </div>
                    <div class="flex gap-2">
                        <button id="test-telegram" class="btn btn-outline !py-2 !text-xs font-black flex items-center gap-1.5">
                            <i data-lucide="zap" class="w-3.5 h-3.5 text-sky-500"></i>Test
                        </button>
                        <button id="save-telegram" class="btn btn-primary !py-2 !text-xs font-black">Sync Bot</button>
                    </div>
                </div>

                <!-- Setup guide -->
                <div class="p-3 rounded-xl bg-sky-500/5 border border-sky-200/30 space-y-2 text-[11px] leading-snug">
                    <p class="font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 text-[9px]">Setup Guide</p>
                    <ol class="space-y-1.5 list-decimal list-inside font-medium text-muted-foreground">
                        <li>Nhắn <code class="font-mono bg-muted px-1 rounded">/newbot</code> cho <b>@BotFather</b> trên Telegram → nhận <b>Token</b></li>
                        <li>Nhắn bất kỳ tin nhắn cho bot → mở <code class="font-mono bg-muted px-1 rounded text-[10px]">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> → lấy <b>chat_id</b></li>
                        <li>Điền Token + Chat ID bên dưới → bấm <b>Sync Bot</b></li>
                        <li>Bấm <b>Register Webhook</b> để bot nhận lệnh <code class="font-mono bg-muted px-1 rounded">/status</code> và inline buttons</li>
                        <li>Bấm <b>Test</b> để kiểm tra bot có nhắn tin không</li>
                    </ol>
                </div>

                <div class="settings-content grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black uppercase opacity-40 ml-1">Bot Token</label>
                        <input type="password" id="tg-token" class="input" placeholder="123456789:ABCDef..." value="${telegram.token || ''}">
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black uppercase opacity-40 ml-1">Chat ID</label>
                        <input type="text" id="tg-chatid" class="input" placeholder="123456789" value="${telegram.chatId || ''}">
                    </div>
                </div>

                <!-- Webhook registration -->
                <div class="pt-2 space-y-2 border-t border-border/40">
                    <label class="text-[9px] font-black uppercase opacity-40">Webhook URL (nhận lệnh từ Telegram)</label>
                    <div class="flex gap-2">
                        <input type="text" id="tg-webhook-url" class="input flex-1 font-mono text-[11px]" placeholder="https://your-app.vercel.app/api/telegram-webhook">
                        <button id="register-webhook" class="btn btn-outline !py-2 !text-xs font-black whitespace-nowrap">Register Webhook</button>
                    </div>
                </div>
            </div>

            <!-- Timing Rules Section -->
            <div class="settings-section">
                <div class="settings-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center"><i data-lucide="clock" class="w-5 h-5"></i></div>
                        <div><p class="font-black">Timing Rules</p><p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Punch Deadlines</p></div>
                    </div>
                    <button id="save-times" class="btn btn-primary !py-2 !text-xs font-black">Save Rules</button>
                </div>
                <div class="p-3 mb-2 rounded-xl bg-orange-500/5 border border-orange-200/30 flex gap-2 text-[11px] text-orange-700/80 dark:text-orange-400/80 font-medium leading-snug">
                    <i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5"></i>
                    <span>AM/PM Deadline ảnh hưởng: (1) cảnh báo LATE trong lịch sử, (2) mốc gửi alert nhắc nhở của cron. Lịch chạy Playwright thực tế vẫn cố định trong <code class="font-mono bg-orange-100/60 dark:bg-orange-900/30 px-1 rounded">.github/workflows/</code>.</span>
                </div>
                <div class="settings-content grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black uppercase opacity-40">AM Deadline</label>
                        <input type="time" id="time-am" class="input" value="${finalTimes.am}">
                        <p class="text-[9px] text-muted-foreground/60 font-medium">Punch-in muộn nhất. Sau giờ này → flagged LATE.</p>
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black uppercase opacity-40">Mid-Day Split</label>
                        <input type="time" id="time-noon" class="input" value="${finalTimes.noon}">
                        <p class="text-[9px] text-muted-foreground/60 font-medium">Ranh giới AM/PM hiển thị. Không ảnh hưởng logic.</p>
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black uppercase opacity-40">PM Deadline</label>
                        <input type="time" id="time-pm" class="input" value="${finalTimes.pm}">
                        <p class="text-[9px] text-muted-foreground/60 font-medium">Punch-out muộn nhất. Sau giờ này → flagged LATE.</p>
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black uppercase opacity-40 flex items-center gap-1">Offset (phút) <span class="text-orange-400 normal-case font-bold">TBD</span></label>
                        <input type="number" id="time-offset" class="input opacity-50" value="${finalTimes.offsetMin}" disabled>
                        <p class="text-[9px] text-muted-foreground/60 font-medium">Chưa implement — sẽ dùng để điều chỉnh GHA schedule.</p>
                    </div>
                </div>
            </div>

            <!-- Weekly Cycle Section -->
            <div class="settings-section">
                <div class="settings-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><i data-lucide="calendar" class="w-5 h-5"></i></div>
                        <div>
                            <p class="font-black">Default Weekly Schedule <span class="text-[10px] font-bold text-primary ml-1.5">PERMANENT RULES</span></p>
                            <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Applied to all future weeks unless overridden</p>
                        </div>
                    </div>
                    <button id="save-schedule" class="btn btn-primary !py-2 !text-xs font-black">Save Schedule</button>
                </div>
                <div class="p-3 mb-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-2 text-[11px] text-primary/70 font-medium leading-snug">
                    <i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5"></i>
                    <span>Đây là quy tắc mặc định cho mỗi tuần. Thay đổi ở đây sẽ áp dụng cho tất cả các tuần tương lai (trừ các ngày được swap riêng biệt ở bên dưới).</span>
                </div>
                <div class="settings-content grid grid-cols-1 gap-1">
                    ${[1, 2, 3, 4, 5, 6, 0].map(day => {
        const val = finalSchedule[day] || finalSchedule[String(day)] || 'wio';
        const label = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][day];
        const modeIcon = val === 'wfh' ? 'laptop' : val === 'off' ? 'moon' : 'building-2';
        const modeDesc = val === 'wfh'
            ? '<span class="text-primary">WFH</span> — Hệ thống tự động Punch'
            : val === 'off'
                ? '<span class="text-orange-500">Nghỉ</span> — Hệ thống không chạy'
                : '<span class="text-foreground">Văn Phòng</span> — Vào VP check-in thủ công';
        return `
                        <div class="flex items-center justify-between p-3.5 rounded-xl hover:bg-muted/30 transition-all group" id="sched-row-${day}">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="sched-row-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${val === 'wfh' ? 'bg-primary/10 text-primary' :
                val === 'off' ? 'bg-orange-500/10 text-orange-500' :
                    'bg-muted text-muted-foreground'
            }" data-day="${day}">
                                    <i data-lucide="${modeIcon}" class="w-4 h-4"></i>
                                </div>
                                <div class="min-w-0">
                                    <p class="font-bold text-sm leading-none">${label}</p>
                                    <p class="sched-row-desc text-[10px] font-medium text-muted-foreground mt-0.5" data-day="${day}">${modeDesc}</p>
                                </div>
                            </div>
                            <div class="flex p-0.5 bg-muted rounded-lg gap-0.5 shrink-0">
                                <button class="sched-opt text-[9px] font-black px-3 py-1.5 rounded-md ${val === 'wio' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}" data-day="${day}" data-val="wio">OFFICE</button>
                                <button class="sched-opt text-[9px] font-black px-3 py-1.5 rounded-md ${val === 'wfh' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}" data-day="${day}" data-val="wfh">WFH</button>
                                <button class="sched-opt text-[9px] font-black px-3 py-1.5 rounded-md ${val === 'off' ? 'bg-card shadow-sm text-orange-500' : 'text-muted-foreground'}" data-day="${day}" data-val="off">OFF</button>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </div>

            <!-- Active Swap Overrides -->
            <div class="settings-section">
                <div class="settings-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><i data-lucide="repeat-2" class="w-5 h-5"></i></div>
                        <div>
                            <p class="font-black">Today/Future Schedule Changes <span class="text-[10px] font-bold text-amber-500 ml-1.5">TEMPORARY SWAPS</span></p>
                            <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Specific dates overriding the default schedule</p>
                        </div>
                    </div>
                </div>
                <div class="p-3 mb-4 rounded-xl bg-amber-500/5 border border-amber-200/30 flex gap-2 text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium leading-snug">
                    <i data-lucide="info" class="w-4 h-4 shrink-0 mt-0.5"></i>
                    <span>Swap dành cho ngày cụ thể. Ví dụ: "Thứ 5 swap từ WFH → VP" hoặc "Thứ 2-3 tuần này OFF". Các swaps này chỉ áp dụng cho những ngày được chỉ định, không ảnh hưởng quy tắc mặc định.</span>
                </div>
                <div id="swap-overrides-list" class="settings-content">
                    <p class="text-xs text-muted-foreground text-center py-4">Loading swaps...</p>
                </div>
            </div>

            <!-- Config Import/Export -->
            <div class="settings-section">
                <div class="settings-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center"><i data-lucide="package" class="w-5 h-5"></i></div>
                        <div><p class="font-black">Backup & Restore</p><p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configuration Management</p></div>
                    </div>
                </div>
                <div class="settings-content flex gap-4">
                    <button id="export-config" class="btn btn-outline flex-1">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export Config
                    </button>
                    <button id="import-config" class="btn btn-outline flex-1">
                        <i data-lucide="upload" class="w-4 h-4"></i>
                        Import Config
                    </button>
                    <input type="file" id="config-file-input" class="hidden" accept=".json">
                </div>
            </div>

            <!-- Global Actions -->
            <div class="flex items-center justify-between p-6 bg-red-500/5 rounded-2xl border border-red-500/10 mt-12">
                <div><p class="text-sm font-black">Session Control</p><p class="text-[10px] font-bold opacity-40 uppercase tracking-widest">Wipe cache or logout</p></div>
                <div class="flex gap-4">
                    <button id="s-theme-btn" class="btn btn-outline !text-[10px]">Theme</button>
                    <button id="s-purge-local" class="btn btn-outline border-red-500/20 !text-red-500 !text-[10px]">Logout</button>
                </div>
            </div>
        </div>`;
    lucide.createIcons();

    const currentSchedule = { ...finalSchedule };
    const modeIconMap = { wio: 'building-2', wfh: 'laptop', off: 'moon' };
    const modeDescMap = {
        wio: (d) => `<span class="text-foreground">Văn Phòng</span> — Vào VP check-in thủ công`,
        wfh: (d) => `<span class="text-primary">WFH</span> — Hệ thống tự động Punch`,
        off: (d) => `<span class="text-orange-500">Nghỉ</span> — Hệ thống không chạy`,
    };
    $$('.sched-opt').forEach(b => b.onclick = () => {
        const d = b.dataset.day, v = b.dataset.val; currentSchedule[d] = v;
        $$(`.sched-opt[data-day="${d}"]`).forEach(btn => {
            btn.classList.remove('bg-card', 'shadow-sm', 'text-primary', 'text-orange-500', 'text-foreground'); btn.classList.add('text-muted-foreground');
        });
        b.classList.remove('text-muted-foreground'); b.classList.add('bg-card', 'shadow-sm');
        if (v === 'wfh') b.classList.add('text-primary');
        if (v === 'off') b.classList.add('text-orange-500');
        if (v === 'wio') b.classList.add('text-foreground');
        // Update row icon
        const icon = $(`.sched-row-icon[data-day="${d}"]`);
        if (icon) {
            icon.className = `sched-row-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${v === 'wfh' ? 'bg-primary/10 text-primary' : v === 'off' ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'
                }`;
            icon.dataset.day = d;
            icon.innerHTML = `<i data-lucide="${modeIconMap[v]}" class="w-4 h-4"></i>`;
            lucide.createIcons({ nodes: [icon] });
        }
        // Update description
        const desc = $(`.sched-row-desc[data-day="${d}"]`);
        if (desc && modeDescMap[v]) desc.innerHTML = modeDescMap[v](d);
    });

    $('#save-schedule').onclick = async () => {
        const btn = $('#save-schedule');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            await API.updateSchedule(currentSchedule);
            toast('Default Schedule Updated ✓', 'success');
        } catch (e) {
            toast('Save failed: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Schedule';
        }
    };

    // ── Load Active Swap Overrides ──────────────────────────
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const loadSwapOverrides = async () => {
        const container = $('#swap-overrides-list');
        try {
            // Fetch next 30 days
            const dates = [];
            const now = new Date();
            for (let i = -7; i < 30; i++) {
                const d = new Date(now); d.setDate(d.getDate() + i);
                dates.push(d.toISOString().split('T')[0]);
            }
            const res = await API.getBulkState(dates);
            const overrides = [];
            if (res.byDate) {
                for (const [dt, info] of Object.entries(res.byDate)) {
                    if (info.modeOverride) {
                        overrides.push({ date: dt, from: info.scheduleMode, to: info.modeOverride });
                    }
                }
            }
            overrides.sort((a, b) => a.date.localeCompare(b.date));

            if (overrides.length === 0) {
                container.innerHTML = '<p class="text-xs text-muted-foreground text-center py-4">No active swaps</p>';
                return;
            }

            const modeBadge = (m) => m === 'wfh'
                ? '<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary">WFH</span>'
                : m === 'off'
                    ? '<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-orange-500/10 text-orange-500">OFF</span>'
                    : '<span class="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded bg-muted text-muted-foreground">OFFICE</span>';

            container.innerHTML = `<div class="space-y-2">${overrides.map(o => {
                const d = new Date(o.date + 'T00:00:00+07:00');
                const dayLabel = dayLabels[d.getDay()];
                const dd = o.date.split('-');
                const dateStr = `${dayLabel} ${dd[2]}/${dd[1]}`;
                return `<div class="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold w-16">${dateStr}</span>
                        <div class="flex items-center gap-1.5">
                            ${modeBadge(o.from)}
                            <i data-lucide="arrow-right" class="w-3 h-3 text-muted-foreground"></i>
                            ${modeBadge(o.to)}
                        </div>
                    </div>
                    <button class="swap-clear-btn text-[9px] font-black px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors" data-date="${o.date}">Clear</button>
                </div>`;
            }).join('')}</div>`;
            lucide.createIcons();

            $$('.swap-clear-btn').forEach(btn => {
                btn.onclick = async () => {
                    btn.disabled = true; btn.textContent = '...';
                    try {
                        await API.clearSwapOverride(btn.dataset.date);
                        toast(`Swap cleared: ${btn.dataset.date}`, 'success');
                        loadSwapOverrides();
                    } catch (e) { toast('Clear failed: ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'Clear'; }
                };
            });
        } catch (e) {
            container.innerHTML = `<p class="text-xs text-red-500 text-center py-4">${e.message}</p>`;
        }
    };
    loadSwapOverrides();

    $('#save-telegram').onclick = async () => {
        const btn = $('#save-telegram');
        btn.disabled = true; btn.textContent = 'Syncing...';
        try {
            await API.updateSettings({ telegram: { token: $('#tg-token').value, chatId: $('#tg-chatid').value } });
            toast('Bot Synced', 'success');
        } catch (e) { toast('Save failed: ' + e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Sync Bot'; }
    };
    // Auto-fill webhook URL
    const webhookInput = $('#tg-webhook-url');
    if (webhookInput && !webhookInput.value) webhookInput.value = `${window.location.origin}/api/telegram-webhook`;

    $('#test-telegram').onclick = async () => {
        const btn = $('#test-telegram');
        btn.disabled = true; btn.textContent = 'Sending...';
        try {
            await API.testTelegram();
            toast('Test message sent ✓ — check Telegram!', 'success');
        } catch (e) { toast('Test failed: ' + e.message, 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i data-lucide="zap" class="w-3.5 h-3.5 text-sky-500"></i>Test'; lucide.createIcons({ nodes: [btn] }); }
    };
    $('#register-webhook').onclick = async () => {
        const webhookUrl = ($('#tg-webhook-url').value || '').trim();
        if (!webhookUrl) { toast('Nhập Webhook URL trước', 'error'); return; }
        const btn = $('#register-webhook');
        btn.disabled = true; btn.textContent = 'Registering...';
        try {
            await API.registerTelegramWebhook(webhookUrl);
            toast('Webhook registered ✓', 'success');
        } catch (e) { toast('Register failed: ' + e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Register Webhook'; }
    };
    $('#save-times').onclick = async () => {
        const btn = $('#save-times');
        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            await API.updateSettings({ times: { am: $('#time-am').value, noon: $('#time-noon').value, pm: $('#time-pm').value, offsetMin: parseInt($('#time-offset').value) } });
            toast('Rules Updated ✓', 'success');
        } catch (e) { toast('Save failed: ' + e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Save Rules'; }
    };

    // Config Export/Import
    $('#export-config').onclick = () => {
        const config = { schedule: currentSchedule, telegram, times: finalTimes };
        const json = JSON.stringify(config, null, 2);
        Utils.downloadFile(json, `punch-config-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        toast('Config Exported', 'success');
    };

    $('#import-config').onclick = () => $('#config-file-input').click();

    $('#config-file-input').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const config = JSON.parse(text);

            if (config.schedule) await API.updateSchedule(config.schedule);
            if (config.telegram) await API.updateSettings({ telegram: config.telegram });
            if (config.times) await API.updateSettings({ times: config.times });

            toast('Config Imported Successfully', 'success');
            setTimeout(() => onHashChange(), 1000);
        } catch (err) {
            toast('Import Failed: ' + err.message, 'error');
        }
    };

    $('#s-theme-btn').onclick = () => { document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); };
    $('#s-purge-local').onclick = () => { API.clearSecret(); location.reload(); };
}

// ══════════════════════════════════════════════════════════════
// Shared UI Functions
// ══════════════════════════════════════════════════════════════

window.openLightbox = (url) => {
    const lb = document.createElement('div');
    lb.className = 'fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in cursor-zoom-out';
    lb.innerHTML = `<img src="${url}" class="max-w-full max-h-full rounded-2xl shadow-2xl scale-in-95 animate-in"><button class="absolute top-6 right-6 p-4 text-white/50 hover:text-white"><i data-lucide="x" class="w-8 h-8"></i></button>`;
    document.body.appendChild(lb);
    lucide.createIcons();
    lb.onclick = () => lb.remove();
};

// ══════════════════════════════════════════════════════════════
// Router & Boot
// ══════════════════════════════════════════════════════════════

const routes = { dashboard: renderDashboard, history: renderHistory, settings: renderSettings };

function onHashChange() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const page = routes[hash] ? hash : 'dashboard';
    globalState.currentPage = page;

    $$('.nav-tab').forEach(t => t.dataset.page === page ? t.classList.add('active') : t.classList.remove('active'));

    const c = $('#app');
    c.innerHTML = `<div class="flex items-center justify-center p-20 opacity-40"><div class="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div></div>`;
    routes[page](c).catch(e => { c.innerHTML = `<p class="p-20 text-center font-bold text-red-500">${e.message}</p>`; });
}

// ── Secret input form (first visit on prod) ──────────────────
function showSecretForm() {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-overlay animate-in"><div class="modal-content !max-w-sm space-y-5">
        <div class="text-center">
            <h2 class="text-xl font-black">Punch Secret</h2>
            <p class="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">
                Enter your PUNCH_SECRET to continue
            </p>
        </div>
        <div class="relative">
            <input type="password" id="auth-secret" class="input w-full pr-10" placeholder="PUNCH_SECRET" autocomplete="off" spellcheck="false">
            <button id="auth-eye" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <svg id="auth-eye-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
        </div>
        <div id="auth-error" class="hidden text-[11px] text-destructive font-medium text-center"></div>
        <button id="auth-submit" class="btn btn-primary w-full shadow-lg shadow-primary/20">Unlock</button>
        <p class="text-[10px] text-center text-muted-foreground">Set PUNCH_SECRET in Vercel Environment Variables</p>
    </div></div>`;

    // Eye toggle
    $('#auth-eye').onclick = () => {
        const inp = $('#auth-secret');
        inp.type = inp.type === 'password' ? 'text' : 'password';
        $('#auth-eye-icon').innerHTML = inp.type === 'text'
            ? '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>'
            : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
    };

    const errEl = $('#auth-error');
    const submit = async () => {
        const s = $('#auth-secret').value.trim();
        if (!s) { errEl.classList.remove('hidden'); errEl.textContent = 'Please enter your secret.'; return; }

        errEl.classList.add('hidden');
        $('#auth-submit').disabled = true;
        $('#auth-submit').textContent = 'Verifying…';
        try {
            API.setSecret(s);
            // Test the secret by calling an API endpoint
            await API.getState();
            location.reload();
        } catch (e) {
            API.clearSecret();
            errEl.classList.remove('hidden');
            errEl.textContent = e.message === 'AUTH_FAIL' ? 'Invalid secret' : e.message;
            $('#auth-submit').disabled = false;
            $('#auth-submit').textContent = 'Unlock';
        }
    };

    $('#auth-submit').onclick = submit;
    $('#auth-secret').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    setTimeout(() => $('#auth-secret') && $('#auth-secret').focus(), 100);
}

async function boot() {
    const s = localStorage.getItem('theme') || 'light';
    if (s === 'dark') document.documentElement.classList.add('dark');

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }

    $('#theme-toggle').onclick = () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };

    $$('.nav-tab').forEach(t => {
        t.onclick = () => {
            // Immediately mark active without waiting for render
            $$('.nav-tab').forEach(b => b.classList.remove('active'));
            t.classList.add('active');
            if (window.location.hash === `#${t.dataset.page}`) onHashChange(); else window.location.hash = t.dataset.page;
        };
    });

    // ── Auth gate ─────────────────────────────────────────────
    // Local dev: auto-get secret from .env via /api/dev-secret
    if (!API.hasSecret()) {
        const devResult = await API.getDevSecret();
        if (devResult && devResult.noAuth) {
            // No PUNCH_SECRET configured → open access
        } else if (devResult && typeof devResult === 'string') {
            // Local dev: got secret from .env
            API.setSecret(devResult);
        } else {
            // Prod: check if PUNCH_SECRET is required
            const check = await API.authCheck();
            if (check.needsSecret) {
                showSecretForm();
                return;
            }
        }
    } else {
        // Has saved secret — verify it still works
        try {
            await API.getState();
        } catch (e) {
            if (e.message === 'AUTH_FAIL') {
                API.clearSecret();
                showSecretForm();
                return;
            }
        }
    }

    window.onhashchange = onHashChange;
    onHashChange();

    // Clock update
    setInterval(() => {
        const el = $('#nav-clock');
        if (el) el.textContent = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) + ' VN';
    }, 1000);

    // Register keyboard shortcuts
    Utils.registerShortcut('d', () => window.location.hash = 'dashboard', true);
    Utils.registerShortcut('h', () => window.location.hash = 'history', true);
    Utils.registerShortcut('s', () => window.location.hash = 'settings', true);
    Utils.registerShortcut('/', () => {
        const search = $('#search-input');
        if (search) search.focus();
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (globalState.countdownInterval) {
        clearInterval(globalState.countdownInterval);
    }
});

boot();
