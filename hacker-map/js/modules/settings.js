/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Settings & Audio Telemetry Subsystem
 * 
 * Manages operator preferences, localStorage persistence,
 * and synthesized Web Audio tactical alert cues (zero asset dependencies).
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, $$ } from '../utils/dom.js';
import { getSettings, saveSettings } from '../utils/storage.js';

export class SettingsManager {
    constructor() {
        this.settings = getSettings();
        this.audioCtx = null;
        this.callbacks = new Map(); // key -> callback

        this.init();
    }

    init() {
        this.bindInputs();
    }

    /**
     * Subscribe to setting changes
     */
    onChange(key, callback) {
        this.callbacks.set(key, callback);
    }

    triggerChange(key, value) {
        this.settings[key] = value;
        if (key === 'dataMode') this.settings.dataModeConfigured = true;
        saveSettings(this.settings);
        const cb = this.callbacks.get(key);
        if (cb) cb(value);
    }

    bindInputs() {
        // Matrix Background
        const matrixToggle = $('#setting-matrix-bg');
        if (matrixToggle) {
            matrixToggle.checked = !!this.settings.matrixBg;
            matrixToggle.addEventListener('change', (e) => {
                this.triggerChange('matrixBg', e.target.checked);
            });
        }

        // Attack Animations
        const animToggle = $('#setting-animations');
        if (animToggle) {
            animToggle.checked = !!this.settings.attackAnimations;
            animToggle.addEventListener('change', (e) => {
                this.triggerChange('attackAnimations', e.target.checked);
            });
        }

        // Sound
        const soundToggle = $('#setting-sound');
        if (soundToggle) {
            soundToggle.checked = !!this.settings.sound;
            soundToggle.addEventListener('change', (e) => {
                this.triggerChange('sound', e.target.checked);
                if (e.target.checked) {
                    this.initAudioContext();
                    this.playTacticalBeep(880, 0.08, 'sine');
                }
            });
        }

        // Auto Refresh
        const refreshToggle = $('#setting-auto-refresh');
        if (refreshToggle) {
            refreshToggle.checked = !!this.settings.autoRefresh;
            refreshToggle.addEventListener('change', (e) => {
                this.triggerChange('autoRefresh', e.target.checked);
            });
        }

        // Refresh Interval
        const intervalSelect = $('#setting-refresh-interval');
        if (intervalSelect) {
            intervalSelect.value = this.settings.refreshInterval || 30000;
            intervalSelect.addEventListener('change', (e) => {
                this.triggerChange('refreshInterval', parseInt(e.target.value));
            });
        }

        // Data Mode
        const dataModeSelect = $('#setting-data-mode');
        if (dataModeSelect) {
            dataModeSelect.value = this.settings.dataMode || 'demo';
            dataModeSelect.addEventListener('change', (e) => {
                this.triggerChange('dataMode', e.target.value);
            });
        }

        // Notifications
        const notifToggle = $('#setting-notifications');
        if (notifToggle) {
            notifToggle.checked = !!this.settings.notifications;
            notifToggle.addEventListener('change', (e) => {
                this.triggerChange('notifications', e.target.checked);
            });
        }
    }

    /**
     * Web Audio API Synthesized Tactical Audio
     * Generates subtle cyber audio chirps without downloading MP3/WAV files.
     */
    initAudioContext() {
        if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playTacticalBeep(freq = 660, duration = 0.06, type = 'sine') {
        if (!this.settings.sound) return;

        try {
            this.initAudioContext();
            if (!this.audioCtx) return;

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            // Quick decay envelope prevents clicks
            gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch {
            // Audio policy or device limitation
        }
    }

    playCriticalAlert() {
        if (!this.settings.sound) return;
        this.playTacticalBeep(1040, 0.08, 'triangle');
        setTimeout(() => this.playTacticalBeep(1320, 0.12, 'sine'), 90);
    }
}
