/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Real-Time Threat Timeline Feed
 * 
 * Streams incoming threat telemetry into a cyber activity feed
 * with animated ingest, severity color badges, and interactive inspection.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { CONFIG } from '../config/config.js';
import { $, createElement } from '../utils/dom.js';
import { formatTimestamp } from '../utils/formatter.js';
import { sanitizeSeverity, sanitizeText } from '../utils/sanitizer.js';

export class AttackFeed {
    constructor(containerId = 'threat-timeline', countId = 'timeline-count') {
        this.container = $(`#${containerId}`);
        this.countEl = $(`#${countId}`);
        this.events = [];
        this.maxEvents = CONFIG.MAX_ATTACK_EVENTS || 50;
        this.onEventClickCallback = null;
    }

    /**
     * Ingest a new attack event and render into the timeline
     */
    addEvent(event) {
        if (!this.container) return;

        this.events.unshift(event);
        if (this.events.length > this.maxEvents) {
            this.events.pop();
            // Prune last element in DOM
            if (this.container.lastElementChild) {
                this.container.removeChild(this.container.lastElementChild);
            }
        }

        const el = this.createEventElement(event);
        this.container.insertBefore(el, this.container.firstChild);

        this.updateCount();
    }

    /**
     * Build an individual timeline event DOM card
     */
    createEventElement(event) {
        const sevClass = sanitizeSeverity(event.severity);
        const timeStr = formatTimestamp(event.timestamp);

        const item = createElement('div', {
            className: `event-item ${sevClass} animate-in`,
            dataset: { id: event.id },
            role: 'button',
            tabIndex: 0,
            'aria-label': `Inspect ${event.severity} ${event.attackType} event targeting ${event.targetCountry}`
        });

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span class="event-time">[${timeStr}]</span>
                <span class="severity-badge severity-${sevClass}">${sanitizeText(event.severity)}</span>
            </div>
            <div class="event-type">${sanitizeText(event.attackType)}</div>
            <div class="event-detail" style="display:flex; flex-direction:column; gap:2px; margin-top:4px;">
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--dim-text);">SRC:</span>
                    <span style="color:var(--text-primary); font-weight:600;">${sanitizeText(event.sourceCountry)}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--dim-text);">TGT:</span>
                    <span style="color:var(--text-primary); font-weight:600;">${sanitizeText(event.targetCountry)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.62rem; margin-top:2px;">
                    <span style="color:var(--dim-text);">SVC:</span>
                    <span style="color:var(--neon-green); font-family:var(--font-mono);">${sanitizeText(event.targetService)}</span>
                </div>
            </div>
        `;

        const inspect = () => {
            if (this.onEventClickCallback) {
                this.onEventClickCallback(event);
            }
        };
        item.addEventListener('click', inspect);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inspect();
            }
        });

        return item;
    }

    /**
     * Batch seed events
     */
    seedEvents(events) {
        if (!Array.isArray(events)) return;
        events.forEach(evt => this.addEvent(evt));
    }

    /**
     * Clear all timeline history
     */
    clear() {
        this.events = [];
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.updateCount();
    }

    /**
     * Update header counter
     */
    updateCount() {
        if (this.countEl) {
            this.countEl.textContent = `${this.events.length} Events`;
        }
    }
}
