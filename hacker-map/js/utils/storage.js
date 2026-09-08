import { CONFIG } from '../config/config.js';

const PREFIX = CONFIG.STORAGE_KEYS.CACHE_PREFIX;

// Get item from localStorage
export function getStorage(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch {
        return defaultValue;
    }
}

// Set item in localStorage
export function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        console.warn('[Storage] Failed to save:', key);
        return false;
    }
}

// Remove item
export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore
    }
}

// Get/set settings
export function getSettings() {
    const defaults = {
        matrixBg: CONFIG.ENABLE_MATRIX_BG,
        attackAnimations: CONFIG.ENABLE_ATTACK_ANIMATIONS,
        sound: CONFIG.ENABLE_SOUND,
        autoRefresh: true,
        refreshInterval: 30000,
        dataMode: CONFIG.DATA_MODE,
        dataModeConfigured: false,
        theme: 'matrix-dark',
        notifications: true
    };
    const stored = getStorage(CONFIG.STORAGE_KEYS.SETTINGS, null);
    if (!stored || typeof stored !== 'object') return defaults;

    // Earlier releases saved the demo default without recording an operator choice.
    // Respect explicit choices, while allowing config.js to define the first-run mode.
    return {
        ...defaults,
        ...stored,
        dataMode: stored.dataModeConfigured ? stored.dataMode : CONFIG.DATA_MODE
    };
}

export function saveSettings(settings) {
    return setStorage(CONFIG.STORAGE_KEYS.SETTINGS, settings);
}

// Cache with TTL
export function getCached(key, ttlMs = 300000) {
    const cached = getStorage(PREFIX + key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > ttlMs) {
        removeStorage(PREFIX + key);
        return null;
    }
    return cached.data;
}

export function setCache(key, data) {
    setStorage(PREFIX + key, {
        data,
        timestamp: Date.now()
    });
}

// Clear all app caches
export function clearCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(PREFIX)) {
            localStorage.removeItem(key);
        }
    });
}
