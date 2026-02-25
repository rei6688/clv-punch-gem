// File: public/js/charts.js
// Chart rendering utilities using HTML/CSS only (no external dependencies)

export function renderWeekView(records, currentDate, bulkState, config = {}) {
    const today = new Date(currentDate + 'T00:00:00+07:00');
    const dayOfWeek = today.getDay(); // 0 is Sunday

    // Start of week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);

    const weekDays = [];
    const recordMap = {};
    records.forEach(r => { recordMap[r.date] = r; });
    const byDate = (bulkState && bulkState.byDate) || {};

    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        weekDays.push({
            date: dateStr,
            dayName: d.toLocaleDateString('vi-VN', { weekday: 'short' }),
            dayNum: d.getDate(),
            isToday: dateStr === currentDate,
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        });
    }

    return `
        <div class="week-view">
            <div class="week-grid">
                ${weekDays.map(d => {
        const dayState = byDate[d.date];
        const record = recordMap[d.date];
        let cellClass = 'week-cell';
        if (d.isToday) cellClass += ' today';
        if (d.isWeekend) cellClass += ' weekend';

        let modeIcon = '🏢';
        let modeClass = 'wio';
        if (dayState) {
            const mode = dayState.effectiveMode || dayState.scheduleMode;
            if (dayState.isOff || mode === 'off') { modeIcon = '🌴'; modeClass = 'off'; }
            else if (mode === 'wfh') { modeIcon = '🏠'; modeClass = 'wfh'; }
        }

        let indicator = '';
        if (record) {
            const amOk = record.periods?.am?.status === 'success' || record.periods?.am?.status === 'manual_done';
            const pmOk = record.periods?.pm?.status === 'success' || record.periods?.pm?.status === 'manual_done';
            if (amOk && pmOk) indicator = 'bg-green-500';
            else if (amOk || pmOk) indicator = 'bg-yellow-500';
            else indicator = 'bg-red-500/30';
        }

        const isSwapped = dayState && dayState.modeOverride && dayState.modeOverride !== dayState.scheduleMode;
        const autoRun = config.isEnabled && modeClass === 'wfh' && !(dayState && dayState.isOff);

        return `
                        <div class="${cellClass}" data-date="${d.date}">
                            <div class="week-day-name">${d.dayName}</div>
                            <div class="week-day-num">${d.dayNum}</div>
                            <div class="week-mode ${modeClass}">${modeIcon}</div>
                            <div class="absolute top-1 right-1 flex flex-col gap-0.5 opacity-60">
                                ${autoRun ? '<i data-lucide="zap" class="w-2.5 h-2.5 text-primary fill-primary"></i>' : ''}
                                ${isSwapped ? '<i data-lucide="repeat-2" class="w-2.5 h-2.5 text-amber-500"></i>' : ''}
                            </div>
                            ${indicator ? `<div class="week-indicator ${indicator}"></div>` : ''}
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

