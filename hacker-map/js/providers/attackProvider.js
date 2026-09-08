/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Attack Data Provider Architecture
 * 
 * Provides consistent interface for simulated (demo) and verified (live) cyber attack telemetry.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { CONFIG } from '../config/config.js';
import { THREAT_NODES, ATTACK_PROFILES, INITIAL_ATTACKS } from '../data/threatNodes.js';

class AttackProvider {
    constructor() {
        this.mode = CONFIG.DATA_MODE || 'demo'; // 'demo' | 'live'
        this.status = 'connected'; // 'connected' | 'degraded' | 'offline'
        this.isRunning = false;
        this.events = [...INITIAL_ATTACKS];
        this.listeners = new Set();
        this.timer = null;
        this.eventIdCounter = 100;
    }

    /**
     * Subscribe to new incoming attack events
     * @param {Function} callback (attackEvent) => void
     * @returns {Function} unsubscribe function
     */
    onAttack(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all subscribers with a new attack event
     */
    notify(event) {
        this.listeners.forEach(cb => {
            try {
                cb(event);
            } catch (err) {
                console.error('[AttackProvider] Subscriber notification error:', err);
            }
        });
    }

    /**
     * Get all currently buffered attack events
     */
    getData() {
        return [...this.events];
    }

    /**
     * Get current provider health and operational state.
     *
     * The attack map is ALWAYS a simulation: no open, keyless, browser-fetchable
     * real-time global attack-telemetry feed exists, so we never claim otherwise.
     * The status is reported honestly as a healthy simulated stream regardless of
     * the app's DATA_MODE (which only governs the CVE / news intelligence feeds).
     */
    getStatus() {
        return {
            mode: this.mode,
            status: 'connected',
            activeCount: this.events.length,
            isSimulated: true,
            label: 'SIMULATED'
        };
    }

    /**
     * Start the threat telemetry engine (always simulated — see getStatus()).
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.scheduleNextDemoEvent();
    }

    /**
     * Stop/Pause the telemetry engine
     */
    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Toggle pause / resume
     */
    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
        return this.isRunning;
    }

    /**
     * Switch operating mode between 'demo' and 'live'
     */
    setMode(newMode) {
        if (newMode === this.mode) return;
        this.stop();
        this.mode = newMode;
        this.start();
    }

    /**
     * Schedules the next simulated attack event with randomized organic delays
     */
    scheduleNextDemoEvent() {
        if (!this.isRunning) return;

        // Realistic organic delay between 1200ms and 3600ms
        const delay = Math.floor(Math.random() * 2400) + 1200;

        this.timer = setTimeout(() => {
            if (!this.isRunning) return;
            const event = this.generateSimulatedEvent();
            this.addEvent(event);
            this.scheduleNextDemoEvent();
        }, delay);
    }

    /**
     * Generates a realistic simulated attack telemetry event
     */
    generateSimulatedEvent() {
        this.eventIdCounter++;
        
        // Pick source node
        const sourceIndex = Math.floor(Math.random() * THREAT_NODES.length);
        const source = THREAT_NODES[sourceIndex];

        // Pick target node (ensure target is different country or city)
        let targetIndex = Math.floor(Math.random() * THREAT_NODES.length);
        while (targetIndex === sourceIndex) {
            targetIndex = Math.floor(Math.random() * THREAT_NODES.length);
        }
        const target = THREAT_NODES[targetIndex];

        // Pick attack profile
        const profile = ATTACK_PROFILES[Math.floor(Math.random() * ATTACK_PROFILES.length)];
        const severity = profile.severities[Math.floor(Math.random() * profile.severities.length)];
        const service = profile.services[Math.floor(Math.random() * profile.services.length)];
        const signature = profile.signatures[Math.floor(Math.random() * profile.signatures.length)];

        // Realistic masked IP generation
        const srcOctet1 = Math.floor(Math.random() * 190) + 20;
        const srcOctet2 = Math.floor(Math.random() * 254) + 1;
        const tgtOctet1 = Math.floor(Math.random() * 190) + 20;
        const tgtOctet2 = Math.floor(Math.random() * 254) + 1;

        return {
            id: `atk-${Date.now()}-${this.eventIdCounter}`,
            timestamp: Date.now(),
            sourceCountry: source.country,
            sourceCountryCode: source.code,
            sourceCity: source.city,
            sourceLat: source.lat,
            sourceLng: source.lng,
            targetCountry: target.country,
            targetCountryCode: target.code,
            targetCity: target.city,
            targetLat: target.lat,
            targetLng: target.lng,
            attackType: profile.type,
            severity: severity,
            sourceIPMasked: `${srcOctet1}.${srcOctet2}.***.***`,
            targetIPMasked: `${tgtOctet1}.${tgtOctet2}.***.***`,
            targetService: service,
            signature: signature
        };
    }

    /**
     * Ingests a new event, maintains buffer constraints, and notifies subscribers
     */
    addEvent(event) {
        this.events.unshift(event);
        if (this.events.length > CONFIG.MAX_ATTACK_EVENTS) {
            this.events.pop();
        }
        this.notify(event);
    }

    /**
     * Clear all telemetry history
     */
    clear() {
        this.events = [];
    }
}

export const attackProvider = new AttackProvider();
