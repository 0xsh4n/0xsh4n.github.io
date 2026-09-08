/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * Security Research Feed Provider (LIVE)
 *
 * Pulls REAL, recent security stories from the Hacker News Algolia API
 * (https://hn.algolia.com) — keyless and CORS-enabled, so it works directly
 * from a static page with no backend and no API key. Multiple security-themed
 * queries are merged and de-duplicated. No bundled/demo data is used; on
 * failure the feed reports an honest error state instead of inventing content.
 *
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { CONFIG } from '../config/config.js';
import { getCached, setCache } from '../utils/storage.js';

const HN_BASE = 'https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=20&query=';
const QUERIES = ['vulnerability', 'exploit', 'bug bounty', 'ransomware'];

class WriteupProvider {
    constructor() {
        this.cacheKey = 'research_feed_data';
        this.status = 'connected'; // 'connected' | 'degraded' | 'offline'
        this.sourceName = 'HACKER NEWS (LIVE)';
        this.data = [];
        this.lastFetchTime = null;
    }

    async getData() {
        const cached = getCached(this.cacheKey, CONFIG.FEED_REFRESH_INTERVAL || 600000);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            this.data = cached;
            this.status = 'connected';
            this.sourceName = 'HACKER NEWS (CACHED)';
            return this.data;
        }

        try {
            const items = await this.fetchLive();
            if (items.length) {
                this.data = items;
                setCache(this.cacheKey, this.data);
                this.status = 'connected';
                this.sourceName = 'HACKER NEWS (LIVE)';
                this.lastFetchTime = Date.now();
                return this.data;
            }
            throw new Error('Empty research feed');
        } catch (err) {
            console.warn('[WriteupProvider] Live research feed unavailable:', err.message);
            this.status = 'offline';
            this.sourceName = 'RESEARCH FEED OFFLINE';
            this.data = [];
            return this.data;
        }
    }

    async fetchLive() {
        const fetchOne = async (q) => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 9000);
            try {
                const r = await fetch(HN_BASE + encodeURIComponent(q), {
                    signal: controller.signal,
                    headers: { Accept: 'application/json' }
                });
                clearTimeout(t);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const j = await r.json();
                return Array.isArray(j.hits) ? j.hits : [];
            } catch (e) {
                clearTimeout(t);
                return [];
            }
        };

        const results = await Promise.all(QUERIES.map(fetchOne));
        const merged = new Map();
        for (const hits of results) {
            for (const h of hits) {
                if (h && h.title && h.objectID && !merged.has(h.objectID)) {
                    merged.set(h.objectID, this.normalizeHn(h));
                }
            }
        }
        if (merged.size === 0) throw new Error('No research stories returned');

        return [...merged.values()].sort(
            (a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)
        );
    }

    normalizeHn(h) {
        const title = h.title;
        const lower = title.toLowerCase();
        const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;

        // Derive a category matching the UI filter tabs.
        let category = 'RESEARCH';
        if (/bug bounty|bounty|hackerone|bugcrowd|\$\s?\d/.test(lower)) category = 'BUG BOUNTY';
        else if (/cve-\d{4}/.test(lower)) category = 'CVES';
        else if (/\bxss\b|csrf|ssrf|sql ?injection|\bsqli\b|\bweb\b|http|browser|\bdom\b|cookie|jwt|oauth/.test(lower)) category = 'WEB SECURITY';
        else if (/pentest|red team|privilege escalation|lateral movement|active directory|kerbero/.test(lower)) category = 'PENTESTING';
        else if (/exploit|\brce\b|0 ?day|zero ?day|overflow|deserializ|payload|shellcode/.test(lower)) category = 'EXPLOITATION';

        // Lightweight tags from keyword hits.
        const kw = ['RCE', 'XSS', 'SSRF', 'CSRF', 'SQLi', 'LFI', 'IDOR', 'Bug Bounty', 'CVE',
            'Ransomware', 'Malware', 'Phishing', 'Zero-Day', 'Kernel', 'Cloud', 'AWS',
            'Android', 'iOS', 'Linux', 'Windows', 'Kubernetes', 'API'];
        const tags = kw.filter(k => lower.includes(k.toLowerCase())).slice(0, 5);
        if (!tags.length) tags.push('InfoSec');
        tags.push('Hacker News');

        const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'news.ycombinator.com'; } })();

        return {
            id: h.objectID,
            title,
            source: 'Hacker News',
            author: h.author || 'unknown',
            publishedDate: h.created_at,
            category,
            tags,
            summary: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News. Source: ${host}. Open to read the full research/writeup and community discussion.`,
            url,
            popularity: h.points ?? 0,
            readTime: `${h.num_comments ?? 0} comments`
        };
    }

    async refreshData() {
        return await this.getData();
    }

    getStatus() {
        return {
            status: this.status,
            source: this.sourceName,
            totalLoaded: this.data.length,
            lastFetch: this.lastFetchTime
        };
    }
}

export const writeupProvider = new WriteupProvider();
