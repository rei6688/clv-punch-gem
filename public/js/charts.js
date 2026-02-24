// File: public/js/charts.js
// Chart rendering utilities using HTML/CSS only (no external dependencies)

export function renderMiniCalendar(records, currentDate, bulkState) {
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

        // Mode icon badge
        if (dayState) {
            const mode = dayState.effectiveMode || dayState.scheduleMode;
            const isSwapped = dayState.modeOverride && dayState.modeOverride !== dayState.scheduleMode;
            if (dayState.isOff || mode === 'off') {
                modeBadge = `<span class="cell-mode off" title="OFF">OFF</span>`;
            } else if (mode === 'wfh') {
                modeBadge = `<span class="cell-mode wfh${isSwapped ? ' swapped' : ''}" title="${isSwapped ? 'Swapped to WFH' : 'WFH'}">H</span>`;
            } else {
                modeBadge = `<span class="cell-mode wio${isSwapped ? ' swapped' : ''}" title="${isSwapped ? 'Swapped to Office' : 'Office'}">O</span>`;
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

        html += `
            <div class="${cellClass}" data-date="${dateStr}">
                ${modeBadge}
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
