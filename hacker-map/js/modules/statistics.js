/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Global Threat Statistics Engine
 * 
 * Aggregates live telemetry, updates animated metric counters,
 * computes attack type distribution with proportional progress bars,
 * and maintains ranked source/target geographic hotspots.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, animateCounter } from '../utils/dom.js';
import { formatNumber, formatPercent } from '../utils/formatter.js';
import { sanitizeText } from '../utils/sanitizer.js';

export class ThreatStatistics {
    constructor() {
        this.totalEvents = 0;
        this.severityCounts = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
        };

        this.attackTypeCounts = new Map();
        this.targetCountryCounts = new Map();
        this.sourceCountryCounts = new Map();

        // Cached DOM elements
        this.totalEl = $('#stat-total');
        this.criticalEl = $('#stat-critical');
        this.highEl = $('#stat-high');
        this.mediumEl = $('#stat-medium');
        this.lowEl = $('#stat-low');

        this.attackTypesListEl = $('#attack-types-list');
        this.targetedCountriesEl = $('#targeted-countries');
        this.sourceCountriesEl = $('#source-countries');
        this.lastUpdateEl = $('#status-last-update');

        this.isDirty = false;
        this.renderDebounceTimer = null;
    }

    /**
     * Ingest a single attack event and update frequency tallies
     */
    recordEvent(event) {
        this.totalEvents++;
        const sev = (event.severity || 'LOW').toUpperCase();
        if (this.severityCounts[sev] !== undefined) {
            this.severityCounts[sev]++;
        } else {
            this.severityCounts.LOW++;
        }

        // Attack types
        const at = event.attackType || 'Unknown';
        this.attackTypeCounts.set(at, (this.attackTypeCounts.get(at) || 0) + 1);

        // Targeted country
        const tgt = event.targetCountry || 'Unknown';
        this.targetCountryCounts.set(tgt, (this.targetCountryCounts.get(tgt) || 0) + 1);

        // Source country
        const src = event.sourceCountry || 'Unknown';
        this.sourceCountryCounts.set(src, (this.sourceCountryCounts.get(src) || 0) + 1);

        this.scheduleRender();
    }

    /**
     * Batch ingest an array of initial attacks
     */
    seedData(events) {
        if (!Array.isArray(events)) return;
        events.forEach(evt => {
            this.totalEvents++;
            const sev = (evt.severity || 'LOW').toUpperCase();
            if (this.severityCounts[sev] !== undefined) {
                this.severityCounts[sev]++;
            }
            const at = evt.attackType || 'Unknown';
            this.attackTypeCounts.set(at, (this.attackTypeCounts.get(at) || 0) + 1);

            const tgt = evt.targetCountry || 'Unknown';
            this.targetCountryCounts.set(tgt, (this.targetCountryCounts.get(tgt) || 0) + 1);

            const src = evt.sourceCountry || 'Unknown';
            this.sourceCountryCounts.set(src, (this.sourceCountryCounts.get(src) || 0) + 1);
        });

        this.renderAll();
    }

    /**
     * Debounced rendering to avoid unnecessary DOM reflows
     */
    scheduleRender() {
        if (this.renderDebounceTimer) return;
        this.renderDebounceTimer = setTimeout(() => {
            this.renderAll();
            this.renderDebounceTimer = null;
        }, 300);
    }

    /**
     * Refresh all statistical UI panels
     */
    renderAll() {
        this.renderCounters();
        this.renderAttackTypes();
        this.renderTopCountries(this.targetCountryCounts, this.targetedCountriesEl, 'target');
        this.renderTopCountries(this.sourceCountryCounts, this.sourceCountriesEl, 'source');
        this.renderSystemStatus();
    }

    /**
     * Update primary severity counters with easing animations
     */
    renderCounters() {
        if (this.totalEl) animateCounter(this.totalEl, this.totalEvents, 400);
        if (this.criticalEl) animateCounter(this.criticalEl, this.severityCounts.CRITICAL, 400);
        if (this.highEl) animateCounter(this.highEl, this.severityCounts.HIGH, 400);
        if (this.mediumEl) animateCounter(this.mediumEl, this.severityCounts.MEDIUM, 400);
        if (this.lowEl) animateCounter(this.lowEl, this.severityCounts.LOW, 400);
    }

    /**
     * Render attack types ranked by percentage with visual bar fills
     */
    renderAttackTypes() {
        if (!this.attackTypesListEl || this.totalEvents === 0) return;

        // Sort descending
        const sorted = [...this.attackTypeCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5

        let html = '';
        sorted.forEach(([type, count]) => {
            const ratio = count / this.totalEvents;
            const percentStr = formatPercent(ratio, 0);
            const percentNum = Math.round(ratio * 100);

            html += `
                <div class="stat-type-item" style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.68rem; margin-bottom:2px;">
                        <span style="color:var(--text-primary); font-weight:600;">${sanitizeText(type)}</span>
                        <span style="color:var(--terminal-text); font-family:var(--font-mono);">${percentStr}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${percentNum}%;"></div>
                    </div>
                </div>
            `;
        });

        this.attackTypesListEl.innerHTML = html;
    }

    /**
     * Render ranked lists of target or source countries
     */
    renderTopCountries(countryMap, targetEl, role) {
        if (!targetEl || countryMap.size === 0) return;

        const sorted = [...countryMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const maxVal = sorted[0] ? sorted[0][1] : 1;

        let html = '<div class="ranked-country-list">';
        sorted.forEach(([country, count], index) => {
            const barWidth = Math.round((count / maxVal) * 100);
            const rankColor = index === 0 ? 'var(--neon-green)' : 'var(--dim-text)';

            html += `
                <div class="ranked-country-row" style="display:flex; align-items:center; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(22,61,22,0.25); font-size:0.68rem;">
                    <div style="display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">
                        <span style="color:${rankColor}; font-family:var(--font-mono); font-weight:700; width:16px;">#${index + 1}</span>
                        <span style="color:var(--text-primary);">${sanitizeText(country)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:40px; height:3px; background:rgba(22,61,22,0.4); border-radius:1px; overflow:hidden;">
                            <div style="width:${barWidth}%; height:100%; background:var(--neon-green);"></div>
                        </div>
                        <span style="color:var(--dim-text); font-family:var(--font-mono); font-size:0.65rem; min-width:24px; text-align:right;">${formatNumber(count)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        targetEl.innerHTML = html;
    }

    /**
     * Update the Last Updated status indicator
     */
    renderSystemStatus() {
        if (this.lastUpdateEl) {
            const time = new Date().toLocaleTimeString('en-US', { hour12: false });
            this.lastUpdateEl.textContent = `${time} UTC`;
        }
    }

    /**
     * Reset all statistics
     */
    reset() {
        this.totalEvents = 0;
        this.severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        this.attackTypeCounts.clear();
        this.targetCountryCounts.clear();
        this.sourceCountryCounts.clear();
        this.renderAll();
    }
}
