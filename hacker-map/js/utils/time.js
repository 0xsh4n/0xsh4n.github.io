// Get current UTC timestamp string
export function utcNow() {
    return new Date().toISOString();
}

// Get current UTC time formatted HH:MM:SS
export function utcTimeString() {
    const d = new Date();
    return d.toISOString().slice(11, 19);
}

// Get local time formatted HH:MM:SS
export function localTimeString() {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
}

// Time difference in human readable format
export function timeDiff(date) {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 0) return 'in the future';
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s} seconds ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
}

// Create a timer that calls callback at interval
export function createInterval(callback, intervalMs) {
    let id = setInterval(callback, intervalMs);
    return {
        stop() { clearInterval(id); id = null; },
        restart(newInterval) {
            this.stop();
            id = setInterval(callback, newInterval || intervalMs);
        },
        get active() { return id !== null; }
    };
}

// Clock updater - updates UTC and local time displays
export function startClock(utcEl, localEl) {
    function update() {
        if (utcEl) utcEl.textContent = utcTimeString() + ' UTC';
        if (localEl) localEl.textContent = localTimeString();
    }
    update();
    return createInterval(update, 1000);
}

// Check if timestamp is within a time window
export function isWithinWindow(timestamp, windowMs) {
    return (Date.now() - new Date(timestamp).getTime()) <= windowMs;
}

// Visibility change handler - pause/resume expensive operations
export function onVisibilityChange(onHidden, onVisible) {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            onHidden();
        } else {
            onVisible();
        }
    });
}
