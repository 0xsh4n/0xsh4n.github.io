/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * CVE Intelligence Center Coordinator
 * 
 * Manages vulnerability catalog browsing, filter tab navigation,
 * debounced full-text search, and detailed card rendering.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, $$, debounce } from '../utils/dom.js';
import { cveProvider } from '../providers/cveProvider.js';
import { CVEModal } from './cveModal.js';
import { formatCVSS, formatDate, truncate } from '../utils/formatter.js';
import { sanitizeSeverity, sanitizeText, sanitizeQuery } from '../utils/sanitizer.js';

export class CVEDashboard {
    constructor() {
        this.viewEl = $('#view-cve');
        this.gridEl = $('#cve-grid');
        this.searchInput = $('#view-cve .search-bar');
        this.tabs = $$('#view-cve .tab');
        this.cves = [];
        this.currentTab = 'LATEST';
        this.searchQuery = '';
        this.modal = new CVEModal('modal-container');

        this.init();
    }

    async init() {
        if (!this.viewEl || !this.gridEl) return;

        // Wire modal related-CVE jump
        this.modal.onRelatedClickCallback = (relatedId) => {
            const match = this.cves.find(c => c.id.toUpperCase() === relatedId.toUpperCase());
            if (match) {
                this.modal.open(match);
            } else {
                this.searchQuery = relatedId;
                if (this.searchInput) this.searchInput.value = relatedId;
                this.switchTab('SEARCH');
                this.modal.close();
            }
        };

        this.setupTabs();
        this.setupSearch();

        // Initial fetch
        await this.loadData();
    }

    /**
     * Retrieve CVE records from provider
     */
    async loadData() {
        this.renderLoading();
        try {
            this.cves = await cveProvider.getData();
            this.updateStatusBadge();
            this.render();
            if (typeof this.onLoaded === 'function') this.onLoaded();
        } catch (err) {
            console.error('[CVEDashboard] Failed to load data:', err);
            this.renderError('Unable to load vulnerability intelligence.');
        }
    }

    /**
     * Updates System Status panel indicator
     */
    updateStatusBadge() {
        const statusEl = $('#status-cve');
        if (!statusEl) return;
        const status = cveProvider.getStatus();

        const live = status.status === 'connected' && /LIVE/.test(status.source || '');
        let label, health;
        if (live) {
            label = 'LIVE'; health = 'online';
        } else if (status.status === 'connected') {
            // Bundled/demo intelligence is a valid, healthy state — not a fault.
            label = 'DEMO'; health = 'online';
        } else if (status.status === 'offline') {
            label = 'OFFLINE'; health = 'offline';
        } else {
            label = 'CACHED'; health = 'degraded';
        }
        const indicator = document.createElement('span');
        indicator.className = `status-indicator status-${health}`;
        statusEl.replaceChildren(indicator, document.createTextNode(label));
    }

    /**
     * Wire category tabs (LATEST, CRITICAL, HIGH, KNOWN EXPLOITED, SEARCH)
     */
    setupTabs() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.textContent.trim().toUpperCase();
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        this.tabs.forEach(t => {
            t.classList.toggle('active', t.textContent.trim().toUpperCase() === tabName);
        });

        // Focus search input if SEARCH tab is clicked
        if (tabName === 'SEARCH' && this.searchInput) {
            this.searchInput.focus();
        }

