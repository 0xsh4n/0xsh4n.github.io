/**
 * H4CK3R M4P - Cyber Threat Intelligence Dashboard
 * Main Application Bootstrap
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 * @version 1.0.0
 */

import { CONFIG } from './config/config.js';
import { $, $$, delegate, toggleClass } from './utils/dom.js';
import { startClock, onVisibilityChange } from './utils/time.js';
import { getSettings, saveSettings } from './utils/storage.js';
import { MatrixBackground } from './modules/matrix.js';
import { CyberAttackMap } from './modules/map.js';
import { ThreatStatistics } from './modules/statistics.js';
import { AttackFeed } from './modules/attackFeed.js';
import { CVEDashboard } from './modules/cveDashboard.js';
import { WriteupFeed } from './modules/writeupFeed.js';
import { ThreatFeed } from './modules/threatFeed.js';
import { NotificationCenter } from './modules/notifications.js';
import { SettingsManager } from './modules/settings.js';
import { GlobalSearch } from './modules/search.js';
import { attackProvider } from './providers/attackProvider.js';
import { cveProvider } from './providers/cveProvider.js';
import { newsProvider } from './providers/newsProvider.js';

class HackerMap {
    constructor() {
        this.currentView = 'map';
        this.settings = getSettings();
        this.modules = {};
        this.intervals = [];
        this.isHidden = false;
        this.refreshTimer = null;
    }

    async init() {
        this.log('INFO', `Initializing ${CONFIG.APP_NAME} v${CONFIG.VERSION}...`);
        
        // Initialize clock
        this.clockTimer = startClock(
            $('#utc-time'),
            $('#local-time')
        );
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup terminal
        this.setupTerminal();
        
        // Setup fullscreen
        this.setupFullscreen();
        
        // Setup settings
        this.loadSettings();
        
        // Setup visibility handling
        onVisibilityChange(
            () => this.onHidden(),
            () => this.onVisible()
        );
        
        // Setup mobile menu
        this.setupMobileMenu();
        
        // Setup notification panel
        this.setupNotifications();

        // Search is global so it remains available from every dashboard view.
        this.setupGlobalSearch();
        
        this.log('INFO', 'Core systems initialized.');
        this.log('INFO', 'Intelligence feeds: LIVE (NVD · Hacker News · GitHub Advisories). Attack map: SIMULATED.');
        this.log('INFO', 'Initializing telemetry & map visualization engines...');
        
        // Initialize Phase 2 modules
        this.initModules();
        
        this.log('INFO', 'Dashboard ready. All systems operational.');
    }