export function renderMiniCalendar(records, currentDate, bulkState, config = {}) {
    const date = new Date(currentDate);
    const year = date.getFullYear();
    const month = date.getMonth();

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Create lookup map for records
    const recordMap = {};
    records.forEach(r => {
        recordMap[r.date] = r;
    });
    const byDate = (bulkState && bulkState.byDate) || {};

    let html = `
        <div class="mini-calendar">
            <div class="calendar-header">
                <button class="calendar-nav" data-nav="prev">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <div class="calendar-title">
                    ${date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                </div>
                <button class="calendar-nav" data-nav="next">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-day-label">CN</div>
                <div class="calendar-day-label">T2</div>
                <div class="calendar-day-label">T3</div>
                <div class="calendar-day-label">T4</div>
                <div class="calendar-day-label">T5</div>
                <div class="calendar-day-label">T6</div>
                <div class="calendar-day-label">T7</div>
    `;

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="calendar-cell empty"></div>`;
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = recordMap[dateStr];
        const dayState = byDate[dateStr];
        const isToday = dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

        let cellClass = 'calendar-cell';
        let indicator = '';
        let modeBadge = '';

        if (isToday) cellClass += ' today';

        // Mode icon badge with emojis on hover
        if (dayState) {
            const mode = dayState.effectiveMode || dayState.scheduleMode;
            const isSwapped = dayState.modeOverride && dayState.modeOverride !== dayState.scheduleMode;
            if (dayState.isOff || mode === 'off') {
                modeBadge = `<span class="cell-mode off" title="OFF"><span class="cell-badge">🌴</span></span>`;
            } else if (mode === 'wfh') {
                modeBadge = `<span class="cell-mode wfh${isSwapped ? ' swapped' : ''}" title="${isSwapped ? 'Swapped to WFH' : 'WFH'}"><span class="cell-badge">🏠</span></span>`;
            } else {
                modeBadge = `<span class="cell-mode wio${isSwapped ? ' swapped' : ''}" title="${isSwapped ? 'Swapped to Office' : 'Office'}"><span class="cell-badge">🏢</span></span>`;
            }
        }

        // Punch status indicator
        if (record) {
            if (record.isOff || (record.day && record.day.isOff)) {
                cellClass += ' off-day';
                indicator = '<div class="cell-indicator bg-orange-500"></div>';
            } else {
                const amOk = record.periods?.am?.status === 'success' || record.periods?.am?.status === 'manual_done';
                const pmOk = record.periods?.pm?.status === 'success' || record.periods?.pm?.status === 'manual_done';

                if (amOk && pmOk) {
                    cellClass += ' success-day';
                    indicator = '<div class="cell-indicator bg-green-500"></div>';
                } else if (amOk || pmOk) {
                    cellClass += ' partial-day';
                    indicator = '<div class="cell-indicator bg-yellow-500"></div>';
                } else if (record.periods?.am || record.periods?.pm) {
                    cellClass += ' fail-day';
                    indicator = '<div class="cell-indicator bg-red-500"></div>';
                }
            }
        }

        const mode = dayState?.effectiveMode || dayState?.scheduleMode;
        const isSwapped = dayState && dayState.modeOverride && dayState.modeOverride !== dayState.scheduleMode;
        const autoRun = config.isEnabled && mode === 'wfh' && !dayState?.isOff;

        html += `
            <div class="${cellClass}" data-date="${dateStr}">
                ${modeBadge}
                <div class="absolute top-0.5 left-0.5 flex items-center gap-0.5 pointer-events-none opacity-60">
                    ${autoRun ? '<i data-lucide="zap" class="w-1.5 h-1.5 text-primary fill-primary"></i>' : ''}
                    ${isSwapped ? '<i data-lucide="repeat-2" class="w-1.5 h-1.5 text-amber-500"></i>' : ''}
                </div>
                <span class="cell-day">${day}</span>
                ${indicator}
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

export function renderSuccessRateChart(percentage) {
    const circumference = 2 * Math.PI * 40; // radius = 40
    const offset = circumference - (percentage / 100) * circumference;

    let color = 'text-red-500';
    if (percentage >= 90) color = 'text-green-500';
    else if (percentage >= 70) color = 'text-yellow-500';

    return `
        <div class="success-rate-chart">
            <svg class="chart-svg" viewBox="0 0 100 100">
                <circle class="chart-bg" cx="50" cy="50" r="40" />
                <circle class="chart-progress ${color}" cx="50" cy="50" r="40"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}" />
            </svg>
            <div class="chart-value">
                <span class="value-number">${percentage}</span>
                <span class="value-unit">%</span>
            </div>
        </div>
    `;
}

export function renderWeeklyActivity(records) {
    const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const today = new Date();
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        const record = records.find(r => r.date === dateStr);

        let value = 0;
        if (record && !record.isOff) {
            const amOk = record.periods?.am?.status === 'success' || record.periods?.am?.status === 'manual_done';
            const pmOk = record.periods?.pm?.status === 'success' || record.periods?.pm?.status === 'manual_done';
            value = (amOk ? 50 : 0) + (pmOk ? 50 : 0);
        }

        weekData.push({
            day: weekDays[date.getDay()],
            value,
            date: dateStr,
            isToday: i === 0
        });
    }

    const maxValue = 100;

    return `
        <div class="weekly-activity">
            <div class="activity-bars">
                ${weekData.map(d => `
                    <div class="activity-bar-container ${d.isToday ? 'today' : ''}">
                        <div class="activity-bar-wrapper">
                            <div class="activity-bar" style="height: ${d.value}%">
                                <div class="bar-fill"></div>
                            </div>
                        </div>
                        <div class="activity-bar-label">${d.day}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

export function renderStatCard(icon, label, value, subtitle, color = 'primary') {
    return `
        <div class="stat-card group">
            <div class="stat-icon ${color}">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            <div class="stat-content">
                <div class="stat-label">${label}</div>
                <div class="stat-value" data-value="${value}">${value}</div>
                ${subtitle ? `<div class="stat-subtitle">${subtitle}</div>` : ''}
            </div>
        </div>
    `;
}

export function renderProgressBar(percentage, label, showValue = true) {
    return `
        <div class="progress-container">
            ${label ? `<div class="progress-label">${label}</div>` : ''}
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            ${showValue ? `<div class="progress-value">${percentage}%</div>` : ''}
        </div>
    `;
}

export function renderRecentHistoryChanges(events) {
    if (!events || !events.length) {
        return `<p class="text-[10px] text-muted-foreground italic text-center py-4">No recent changes</p>`;
    }

    const typeIcons = {
        'swap_day': 'repeat-2',
        'mark_off_range': 'umbrella',
        'mark_done': 'check-circle',
        'update_config': 'settings',
        'default': 'edit-3'
    };

    const typeColors = {
        'swap_day': 'text-amber-500',
        'mark_off_range': 'text-orange-500',
        'mark_done': 'text-green-500',
        'update_config': 'text-primary',
        'default': 'text-muted-foreground'
    };

    return events.map(ev => {
        const icon = typeIcons[ev.event_type] || typeIcons.default;
        const color = typeColors[ev.event_type] || typeColors.default;
        const date = new Date(ev.created_at * 1000);
        const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        let detail = 'Updated system settings';
        try {
            const data = typeof ev.event_data === 'string' ? JSON.parse(ev.event_data) : ev.event_data;
            if (ev.event_type === 'swap_day') detail = `Swapped ${data.date} to ${data.mode.toUpperCase()}`;
            else if (ev.event_type === 'mark_off_range') detail = `Set OFF from ${data.start} to ${data.end}`;
            else if (ev.event_type === 'mark_done') detail = `Marked ${data.period.toUpperCase()} done`;
            else if (ev.event_type === 'update_config') detail = `System ${data.isEnabled ? 'Enabled' : 'Disabled'}`;
        } catch (e) { }

        return `
            <div class="flex items-start gap-3 py-2 animate-in slide-in-from-left-2 duration-300">
                <div class="mt-1 w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-3 h-3 ${color}"></i>
                </div>
                <div class="space-y-0.5">
                    <p class="text-[10px] font-black leading-tight text-foreground/90">${detail}</p>
                    <p class="text-[8px] font-bold text-muted-foreground uppercase tabular-nums">${timeStr} • ${ev.user_source || 'API'}</p>
                </div>
            </div>
        `;
    }).join('');
}
