# H4CK3R M4P 🛡️

### Cyber Threat Intelligence Dashboard

**by [0xsh4n](https://github.com/0xsh4n)**

A production-quality, **100% static** cybersecurity intelligence dashboard featuring a
real-time animated attack map, CVE intelligence, security-research aggregation, and threat
monitoring. **No build step. No backend. No API key. No paid map tiles.** Just upload the
folder and it works.

🔗 **Live Demo**: [https://0xsh4n.github.io/hacker-map](https://0xsh4n.github.io/hacker-map)

![License](https://img.shields.io/badge/license-MIT-green)
![Static Site](https://img.shields.io/badge/type-static%20site-blue)
![No Framework](https://img.shields.io/badge/framework-vanilla%20JS-yellow)
![No API Key](https://img.shields.io/badge/API%20key-not%20required-brightgreen)

---

## Features

- 🌍 **Self-contained World Attack Map** — A dark-themed world map rendered on an HTML5
  canvas from **bundled, offline country geometry**. Every attack draws an animated
  **source → target** curved trajectory with a traveling projectile, an impact ripple, and
  glowing origin/target nodes. Pan by dragging, zoom with the wheel or the on-map controls.
- 🔍 **CVE Intelligence Center** — **real, live vulnerabilities** from the
  [NVD 2.0 API](https://nvd.nist.gov/developers/vulnerabilities), fetched directly in the
  browser — **no API key** (NVD is keyless + CORS-enabled) — including CISA KEV flags.
- 📝 **Security Research Feed** — **real, live** security stories from the
  [Hacker News (Algolia) API](https://hn.algolia.com/api) (keyless + CORS), categorised into
  bug bounty / web / exploitation / pentest / research.
- 📡 **Threat Feed** — **real, live** advisories from the
  [GitHub Security Advisory Database](https://docs.github.com/en/rest/security-advisories)
  (keyless + CORS).
- 🖥️ **Intelligence Terminal** — Live system log with copy/pause/clear.
- 🔔 **Alert System** — In-app + native notifications for critical events.
- 🔎 **Global Search** — `Ctrl/⌘ + K` to jump to CVEs, writeups, and map nodes.
- ⚙️ **Configurable Settings** — Display, sound, data mode, and refresh cadence.
- 🎨 **Matrix Dark Theme** — Immersive cybersecurity aesthetic.

## Why there is no "API key required"

Earlier versions leaned on an external map-tile provider and a live data key. This version
**removes those dependencies entirely**:

- The world map uses **local vector geometry** (`js/data/worldGeo.js`, public-domain Natural
  Earth data) drawn on a canvas — there are **no third-party map tiles** and therefore
  **nothing to authenticate**.
- **All three intelligence feeds are LIVE from real, keyless, CORS-enabled public APIs** —
  no API key, no backend, no bundled/demo datasets. There are **no demo data files** in the
  project anymore.
- If a feed's public API is briefly unreachable or rate-limited, that panel shows an honest
  **offline** state and recovers on the next refresh — it never invents content.

### Live feeds & the one honest exception

| Panel | Source | Key? | Live? |
|---|---|---|---|
| CVE Intel | NVD 2.0 API | none | ✅ real |
| Security Research | Hacker News (Algolia) | none | ✅ real |
| Threat Feed | GitHub Security Advisories | none | ✅ real |
| **World Attack Map** | **simulation** (`js/data/threatNodes.js`) | — | ⚠️ **simulated** |

The **attack map is the one thing that cannot be live**: there is no open, keyless,
browser-fetchable real-time global attack-telemetry feed (commercial "attack maps" are
proprietary and block anonymous cross-origin access). It is therefore a realistic simulation,
labeled **SIMULATED TRAFFIC** right on the map. Making it truly live would require your own
backend/serverless proxy.

## Tech Stack

- **HTML5** / **CSS3** / **Vanilla JavaScript** (ES Modules)
- **Canvas 2D** — custom offline world map + animated attack arcs (no Leaflet, no tiles)
- **No frameworks, no build tools, no backend**

## Getting Started (Local)

Browsers block ES modules on the `file://` protocol, so **don't** double-click
`index.html`. Serve the folder over HTTP instead:

```bash
git clone https://github.com/0xsh4n/hacker-map.git
cd hacker-map
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (VS Code's *Live Server* extension or `npx serve .` work
too.)

## Deployment — just upload the folder

Because the app is 100% static, deployment is literally *"upload these files"*. Pick one:

### Option A — Its own GitHub Pages project site

1. Create a repo named `hacker-map` and push the whole folder to it.
2. Repo → **Settings → Pages → Build and deployment**: set **Source = Deploy from a branch**,
   **Branch = `main` / root**, save.
3. Your dashboard goes live at `https://<username>.github.io/hacker-map/`.

### Option B — Alongside your existing `github.io` site

If you already have a user site like
[`0xsh4n/0xsh4n.github.io`](https://github.com/0xsh4n/0xsh4n.github.io) with its own root
`index.html`, you do **not** need to touch that file. Just drop this project in as a
**subfolder**:

```
0xsh4n.github.io/
├── index.html            ← your existing homepage (unchanged)
└── hacker-map/           ← this whole folder, copied in
    ├── index.html
    ├── css/
    └── js/
```

Commit and push. GitHub Pages serves the subfolder automatically:

- Your homepage stays at `https://0xsh4n.github.io/`
- The dashboard is live at `https://0xsh4n.github.io/hacker-map/`

You can then link to it from your homepage, e.g.:

```html
<a href="/hacker-map/">🛡️ H4CK3R M4P — Threat Intelligence Dashboard</a>
```

> **Tip:** All asset paths in this project are **relative**, so the subfolder approach works
> without editing a single line. Other static hosts (Cloudflare Pages, Netlify, Vercel)
> work the same way — point them at the folder, no build command needed.

## Configuration

Edit `js/config/config.js`:

| Setting | Purpose |
| --- | --- |
| `ENABLE_MATRIX_BG` | Matrix rain background |
| `ATTACK_REFRESH_INTERVAL` | Simulated attack cadence (ms) |
| `CVE_REFRESH_INTERVAL` / `FEED_REFRESH_INTERVAL` | Cache TTL for the live feeds (ms) |
| `MAX_SIMULTANEOUS_ANIMATIONS` | Concurrent attack arcs on the map |

> ⚠️ **Do not** put an API key in this file — it ships to the browser and, for NVD, actually
> *breaks* the request (the `apiKey` header forces a CORS preflight NVD rejects from a page).
> The feeds are keyless by design. A key is only useful behind a server-side proxy.

## Project Structure

```
hacker-map/
├── index.html
├── css/                  # variables, reset, main, components, animations, responsive
└── js/
    ├── app.js            # bootstrap
    ├── config/config.js
    ├── data/             # worldGeo.js (offline map geometry) + threatNodes.js (map sim model)
    ├── providers/        # attack (sim) / cve (NVD) / writeup (HN) / news (GitHub) providers
    ├── modules/          # map (canvas), matrix, feeds, stats, search, settings, ...
    └── utils/            # dom, formatter, sanitizer, storage, time
```

## Security

- No `eval()` or dynamic script injection
- All rendered content is sanitized (`js/utils/sanitizer.js`)
- External links use `rel="noopener noreferrer"`
- No hard-coded API keys

## Accessibility

- Keyboard navigation + ARIA roles on tabs and controls
- Sufficient contrast, respects `prefers-reduced-motion`

## License

MIT License — see [LICENSE](LICENSE).

## Author

**0xsh4n** — [GitHub](https://github.com/0xsh4n)

---

> ⚠️ **Disclaimer**: For educational and research purposes. Attack data in DEMO mode is
> simulated — this dashboard performs no actual scanning or attacks.
