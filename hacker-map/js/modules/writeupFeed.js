/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Latest Security Research & Writeups Coordinator
 * 
 * Coordinates research aggregation, category tab filtering,
 * multi-attribute sorting (newest, trending, source), and debounced search.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, $$, debounce } from '../utils/dom.js';
import { writeupProvider } from '../providers/writeupProvider.js';
import { timeAgo } from '../utils/formatter.js';
import { sanitizeText, sanitizeURL, sanitizeQuery } from '../utils/sanitizer.js';

export class WriteupFeed {
    constructor() {
        this.viewEl = $('#view-writeups');
        this.gridEl = $('#writeups-grid');
        this.tabs = $$('#writeups-tabs .tab');
        this.sortSelect = $('#writeups-sort-select');
        this.searchInput = $('#writeups-search-input');

        this.items = [];
        this.currentTab = 'ALL';
        this.currentSort = 'newest';
        this.searchQuery = '';

        this.init();
    }

    async init() {
        if (!this.viewEl || !this.gridEl) return;

        this.setupTabs();
        this.setupControls();

        await this.loadData();
    }

    async loadData() {
        this.renderLoading();
        try {
            this.items = await writeupProvider.getData();
            this.updateStatusBadge();
            this.render();
        } catch (err) {
            console.error('[WriteupFeed] Data load error:', err);
            this.renderError('Unable to load security research feeds.');
        }
    }

    updateStatusBadge() {
        const statusEl = $('#status-research');
        if (!statusEl) return;
        const status = writeupProvider.getStatus();

        // Curated research feeds are a healthy operating state; only a genuine
        // failure should read as degraded/offline.
        let label, health;
        if (status.status === 'offline') {
            label = 'OFFLINE'; health = 'offline';
        } else if (/CACHED/.test(status.source || '')) {
            label = 'CACHED'; health = 'online';
        } else if (/LIVE/.test(status.source || '')) {
            label = 'LIVE'; health = 'online';
        } else {
            label = 'LIVE'; health = 'online';
        }
        const indicator = document.createElement('span');
        indicator.className = `status-indicator status-${health}`;
        statusEl.replaceChildren(indicator, document.createTextNode(label));
    }

    setupTabs() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.textContent.trim().toUpperCase();
                this.currentTab = tabName;

                this.tabs.forEach(t => {
                    t.classList.toggle('active', t.textContent.trim().toUpperCase() === tabName);
                });

                this.render();
            });
        });
    }

    setupControls() {
        // Sort select
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.render();
            });
        }

        // Debounced search
        if (this.searchInput) {
            const onInput = debounce((e) => {
                this.searchQuery = sanitizeQuery(e.target.value.toLowerCase());
                this.render();
            }, 250);

            this.searchInput.addEventListener('input', onInput);
        }
    }

    getFilteredItems() {
        let list = [...this.items];

        // 1. Filter by category tab
        if (this.currentTab !== 'ALL') {
            list = list.filter(item => {
                const cat = (item.category || '').toUpperCase();
                return cat === this.currentTab;
            });
        }

        // 2. Filter by search query
        if (this.searchQuery) {
            const q = this.searchQuery;
            list = list.filter(item => {
                const matchTitle = item.title && item.title.toLowerCase().includes(q);
                const matchAuthor = item.author && item.author.toLowerCase().includes(q);
                const matchSource = item.source && item.source.toLowerCase().includes(q);
                const matchSummary = item.summary && item.summary.toLowerCase().includes(q);
                const matchTags = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(q));
                return matchTitle || matchAuthor || matchSource || matchSummary || matchTags;
            });
        }

        // 3. Sort
        switch (this.currentSort) {
            case 'trending':
                list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                break;
            case 'source':
                list.sort((a, b) => (a.source || '').localeCompare(b.source || ''));
                break;
            case 'newest':
            default:
                list.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
                break;
        }

        return list;
    }

    render() {
        if (!this.gridEl) return;

        const filtered = this.getFilteredItems();

        if (filtered.length === 0) {
            this.gridEl.innerHTML = `
                <div class="empty-state" style="grid-column:1 / -1;">
                    <div class="empty-state-icon">📝</div>
                    <div style="font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;">No writeups found</div>
                    <div style="font-size:0.7rem; color:var(--dim-text);">Try adjusting your category filter or search keywords.</div>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(item => {
            const safeUrl = sanitizeURL(item.url);
            const timeAgoStr = timeAgo(item.publishedDate);

            // Tags HTML
            let tagsHtml = '';
            if (Array.isArray(item.tags)) {
                tagsHtml = item.tags.map(tag => `
                    <span class="tag" style="cursor:pointer;" data-tag="${sanitizeText(tag)}">${sanitizeText(tag)}</span>
                `).join(' ');
            }

            html += `
                <div class="card animate-in" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <!-- Header / Source & Time -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.65rem;">
                            <span class="severity-badge" style="background:rgba(0,255,65,0.08); color:var(--neon-green); border:1px solid var(--border-panel); font-weight:700;">
                                ${sanitizeText(item.source)}
                            </span>
                            <div style="color:var(--dim-text); font-family:var(--font-mono);">
                                <span>${timeAgoStr}</span> • <span>${sanitizeText(item.readTime || '5 min read')}</span>
                            </div>
                        </div>

                        <!-- Title -->
                        <h3 class="card-title" style="font-size:0.85rem; line-height:1.45; margin-bottom:6px; color:var(--text-primary);">
                            ${sanitizeText(item.title)}
                        </h3>

                        <!-- Author -->
                        <div style="font-size:0.68rem; color:var(--dim-text); margin-bottom:10px;">
                            BY: <span style="color:var(--terminal-text); font-family:var(--font-mono);">${sanitizeText(item.author)}</span>
                        </div>

                        <!-- Summary -->
                        <p style="font-size:0.72rem; color:var(--dim-text); line-height:1.55; margin-bottom:12px;">
                            ${sanitizeText(item.summary)}
                        </p>

                        <!-- Tags -->
                        <div class="card-tags" style="margin-bottom:14px;">
                            ${tagsHtml}
                        </div>
                    </div>

                    <!-- Read Button -->
                    <div style="border-top:1px solid rgba(22,61,22,0.3); padding-top:10px; display:flex; justify-content:flex-end;">
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-size:0.68rem; padding:5px 12px;">
                            <span>READ ARTICLE</span>
                            <span style="font-size:0.75rem;">↗</span>
                        </a>
                    </div>
                </div>
            `;
        });

        this.gridEl.innerHTML = html;

        // Wire tag pills to auto-filter on click
        this.gridEl.querySelectorAll('.tag[data-tag]').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = pill.dataset.tag;
                if (this.searchInput) {
                    this.searchInput.value = tag;
                    this.searchQuery = tag.toLowerCase();
                    this.render();
                }
            });
        });
    }

    renderLoading() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = `
            <div style="grid-column:1 / -1; display:flex; justify-content:center; align-items:center; height:200px; gap:12px; color:var(--dim-text); font-size:0.75rem;">
                <div class="spinner"></div>
                <span>Aggregating offensive security research feeds...</span>
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
