// Format number with commas
export function formatNumber(num) {
    return (num || 0).toLocaleString();
}

// Format as percentage
export function formatPercent(value, decimals = 0) {
    return `${(value * 100).toFixed(decimals)}%`;
}

// Format time ago
export function timeAgo(date) {
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return 'date unavailable';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

// Format UTC time
export function formatUTC() {
    return new Date().toISOString().slice(11, 19) + ' UTC';
}

// Format local time
export function formatLocalTime() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// Format date
export function formatDate(date) {
    if (!date || !Number.isFinite(new Date(date).getTime())) return 'Date unavailable';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

// Format timestamp for event feed
export function formatTimestamp(date) {
    return new Date(date).toLocaleTimeString('en-US', { hour12: false });
}

// Format CVSS score
export function formatCVSS(score) {
    return score != null ? score.toFixed(1) : 'N/A';
}

// Mask IP address for display
export function maskIP(ip) {
    if (!ip) return '***.***.***';
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
    }
    return ip.replace(/[0-9a-f]{2,}/gi, '***');
}

// Format severity from CVSS score
export function getSeverityFromScore(score) {
    if (score >= 9.0) return { label: 'CRITICAL', class: 'critical' };
    if (score >= 7.0) return { label: 'HIGH', class: 'high' };
    if (score >= 4.0) return { label: 'MEDIUM', class: 'medium' };
    if (score >= 0.1) return { label: 'LOW', class: 'low' };
    return { label: 'NONE', class: 'info' };
}

// Truncate text
export function truncate(text, maxLen = 120) {
    if (!text || text.length <= maxLen) return text || '';
    return text.slice(0, maxLen).trimEnd() + '…';
}

// Format file size
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