        this.render();
    }

    /**
     * Wire debounced live search
     */
    setupSearch() {
        if (!this.searchInput) return;

        const onInput = debounce((e) => {
            this.searchQuery = sanitizeQuery(e.target.value.toLowerCase());
            if (this.searchQuery.length > 0 && this.currentTab !== 'SEARCH') {
                this.switchTab('SEARCH');
            } else {
                this.render();
            }
        }, 250);

        this.searchInput.addEventListener('input', onInput);
    }

    /**
     * Filter CVEs according to active tab and search query
     */
    getFilteredCVEs() {
        let list = [...this.cves];

        // 1. Apply Tab Filter
        switch (this.currentTab) {
            case 'CRITICAL':
                list = list.filter(c => (c.severity || '').toUpperCase() === 'CRITICAL');
                break;
            case 'HIGH':
                list = list.filter(c => (c.severity || '').toUpperCase() === 'HIGH');
                break;
            case 'KNOWN EXPLOITED':
                list = list.filter(c => c.isKev);
                break;
            case 'SEARCH':
            case 'LATEST':
            default:
                break;
        }

        // 2. Apply Text Query
        if (this.searchQuery) {
            const q = this.searchQuery;
            list = list.filter(c => 
                (c.id && c.id.toLowerCase().includes(q)) ||
                (c.title && c.title.toLowerCase().includes(q)) ||
                (c.product && c.product.toLowerCase().includes(q)) ||
                (c.vendor && c.vendor.toLowerCase().includes(q)) ||
                (c.description && c.description.toLowerCase().includes(q)) ||
                (c.cwe && c.cwe.toLowerCase().includes(q))
            );
        }

        return list;
    }

    /**
     * Render the cards into the grid
     */
    render() {
        if (!this.gridEl) return;

        const filtered = this.getFilteredCVEs();

        if (filtered.length === 0) {
            this.gridEl.innerHTML = `
                <div class="empty-state" style="grid-column:1 / -1;">
                    <div class="empty-state-icon">🛡️</div>
                    <div style="font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;">No vulnerabilities matched criteria</div>
                    <div style="font-size:0.7rem; color:var(--dim-text);">Try refining your search terms or selecting another category tab.</div>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(cve => {
            const sevClass = sanitizeSeverity(cve.severity);

            html += `
                <div class="card animate-in" data-cve-id="${sanitizeText(cve.id)}" role="button" tabindex="0" aria-label="Inspect ${sanitizeText(cve.id)}" style="cursor:pointer; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <!-- Header Badges -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700; color:var(--neon-green);">${sanitizeText(cve.id)}</span>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <span class="severity-badge severity-${sevClass}">${sanitizeText(cve.severity)}</span>
                                <span class="severity-badge" style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid var(--border-panel); font-size:0.6rem;">CVSS ${formatCVSS(cve.cvssScore)}</span>
                            </div>
                        </div>

                        <!-- Title -->
                        <div class="card-title" style="font-size:0.82rem; line-height:1.4; color:var(--text-primary); margin-bottom:8px;">
                            ${sanitizeText(cve.title)}
                        </div>

                        <!-- Product & Version -->
                        <div style="font-size:0.68rem; margin-bottom:8px; color:var(--dim-text);">
                            <div>PRODUCT: <span style="color:var(--text-primary); font-weight:600;">${sanitizeText(cve.vendor)} ${sanitizeText(cve.product)}</span></div>
                            <div>VERSIONS: <span style="color:var(--terminal-text); font-family:var(--font-mono);">${sanitizeText(cve.affectedVersions)}</span></div>
                            ${cve.lastModifiedDate ? `<div>MODIFIED: <span style="color:var(--text-primary);">${formatDate(cve.lastModifiedDate)}</span></div>` : ''}
                        </div>

                        <!-- Short Description -->
                        <div style="font-size:0.72rem; color:var(--dim-text); line-height:1.5; margin-bottom:12px;">
                            ${sanitizeText(truncate(cve.description, 140))}
                        </div>
                    </div>

                    <!-- Footer Tags -->
                    <div style="border-top:1px solid rgba(22,61,22,0.3); padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.62rem; color:var(--dim-text); font-family:var(--font-mono);">${formatDate(cve.publishedDate)}</span>
                        ${cve.isKev ? '<span class="severity-badge severity-critical" style="font-size:0.58rem;">KNOWN EXPLOITED</span>' : '<span style="font-size:0.62rem; color:var(--dim-text);">ADVISORY</span>'}
                    </div>
                </div>
            `;
        });

        this.gridEl.innerHTML = html;

        // Wire click handler on cards
        this.gridEl.querySelectorAll('.card[data-cve-id]').forEach(card => {
            const openCard = () => {
                const id = card.dataset.cveId;
                const match = this.cves.find(c => c.id === id);
                if (match) {
                    this.modal.open(match);
                }
            };
            card.addEventListener('click', openCard);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCard();
                }
            });
        });
    }

    renderLoading() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = `
            <div style="grid-column:1 / -1; display:flex; justify-content:center; align-items:center; height:200px; gap:12px; color:var(--dim-text); font-size:0.75rem;">
                <div class="spinner"></div>
                <span>Querying vulnerability telemetry database...</span>
            </div>
        `;
    }

    renderError(msg) {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = `
            <div class="empty-state" style="grid-column:1 / -1;">
                <div style="color:var(--severity-critical); font-size:1.5rem; margin-bottom:8px;">⚠️</div>
                <div style="color:var(--text-primary); font-size:0.85rem;">${sanitizeText(msg)}</div>
            </div>
        `;
    }
}
