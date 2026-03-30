# HAR File Analyser

A **privacy-first, browser-based HAR file analysis tool** built as part of the Mightora ecosystem.

🔗 **Live Tool:** [mightora.github.io/har](https://mightora.github.io/har)

---

## What It Does

HAR File Analyser gives you instant insights from HTTP Archive (HAR) files — without ever uploading your data anywhere.

Drop in a `.har` file and get:

- **Summary dashboard** — total requests, domains, size, failures, timings
- **Visual charts** — status code distribution, resource breakdown, request timings, domain usage
- **Request Explorer** — searchable, filterable, sortable table with detail panel
- **Cookie Explorer** — all cookies grouped by domain, security attribute analysis
- **JWT Detector** — finds and decodes JWTs in headers, cookies, and query params
- **Auth & Security Insights** — detects Bearer tokens, API keys, Basic auth, sensitive query params
- **Error Analysis** — grouped 4xx/5xx failures with repeat pattern detection
- **Performance Analysis** — slowest/largest requests, duration distribution
- **Infrastructure Detection** — CDN, server platform, caching header analysis
- **Third-Party Domain Detection** — identifies external dependencies

---

## Privacy

All processing is **100% local in your browser**:

- ❌ No data uploaded
- ❌ No server-side processing
- ❌ No storage (localStorage, cookies, IndexedDB)
- ✅ Works offline after initial page load
- ✅ Open source — inspect every line

HAR files can contain sensitive data (auth tokens, cookies, passwords). This tool is designed so you never have to trust a third party with them.

---

## How to Run Locally

```bash
# Clone the repo
git clone https://github.com/mightora/har.git
cd har

# Serve locally (any static file server works)
npx serve .
# or
python3 -m http.server 8080
# or
npx http-server .
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

No build step required — it's plain HTML, CSS, and JavaScript (ES modules).

---

## GitHub Pages Deployment

This site is designed to be deployed directly to GitHub Pages:

1. Go to your repository **Settings → Pages**
2. Set **Source** to `Deploy from a branch`
3. Choose `main` branch, `/ (root)` folder
4. Save — your site will be live at `https://[org].github.io/har`

Or use the included GitHub Actions workflow if one is present.

---

## File Structure

```
/
├── index.html              # Main application
├── assets/
│   ├── css/
│   │   └── style.css       # Mightora design system styles
│   └── js/
│       ├── har-parser.js   # HAR file loading, validation, normalisation
│       ├── analyser.js     # Analysis logic (metrics, security, JWT detection)
│       ├── insights.js     # Chart/visualisation rendering (pure JS canvas)
│       └── ui.js           # UI state management and DOM interactions
├── data/
│   └── config.json         # Site config, author info, footer data
└── README.md
```

---

## How to Capture a HAR File

**Chrome / Edge:**
1. Open DevTools (`F12`)
2. Go to the **Network** tab
3. Enable **Preserve log**
4. Reproduce the issue
5. Right-click → **Save all as HAR with content**

**Firefox:**
1. Open DevTools (`F12`)
2. Go to the **Network** tab
3. Reproduce the issue
4. Right-click → **Save All As HAR**

---

## Extending It

The codebase is modular — each JS file has a single responsibility:

| File | Responsibility |
|------|---------------|
| `har-parser.js` | Load, validate, and normalise HAR data |
| `analyser.js` | Pure analysis functions — no DOM |
| `insights.js` | Canvas-based chart rendering |
| `ui.js` | DOM, state, events |

To add a new analysis feature:
1. Add a function in `analyser.js`
2. Call it from `Analyser.analyse()` to include it in the result
3. Add rendering logic in `ui.js` or `insights.js`
4. Add a tab/panel in `index.html`

---

## Built By

**Ian Tweedie** ([@TechTweedie](https://techtweedie.github.io)) — Microsoft MVP, founder of [Mightora](https://mightora.io).

Part of the **Mightora** free tools ecosystem for developers and the Power Platform community.

---

## Licence

MIT — free to use, fork, and adapt.
