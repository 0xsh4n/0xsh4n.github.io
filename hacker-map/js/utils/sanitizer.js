// Sanitize string for safe text rendering
export function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Strip HTML tags
export function stripHTML(html) {
    if (typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = html; // This already escapes
    return div.textContent;
}

// Sanitize URL (allow only http/https)
export function sanitizeURL(url) {
    if (typeof url !== 'string') return '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch {
        // Invalid URL
    }
    return '';
}

// Validate and sanitize CVE ID format
export function sanitizeCVEId(id) {
    if (typeof id !== 'string') return '';
    const match = id.match(/^CVE-\d{4}-\d{4,}$/);
    return match ? match[0] : '';
}

// Create safe external link
export function createSafeLink(url, text) {
    const a = document.createElement('a');
    const safeUrl = sanitizeURL(url);
    if (safeUrl) {
        a.href = safeUrl;
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
    }
    a.textContent = text || url;
    return a;
}

// Validate API response structure
export function validateResponse(data, requiredFields = []) {
    if (!data || typeof data !== 'object') return false;
    return requiredFields.every(field => field in data);
}

// Sanitize search query
export function sanitizeQuery(query) {
    if (typeof query !== 'string') return '';
    return query.replace(/[<>"'&]/g, '').trim().slice(0, 200);
}

// CSS class values must be constrained separately from escaped display text.
export function sanitizeSeverity(value, fallback = 'low') {
    const normalized = typeof value === 'string' ? value.toLowerCase() : '';
    return ['critical', 'high', 'medium', 'low', 'unknown', 'info'].includes(normalized)
        ? normalized
        : fallback;
}
