# Mightora HAR Analyser

Free, privacy-first HAR troubleshooting tool. Analyze captures **locally in your browser**, without sending network captures to a backend.

**Website (when Pages is enabled):** https://mightora.github.io/har/

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
