export const CONFIG = {
    APP_NAME: 'H4CK3R M4P',
    APP_AUTHOR: '0xsh4n',
    APP_URL: 'https://github.com/0xsh4n',
    VERSION: '1.0.0',

    // API Keys - NEVER commit real keys.
    // This app is 100% static and needs NO API key to run. If you later add a
    // rate-limited source (e.g. NVD), inject the key at a trusted serverless
    // proxy — never hard-code it here, since this file ships to the browser.
    NVD_API_KEY: 'C0E3B8F2-0AED-4358-B56D-6A0F2777196E',

    // Feature flags
    // NVD 2.0 is keyless and CORS-enabled, so LIVE mode uses it directly from
    // the browser. CISA KEV's raw JSON has no CORS header (browser-blocked), so
    // KEV status instead comes from NVD's `cisaExploitAdd` field.
    ENABLE_NVD: true,
    ENABLE_CISA_KEV: true,
    ENABLE_MATRIX_BG: true,
    ENABLE_ATTACK_ANIMATIONS: true,
    ENABLE_SOUND: false,

    // Data mode: 'demo' (self-contained simulation) or 'live' (best-effort
    // public feeds with automatic fallback to demo). Demo is the default so
    // the dashboard is fully functional the moment the folder is deployed.
    DATA_MODE: 'live',
    
    // Refresh intervals (ms)
    ATTACK_REFRESH_INTERVAL: 3000,
    CVE_REFRESH_INTERVAL: 300000,    // 5 min
    FEED_REFRESH_INTERVAL: 600000,   // 10 min
    STATS_UPDATE_INTERVAL: 5000,
    
    // Limits
    MAX_ATTACK_EVENTS: 50,
    MAX_SIMULTANEOUS_ANIMATIONS: 20,
    MAX_TERMINAL_LINES: 200,
    MAX_NOTIFICATIONS: 50,
    
    // Map defaults
    MAP_CENTER: [20, 0],
    MAP_ZOOM: 2,
    MAP_MIN_ZOOM: 2,
    MAP_MAX_ZOOM: 8,
    
    // API endpoints (placeholders)
    API: {
        NVD_BASE: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
        CISA_KEV: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
        CVE_ORG: 'https://cveawg.mitre.org/api/cve',
    },
    
    // Severity thresholds
    SEVERITY: {
        CRITICAL: { min: 9.0, label: 'CRITICAL', class: 'critical' },
        HIGH: { min: 7.0, label: 'HIGH', class: 'high' },
        MEDIUM: { min: 4.0, label: 'MEDIUM', class: 'medium' },
        LOW: { min: 0.1, label: 'LOW', class: 'low' },
        NONE: { min: 0, label: 'NONE', class: 'info' }
    },
    
    // Attack types with colors
    ATTACK_TYPES: {
        DDOS: { label: 'DDoS', color: '#ff0040' },
        PHISHING: { label: 'Phishing', color: '#ff6600' },
        MALWARE: { label: 'Malware', color: '#ff3366' },
        BOTNET: { label: 'Botnet', color: '#cc00ff' },
        RANSOMWARE: { label: 'Ransomware', color: '#ff0040' },
        EXPLOIT: { label: 'Exploit Attempt', color: '#ffcc00' },
        BRUTE_FORCE: { label: 'Brute Force', color: '#ff9900' },
        SCANNING: { label: 'Suspicious Scanning', color: '#00ccff' },
        UNKNOWN: { label: 'Unknown Threat', color: '#666666' }
    },
    
    // Storage keys
    STORAGE_KEYS: {
        SETTINGS: 'h4ck3r_map_settings',
        NOTIFICATIONS: 'h4ck3r_map_notifications',
        CACHE_PREFIX: 'h4ck3r_map_cache_'
    }
};
