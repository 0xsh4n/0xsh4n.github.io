/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Self-Contained World Cyber Attack Map
 *
 * A fully offline, dependency-free world map rendered on an HTML5 canvas.
 * NO external tile providers, NO map CDNs, NO API keys required — the country
 * geometry is bundled locally in js/data/worldGeo.js. This guarantees the map
 * always renders, whether the folder is opened locally, served on localhost,
 * or deployed to GitHub Pages / any static host.
 *
 * Features:
 *   - Equirectangular projection with drag-to-pan and wheel/button zoom
 *   - Animated source -> target attack trajectories (curved Bézier arcs)
 *   - Traveling projectile heads + expanding impact ripples
 *   - Glowing origin/target nodes and hover threat-intel tooltips
 *   - Severity/type filtering, pause/resume, flyTo() navigation
 *
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { CONFIG } from '../config/config.js';
import { timeAgo } from '../utils/formatter.js';
import { sanitizeText } from '../utils/sanitizer.js';
import { WORLD_GEO } from '../data/worldGeo.js';

export class CyberAttackMap {
    constructor(containerId = 'attack-map') {
        this.containerId = containerId;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.baseCanvas = null; // offscreen cached basemap
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.width = 0;
        this.height = 0;

        // View transform
        this.zoom = 1;
        this.minZoom = 0.85;
        this.maxZoom = 8;
        this.panX = 0;
        this.panY = 0;

        this.activeAttacks = new Map(); // id -> record
        this.countryHits = new Map();

        this.isPaused = false;
        this.selectedFilterType = 'ALL';
        this.selectedFilterSeverity = 'ALL';
        this.onThreatSelectCallback = null;

        this.attackCounterEl = document.querySelector('.attack-counter');
        this.hoverAttack = null;

        // Facade so callers written against the old Leaflet API keep working.
        this.map = {
            invalidateSize: () => this.resize(),
            flyTo: (latlng, zoom, opts) => this.flyTo(latlng, zoom, opts)
        };

        this.init();
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.warn('[CyberMap] container missing.');
            return;
        }

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'cyber-map-canvas';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.baseCanvas = document.createElement('canvas');

