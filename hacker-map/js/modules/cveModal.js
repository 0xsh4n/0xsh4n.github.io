/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * CVE Detailed Investigation Modal
 * 
 * Deep-dive vulnerability view featuring CVSS vectors, affected version matrices,
 * chronological disclosure timelines, and safe external references.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, createElement } from '../utils/dom.js';
import { formatDate, formatCVSS } from '../utils/formatter.js';
import { sanitizeSeverity, sanitizeText, sanitizeURL } from '../utils/sanitizer.js';

export class CVEModal {
    constructor(containerId = 'modal-container') {
        this.container = $(`#${containerId}`);
        this.activeCve = null;
        this.onRelatedClickCallback = null;
        this.previousFocus = null;

        // Global ESC handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    isOpen() {
        return this.container && this.container.children.length > 0;
    }

    /**
     * Open modal with CVE data model
     */
    open(cve) {
        if (!this.container || !cve) return;
        this.activeCve = cve;
        this.previousFocus = document.activeElement;

        const sevClass = sanitizeSeverity(cve.severity);

        // Build Modal Overlay
        const overlay = createElement('div', {
            className: 'modal-overlay animate-in',
            onclick: (e) => {
                if (e.target === overlay) this.close();
            }
        });

        // References HTML
        let refsHtml = '';
        if (Array.isArray(cve.references) && cve.references.length > 0) {
            refsHtml = cve.references.map(ref => {
                const safeUrl = sanitizeURL(ref.url);
                return `
                    <div style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--neon-green); font-size:0.75rem;">▸</span>
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--text-primary); text-decoration:none; font-size:0.72rem; border-bottom:1px dashed var(--dim-text); transition:color 0.2s;">
                            ${sanitizeText(ref.source || ref.url)}
                        </a>
                        <span style="color:var(--dim-text); font-size:0.62rem;">[EXTERNAL]</span>
                    </div>
                `;
            }).join('');
        } else {
            refsHtml = '<div style="color:var(--dim-text); font-size:0.72rem;">No external references recorded.</div>';
        }

        // Timeline HTML
        let timelineHtml = '';
        if (Array.isArray(cve.timeline) && cve.timeline.length > 0) {
            timelineHtml = cve.timeline.map(item => `
                <div style="display:flex; gap:12px; margin-bottom:10px; position:relative;">
                    <span style="font-family:var(--font-mono); color:var(--neon-green); font-size:0.68rem; font-weight:700; min-width:85px;">${sanitizeText(item.date)}</span>
                    <span style="color:var(--text-primary); font-size:0.72rem; line-height:1.4;">${sanitizeText(item.event)}</span>
                </div>
            `).join('');
        } else {
            timelineHtml = '<div style="color:var(--dim-text); font-size:0.72rem;">No chronological milestones cataloged.</div>';
        }

        // Related CVEs
        let relatedHtml = '';
        if (Array.isArray(cve.relatedCves) && cve.relatedCves.length > 0) {
            relatedHtml = cve.relatedCves.map(relId => `
                <button class="tag" style="cursor:pointer; background:rgba(0,255,65,0.08); border:1px solid var(--border-panel); color:var(--neon-green); font-family:var(--font-mono);" data-related="${sanitizeText(relId)}">
                    ${sanitizeText(relId)}
                </button>
            `).join(' ');
        } else {
            relatedHtml = '<span style="color:var(--dim-text); font-size:0.7rem;">None identified</span>';
        }

        overlay.innerHTML = `
            <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-cve-title">
                <div class="modal-header" style="align-items:flex-start;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                            <span style="font-family:var(--font-mono); font-size:1.1rem; font-weight:700; color:var(--neon-green); letter-spacing:1px;">${sanitizeText(cve.id)}</span>
                            <span class="severity-badge severity-${sevClass}">${sanitizeText(cve.severity)}</span>
                            <span class="severity-badge" style="background:rgba(255,255,255,0.05); color:#ffffff; border:1px solid var(--border-panel);">CVSS ${formatCVSS(cve.cvssScore)}</span>
                            ${cve.isKev ? '<span class="severity-badge severity-critical" style="font-size:0.6rem;">CISA KEV</span>' : ''}
                        </div>
                        <h3 id="modal-cve-title" style="font-size:0.92rem; color:var(--text-primary); font-weight:600; line-height:1.4; margin:0;">${sanitizeText(cve.title)}</h3>
                    </div>
                    <button class="btn-icon" id="modal-close-btn" aria-label="Close modal" style="font-size:1.2rem; line-height:1; color:var(--dim-text); cursor:pointer;">✕</button>
                </div>

                <div class="modal-body">
                    <!-- Section 1: Overview -->
                    <div style="margin-bottom:18px;">
                        <div class="panel-header" style="padding-left:0; margin-bottom:8px;">OVERVIEW</div>
                        <p style="font-size:0.76rem; line-height:1.6; color:var(--text-primary); margin-bottom:12px;">${sanitizeText(cve.description)}</p>
                        
                        <div style="background:var(--bg-secondary); border:1px solid var(--border-panel); border-radius:3px; padding:10px 14px; font-size:0.7rem; font-family:var(--font-mono); display:flex; flex-direction:column; gap:6px;">
                            ${cve.cvssVector ? `<div><span style="color:var(--dim-text);">VECTOR:</span> <span style="color:var(--terminal-text);">${sanitizeText(cve.cvssVector)}</span></div>` : ''}
                            ${cve.cwe ? `<div><span style="color:var(--dim-text);">WEAKNESS:</span> <span style="color:var(--text-primary);">${sanitizeText(cve.cwe)}</span></div>` : ''}
                            ${cve.exploitStatus ? `<div><span style="color:var(--dim-text);">EXPLOIT STATUS:</span> <span style="color:var(--severity-critical); font-weight:600;">${sanitizeText(cve.exploitStatus)}</span></div>` : ''}
                        </div>
                    </div>

                    <!-- Section 2: Affected Products & Versions -->
                    <div style="margin-bottom:18px;">
                        <div class="panel-header" style="padding-left:0; margin-bottom:8px;">AFFECTED PRODUCTS & VERSIONS</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.72rem; margin-bottom:6px;">
                            <div><span style="color:var(--dim-text);">VENDOR:</span> <span style="color:var(--text-primary); font-weight:600;">${sanitizeText(cve.vendor)}</span></div>
                            <div><span style="color:var(--dim-text);">PRODUCT:</span> <span style="color:var(--text-primary); font-weight:600;">${sanitizeText(cve.product)}</span></div>
                        </div>
                        <div style="font-size:0.72rem;"><span style="color:var(--dim-text);">AFFECTED RELEASES:</span> <span style="color:var(--neon-green); font-family:var(--font-mono);">${sanitizeText(cve.affectedVersions)}</span></div>
                    </div>

                    <!-- Section 3: Chronological Timeline -->
                    <div style="margin-bottom:18px;">
                        <div class="panel-header" style="padding-left:0; margin-bottom:8px;">DISCLOSURE TIMELINE</div>
                        <div style="padding-left:4px; border-left:2px solid var(--border-panel); margin-left:6px;">
                            ${timelineHtml}
                        </div>
                    </div>

                    <!-- Section 4: Verified References -->
                    <div style="margin-bottom:18px;">
                        <div class="panel-header" style="padding-left:0; margin-bottom:8px;">VERIFIED REFERENCES & ADVISORIES</div>
                        ${refsHtml}
                    </div>

                    <!-- Section 5: Related Vulnerabilities -->
                    <div>
                        <div class="panel-header" style="padding-left:0; margin-bottom:8px;">RELATED CVES</div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            ${relatedHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wire close button
        const closeBtn = overlay.querySelector('#modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Wire related CVE clicks
        overlay.querySelectorAll('[data-related]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.related;
                if (this.onRelatedClickCallback) {
                    this.onRelatedClickCallback(targetId);
                }
            });
        });

        this.container.innerHTML = '';
        this.container.appendChild(overlay);
        closeBtn?.focus();
    }

    /**
     * Close modal
     */
    close() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.activeCve = null;
        this.previousFocus?.focus?.();
        this.previousFocus = null;
    }
}