    // Navigation between views
    setupNavigation() {
        const navLinks = $$('.nav-link');
        const views = $$('.view');
        
        delegate($('.nav-links') || document.body, '.nav-link', 'click', (e, btn) => {
            const viewId = btn.dataset.view;
            if (!viewId) return;
            
            // Update nav active state
            navLinks.forEach(l => l.classList.remove('active'));
            btn.classList.add('active');
            navLinks.forEach(link => {
                const active = link === btn;
                link.setAttribute('aria-selected', String(active));
                link.tabIndex = active ? 0 : -1;
            });
            
            // Show correct view
            views.forEach(v => v.classList.remove('active'));
            const targetView = $(`#view-${viewId}`);
            if (targetView) targetView.classList.add('active');
            
            this.currentView = viewId;
            this.log('INFO', `View switched to: ${viewId.toUpperCase()}`);

            // If switching back to map, re-render map viewport
            if (viewId === 'map' && this.modules.map?.map) {
                setTimeout(() => {
                    this.modules.map.map.invalidateSize();
                    this.modules.map.reprojectAll();
                }, 100);
            }
        });

        $('.nav-links')?.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const tabs = [...navLinks];
            const current = Math.max(0, tabs.indexOf(document.activeElement));
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 :
                (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next].focus();
            tabs[next].click();
        });

        // Top nav refresh button
        const refreshBtn = $('#refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.style.transform = 'rotate(360deg)';
                refreshBtn.style.transition = 'transform 0.6s ease';
                setTimeout(() => {
                    refreshBtn.style.transform = '';
                    refreshBtn.style.transition = '';
                }, 600);

                this.refreshData({ includeAttack: true, manual: true });
            });
        }
    }

    // Terminal (intelligence log)
    setupTerminal() {
        const terminal = $('.bottom-terminal');
        const header = $('.terminal-header');
        const content = $('.terminal-content');
        const log = $('#terminal-log');
        
        if (!terminal || !header) return;
        
        // Toggle collapse
        const toggleBtn = $('#terminal-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                terminal.classList.toggle('collapsed');
            });
        }
        
        // Clear logs
        const clearBtn = $('#terminal-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (log) log.textContent = '';
                this.log('INFO', 'Terminal cleared.');
            });
        }
        
        // Pause auto-scroll
        this.terminalPaused = false;
        const pauseBtn = $('#terminal-pause');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.terminalPaused = !this.terminalPaused;
                pauseBtn.textContent = this.terminalPaused ? '▶' : '⏸';
                pauseBtn.title = this.terminalPaused ? 'Resume' : 'Pause';
            });
        }
        
        // Copy logs
        const copyBtn = $('#terminal-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (log) {
                    const text = log.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        this.log('INFO', 'Logs copied to clipboard.');
                    }).catch(() => {
                        this.log('WARN', 'Failed to copy logs.');
                    });
                }
            });
        }
    }

    // Log to terminal
    log(level, message) {
        const log = $('#terminal-log');
        if (!log) return;
        
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const line = document.createElement('div');
        line.className = `log-line log-${level.toLowerCase()}`;
        line.textContent = `[${time}] [${level}] ${message}`;
        
        log.appendChild(line);
        
        // Trim old lines
        while (log.children.length > CONFIG.MAX_TERMINAL_LINES) {
            log.removeChild(log.firstChild);
        }
        
        // Auto-scroll
        if (!this.terminalPaused) {
            const content = $('.terminal-content');
            if (content) content.scrollTop = content.scrollHeight;
        }
    }

    // Fullscreen toggle
    setupFullscreen() {
        const btn = $('#fullscreen-btn');
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    // Mobile hamburger menu
    setupMobileMenu() {
        const hamburger = $('#hamburger-btn');
        const navLinks = $('.nav-links');
        
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', () => {
                navLinks.classList.toggle('mobile-open');
            });
            
            // Close on nav click
            delegate(navLinks, '.nav-link', 'click', () => {
                navLinks.classList.remove('mobile-open');
            });
        }
    }

    // Notification panel
    setupNotifications() {
        const btn = $('#notif-btn');
        const panel = $('#notification-panel');
        
        if (btn && panel) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = panel.style.display !== 'none';
                panel.style.display = isVisible ? 'none' : 'block';
            });
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!panel.contains(e.target) && e.target !== btn) {
                    panel.style.display = 'none';
                }
            });
        }
    }

    setupGlobalSearch() {
        this.modules.search = new GlobalSearch();
        $('#search-btn')?.addEventListener('click', () => this.modules.search.open());
        this.modules.search.onSelectCallback = ({ type, id, lat, lng }) => {
            if (type === 'cve' && id) {
                const record = this.modules.cve?.cves.find(cve => cve.id === id);
                if (record) this.modules.cve.modal.open(record);
                return;
            }

            if (type === 'node' && Number.isFinite(lat) && Number.isFinite(lng)) {
                this.navigateToMap(lat, lng);
                return;
            }

            const view = type === 'writeup' ? 'writeups' : 'threats';
            document.querySelector(`.nav-link[data-view="${view}"]`)?.click();
        };
    }

    navigateToMap(lat, lng) {
        document.querySelector('.nav-link[data-view="map"]')?.click();
        setTimeout(() => this.modules.map?.map?.flyTo([lat, lng], 4, { duration: 0.8 }), 120);
    }

    // Load and apply settings
    loadSettings() {
        const settings = this.settings;
        
        // Apply matrix background setting
        const matrixCanvas = $('#matrix-canvas');
        if (matrixCanvas) {
            matrixCanvas.style.display = settings.matrixBg ? '' : 'none';
        }
        
        // Intelligence feeds (CVE / research / threat news) are always LIVE from
        // keyless public APIs; the attack map is always a labeled simulation.
        this.updateDataModeUI();

        this.updateSystemStatus();
    }

    initModules() {
        // 1. Initialize Matrix background
        try {
            this.modules.matrix = new MatrixBackground('matrix-canvas');
            if (!this.settings.matrixBg) {
                this.modules.matrix.toggle(false);
            }
            this.log('INFO', 'Matrix FX subsystem active.');
        } catch (err) {
            this.log('WARN', `Matrix initialization failed: ${err.message}`);
        }

        // 2. Initialize Dark Cyber Attack Map
        try {
            this.modules.map = new CyberAttackMap('attack-map');
            this.setupMapControls();
            this.log('INFO', 'Cyber Attack Map online — self-contained offline world (no API key required).');
        } catch (err) {
            this.log('ERROR', `Map initialization failed: ${err.message}`);
        }

        // 3. Initialize Statistics Engine
        try {
            this.modules.stats = new ThreatStatistics();
            this.log('INFO', 'Global threat statistics engine active.');
        } catch (err) {
            this.log('ERROR', `Statistics engine initialization failed: ${err.message}`);
        }

        // 4. Initialize Real-Time Threat Timeline
        try {
            this.modules.feed = new AttackFeed('threat-timeline', 'timeline-count');
            
            // Wire timeline clear button
            $('#timeline-clear-btn')?.addEventListener('click', () => {
                this.modules.feed?.clear();
                this.log('INFO', 'Threat timeline feed cleared.');
            });

            // Interactive inspection on click
            this.modules.feed.onEventClickCallback = (event) => {
                if (this.modules.map?.map) {
                    this.modules.map.map.flyTo([event.targetLat, event.targetLng], 4, { duration: 1.2 });
                    this.log('INFO', `Inspecting target: ${event.targetCountry} (${event.targetCity}) [${event.targetService}]`);
                }
            };

            this.log('INFO', 'Real-time threat timeline stream ready.');
        } catch (err) {
            this.log('ERROR', `Threat feed initialization failed: ${err.message}`);
        }

        // 5. Connect Attack Telemetry Provider
        try {
            // Forward incoming telemetry events to map, stats, timeline, and terminal
            attackProvider.onAttack((attack) => {
                if (this.modules.map && this.settings.attackAnimations) {
                    this.modules.map.addAttack(attack);
                }

                if (this.modules.stats) {
                    this.modules.stats.recordEvent(attack);
                }

                if (this.modules.feed) {
                    this.modules.feed.addEvent(attack);
                }

                if (attack.severity === 'CRITICAL' || attack.severity === 'HIGH') {
                    this.log(
                        attack.severity === 'CRITICAL' ? 'WARN' : 'INFO',
                        `[${attack.severity}] ${attack.attackType} probe: ${attack.sourceCountry} -> ${attack.targetCountry} [${attack.targetService}]`
                    );

                    // Sound alert cue if enabled
                    if (this.modules.settings) {
                        if (attack.severity === 'CRITICAL') {
                            this.modules.settings.playCriticalAlert();
                        } else {
                            this.modules.settings.playTacticalBeep(720, 0.05);
                        }
                    }

                    // Dispatch notification
                    if (this.modules.notif && this.settings.notifications) {
                        this.modules.notif.notify({
                            title: `${attack.severity} ${attack.attackType}`,
                            message: `${attack.sourceCountry} targeting ${attack.targetCountry} [${attack.targetService}]`,
                            severity: attack.severity,
                            type: 'ATTACK'
                        });
                    }
                }
            });

            // Seed map, statistics, and feed with initial buffered attacks
            const initialAttacks = attackProvider.getData();
            if (this.modules.stats) this.modules.stats.seedData(initialAttacks);
            if (this.modules.feed) this.modules.feed.seedEvents(initialAttacks);

            initialAttacks.forEach((atk, idx) => {
                setTimeout(() => {
                    if (this.modules.map) this.modules.map.addAttack(atk);
                }, (idx + 1) * 600);
            });

            attackProvider.start();
            this.updateDataModeUI(this.settings.dataMode);
            this.log('INFO', `Attack telemetry provider connected [${attackProvider.getStatus().label}].`);
        } catch (err) {
            this.log('ERROR', `Telemetry provider failed: ${err.message}`);
        }

        // 6. Initialize CVE Intelligence Center
        try {
            this.modules.cve = new CVEDashboard();
            // Refresh the top data-mode badge once live CVE data settles.
            this.modules.cve.onLoaded = () => {
                this.updateDataModeUI();
                this.updateSystemStatus();
            };
            this.log('INFO', 'CVE Intelligence Center subsystem active.');
        } catch (err) {
            this.log('ERROR', `CVE dashboard initialization failed: ${err.message}`);
        }

        // 7. Initialize Latest Security Research Feed
        try {
            this.modules.writeups = new WriteupFeed();
            this.log('INFO', 'Security Research feed subsystem active.');
        } catch (err) {
            this.log('ERROR', `Writeups initialization failed: ${err.message}`);
        }

        // 8. Initialize Cyber Threat News Feed
        try {
            this.modules.threats = new ThreatFeed();
            this.log('INFO', 'Cyber Threat news feed subsystem active.');
        } catch (err) {
            this.log('ERROR', `Threat feed initialization failed: ${err.message}`);
        }

        // 9. Initialize Notification Center & Alert System
        try {
            this.modules.notif = new NotificationCenter();
            // Seed a welcome notification
            if (this.modules.notif.notifications.length === 0) {
                this.modules.notif.notify({
                    title: 'H4CK3R M4P Telemetry Active',
                    message: 'Global threat monitoring engine synchronized. All nodes reporting nominal status.',
                    severity: 'INFO',
                    type: 'SYSTEM'
                });
            }
            this.log('INFO', 'Tactical alert system & notification center online.');
        } catch (err) {
            this.log('ERROR', `Notification center initialization failed: ${err.message}`);
        }

        // 10. Initialize Unified Settings Manager
        try {
            this.modules.settings = new SettingsManager();
            
            // Wire dynamic setting updates
            this.modules.settings.onChange('matrixBg', (val) => {
                this.settings.matrixBg = val;
                this.modules.matrix?.toggle(val);
                this.log('INFO', `Matrix FX: ${val ? 'ENABLED' : 'DISABLED'}`);
            });

            this.modules.settings.onChange('attackAnimations', (val) => {
                this.settings.attackAnimations = val;
                if (this.modules.map) this.modules.map.isPaused = !val;
                this.log('INFO', `Attack animations: ${val ? 'ENABLED' : 'PAUSED'}`);
            });

            this.modules.settings.onChange('sound', (val) => {
                this.settings.sound = val;
                this.log('INFO', `Tactical Audio Telemetry: ${val ? 'ARMED' : 'MUTED'}`);
            });

            this.modules.settings.onChange('notifications', (val) => {
                this.settings.notifications = val;
                if (val) this.modules.notif?.requestPermission();
                this.log('INFO', `In-app alert dispatch: ${val ? 'ACTIVE' : 'MUTED'}`);
            });

            this.modules.settings.onChange('autoRefresh', (val) => {
                this.settings.autoRefresh = val;
                this.configureRefreshTimer();
                this.log('INFO', `Background refresh: ${val ? 'ENABLED' : 'DISABLED'}`);
            });

            this.modules.settings.onChange('refreshInterval', (val) => {
                this.settings.refreshInterval = val;
                this.configureRefreshTimer();
                this.log('INFO', `Refresh cadence set to ${Math.round(val / 1000)} seconds.`);
            });

            this.configureRefreshTimer();

            this.log('INFO', 'Operator preferences synchronized.');
        } catch (err) {
            this.log('ERROR', `Settings manager initialization failed: ${err.message}`);
        }
    }

    configureRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (!this.settings.autoRefresh || this.isHidden) return;

        const interval = Number(this.settings.refreshInterval) || 30000;
        this.refreshTimer = setInterval(() => this.refreshData(), interval);
    }

    async refreshData({ includeAttack = false, manual = false } = {}) {
        if (includeAttack) {
            attackProvider.addEvent(attackProvider.generateSimulatedEvent());
        }

        const refreshes = [
            this.modules.cve?.loadData(),
            this.modules.writeups?.loadData(),
            this.modules.threats?.loadData()
        ].filter(Boolean);

        try {
            await Promise.allSettled(refreshes);
            this.updateSystemStatus();
            if (manual) this.log('INFO', 'Intelligence feeds refreshed.');
        } catch {
            this.log('WARN', 'One or more intelligence feeds could not refresh.');
        }
    }

    updateSystemStatus() {
        const lastUpdate = $('#status-last-update');
        if (lastUpdate) {
            lastUpdate.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }) + ' LOCAL';
        }

        const attackStatus = $('#status-attack');
        if (attackStatus) {
            const providerStatus = attackProvider.getStatus();
            const label = providerStatus.label || 'DEMO';
            const health = providerStatus.status === 'connected' ? 'online' : 'degraded';
            attackStatus.replaceChildren(this.makeStatusIndicator(health), document.createTextNode(label));
        }
    }

    updateDataModeUI() {
        const badge = $('#data-mode-badge');
        const label = $('#live-label');
        const dot = $('#live-dot');

        // The top badge reflects the LIVE intelligence feeds (CVE from NVD, etc.).
        // The attack map is always a simulation, labeled separately on the map.
        const cve = cveProvider.getStatus();
        const liveOk = cve.status !== 'offline';

        if (badge) {
            badge.textContent = liveOk ? 'LIVE' : 'OFFLINE';
            badge.className = `data-mode ${liveOk ? 'live' : 'demo'}`;
        }
        if (label) {
            label.textContent = liveOk ? 'LIVE • NVD' : 'RECONNECTING';
        }
        if (dot) {
            dot.classList.toggle('degraded', !liveOk);
        }
    }

    makeStatusIndicator(status) {
        const indicator = document.createElement('span');
        indicator.className = `status-indicator status-${status}`;
        return indicator;
    }

    setupMapControls() {
        const filterBtn = $('#map-filter-btn');
        const filterDropdown = $('#map-filter-dropdown');
        const pauseBtn = $('#map-pause-btn');
        const typeSelect = $('#map-filter-type');
        const severitySelect = $('#map-filter-severity');

        // Toggle filter dropdown
        if (filterBtn && filterDropdown) {
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = filterDropdown.style.display === 'none';
                filterDropdown.style.display = isHidden ? 'flex' : 'none';
            });

            document.addEventListener('click', (e) => {
                if (!filterDropdown.contains(e.target) && e.target !== filterBtn) {
                    filterDropdown.style.display = 'none';
                }
            });
        }

        // Pause/Resume button
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                const isPaused = this.modules.map ? this.modules.map.togglePause() : false;
                pauseBtn.textContent = isPaused ? '▶' : '⏸';
                pauseBtn.title = isPaused ? 'Resume Visuals' : 'Pause Visuals';
                this.log('INFO', `Map visual animations ${isPaused ? 'PAUSED' : 'RESUMED'}.`);
            });
        }

        // Filter type selector
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                if (this.modules.map) {
                    this.modules.map.selectedFilterType = e.target.value;
                    this.log('INFO', `Threat type filter set to: ${e.target.value}`);
                }
            });
        }

        // Filter severity selector
        if (severitySelect) {
            severitySelect.addEventListener('change', (e) => {
                if (this.modules.map) {
                    this.modules.map.selectedFilterSeverity = e.target.value;
                    this.log('INFO', `Threat severity filter set to: ${e.target.value}`);
                }
            });
        }
    }

    // Visibility handlers for performance
    onHidden() {
        this.isHidden = true;
        this.log('INFO', 'Tab hidden — throttling background animations.');
        if (this.modules.matrix) this.modules.matrix.stop();
        attackProvider.stop();
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    onVisible() {
        this.isHidden = false;
        this.log('INFO', 'Tab visible — resuming telemetry.');
        if (this.modules.matrix && this.settings.matrixBg) {
            this.modules.matrix.start();
        }
        attackProvider.start();
        this.configureRefreshTimer();
    }
}

// Boot the application
const app = new HackerMap();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Export for module access
export { app };