        this.buildControls();
        this.bindEvents();
        this.resize();
        this.startAnimationLoop();
    }

    /* ---------------------------------------------------------------- UI --- */

    buildControls() {
        const zoomWrap = document.createElement('div');
        zoomWrap.className = 'map-zoom-controls';
        zoomWrap.innerHTML = `
            <button type="button" class="map-zoom-btn" data-zoom="in" aria-label="Zoom in" title="Zoom in">+</button>
            <button type="button" class="map-zoom-btn" data-zoom="out" aria-label="Zoom out" title="Zoom out">−</button>
            <button type="button" class="map-zoom-btn" data-zoom="reset" aria-label="Reset view" title="Reset view">⟲</button>
        `;
        this.container.appendChild(zoomWrap);
        zoomWrap.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-zoom]');
            if (!btn) return;
            if (btn.dataset.zoom === 'in') this.zoomBy(1.5);
            else if (btn.dataset.zoom === 'out') this.zoomBy(1 / 1.5);
            else this.resetView();
        });

        const simTag = document.createElement('div');
        simTag.className = 'map-sim-tag';
        simTag.title = 'Attack traffic on this map is simulated — no live global attack feed is available to a static site without a backend.';
        simTag.innerHTML = '<span class="map-sim-dot"></span>SIMULATED TRAFFIC';
        this.container.appendChild(simTag);

        const legend = document.createElement('div');
        legend.className = 'map-legend';
        legend.innerHTML = `
            <span class="map-legend-title">SEVERITY</span>
            <span class="map-legend-item"><i style="background:#ff0040"></i>Critical</span>
            <span class="map-legend-item"><i style="background:#ff6600"></i>High</span>
            <span class="map-legend-item"><i style="background:#ffcc00"></i>Medium</span>
            <span class="map-legend-item"><i style="background:#00ccff"></i>Low</span>
        `;
        this.container.appendChild(legend);
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        // Drag to pan
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let moved = false;

        this.canvas.addEventListener('pointerdown', (e) => {
            dragging = true;
            moved = false;
            lastX = e.clientX;
            lastY = e.clientY;
            this.canvas.setPointerCapture(e.pointerId);
            this.canvas.classList.add('grabbing');
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (dragging) {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
                this.panX += dx;
                this.panY += dy;
                lastX = e.clientX;
                lastY = e.clientY;
                this.clampPan();
                this.renderBase();
            } else {
                this.handleHover(e);
            }
        });

        const endDrag = (e) => {
            dragging = false;
            this.canvas.classList.remove('grabbing');
            if (e && this.canvas.hasPointerCapture?.(e.pointerId)) {
                this.canvas.releasePointerCapture(e.pointerId);
            }
        };
        this.canvas.addEventListener('pointerup', endDrag);
        this.canvas.addEventListener('pointercancel', endDrag);
        this.canvas.addEventListener('pointerleave', () => {
            this.hideTooltip();
            this.hoverAttack = null;
        });

        // Wheel zoom (anchored at cursor)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            this.zoomBy(factor, e.clientX, e.clientY);
        }, { passive: false });

        // Click a trajectory to select it
        this.canvas.addEventListener('click', (e) => {
            if (moved) return;
            const hit = this.pickAttack(e);
            if (hit && this.onThreatSelectCallback) this.onThreatSelectCallback(hit.attack);
        });
    }

    /* -------------------------------------------------------- projection --- */

    resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.width = Math.max(rect.width, 10);
        this.height = Math.max(rect.height, 10);

        for (const c of [this.canvas, this.baseCanvas]) {
            c.width = this.width * this.dpr;
            c.height = this.height * this.dpr;
        }
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        // Base scale (pixels per degree) so the whole world fits.
        this.baseScale = Math.min(this.width / 360, this.height / 180);
        this.clampPan();
        this.renderBase();
    }

    project(lat, lng) {
        const s = this.baseScale * this.zoom;
        const cx = this.width / 2 + this.panX;
        const cy = this.height / 2 + this.panY;
        return { x: cx + lng * s, y: cy - lat * s };
    }

    unprojectX(x) {
        const s = this.baseScale * this.zoom;
        return (x - (this.width / 2 + this.panX)) / s;
    }
    unprojectY(y) {
        const s = this.baseScale * this.zoom;
        return -(y - (this.height / 2 + this.panY)) / s;
    }

    clampPan() {
        const s = this.baseScale * this.zoom;
        const worldW = 360 * s;
        const worldH = 180 * s;
        const maxX = Math.max(0, (worldW - this.width) / 2 + 40);
        const maxY = Math.max(0, (worldH - this.height) / 2 + 40);
        this.panX = Math.max(-maxX, Math.min(maxX, this.panX));
        this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
    }

    zoomBy(factor, anchorClientX, anchorClientY) {
        const prev = this.zoom;
        const next = Math.max(this.minZoom, Math.min(this.maxZoom, prev * factor));
        if (next === prev) return;

        const rect = this.canvas.getBoundingClientRect();
        const ax = anchorClientX != null ? anchorClientX - rect.left : this.width / 2;
        const ay = anchorClientY != null ? anchorClientY - rect.top : this.height / 2;

        // Keep the geo point under the cursor stationary while zooming.
        const lng = this.unprojectX(ax);
        const lat = this.unprojectY(ay);
        this.zoom = next;
        const p = this.project(lat, lng);
        this.panX += ax - p.x;
        this.panY += ay - p.y;
        this.clampPan();
        this.renderBase();
    }

    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.renderBase();
    }

    flyTo(latlng, zoom = 4, opts = {}) {
        const [lat, lng] = Array.isArray(latlng) ? latlng : [latlng.lat, latlng.lng];
        const duration = (opts.duration || 0.9) * 1000;
        const startZoom = this.zoom;
        const startPanX = this.panX;
        const startPanY = this.panY;
        const targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));

        const start = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3);

        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const k = ease(t);
            this.zoom = startZoom + (targetZoom - startZoom) * k;
            // Recompute pan so the target lat/lng lands at canvas center.
            const s = this.baseScale * this.zoom;
            const desiredPanX = -lng * s;
            const desiredPanY = lat * s;
            this.panX = startPanX + (desiredPanX - startPanX) * k;
            this.panY = startPanY + (desiredPanY - startPanY) * k;
            this.clampPan();
            this.renderBase();
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /* ------------------------------------------------------- base render --- */

    renderBase() {
        const ctx = this.baseCanvas.getContext('2d');
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);

        // Deep space background
        ctx.fillStyle = '#01040a';
        ctx.fillRect(0, 0, this.width, this.height);

        this.drawGraticule(ctx);

        // Countries
        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.6;
        for (const feat of WORLD_GEO) {
            const polys = feat.t === 1 ? feat.c : feat.c;
            ctx.beginPath();
            for (const poly of polys) {
                for (const ring of poly) {
                    for (let i = 0; i < ring.length; i++) {
                        const p = this.project(ring[i][1], ring[i][0]);
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    }
                    ctx.closePath();
                }
            }
            ctx.fillStyle = 'rgba(10, 30, 16, 0.92)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.28)';
            ctx.stroke();
        }
        ctx.restore();

        // Blit immediately so the world map is visible even when the animation
        // loop is throttled (e.g. background tab) or paused by the user.
        this.blitBase();
    }

    blitBase() {
        if (!this.ctx) return;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.drawImage(this.baseCanvas, 0, 0, this.width, this.height);
    }

    drawGraticule(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.06)';
        ctx.lineWidth = 0.5;
        for (let lng = -180; lng <= 180; lng += 30) {
            const a = this.project(85, lng);
            const b = this.project(-85, lng);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        for (let lat = -60; lat <= 90; lat += 30) {
            const a = this.project(lat, -180);
            const b = this.project(lat, 180);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ------------------------------------------------------------ attacks -- */

    addAttack(attack) {
        if (!this.ctx || this.isPaused) return;

        if (this.selectedFilterType !== 'ALL' && attack.attackType !== this.selectedFilterType) return;
        if (this.selectedFilterSeverity !== 'ALL' && attack.severity !== this.selectedFilterSeverity) return;

        if (this.activeAttacks.size >= CONFIG.MAX_SIMULTANEOUS_ANIMATIONS) {
            const oldest = this.activeAttacks.keys().next().value;
            this.activeAttacks.delete(oldest);
        }

        this.countryHits.set(attack.targetCountry, (this.countryHits.get(attack.targetCountry) || 0) + 1);

        this.activeAttacks.set(attack.id, {
            attack,
            startTime: performance.now(),
            duration: 2200,
            impactDuration: 900,
            color: this.getSeverityColor(attack.severity),
            hasImpacted: false
        });
        this.updateActiveCounter();
    }

    getBezier(p1, cp, p2, t) {
        const it = 1 - t;
        return {
            x: it * it * p1.x + 2 * it * t * cp.x + t * t * p2.x,
            y: it * it * p1.y + 2 * it * t * cp.y + t * t * p2.y
        };
    }

    controlPoint(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const curvature = Math.min(dist * 0.22, 140);
        return { x: (p1.x + p2.x) / 2 + nx * curvature, y: (p1.y + p2.y) / 2 + ny * curvature };
    }

    startAnimationLoop() {
        const step = (now) => {
            this.draw(now);
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    draw(now) {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);
        // Cached basemap
        ctx.drawImage(this.baseCanvas, 0, 0, this.width, this.height);

        if (this.isPaused) return;

        const toRemove = [];
        ctx.lineCap = 'round';

        this.activeAttacks.forEach((rec, id) => {
            const { attack } = rec;
            const p1 = this.project(attack.sourceLat, attack.sourceLng);
            const p2 = this.project(attack.targetLat, attack.targetLng);
            const cp = this.controlPoint(p1, p2);
            rec._p1 = p1; rec._p2 = p2; rec._cp = cp;

            const elapsed = now - rec.startTime;
            const progress = Math.min(elapsed / rec.duration, 1);

            // Source node
            this.drawNode(ctx, p1, '#00ff41', 3);

            if (progress < 1) {
                // Trailing arc up to the projectile
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = rec.color;
                ctx.shadowColor = rec.color;
                ctx.shadowBlur = 8;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                const segs = 28;
                for (let i = 0; i <= segs * progress; i++) {
                    const t = (i / segs);
                    const pt = this.getBezier(p1, cp, p2, t);
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
                ctx.restore();

                // Projectile head
                const head = this.getBezier(p1, cp, p2, progress);
                ctx.save();
                ctx.shadowColor = rec.color;
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(head.x, head.y, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                // Full faded arc after impact
                ctx.save();
                ctx.globalAlpha = 0.22;
                ctx.strokeStyle = rec.color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
                ctx.stroke();
                ctx.restore();

                // Impact ripple
                const impactT = (elapsed - rec.duration) / rec.impactDuration;
                if (impactT <= 1) {
                    const r = 4 + impactT * 26;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, 1 - impactT);
                    ctx.strokeStyle = rec.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p2.x, p2.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    toRemove.push(id);
                }
            }

            // Target node (brighter once impacted)
            this.drawNode(ctx, p2, rec.color, progress >= 1 ? 3.4 : 2.2);
        });

        toRemove.forEach(id => {
            this.activeAttacks.delete(id);
        });
        if (toRemove.length) this.updateActiveCounter();
    }

    drawNode(ctx, p, color, radius) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /* -------------------------------------------------------------- hover -- */

    pickAttack(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let best = null;
        let bestDist = 14;
        this.activeAttacks.forEach((rec) => {
            for (const pt of [rec._p1, rec._p2]) {
                if (!pt) continue;
                const d = Math.hypot(pt.x - mx, pt.y - my);
                if (d < bestDist) { bestDist = d; best = rec; }
            }
        });
        return best;
    }

    handleHover(e) {
        const hit = this.pickAttack(e);
        if (hit) {
            this.canvas.style.cursor = 'pointer';
            this.showTooltip(e, hit.attack);
        } else {
            this.canvas.style.cursor = 'grab';
            this.hideTooltip();
        }
    }

    showTooltip(e, attack) {
        let tip = document.getElementById('cyber-map-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'cyber-map-tooltip';
            tip.className = 'attack-info-card tooltip';
            document.body.appendChild(tip);
        }
        const color = this.getSeverityColor(attack.severity);
        tip.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border-panel); padding-bottom:4px;">
                <span style="color:var(--neon-green); font-weight:700; font-size:0.7rem; letter-spacing:1px;">⚡ THREAT DETECTED</span>
                <span class="severity-badge" style="color:${color}; border-color:${color}; background:rgba(0,0,0,0.6);">${sanitizeText(attack.severity)}</span>
            </div>
            <div style="display:grid; grid-template-columns: auto 1fr; gap:4px 12px; font-size:0.68rem;">
                <span class="label">TYPE:</span>
                <span class="value" style="color:#ffffff; font-weight:600;">${sanitizeText(attack.attackType)}</span>
                <span class="label">SOURCE:</span>
                <span class="value">${sanitizeText(attack.sourceCountry)} (${sanitizeText(attack.sourceCity)})</span>
                <span class="label">TARGET:</span>
                <span class="value">${sanitizeText(attack.targetCountry)} (${sanitizeText(attack.targetCity)})</span>
                <span class="label">TARGET IP:</span>
                <span class="value" style="font-family:var(--font-mono); color:var(--terminal-text);">${sanitizeText(attack.targetIPMasked)}</span>
                <span class="label">SERVICE:</span>
                <span class="value" style="color:var(--neon-green);">${sanitizeText(attack.targetService)}</span>
                <span class="label">SIGNATURE:</span>
                <span class="value" style="color:var(--dim-text);">${sanitizeText(attack.signature || 'Anomalous Traffic')}</span>
                <span class="label">DETECTED:</span>
                <span class="value">${timeAgo(attack.timestamp)}</span>
            </div>
        `;
        tip.style.display = 'block';
        const pad = 16;
        let left = e.clientX + pad;
        let top = e.clientY + pad;
        if (left + 260 > window.innerWidth) left = e.clientX - 270;
        if (top + 200 > window.innerHeight) top = e.clientY - 210;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    hideTooltip() {
        const tip = document.getElementById('cyber-map-tooltip');
        if (tip) tip.style.display = 'none';
    }

    /* ------------------------------------------------------------- utils --- */

    reprojectAll() {
        this.renderBase();
    }

    clear() {
        this.activeAttacks.clear();
        this.updateActiveCounter();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    updateActiveCounter() {
        if (this.attackCounterEl) {
            this.attackCounterEl.textContent = `Active: ${this.activeAttacks.size}`;
        }
    }

    getSeverityColor(severity) {
        switch ((severity || '').toUpperCase()) {
            case 'CRITICAL': return '#ff0040';
            case 'HIGH': return '#ff6600';
            case 'MEDIUM': return '#ffcc00';
            case 'LOW': return '#00ccff';
            default: return '#00ff41';
        }
    }
}
