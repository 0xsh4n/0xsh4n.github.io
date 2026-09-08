/**
 * H4CK3R M4P - Cyber Threat Intelligence
 * CVE Intelligence Provider
 *
 * DEMO mode  -> bundled high-fidelity CVE dataset (no network).
 * LIVE mode  -> real, keyless vulnerability data from the NVD 2.0 API, which
 *               sends `Access-Control-Allow-Origin: *` and therefore works
 *               directly from a static browser page with NO API key. The NVD
 *               response also carries CISA KEV flags (`cisaExploitAdd`), so the
 *               "Known Exploited" tab stays meaningful. On any failure it falls
 *               back to the bundled dataset so the view is never empty.
 *
 * @author 0xsh4n
 * @url https://github.com/0xsh4n
 */

import { CONFIG } from '../config/config.js';
import { getCached, setCache } from '../utils/storage.js';
import { sanitizeCVEId } from '../utils/sanitizer.js';

class CVEProvider {
    constructor() {
        this.cacheKey = 'cve_data_feed';
        this.status = 'connected'; // 'connected' | 'degraded' | 'offline'
        this.sourceName = 'NVD LIVE';
        this.data = [];
        this.lastFetchTime = null;
        this.errorMessage = null;
    }

    /**
     * Get all currently available CVE records — always LIVE from NVD (keyless).
     * No bundled/demo data: on failure the feed reports an honest offline state.
     */
    async getData() {
        // Serve a fresh TTL cache if present to respect NVD rate limits.
        const cached = getCached(this.cacheKey, CONFIG.CVE_REFRESH_INTERVAL || 300000);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            this.data = cached;
            this.status = 'connected';
            this.sourceName = 'NVD LIVE (CACHED)';
            return this.data;
        }

