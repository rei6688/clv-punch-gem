// File: public/js/utils.js
// Utility functions for the Auto Punch application

// Date utilities
export function todayVN() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function getVietnamTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
}

export function formatDate(date, format = 'short') {
    const d = new Date(date);
    if (format === 'full') {
        return d.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (format === 'medium') {
        return d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return d.toLocaleDateString('vi-VN');
}

export function getDayOfWeek(date) {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
}

export function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Time utilities
export function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

export function minutesToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function getTimeUntil(targetTime) {
    const now = getVietnamTime();
    const [h, m] = targetTime.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    
    if (target < now) {
        target.setDate(target.getDate() + 1);
    }
    
    const diff = target - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return { hours, minutes, seconds, total: diff };
}

// Statistics utilities
export function calculateSuccessRate(records) {
    if (!records || records.length === 0) return 0;
    
    let totalSessions = 0;
    let successSessions = 0;
    
    records.forEach(r => {
        if (!r.isOff) {
            if (r.periods?.am) {
                totalSessions++;
                if (r.periods.am.status === 'success' || r.periods.am.status === 'manual_done') {
                    successSessions++;
                }
            }
            if (r.periods?.pm) {
                totalSessions++;
                if (r.periods.pm.status === 'success' || r.periods.pm.status === 'manual_done') {
                    successSessions++;
                }
            }
        }
    });
    
    return totalSessions > 0 ? Math.round((successSessions / totalSessions) * 100) : 0;
}

export function calculateStreak(records) {
    if (!records || records.length === 0) return 0;
    
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    
    for (const r of sorted) {
        if (r.isOff) continue;
        
        const amSuccess = r.periods?.am?.status === 'success' || r.periods?.am?.status === 'manual_done';
        const pmSuccess = r.periods?.pm?.status === 'success' || r.periods?.pm?.status === 'manual_done';
        
        if (amSuccess || pmSuccess) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

export function getMonthlyStats(records, month = null) {
    const targetMonth = month || new Date().getMonth();
    const targetYear = new Date().getFullYear();
    
    const monthRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });
    
    let totalDays = monthRecords.length;
    let workDays = monthRecords.filter(r => !r.isOff).length;
    let successDays = 0;
    let latePunches = 0;
    
    monthRecords.forEach(r => {
        if (r.isOff) return;
        
        const amOk = r.periods?.am?.status === 'success' || r.periods?.am?.status === 'manual_done';
        const pmOk = r.periods?.pm?.status === 'success' || r.periods?.pm?.status === 'manual_done';
        
        if (amOk && pmOk) successDays++;
        
        // Check for late punches (after deadline)
        if (r.periods?.am?.recordedPunchTime) {
            const punchTime = timeToMinutes(r.periods.am.recordedPunchTime);
            const deadline = timeToMinutes(r.config?.times?.am || '08:30');
            if (punchTime > deadline) latePunches++;
        }
    });
    
    return { totalDays, workDays, successDays, latePunches };
}

// Export utilities
export function exportToCSV(records) {
    const headers = ['Date', 'Day', 'AM Status', 'AM Time', 'PM Status', 'PM Time', 'Is Off'];
    const rows = records.map(r => [
        r.date,
        getDayOfWeek(r.date),
        r.periods?.am?.status || 'N/A',
        r.periods?.am?.recordedPunchTime || 'N/A',
        r.periods?.pm?.status || 'N/A',
        r.periods?.pm?.recordedPunchTime || 'N/A',
        r.isOff ? 'Yes' : 'No'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return csv;
}

export function downloadFile(content, filename, type = 'text/csv') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Storage utilities
export function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        return false;
    }
}

export function getFromLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Failed to read from localStorage:', e);
        return defaultValue;
    }
}

// Debounce utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Animation utilities
export function animateValue(element, start, end, duration, formatter = v => v) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = start + (end - start) * eased;
        
        element.textContent = formatter(Math.round(value));
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Keyboard shortcuts
export function registerShortcut(key, callback, ctrlKey = false, altKey = false) {
    document.addEventListener('keydown', (e) => {
        if (e.key === key && e.ctrlKey === ctrlKey && e.altKey === altKey) {
            e.preventDefault();
            callback();
        }
    });
}
