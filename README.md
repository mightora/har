# Mightora HAR Analyser

Free, privacy-first HAR troubleshooting tool. Analyze captures **locally in your browser**, without sending network captures to a backend.

**Website (when Pages is enabled):** https://har.mightora.io/

## Privacy

HAR data is read inside a browser Web Worker, and raw headers, cookies, query strings, request and response bodies are never returned to the dashboard. Reports are sanitised but **not anonymous**: hostnames and some paths remain. Never share confidential original HAR files. Shared Mightora components load from third-party CDNs; for highly sensitive use, review and self-host dependencies.

## Running locally

Serve the repository over HTTP (module Workers do not work using file://):

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/. Run tests using `npm test` (Node 22 or later).

## Publishing

GitHub Actions workflow `.github/workflows/pages.yml` deploys on pushes to main. In GitHub Settings → Pages set **Build and deployment → Source: GitHub Actions**. Check the Actions tab for a successful deployment. Publishing requires GitHub Pages to be enabled at the repository level.

MIT licensed. PRs welcome.

## Offline ZIP edition

Download [the self-contained HTML ZIP](https://har.mightora.io/downloads/mightora-har-offline.zip), or the [single HTML file](https://har.mightora.io/downloads/har-analyser.html). After extracting, double-click `har-analyser.html`: no server, software installation or internet connection is needed. The offline HTML embeds the Mightora logo, styles, and all analysis code, with a restrictive CSP that prohibits remote connections. A blob Web Worker handles parsing when supported, with a local parsing fallback for browsers that restrict workers on `file://` URLs.

The website includes separate HAR troubleshooting, network timing, security/privacy and offline-use guides in `guides/`, a sitemap using `har.mightora.io`, and structured FAQ and how-to answers. Automated tests check the download package and SEO files on every commit.

**Security note:** Both editions process selected HAR files locally, but even sanitised diagnostic reports can contain identifying hostnames or path information. Do not upload or share a raw HAR without reviewing it.