        try {
            const liveData = await this.fetchNvdRecent();
            if (liveData && liveData.length > 0) {
                this.data = liveData;
                setCache(this.cacheKey, this.data);
                this.status = 'connected';
                this.sourceName = 'NVD LIVE';
                this.lastFetchTime = Date.now();
                this.errorMessage = null;
                return this.data;
            }
            throw new Error('Empty NVD response');
        } catch (err) {
            console.warn('[CVEProvider] Live NVD feed unavailable:', err.message);
            this.status = 'offline';
            this.sourceName = 'NVD OFFLINE';
            this.errorMessage = 'NVD unavailable (network or rate limit). Try again shortly.';
            this.data = [];
            this.lastFetchTime = Date.now();
            return this.data;
        }
    }

    /**
     * Fetch CVEs from the NVD 2.0 REST API (keyless, CORS-enabled).
     *
     * Two small merged queries so the view is both fresh AND meaningful:
     *   1. Recently published CVEs (freshness — but the newest are often not yet
     *      scored by NVD, hence UNKNOWN severity).
     *   2. Recently published CRITICAL CVEs (guarantees scored, high-signal cards
     *      for the Critical/High tabs and CVSS badges).
     * Results are de-duplicated and sorted scored-first, then newest-first.
     */
    async fetchNvdRecent() {
        const end = new Date();
        const fmt = (d) => d.toISOString().slice(0, 23); // ISO-8601, no trailing 'Z' (UTC)
        const recentStart = new Date(end.getTime() - 21 * 24 * 60 * 60 * 1000);   // 21 days
        const scoredStart = new Date(end.getTime() - 110 * 24 * 60 * 60 * 1000);  // < 120d NVD cap

        const base = CONFIG.API.NVD_BASE;
        const urls = [
            `${base}?pubStartDate=${fmt(recentStart)}&pubEndDate=${fmt(end)}&resultsPerPage=40`,
            `${base}?pubStartDate=${fmt(scoredStart)}&pubEndDate=${fmt(end)}&cvssV3Severity=CRITICAL&resultsPerPage=25`
        ];

        // IMPORTANT: do NOT send the NVD `apiKey` header from the browser. It is
        // a non-simple header that forces a CORS preflight NVD does not satisfy,
        // which makes the request fail outright ("Failed to fetch"). The keyless
        // endpoint is fully CORS-enabled and works from any static page. An NVD
        // key is only useful server-side (e.g. behind a serverless proxy).
        const headers = { 'Accept': 'application/json' };

        const fetchOne = async (url) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9000);
            try {
                const response = await fetch(url, { signal: controller.signal, headers });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const json = await response.json();
                if (!json || !Array.isArray(json.vulnerabilities)) throw new Error('Invalid NVD schema');
                return json.vulnerabilities;
            } catch (err) {
                clearTimeout(timeoutId);
                throw err;
            }
        };

        const results = await Promise.allSettled(urls.map(fetchOne));
        // The first (recent) query is the primary one — if it fails, treat as an error.
        if (results[0].status === 'rejected') throw results[0].reason;

        const merged = new Map();
        for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            for (const v of r.value) {
                const item = this.normalizeNvd(v);
                if (item && !merged.has(item.id)) merged.set(item.id, item);
            }
        }

        const list = [...merged.values()];
        // Rank analyzed CVEs (with product data) and scored ones first, so the
        // grid leads with fully-detailed entries rather than "Awaiting analysis".
        const rank = (c) => (c.product ? 2 : 0) + (c.cvssScore != null ? 1 : 0);
        list.sort((a, b) => {
            const r = rank(b) - rank(a);
            if (r) return r;
            return new Date(b.publishedDate) - new Date(a.publishedDate); // then newest
        });
        return list;
    }

    /**
     * Normalize a single NVD 2.0 vulnerability object to the app's CVE shape.
     */
    normalizeNvd(v) {
        const cve = v && v.cve;
        if (!cve || !cve.id) return null;
        const id = sanitizeCVEId(cve.id);
        if (!id) return null;

        const descEn = (cve.descriptions || []).find((d) => d.lang === 'en');
        const description = descEn ? descEn.value : '';

        // CVSS: prefer v3.1 > v3.0 > v2.
        const metrics = cve.metrics || {};
        const m = (metrics.cvssMetricV31 || metrics.cvssMetricV30 || metrics.cvssMetricV2 || [])[0];
        const cvssData = m ? m.cvssData : null;
        const cvssScore = cvssData && typeof cvssData.baseScore === 'number' ? cvssData.baseScore : null;
        const cvssVector = cvssData ? cvssData.vectorString || null : null;
        const severity = (
            (cvssData && cvssData.baseSeverity) ||
            (m && m.baseSeverity) ||
            this.severityFromScore(cvssScore)
        ).toUpperCase();

        // CWE list (skip NVD placeholder values).
        const cwe = (cve.weaknesses || [])
            .flatMap((w) => w.description || [])
            .filter((d) => d.lang === 'en' && d.value && !/NVD-CWE/.test(d.value))
            .map((d) => d.value)
            .join(', ');

        // Affected products & version ranges from the CPE configuration.
        const { vendor, product, affectedVersions } = this.extractAffected(cve);

        const isKev = !!cve.cisaExploitAdd;

        const references = (cve.references || []).slice(0, 6).map((r) => ({
            source: r.source || 'Reference',
            url: r.url
        }));

        const timeline = [];
        if (cve.published) timeline.push({ date: cve.published, event: 'Published to the National Vulnerability Database.' });
        if (cve.cisaExploitAdd) timeline.push({ date: cve.cisaExploitAdd, event: 'Added to the CISA Known Exploited Vulnerabilities Catalog.' });
        if (cve.lastModified) timeline.push({ date: cve.lastModified, event: 'Last modified in NVD.' });

        const titleFromCpe = [vendor, product].filter(Boolean).join(' ').trim();
        const title = titleFromCpe
            ? `${titleFromCpe}${cwe ? ' — ' + cwe.split(',')[0] : ''}`
            : (description ? description.slice(0, 90) + (description.length > 90 ? '…' : '') : id);

        return {
            id,
            title,
            description,
            severity: severity || 'UNKNOWN',
            cvssScore,
            cvssVector,
            cwe,
            vendor,
            product,
            affectedVersions,
            vulnStatus: cve.vulnStatus || '',
            publishedDate: cve.published || null,
            lastModifiedDate: cve.lastModified || null,
            isKev,
            kevDateAdded: cve.cisaExploitAdd || null,
            exploitStatus: isKev ? 'Listed in CISA KEV Catalog' : '',
            references: references.length ? references : [
                { source: 'NVD', url: `https://nvd.nist.gov/vuln/detail/${id}` }
            ],
            timeline,
            relatedCves: []
        };
    }

    /**
     * Extract affected vendor, product(s) and version ranges from an NVD CVE's
     * CPE configuration. Handles version range bounds and specific versions,
     * and degrades gracefully when the CVE has not been analyzed yet.
     */
    extractAffected(cve) {
        const nodes = (cve.configurations || []).flatMap((c) => c.nodes || []);
        const cpes = nodes.flatMap((n) => n.cpeMatch || []).filter((c) => c.vulnerable && c.criteria);

        const range = (c, ver) => {
            const p = [];
            if (c.versionStartIncluding) p.push(`>= ${c.versionStartIncluding}`);
            else if (c.versionStartExcluding) p.push(`> ${c.versionStartExcluding}`);
            if (c.versionEndIncluding) p.push(`<= ${c.versionEndIncluding}`);
            else if (c.versionEndExcluding) p.push(`< ${c.versionEndExcluding}`);
            if (p.length) return p.join(', ');
            if (ver && ver !== '*' && ver !== '-') return ver;      // specific version
            return 'all versions';
        };

        // Turn CPE tokens into readable names: unescape, de-underscore, then
        // uppercase short acronyms (ibm->IBM) / title-case the rest.
        const pretty = (s) => (s || '')
            .replace(/\\(.)/g, '$1')
            .replace(/_/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((w) => (w.length <= 3 && /^[a-z]+$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
            .join(' ');

        // Group version ranges per vendor+product.
        const products = new Map();
        for (const c of cpes) {
            const parts = c.criteria.split(':'); // cpe:2.3:a:vendor:product:version:...
            const vendor = pretty(parts[3]);
            const product = pretty(parts[4]);
            if (!product) continue;
            const key = `${vendor}|${product}`;
            if (!products.has(key)) products.set(key, { vendor, product, ranges: new Set() });
            products.get(key).ranges.add(range(c, parts[5]));
        }

        if (products.size === 0) {
            // Not yet analyzed by NVD -> no CPE data available.
            const pending = /Awaiting|Undergoing|Received/i.test(cve.vulnStatus || '');
            return { vendor: '', product: '', affectedVersions: pending ? 'Awaiting NVD analysis' : 'Not specified' };
        }

        const entries = [...products.values()];
        const primary = entries[0];
        const names = entries.slice(0, 3).map((e) => e.product);
        const productLabel = names.join(', ') + (entries.length > 3 ? ` +${entries.length - 3} more` : '');

        // Version string for the primary product (ranges joined), de-duplicated.
        const versions = [...primary.ranges].filter(Boolean);
        const affectedVersions = versions.length ? versions.join('  |  ') : 'all versions';

        return { vendor: primary.vendor, product: productLabel, affectedVersions };
    }

    severityFromScore(score) {
        if (typeof score !== 'number') return 'UNKNOWN';
        if (score >= 9.0) return 'CRITICAL';
        if (score >= 7.0) return 'HIGH';
        if (score >= 4.0) return 'MEDIUM';
        if (score > 0) return 'LOW';
        return 'NONE';
    }

    async refreshData() {
        return await this.getData();
    }

    async getById(id) {
        if (!this.data || this.data.length === 0) {
            await this.getData();
        }
        return this.data.find((cve) => cve.id.toUpperCase() === (id || '').toUpperCase()) || null;
    }

    getStatus() {
        return {
            mode: this.mode,
            status: this.status,
            source: this.sourceName,
            totalLoaded: this.data.length,
            lastFetch: this.lastFetchTime,
            errorMessage: this.errorMessage
        };
    }
}

export const cveProvider = new CVEProvider();
