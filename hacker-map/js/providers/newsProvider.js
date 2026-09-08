/**
 * H4CK3R M4P - Cyber Threat News Provider (LIVE)
 *
 * Pulls REAL, recent security advisories from the GitHub Security Advisories
 * API (https://api.github.com/advisories) — keyless and CORS-enabled, so it
 * works directly from a static page with no backend and no API key (subject to
 * GitHub's unauthenticated rate limit, ~60 req/hr per IP). No bundled/demo data
 * is used; on failure the feed reports an honest error state.
 *
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { CONFIG } from '../config/config.js';
import { getCached, setCache } from '../utils/storage.js';

const GH_ADVISORIES = 'https://api.github.com/advisories?per_page=30&sort=published&direction=desc';

class NewsProvider {
    constructor() {
        this.cacheKey = 'threat_news_data';
        this.status = 'connected';
        this.sourceName = 'GITHUB ADVISORIES (LIVE)';
        this.data = [];
        this.lastFetchTime = null;
    }

    async getData() {
        const cached = getCached(this.cacheKey, CONFIG.FEED_REFRESH_INTERVAL || 600000);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            this.data = cached;
            this.status = 'connected';
            this.sourceName = 'GITHUB ADVISORIES (CACHED)';
            return this.data;
        }

        try {
            const items = await this.fetchLive();
            if (items.length) {
                this.data = items;
                setCache(this.cacheKey, this.data);
                this.status = 'connected';
                this.sourceName = 'GITHUB ADVISORIES (LIVE)';
                this.lastFetchTime = Date.now();
                return this.data;
            }
            throw new Error('Empty advisories response');
        } catch (err) {
            console.warn('[NewsProvider] Live advisories feed unavailable:', err.message);
            this.status = 'offline';
            this.sourceName = 'THREAT FEED OFFLINE';
            this.data = [];
            return this.data;
        }
    }

    async fetchLive() {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 9000);
        try {
            const r = await fetch(GH_ADVISORIES, {
                signal: controller.signal,
                headers: { Accept: 'application/vnd.github+json' }
            });
            clearTimeout(t);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const arr = await r.json();
            if (!Array.isArray(arr)) throw new Error('Invalid advisories schema');
            return arr.map((a) => this.normalize(a)).filter(Boolean);
        } catch (err) {
            clearTimeout(t);
            throw err;
        }
    }

    normalize(a) {
        if (!a || !a.ghsa_id) return null;
        const sev = (a.severity || 'unknown').toUpperCase();

        // Map advisory type to the UI's category filters.
        let category = 'Advisories';
        if (a.cve_id) category = 'Zero-Day';
        else if ((a.type || '') === 'malware') category = 'Breaches';

        const cwe = Array.isArray(a.cwes) && a.cwes.length ? a.cwes[0].name : '';
        const ecosystem = Array.isArray(a.vulnerabilities) && a.vulnerabilities[0]?.package
            ? `${a.vulnerabilities[0].package.ecosystem || ''} ${a.vulnerabilities[0].package.name || ''}`.trim()
            : '';

        // GitHub advisory descriptions are Markdown — strip it to clean prose.
        const clean = (a.description || a.summary || '')
            .replace(/```[\s\S]*?```/g, ' ')      // code fences
            .replace(/`([^`]*)`/g, '$1')           // inline code
            .replace(/^#{1,6}\s+/gm, '')           // headings
            .replace(/\*\*|__|[*_>#]/g, '')         // emphasis / blockquote / hashes
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // images
            .replace(/\s+/g, ' ')
            .trim();
        const summary = clean.length > 300 ? clean.slice(0, 300) + '…' : (clean || 'Security advisory published to the GitHub Advisory Database.');

        return {
            id: a.ghsa_id,
            title: a.summary || a.ghsa_id,
            summary: summary || 'Security advisory published to the GitHub Advisory Database.',
            source: a.cve_id ? `GitHub · ${a.cve_id}` : 'GitHub Advisory',
            category,
            severity: sev,
            timestamp: new Date(a.published_at || a.updated_at || Date.now()).getTime(),
            url: a.html_url || `https://github.com/advisories/${a.ghsa_id}`,
            threatActor: cwe || (a.cve_id ? 'CVE-tracked' : ''),
            affectedSector: ecosystem || (a.type === 'reviewed' ? 'Open-source software' : '')
        };
    }

    async refreshData() {
        return this.getData();
    }

    getStatus() {
        return {
            status: this.status,
            source: this.sourceName,
            totalItems: this.data.length
        };
    }
}

export const newsProvider = new NewsProvider();
