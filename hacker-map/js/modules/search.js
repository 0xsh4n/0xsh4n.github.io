/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Global Intelligence Search Engine
 * 
 * Aggregates and categorizes results across CVEs, security writeups,
 * threat news, and geographic nodes with keyboard navigation (/ or Ctrl+K).
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, $$, createElement, debounce } from '../utils/dom.js';
import { cveProvider } from '../providers/cveProvider.js';
import { writeupProvider } from '../providers/writeupProvider.js';
import { newsProvider } from '../providers/newsProvider.js';
import { THREAT_NODES } from '../data/threatNodes.js';
import { sanitizeSeverity, sanitizeText, sanitizeQuery } from '../utils/sanitizer.js';

export class GlobalSearch {
    constructor(modalContainerId = 'modal-container') {
        this.container = $(`#${modalContainerId}`);
        this.isOpen = false;
        this.overlay = null;
        this.input = null;
        this.resultsEl = null;
        this.onSelectCallback = null;
        this.previousFocus = null;

        this.initKeybindings();
    }

    initKeybindings() {
        document.addEventListener('keydown', (e) => {
            // Open on '/' or 'Ctrl+K' / 'Cmd+K' (unless typing in an input/textarea)
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
            if ((e.key === '/' && !isTyping) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
                e.preventDefault();
                this.open();
            } else if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    open() {
        if (this.isOpen || !this.container) return;
        this.isOpen = true;
        this.previousFocus = document.activeElement;

        this.overlay = createElement('div', {
            className: 'modal-overlay animate-in',
            onclick: (e) => {
                if (e.target === this.overlay) this.close();
            }
        });

        this.overlay.innerHTML = `
            <div class="modal-content" style="max-width:680px; width:92%; max-height:85vh; display:flex; flex-direction:column; padding:0; overflow:hidden;" role="dialog" aria-modal="true" aria-label="Global Intelligence Search">
                <!-- Search Header -->
                <div style="padding:14px 16px; border-bottom:1px solid var(--border-panel); background:var(--bg-secondary); display:flex; align-items:center; gap:12px;">
                    <span style="color:var(--neon-green); font-size:1.1rem;">🔍</span>
                    <input type="search" id="global-search-query" class="search-input" placeholder="Search CVEs, products, attack types, countries, research... (ESC to close)" style="flex:1; border:none; background:transparent; font-size:0.85rem; padding:6px 0; color:var(--text-primary); outline:none;" autocomplete="off" spellcheck="false">
                    <button id="global-search-close" class="btn-icon" aria-label="Close search" style="font-size:1.1rem; line-height:1; cursor:pointer;">✕</button>
                </div>

                <!-- Results Area -->
                <div id="global-search-results" style="padding:16px; overflow-y:auto; flex:1; min-height:220px; font-size:0.75rem;">
                    <div style="text-align:center; padding:36px 16px; color:var(--dim-text);">
                        <div style="font-size:1.5rem; margin-bottom:8px; opacity:0.6;">⚡</div>
                        <div>Type a query to search global cyber threat intelligence</div>
                        <div style="font-size:0.65rem; margin-top:6px; font-family:var(--font-mono);">Examples: <span style="color:var(--neon-green)">CVE-2024</span>, <span style="color:var(--neon-green)">Apache</span>, <span style="color:var(--neon-green)">XSS</span>, <span style="color:var(--neon-green)">Russia</span>, <span style="color:var(--neon-green)">Zero-Day</span></div>
                    </div>
                </div>

                <!-- Footer Hotkey Cue -->
                <div style="padding:8px 16px; border-top:1px solid rgba(22,61,22,0.3); background:var(--bg-secondary); font-size:0.62rem; color:var(--dim-text); display:flex; justify-content:space-between; font-family:var(--font-mono);">
                    <span>[ESC] CLOSE</span>
                    <span>[ENTER] INSPECT SELECTION</span>
                </div>
            </div>
        `;

        this.container.appendChild(this.overlay);

        this.input = this.overlay.querySelector('#global-search-query');
        this.resultsEl = this.overlay.querySelector('#global-search-results');

        const closeBtn = this.overlay.querySelector('#global-search-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Debounced search query handler
        if (this.input) {
            this.input.focus();
            const performSearch = debounce(async (q) => {
                await this.search(q);
            }, 200);

            this.input.addEventListener('input', (e) => {
                const q = sanitizeQuery(e.target.value);
                performSearch(q);
            });
        }
    }

    close() {
        if (!this.isOpen) return;
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.isOpen = false;
        this.overlay = null;
        this.input = null;
        this.resultsEl = null;
        this.previousFocus?.focus?.();
        this.previousFocus = null;
    }

    async search(query) {
        if (!this.resultsEl) return;
        const q = (query || '').toLowerCase().trim();

        if (q.length < 2) {
            this.resultsEl.innerHTML = `
                <div style="text-align:center; padding:36px 16px; color:var(--dim-text);">
                    <div style="font-size:1.5rem; margin-bottom:8px; opacity:0.6;">⚡</div>
                    <div>Type at least 2 characters to search global intelligence</div>
                </div>
            `;
            return;
        }

        // Query datasets
        let cves, writeups, news;
        try {
            [cves, writeups, news] = await Promise.all([
                cveProvider.getData(),
                writeupProvider.getData(),
                newsProvider.getData()
            ]);
        } catch {
            this.resultsEl.textContent = 'Search data is temporarily unavailable. Please try again.';
            return;
        }

        // Filter CVEs
        const matchingCves = cves.filter(c => 
            (c.id && c.id.toLowerCase().includes(q)) ||
            (c.title && c.title.toLowerCase().includes(q)) ||
            (c.product && c.product.toLowerCase().includes(q)) ||
            (c.vendor && c.vendor.toLowerCase().includes(q)) ||
            (c.cwe && c.cwe.toLowerCase().includes(q))
        ).slice(0, 4);

        // Filter Writeups
        const matchingWriteups = writeups.filter(w => 
            (w.title && w.title.toLowerCase().includes(q)) ||
            (w.author && w.author.toLowerCase().includes(q)) ||
            (Array.isArray(w.tags) && w.tags.some(t => t.toLowerCase().includes(q)))
        ).slice(0, 4);

        // Filter News
        const matchingNews = news.filter(n => 
            (n.title && n.title.toLowerCase().includes(q)) ||
            (n.threatActor && n.threatActor.toLowerCase().includes(q)) ||
            (n.category && n.category.toLowerCase().includes(q))
        ).slice(0, 4);

        // Filter Geographic Nodes
        const matchingNodes = THREAT_NODES.filter(node => 
            node.country.toLowerCase().includes(q) ||
            node.city.toLowerCase().includes(q) ||
            node.code.toLowerCase() === q
        ).slice(0, 4);

        const totalResults = matchingCves.length + matchingWriteups.length + matchingNews.length + matchingNodes.length;

        if (totalResults === 0) {
            this.resultsEl.innerHTML = `
                <div style="text-align:center; padding:36px 16px; color:var(--dim-text);">
                    <div style="font-size:1.5rem; margin-bottom:8px;">🔍</div>
                    <div style="color:var(--text-primary); font-size:0.85rem; margin-bottom:4px;">No intelligence found matching "${sanitizeText(query)}"</div>
                    <div style="font-size:0.7rem;">Try searching for a CVE ID, software product, threat actor, or country.</div>
                </div>
            `;
            return;
        }

        let html = '';

        // 1. CVE Section
        if (matchingCves.length > 0) {
            html += '<div style="margin-bottom:16px;">';
            html += '<div style="font-size:0.65rem; color:var(--neon-green); font-weight:700; letter-spacing:1px; margin-bottom:6px;">🛡️ VULNERABILITY INTELLIGENCE (CVES)</div>';
            matchingCves.forEach(c => {
                html += `
                    <div class="card" style="padding:10px 12px; margin-bottom:6px; cursor:pointer;" data-search-type="cve" data-id="${sanitizeText(c.id)}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                            <span style="font-family:var(--font-mono); color:var(--neon-green); font-weight:700; font-size:0.75rem;">${sanitizeText(c.id)}</span>
                            <span class="severity-badge severity-${sanitizeSeverity(c.severity)}" style="font-size:0.55rem;">${sanitizeText(c.severity)}</span>
                        </div>
                        <div style="color:var(--text-primary); font-size:0.75rem; font-weight:600;">${sanitizeText(c.title)}</div>
                        <div style="font-size:0.65rem; color:var(--dim-text); margin-top:2px;">Product: ${sanitizeText(c.vendor)} ${sanitizeText(c.product)}</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // 2. Security Research Section
        if (matchingWriteups.length > 0) {
            html += '<div style="margin-bottom:16px;">';
            html += '<div style="font-size:0.65rem; color:var(--neon-green); font-weight:700; letter-spacing:1px; margin-bottom:6px;">📝 SECURITY RESEARCH & WRITEUPS</div>';
            matchingWriteups.forEach(w => {
                html += `
                    <div class="card" style="padding:10px 12px; margin-bottom:6px; cursor:pointer;" data-search-type="writeup" data-id="${sanitizeText(w.id)}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                            <span style="font-size:0.62rem; color:var(--dim-text); font-family:var(--font-mono);">${sanitizeText(w.source)}</span>
                            <span style="font-size:0.62rem; color:var(--terminal-text);">${sanitizeText(w.author)}</span>
                        </div>
                        <div style="color:var(--text-primary); font-size:0.75rem; font-weight:600;">${sanitizeText(w.title)}</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // 3. Threat News Section
        if (matchingNews.length > 0) {
            html += '<div style="margin-bottom:16px;">';
            html += '<div style="font-size:0.65rem; color:var(--neon-green); font-weight:700; letter-spacing:1px; margin-bottom:6px;">📡 CYBER THREAT NEWS</div>';
            matchingNews.forEach(n => {
                html += `
                    <div class="card" style="padding:10px 12px; margin-bottom:6px; cursor:pointer;" data-search-type="news" data-id="${sanitizeText(n.id)}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                            <span style="font-size:0.62rem; color:var(--dim-text); font-family:var(--font-mono);">${sanitizeText(n.source)}</span>
                            <span class="severity-badge severity-${sanitizeSeverity(n.severity)}" style="font-size:0.55rem;">${sanitizeText(n.severity)}</span>
                        </div>
                        <div style="color:var(--text-primary); font-size:0.75rem; font-weight:600;">${sanitizeText(n.title)}</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // 4. Geographic Nodes Section
        if (matchingNodes.length > 0) {
            html += '<div style="margin-bottom:8px;">';
            html += '<div style="font-size:0.65rem; color:var(--neon-green); font-weight:700; letter-spacing:1px; margin-bottom:6px;">🌍 THREAT TELEMETRY NODES</div>';
            html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
            matchingNodes.forEach(node => {
                html += `
                    <div class="card" style="padding:8px 12px; margin-bottom:0; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" data-search-type="node" data-lat="${node.lat}" data-lng="${node.lng}">
                        <div>
                            <div style="color:var(--text-primary); font-weight:600; font-size:0.75rem;">${sanitizeText(node.country)}</div>
                            <div style="color:var(--dim-text); font-size:0.65rem;">${sanitizeText(node.city)}</div>
                        </div>
                        <span style="color:var(--neon-green); font-family:var(--font-mono); font-size:0.7rem;">[MAP ↗]</span>
                    </div>
                `;
            });
            html += '</div></div>';
        }

        this.resultsEl.innerHTML = html;

        // Wire result selection clicks
        this.resultsEl.querySelectorAll('[data-search-type]').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.dataset.searchType;
                const id = el.dataset.id;
                const lat = parseFloat(el.dataset.lat);
                const lng = parseFloat(el.dataset.lng);

                if (this.onSelectCallback) {
                    this.onSelectCallback({ type, id, lat, lng });
                }
                this.close();
            });
        });
    }
}
