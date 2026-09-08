/**
 * H4CK3R M4P - Writeups Archive Builder
 *
 * Runs in GitHub Actions (see .github/workflows/fetch-writeups.yml) on a cron.
 * Fetches security-research RSS/Atom feeds SERVER-SIDE (no browser CORS limits),
 * normalizes them into the app's writeup shape, MERGES with the existing archive
 * (so the archive grows over time), de-duplicates, caps the size, and writes
 * data/archive/writeups.json — which the static site then reads same-origin.
 *
 * Zero dependencies: uses Node's global fetch + a small tolerant RSS/Atom parser
 * so nothing needs to be installed and no node_modules ever lands in the repo.
 *
 * Edit SOURCES to add/remove feeds. Failing feeds are skipped, not fatal.
 *
 * @author 0xsh4n
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const ARCHIVE_PATH = 'data/archive/writeups.json';
const MAX_ITEMS = 800;            // cap the archive size
const PER_SOURCE_CAP = 40;        // avoid one huge feed dominating
const UA = 'Mozilla/5.0 (compatible; h4ck3r-map-archiver/1.0; +https://github.com/0xsh4n)';

// name = display source; url = feed; verified reachable at build time.
const SOURCES = [
    { name: 'PortSwigger', url: 'https://portswigger.net/research/rss' },
    { name: 'Intigriti', url: 'https://blog.intigriti.com/feed/' },
    { name: 'YesWeHack', url: 'https://www.yeswehack.com/feed' },
    { name: 'HACKLIDO', url: 'https://hacklido.com/rss' },
    { name: 'Google Project Zero', url: 'https://googleprojectzero.blogspot.com/feeds/posts/default' },
    { name: 'Medium', url: 'https://medium.com/feed/tag/bug-bounty' },
    { name: 'Medium', url: 'https://medium.com/feed/tag/cybersecurity' },
    { name: 'Medium', url: 'https://medium.com/feed/tag/penetration-testing' },
    { name: 'Medium', url: 'https://medium.com/feed/tag/infosec' }
];

/* --------------------------------------------------------- tiny XML utils -- */

function decodeEntities(s = '') {
    return s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&amp;/g, '&')
        .trim();
}

function stripHtml(s = '') {
    return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return m ? decodeEntities(m[1]) : '';
}

function allTags(block, name) {
    const out = [];
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi');
    let m;
    while ((m = re.exec(block))) out.push(decodeEntities(m[1]));
    return out;
}

function linkOf(block) {
    // RSS: <link>URL</link>  |  Atom: <link rel="alternate" href="URL"/>
    const rss = block.match(/<link>([\s\S]*?)<\/link>/i);
    if (rss && rss[1].trim()) return decodeEntities(rss[1]);
    const atomAlt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
    if (atomAlt) return decodeEntities(atomAlt[1]);
    const atom = block.match(/<link[^>]*href=["']([^"']+)["']/i);
    return atom ? decodeEntities(atom[1]) : '';
}

