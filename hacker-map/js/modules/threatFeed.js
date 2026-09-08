/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Cyber Threat Feed Coordinator
 * 
 * Manages cybersecurity headlines, zero-day alerts, ransomware disclosures,
 * and category filtering.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, $$ } from '../utils/dom.js';
import { newsProvider } from '../providers/newsProvider.js';
import { timeAgo } from '../utils/formatter.js';
import { sanitizeSeverity, sanitizeText, sanitizeURL } from '../utils/sanitizer.js';

export class ThreatFeed {
    constructor() {
        this.viewEl = $('#view-threats');
        this.listEl = $('#threat-feed-list');
        this.filterButtons = $$('#view-threats .btn-filter');

        this.items = [];
        this.currentFilter = 'All';

        this.init();
    }

    async init() {
        if (!this.viewEl || !this.listEl) return;

        this.setupFilters();
        await this.loadData();
    }

    async loadData() {
        this.renderLoading();
        try {
            this.items = await newsProvider.getData();
            this.render();
        } catch (err) {
            console.error('[ThreatFeed] Failed to load news items:', err);
            this.renderError('Unable to load cyber threat news feed.');
        }
    }

    setupFilters() {
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.textContent.trim();
                this.filterButtons.forEach(b => b.classList.toggle('active', b === btn));
                this.render();
            });
        });
    }

    getFilteredItems() {
        if (this.currentFilter === 'All') return [...this.items];
        // Filter by severity — GitHub advisories carry reliable severity data.
        return this.items.filter(item =>
            (item.severity || '').toUpperCase() === this.currentFilter.toUpperCase()
        );
    }

    render() {
        if (!this.listEl) return;
        const filtered = this.getFilteredItems();

        if (filtered.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">◌</div>
                    <div style="font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;">No advisories in this category right now</div>
                    <div style="font-size:0.7rem; color:var(--dim-text); max-width:520px;">Live feed from the GitHub Security Advisory Database. If nothing loads, the public API may be briefly rate-limited (unauthenticated ~60 req/hr) — try refreshing shortly.</div>
                </div>
            `;
            return;
        }

        let html = '<div style="display:flex; flex-direction:column; gap:12px; max-width:860px;">';
        filtered.forEach(item => {
            const sevClass = sanitizeSeverity(item.severity);
            const timeAgoStr = timeAgo(item.timestamp);
            const safeUrl = sanitizeURL(item.url);

            html += `
                <article class="card animate-in" style="margin-bottom:0; display:flex; flex-direction:column; gap:8px;">
                    <!-- Metadata Header -->
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.68rem;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="severity-badge severity-${sevClass}">${sanitizeText(item.severity)}</span>
                            <span class="severity-badge" style="background:rgba(0,255,65,0.06); color:var(--neon-green); border:1px solid var(--border-panel); font-weight:700;">
                                ${sanitizeText(item.source)}
                            </span>
                            <span style="color:var(--dim-text); font-family:var(--font-mono); font-size:0.62rem;">${sanitizeText(item.category)}</span>
                        </div>
                        <span style="color:var(--dim-text); font-family:var(--font-mono); font-size:0.62rem;">${timeAgoStr}</span>
                    </div>

                    <!-- Headline -->
                    <h3 class="card-title" style="font-size:0.92rem; font-weight:600; line-height:1.4; color:var(--text-primary); margin:0;">
                        ${sanitizeText(item.title)}
                    </h3>

                    <!-- Summary -->
                    <p style="font-size:0.75rem; color:var(--dim-text); line-height:1.55; margin:0;">
                        ${sanitizeText(item.summary)}
                    </p>

                    <!-- Threat Context Badges & Link -->
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(22,61,22,0.3); padding-top:8px; margin-top:4px; font-size:0.65rem;">
                        <div style="display:flex; gap:12px; color:var(--dim-text);">
                            ${item.threatActor ? `<div>ACTOR: <span style="color:var(--terminal-text); font-family:var(--font-mono);">${sanitizeText(item.threatActor)}</span></div>` : ''}
                            ${item.affectedSector ? `<div>SECTOR: <span style="color:var(--text-primary);">${sanitizeText(item.affectedSector)}</span></div>` : ''}
                        </div>
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none; padding:4px 10px; font-size:0.65rem; display:inline-flex; align-items:center; gap:4px;">
                            <span>SOURCE DISCLOSURE</span>
                            <span>↗</span>
                        </a>
                    </div>
                </article>
            `;
        });
        html += '</div>';

        this.listEl.innerHTML = html;
    }

    renderLoading() {
        if (!this.listEl) return;
        this.listEl.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; height:200px; gap:12px; color:var(--dim-text); font-size:0.75rem;">
                <div class="spinner"></div>
                <span>Synchronizing verified cyber threat feeds...</span>
            </div>
        `;
    }

    renderError(msg) {
        if (!this.listEl) return;
        this.listEl.innerHTML = `
            <div class="empty-state">
                <div style="color:var(--severity-critical); font-size:1.5rem; margin-bottom:8px;">⚠️</div>
                <div style="color:var(--text-primary); font-size:0.85rem;">${sanitizeText(msg)}</div>
            </div>
        `;
    }
}
