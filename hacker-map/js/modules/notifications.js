/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Notification Center & Tactical Alert System
 * 
 * Manages in-app threat alerts, unread badges, notification drawers,
 * and optional browser Web Notifications API.
 * 
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { $, $$ } from '../utils/dom.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { timeAgo } from '../utils/formatter.js';
import { sanitizeSeverity, sanitizeText } from '../utils/sanitizer.js';

export class NotificationCenter {
    constructor(panelId = 'notification-panel', listId = 'notification-list', countId = 'notif-count') {
        this.panel = $(`#${panelId}`);
        this.listEl = $(`#${listId}`);
        this.countEl = $(`#${countId}`);
        this.bellBtn = $('#notif-btn');
        this.clearBtn = $('.btn-clear-notif');

        this.storageKey = 'h4ck3r_notifications';
        this.notifications = getStorage(this.storageKey, []);
        this.maxNotifications = 40;

        this.init();
    }

    init() {
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearAll();
            });
        }

        // Mark all as read when opening panel
        if (this.bellBtn) {
            this.bellBtn.addEventListener('click', () => {
                if (this.panel && this.panel.style.display !== 'none') {
                    this.markAllRead();
                }
            });
        }

        this.updateBadge();
        this.render();
    }

    /**
     * Dispatch a new notification into the alert center
     */
    notify({ title, message, severity = 'INFO', type = 'THREAT' }) {
        const notif = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            title,
            message,
            severity,
            type,
            timestamp: Date.now(),
            isRead: false
        };

        this.notifications.unshift(notif);
        if (this.notifications.length > this.maxNotifications) {
            this.notifications.pop();
        }

        this.persist();
        this.updateBadge();
        this.render();

        // Browser Web Notification if permission granted
        this.sendWebNotification(notif);
    }

    sendWebNotification(notif) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(`[${notif.severity}] ${notif.title}`, {
                    body: notif.message,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2300ff41"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>'
                });
            } catch {
                // Ignore background notification restrictions
            }
        }
    }

    /**
     * Request browser notification permission
     */
    async requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                return await Notification.requestPermission();
            } catch {
                return 'denied';
            }
        }
        return Notification.permission;
    }

    markAllRead() {
        this.notifications.forEach(n => n.isRead = true);
        this.persist();
        this.updateBadge();
    }

    clearAll() {
        this.notifications = [];
        this.persist();
        this.updateBadge();
        this.render();
    }

    persist() {
        setStorage(this.storageKey, this.notifications);
    }

    updateBadge() {
        if (!this.countEl) return;
        const unreadCount = this.notifications.filter(n => !n.isRead).length;

        if (unreadCount > 0) {
            this.countEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
            this.countEl.style.display = 'flex';
        } else {
            this.countEl.style.display = 'none';
        }
    }

    render() {
        if (!this.listEl) return;

        if (this.notifications.length === 0) {
            this.listEl.innerHTML = `
                <div style="padding:24px 16px; text-align:center; color:var(--dim-text); font-size:0.7rem;">
                    No recent intelligence alerts.
                </div>
            `;
            return;
        }

        let html = '';
        this.notifications.forEach(n => {
            const sevClass = sanitizeSeverity(n.severity);
            const unreadClass = n.isRead ? '' : 'unread';
            const timeAgoStr = timeAgo(n.timestamp);

            html += `
                <div class="notification-item ${unreadClass}" style="padding:10px 14px; border-bottom:1px solid rgba(22,61,22,0.3); font-size:0.7rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span class="severity-badge severity-${sevClass}" style="font-size:0.58rem;">${sanitizeText(n.severity)}</span>
                        <span style="color:var(--dim-text); font-family:var(--font-mono); font-size:0.6rem;">${timeAgoStr}</span>
                    </div>
                    <div style="color:var(--text-primary); font-weight:600; font-size:0.75rem; margin-bottom:2px;">
                        ${sanitizeText(n.title)}
                    </div>
                    <div style="color:var(--dim-text); font-size:0.68rem; line-height:1.4;">
                        ${sanitizeText(n.message)}
                    </div>
                </div>
            `;
        });

        this.listEl.innerHTML = html;
    }
}