function parseFeed(xml) {
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    return blocks.map((b) => ({
        title: stripHtml(tag(b, 'title')),
        link: linkOf(b),
        date: tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'),
        author: stripHtml(tag(b, 'dc:creator') || tag(b, 'creator') || tag(b, 'name') || ''),
        categories: allTags(b, 'category').map((c) => stripHtml(c)).filter(Boolean),
        content: stripHtml(tag(b, 'content:encoded') || tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'))
    })).filter((i) => i.title && i.link);
}

/* --------------------------------------------------------- normalization --- */

function deriveCategory(text) {
    const l = text.toLowerCase();
    if (/bug bounty|bounty|hackerone|bugcrowd|intigriti|yeswehack|\$\s?\d/.test(l)) return 'BUG BOUNTY';
    if (/cve-\d{4}/.test(l)) return 'CVES';
    if (/\bxss\b|csrf|ssrf|sql ?injection|\bsqli\b|\bweb\b|http|browser|\bdom\b|cookie|jwt|oauth|graphql/.test(l)) return 'WEB SECURITY';
    if (/pentest|red team|privilege escalation|lateral movement|active directory|kerbero/.test(l)) return 'PENTESTING';
    if (/exploit|\brce\b|0 ?day|zero ?day|overflow|deserializ|payload|shellcode|sandbox escape/.test(l)) return 'EXPLOITATION';
    return 'RESEARCH';
}

const KW = ['RCE', 'XSS', 'SSRF', 'CSRF', 'SQLi', 'LFI', 'IDOR', 'Bug Bounty', 'CVE', 'Ransomware',
    'Malware', 'Phishing', 'Zero-Day', 'Kernel', 'Cloud', 'AWS', 'Azure', 'GCP', 'Android', 'iOS',
    'Linux', 'Windows', 'Kubernetes', 'API', 'GraphQL', 'OAuth', 'JWT', 'Deserialization'];

function normalize(item, sourceName) {
    const hay = `${item.title} ${item.categories.join(' ')} ${item.content}`;
    const tags = [];
    for (const k of KW) if (hay.toLowerCase().includes(k.toLowerCase())) tags.push(k);
    for (const c of item.categories.slice(0, 3)) if (c && !tags.includes(c)) tags.push(c);
    const finalTags = [...new Set(tags)].slice(0, 5);
    if (!finalTags.length) finalTags.push('InfoSec');

    const words = item.content ? item.content.split(/\s+/).length : 0;
    const readTime = words > 40 ? `${Math.max(1, Math.round(words / 200))} min read` : 'Read';
    const summary = item.content
        ? (item.content.length > 300 ? item.content.slice(0, 300) + '…' : item.content)
        : `New security research published on ${sourceName}.`;

    const iso = item.date ? new Date(item.date).toISOString() : new Date().toISOString();

    return {
        id: item.link,
        title: item.title,
        source: sourceName,
        author: item.author || sourceName,
        publishedDate: iso,
        category: deriveCategory(hay),
        tags: finalTags,
        summary,
        url: item.link,
        popularity: 0,
        readTime
    };
}

/* ------------------------------------------------------------------ main --- */

async function fetchFeed(src) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    try {
        const r = await fetch(src.url, { signal: controller.signal, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });
        clearTimeout(t);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const xml = await r.text();
        const items = parseFeed(xml).slice(0, PER_SOURCE_CAP).map((i) => normalize(i, src.name));
        console.log(`✓ ${src.name.padEnd(20)} ${items.length} items  (${src.url})`);
        return items;
    } catch (e) {
        clearTimeout(t);
        console.warn(`✗ ${src.name.padEnd(20)} ${e.message}  (${src.url})`);
        return [];
    }
}

async function main() {
    // Load existing archive to merge into (grows over time).
    let existing = [];
    try {
        existing = JSON.parse(await readFile(ARCHIVE_PATH, 'utf8'));
        if (!Array.isArray(existing)) existing = [];
    } catch { /* first run */ }

    const fetched = (await Promise.all(SOURCES.map(fetchFeed))).flat();

    // Merge: keep first occurrence per URL (existing wins for stable ordering,
    // but freshly-fetched metadata is fine either way since content is static).
    const byUrl = new Map();
    for (const it of [...fetched, ...existing]) {
        if (it && it.url && !byUrl.has(it.url)) byUrl.set(it.url, it);
    }

    const merged = [...byUrl.values()]
        .filter((i) => i.title && i.url && i.publishedDate)
        .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate))
        .slice(0, MAX_ITEMS);

    await mkdir(dirname(ARCHIVE_PATH), { recursive: true });
    await writeFile(ARCHIVE_PATH, JSON.stringify(merged, null, 0) + '\n');

    console.log(`\nArchive: ${merged.length} items (was ${existing.length}, fetched ${fetched.length}) -> ${ARCHIVE_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
