/**
 * ui.js
 * Manages UI state, interactions, DOM updates.
 * Coordinates parser, analyser, and insights modules.
 */

import { HarParser } from './har-parser.js';
import { Analyser } from './analyser.js';
import { Insights } from './insights.js';

let state = {
  entries: [],
  analysis: null,
  filteredEntries: [],
  filters: { search: '', status: 'all', domain: 'all', type: 'all' },
  sort: { field: 'index', dir: 'asc' },
  currentTab: 'summary',
  selectedEntry: null,
  requestPage: 1,
  requestPageSize: 50
};

// ─── Bootstrap ──────────────────────────────────────────────────────────────

export function init() {
  loadConfig();
  setupUpload();
  setupTabs();
  setupRequestExplorer();
  showSection('upload');
}

async function loadConfig() {
  try {
    const res = await fetch('./data/config.json');
    const config = await res.json();
    renderConfig(config);
  } catch (e) {
    console.warn('Config not loaded:', e);
  }
}

function renderConfig(config) {
  // Hero
  const heroHeadline = document.getElementById('hero-headline');
  const heroSub = document.getElementById('hero-subheadline');
  const heroDesc = document.getElementById('hero-description');
  if (heroHeadline) heroHeadline.textContent = config.hero.headline;
  if (heroSub) heroSub.textContent = config.hero.subheadline;
  if (heroDesc) heroDesc.textContent = config.hero.description;

  // Page title
  document.title = config.site.name + ' | Mightora';

  // Author
  renderAuthor(config.author);

  // Footer
  renderFooter(config.footer);

  // Privacy
  renderPrivacy(config.privacy);
}

function renderAuthor(author) {
  const el = document.getElementById('author-section');
  if (!el) return;
  el.innerHTML = `
    <div class="author-card">
      <div class="author-image-wrap">
        <img src="${author.image}" alt="${author.name}" class="author-image" id="author-img">
      </div>
      <div class="author-info">
        <div class="author-handle">${author.handle}</div>
        <h3 class="author-name">${author.name}</h3>
        <div class="author-role">${author.role}</div>
        <p class="author-bio">${author.bio}</p>
        <div class="author-links">
          ${author.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="author-link">${l.icon} ${l.label}</a>`).join('')}
        </div>
      </div>
    </div>
  `;
  const img = document.getElementById('author-img');
  if (img) {
    img.addEventListener('error', () => { img.style.display = 'none'; });
  }
}

function renderFooter(footer) {
  const brandsEl = document.getElementById('footer-brands');
  const colsEl = document.getElementById('footer-columns');
  if (brandsEl) {
    brandsEl.innerHTML = footer.brands.map(b => `
      <a href="${b.url}" target="_blank" rel="noopener noreferrer" class="brand-card">
        <img src="${b.logo}" alt="${b.name}" class="brand-logo" onerror="this.style.display='none'">
        <div class="brand-desc">${b.description}</div>
      </a>
    `).join('');
  }
  if (colsEl) {
    const columns = {};
    footer.sections.forEach(s => {
      const col = s.column || 1;
      if (!columns[col]) columns[col] = [];
      columns[col].push(s);
    });
    colsEl.innerHTML = Object.values(columns).map(sections => `
      <div class="footer-col">
        ${sections.map(s => `
          <div class="footer-section">
            <h4 class="footer-section-title">${s.title}</h4>
            <ul class="footer-links">
              ${s.links.map(l => `<li><a href="${l.url}" ${l.url.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${l.name}</a></li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `).join('');
  }
}

function renderPrivacy(privacy) {
  const el = document.getElementById('privacy-points');
  if (!el) return;
  el.innerHTML = privacy.points.map(p => `<li class="privacy-point"><span class="privacy-icon">🔒</span>${p}</li>`).join('');
}

// ─── Upload ──────────────────────────────────────────────────────────────────

function setupUpload() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const filePicker = document.getElementById('file-picker-btn');

  if (!dropzone) return;

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput && fileInput.click();
    }
  });

  if (filePicker) {
    filePicker.addEventListener('click', () => fileInput && fileInput.click());
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) processFile(file);
    });
  }
}

function processFile(file) {
  showUploadStatus('loading', `Parsing ${file.name} (${formatBytes(file.size)})…`);
  setLoadingState(true);

  setTimeout(() => {
    HarParser.parseFile(file)
      .then(har => {
        const entries = HarParser.extractEntries(har);
        const analysis = Analyser.analyse(entries);
        state.entries = entries;
        state.analysis = analysis;
        state.filteredEntries = [...entries];

        showUploadStatus('success', `✅ Loaded ${entries.length} requests from ${file.name}`);
        setLoadingState(false);
        populateDomainFilter(analysis.domains);
        populateTypeFilter(analysis.resourceTypes);
        renderAll();
        showSection('analyser');
        scrollTo('analyser');
      })
      .catch(err => {
        showUploadStatus('error', `❌ ${err.message}`);
        setLoadingState(false);
      });
  }, 50); // Allow UI to paint first
}

function showUploadStatus(type, message) {
  const el = document.getElementById('upload-status');
  if (!el) return;
  el.className = 'upload-status upload-status--' + type;
  el.textContent = message;
  el.style.display = 'block';
}

function setLoadingState(loading) {
  const btn = document.getElementById('file-picker-btn');
  const spinner = document.getElementById('upload-spinner');
  if (btn) btn.disabled = loading;
  if (spinner) spinner.style.display = loading ? 'flex' : 'none';
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      setTab(tab);
    });
  });
}

function setTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('[data-tab-panel]').forEach(panel => {
    panel.style.display = panel.dataset.tabPanel === tab ? 'block' : 'none';
  });

  // Re-render charts on tab switch (canvas sizing)
  if (tab === 'insights' && state.analysis) {
    renderInsights(state.analysis);
  }
}

// ─── Render all ──────────────────────────────────────────────────────────────

function renderAll() {
  const { analysis, entries } = state;
  if (!analysis) return;

  renderSummaryCards(analysis.summary);
  renderInsights(analysis);
  renderRequestTable(entries);
  renderCookieExplorer(analysis.cookies);
  renderJWTExplorer(analysis.jwts);
  renderAuthInsights(analysis.authInsights);
  renderErrorAnalysis(analysis.errors);
  renderCacheInsights(analysis.cacheInsights);
  renderInfraInsights(analysis.infraInsights);

  setTab('summary');
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function renderSummaryCards(summary) {
  const cards = [
    { id: 'card-total', value: summary.totalRequests, label: 'Total Requests', icon: '📡', color: 'primary' },
    { id: 'card-domains', value: summary.uniqueDomains, label: 'Unique Domains', icon: '🌐', color: 'info' },
    { id: 'card-size', value: formatBytes(summary.totalSize), label: 'Total Transferred', icon: '📦', color: 'success' },
    { id: 'card-failed', value: summary.failed, label: 'Failed Requests', icon: '❌', color: summary.failed > 0 ? 'error' : 'success' },
    { id: 'card-redirects', value: summary.redirects, label: 'Redirects', icon: '↩️', color: 'warning' },
    { id: 'card-avg', value: summary.avgTime + 'ms', label: 'Avg Request Time', icon: '⏱️', color: 'info' },
    { id: 'card-slowest', value: summary.slowestTime + 'ms', label: 'Slowest Request', icon: '🐢', color: summary.slowestTime > 3000 ? 'error' : 'warning' },
    { id: 'card-fastest', value: summary.fastestTime + 'ms', label: 'Fastest Request', icon: '⚡', color: 'success' }
  ];

  const container = document.getElementById('summary-cards');
  if (!container) return;
  container.innerHTML = cards.map(c => `
    <div class="metric-card metric-card--${c.color}">
      <div class="metric-icon">${c.icon}</div>
      <div class="metric-value">${c.value}</div>
      <div class="metric-label">${c.label}</div>
    </div>
  `).join('');
}

// ─── Insights ────────────────────────────────────────────────────────────────

function renderInsights(analysis) {
  Insights.renderStatusChart('chart-status', analysis.statusCodes);
  Insights.renderDomainChart('chart-domains', analysis.domains);
  Insights.renderResourceChart('chart-resources', analysis.resourceTypes);
  Insights.renderDurationChart('chart-duration', analysis.durationBuckets);
  Insights.renderSlowestChart('chart-slowest', analysis.slowest);
}

// ─── Request Explorer ────────────────────────────────────────────────────────

function setupRequestExplorer() {
  const searchInput = document.getElementById('req-search');
  const statusFilter = document.getElementById('req-filter-status');
  const domainFilter = document.getElementById('req-filter-domain');
  const typeFilter = document.getElementById('req-filter-type');
  const sortSel = document.getElementById('req-sort');

  if (searchInput) searchInput.addEventListener('input', debounce(() => { state.filters.search = searchInput.value; applyFilters(); }, 300));
  if (statusFilter) statusFilter.addEventListener('change', () => { state.filters.status = statusFilter.value; applyFilters(); });
  if (domainFilter) domainFilter.addEventListener('change', () => { state.filters.domain = domainFilter.value; applyFilters(); });
  if (typeFilter) typeFilter.addEventListener('change', () => { state.filters.type = typeFilter.value; applyFilters(); });
  if (sortSel) sortSel.addEventListener('change', () => {
    const [field, dir] = sortSel.value.split(':');
    state.sort = { field, dir: dir || 'asc' };
    applyFilters();
  });
}

function populateDomainFilter(domains) {
  const el = document.getElementById('req-filter-domain');
  if (!el) return;
  el.innerHTML = '<option value="all">All Domains</option>' +
    domains.map(d => `<option value="${escapeHtml(d.domain)}">${escapeHtml(d.domain)} (${d.count})</option>`).join('');
}

function populateTypeFilter(resourceTypes) {
  const el = document.getElementById('req-filter-type');
  if (!el) return;
  el.innerHTML = '<option value="all">All Types</option>' +
    resourceTypes.map(r => `<option value="${r.type}">${r.type} (${r.count})</option>`).join('');
}

function applyFilters() {
  let entries = [...state.entries];
  const { search, status, domain, type } = state.filters;

  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter(e => e.url.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q));
  }
  if (status !== 'all') {
    if (status === '2xx') entries = entries.filter(e => e.status >= 200 && e.status < 300);
    else if (status === '3xx') entries = entries.filter(e => e.status >= 300 && e.status < 400);
    else if (status === '4xx') entries = entries.filter(e => e.status >= 400 && e.status < 500);
    else if (status === '5xx') entries = entries.filter(e => e.status >= 500);
    else if (status === 'error') entries = entries.filter(e => e.status >= 400);
  }
  if (domain !== 'all') {
    entries = entries.filter(e => e.domain === domain);
  }
  if (type !== 'all') {
    entries = entries.filter(e => e.resourceType === type);
  }

  // Sort
  const { field, dir } = state.sort;
  entries.sort((a, b) => {
    let av = a[field], bv = b[field];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  state.filteredEntries = entries;
  state.requestPage = 1;
  renderRequestTable(entries);
}

function renderRequestTable(entries) {
  const tbody = document.getElementById('request-tbody');
  const countEl = document.getElementById('request-count');
  const paginationEl = document.getElementById('request-pagination');
  if (!tbody) return;

  const page = state.requestPage;
  const pageSize = state.requestPageSize;
  const start = (page - 1) * pageSize;
  const pageEntries = entries.slice(start, start + pageSize);

  if (countEl) countEl.textContent = `Showing ${pageEntries.length} of ${entries.length} requests`;

  tbody.innerHTML = pageEntries.map(e => `
    <tr class="request-row" data-index="${e.index}" tabindex="0">
      <td><span class="badge badge--method badge--${e.method.toLowerCase()}">${escapeHtml(e.method)}</span></td>
      <td class="url-cell" title="${escapeHtml(e.url)}">${escapeHtml(truncateUrl(e.url))}</td>
      <td class="domain-cell">${escapeHtml(e.domain)}</td>
      <td><span class="badge badge--status badge--${statusClass(e.status)}">${e.status || '—'}</span></td>
      <td>${escapeHtml(e.resourceType)}</td>
      <td class="${e.totalTime > 3000 ? 'text-error' : e.totalTime > 1000 ? 'text-warning' : ''}">${Math.round(e.totalTime)}ms</td>
      <td>${formatBytes(e.responseSize)}</td>
    </tr>
  `).join('');

  // Row click for detail panel
  tbody.querySelectorAll('.request-row').forEach(row => {
    row.addEventListener('click', () => openRequestDetail(parseInt(row.dataset.index)));
    row.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') openRequestDetail(parseInt(row.dataset.index));
    });
  });

  // Pagination
  if (paginationEl) {
    const totalPages = Math.ceil(entries.length / pageSize);
    paginationEl.innerHTML = totalPages <= 1 ? '' : `
      <button class="btn btn-sm" ${page === 1 ? 'disabled' : ''} onclick="UI.prevPage()">‹ Prev</button>
      <span class="pagination-info">Page ${page} of ${totalPages}</span>
      <button class="btn btn-sm" ${page === totalPages ? 'disabled' : ''} onclick="UI.nextPage()">Next ›</button>
    `;
  }
}

// ─── Request Detail Panel ─────────────────────────────────────────────────────

function openRequestDetail(index) {
  const entry = state.entries[index];
  if (!entry) return;
  state.selectedEntry = entry;

  const panel = document.getElementById('request-detail-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">
        <span class="badge badge--method badge--${entry.method.toLowerCase()}">${escapeHtml(entry.method)}</span>
        <span class="badge badge--status badge--${statusClass(entry.status)}">${entry.status} ${escapeHtml(entry.statusText)}</span>
      </div>
      <button class="detail-close btn btn-sm" onclick="document.getElementById('request-detail-panel').style.display='none'">✕ Close</button>
    </div>
    <div class="detail-url">${escapeHtml(entry.url)}</div>

    <div class="detail-grid">
      <div class="detail-section">
        <h4>Timings</h4>
        ${renderTimings(entry.timings, entry.totalTime)}
      </div>
      <div class="detail-section">
        <h4>Info</h4>
        <table class="detail-table">
          <tr><td>MIME Type</td><td>${escapeHtml(entry.mimeType)}</td></tr>
          <tr><td>Resource Type</td><td>${escapeHtml(entry.resourceType)}</td></tr>
          <tr><td>Response Size</td><td>${formatBytes(entry.responseSize)}</td></tr>
          <tr><td>Request Size</td><td>${formatBytes(entry.requestSize)}</td></tr>
          <tr><td>Started</td><td>${escapeHtml(entry.startedDateTime)}</td></tr>
        </table>
      </div>
    </div>

    ${entry.queryString.length ? `
      <div class="detail-section">
        <h4>Query Parameters (${entry.queryString.length})</h4>
        ${renderKVTable(entry.queryString)}
      </div>
    ` : ''}

    <div class="detail-section">
      <h4>Request Headers (${entry.requestHeaders.length})</h4>
      ${renderHeaderTable(entry.requestHeaders)}
    </div>

    <div class="detail-section">
      <h4>Response Headers (${entry.responseHeaders.length})</h4>
      ${renderHeaderTable(entry.responseHeaders)}
    </div>

    ${entry.cookies.length ? `
      <div class="detail-section">
        <h4>Request Cookies (${entry.cookies.length})</h4>
        ${renderKVTable(entry.cookies)}
      </div>
    ` : ''}

    ${entry.responseCookies.length ? `
      <div class="detail-section">
        <h4>Set-Cookie (${entry.responseCookies.length})</h4>
        ${renderKVTable(entry.responseCookies)}
      </div>
    ` : ''}
  `;
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderTimings(timings, total) {
  const keys = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'];
  const colors = { blocked: '#6b7280', dns: '#8b5cf6', connect: '#3b82f6', ssl: '#14b8a6', send: '#22c55e', wait: '#f59e0b', receive: '#6366f1' };
  const rows = keys
    .filter(k => timings[k] !== undefined && timings[k] >= 0)
    .map(k => `
      <div class="timing-row">
        <span class="timing-label">${k}</span>
        <div class="timing-bar-wrap">
          <div class="timing-bar" style="width:${total > 0 ? Math.max(2, (timings[k] / total) * 100) : 0}%;background:${colors[k]}"></div>
        </div>
        <span class="timing-value">${Math.round(timings[k])}ms</span>
      </div>
    `);
  rows.push(`<div class="timing-row timing-total"><span class="timing-label">total</span><div class="timing-bar-wrap"></div><span class="timing-value">${Math.round(total)}ms</span></div>`);
  return `<div class="timing-chart">${rows.join('')}</div>`;
}

function renderHeaderTable(headers) {
  if (!headers.length) return '<p class="text-muted">No headers.</p>';
  return `<table class="detail-table"><tbody>${headers.map(h =>
    `<tr><td class="header-name">${escapeHtml(h.name)}</td><td class="header-value">${escapeHtml(h.value || '')}</td></tr>`
  ).join('')}</tbody></table>`;
}

function renderKVTable(items) {
  if (!items.length) return '<p class="text-muted">None.</p>';
  return `<table class="detail-table"><tbody>${items.map(item =>
    `<tr><td>${escapeHtml(item.name || '')}</td><td>${escapeHtml(item.value || '')}</td></tr>`
  ).join('')}</tbody></table>`;
}

// ─── Cookie Explorer ──────────────────────────────────────────────────────────

function renderCookieExplorer(cookies) {
  const el = document.getElementById('cookie-list');
  if (!el) return;
  if (!cookies.length) {
    el.innerHTML = '<p class="text-muted">No cookies found in this HAR file.</p>';
    return;
  }

  // Group by domain
  const byDomain = {};
  cookies.forEach(c => {
    const d = c.domain || 'unknown';
    if (!byDomain[d]) byDomain[d] = [];
    byDomain[d].push(c);
  });

  el.innerHTML = Object.entries(byDomain).map(([domain, cooks]) => `
    <div class="cookie-domain-group">
      <h4 class="cookie-domain-title">🌐 ${escapeHtml(domain)} <span class="badge">${cooks.length}</span></h4>
      <div class="cookie-cards">
        ${cooks.map(c => `
          <div class="cookie-card ${c.issues.length ? 'cookie-card--warn' : ''}">
            <div class="cookie-name">${escapeHtml(c.name)}</div>
            <div class="cookie-attrs">
              <span class="attr-tag ${c.secure ? 'attr-tag--good' : 'attr-tag--bad'}">Secure: ${c.secure ? '✓' : '✗'}</span>
              <span class="attr-tag ${c.httpOnly ? 'attr-tag--good' : 'attr-tag--bad'}">HttpOnly: ${c.httpOnly ? '✓' : '✗'}</span>
              ${c.sameSite ? `<span class="attr-tag">SameSite: ${escapeHtml(c.sameSite)}</span>` : ''}
              ${c.expires ? `<span class="attr-tag">Expires: ${new Date(c.expires).toLocaleDateString()}</span>` : ''}
            </div>
            ${c.issues.length ? `<div class="cookie-issues">${c.issues.map(i => `<span class="issue-tag">⚠️ ${escapeHtml(i)}</span>`).join('')}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ─── JWT Explorer ─────────────────────────────────────────────────────────────

function renderJWTExplorer(jwts) {
  const el = document.getElementById('jwt-list');
  if (!el) return;
  if (!jwts.length) {
    el.innerHTML = '<p class="text-muted">No JWT tokens detected.</p>';
    return;
  }

  el.innerHTML = `
    <div class="jwt-disclaimer">⚠️ <strong>Signature not verified.</strong> Token decoding is for analysis only — no cryptographic verification is performed.</div>
    ${jwts.map((j, i) => `
      <div class="jwt-card ${j.expired ? 'jwt-card--expired' : ''} ${j.warnings && j.warnings.length ? 'jwt-card--warn' : ''}">
        <div class="jwt-header-row">
          <span class="jwt-alg badge">${escapeHtml(j.algorithm || 'unknown')}</span>
          ${j.expired ? '<span class="badge badge--error">EXPIRED</span>' : '<span class="badge badge--success">Active</span>'}
          <span class="jwt-source text-muted">${escapeHtml(j.source)}</span>
        </div>
        <div class="jwt-url text-muted">${escapeHtml(truncateUrl(j.url))}</div>
        ${j.warnings && j.warnings.length ? `<div class="jwt-warnings">${j.warnings.map(w => `<span class="issue-tag">⚠️ ${escapeHtml(w)}</span>`).join('')}</div>` : ''}
        ${j.valid ? `
          <details class="jwt-details">
            <summary>View Decoded Token</summary>
            <div class="jwt-payload-grid">
              <div>
                <strong>Header</strong>
                <pre class="jwt-pre">${escapeHtml(JSON.stringify(j.header, null, 2))}</pre>
              </div>
              <div>
                <strong>Payload</strong>
                <pre class="jwt-pre">${escapeHtml(JSON.stringify(j.payload, null, 2))}</pre>
              </div>
            </div>
            ${j.expiry ? `<div class="jwt-meta">Expires: ${j.expiry}</div>` : ''}
            ${j.issuedAt ? `<div class="jwt-meta">Issued At: ${j.issuedAt}</div>` : ''}
            ${j.subject ? `<div class="jwt-meta">Subject: ${escapeHtml(j.subject)}</div>` : ''}
            ${j.issuer ? `<div class="jwt-meta">Issuer: ${escapeHtml(j.issuer)}</div>` : ''}
          </details>
        ` : `<div class="jwt-error text-error">⚠️ ${escapeHtml(j.error)}</div>`}
      </div>
    `).join('')}
  `;
}

// ─── Auth Insights ────────────────────────────────────────────────────────────

function renderAuthInsights(insights) {
  const el = document.getElementById('auth-insights-list');
  if (!el) return;
  if (!insights.length) {
    el.innerHTML = '<p class="text-muted">No authentication or security patterns detected.</p>';
    return;
  }

  el.innerHTML = insights.map(ins => `
    <div class="insight-card insight-card--${ins.severity}">
      <div class="insight-type">
        ${severityIcon(ins.severity)} <strong>${escapeHtml(ins.type)}</strong>
        <span class="badge badge--${ins.severity}">${ins.severity.toUpperCase()}</span>
      </div>
      <div class="insight-detail">${escapeHtml(ins.detail)}</div>
      <div class="insight-url text-muted">${escapeHtml(truncateUrl(ins.url))}</div>
    </div>
  `).join('');
}

// ─── Error Analysis ───────────────────────────────────────────────────────────

function renderErrorAnalysis(errors) {
  const el = document.getElementById('error-list');
  if (!el) return;
  if (!errors.length) {
    el.innerHTML = '<p class="text-muted success-text">✅ No error responses (4xx/5xx) found.</p>';
    return;
  }

  // Group by status code
  const byCode = {};
  errors.forEach(e => {
    const code = String(e.status);
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(e);
  });

  el.innerHTML = Object.entries(byCode).map(([code, errs]) => `
    <div class="error-group">
      <h4 class="error-code-title">
        <span class="badge badge--status badge--${statusClass(parseInt(code))}">${code}</span>
        ${errs.length} request${errs.length > 1 ? 's' : ''}
      </h4>
      <ul class="error-urls">
        ${errs.slice(0, 10).map(e => `
          <li class="error-url-item">
            <span class="badge badge--method badge--${e.method.toLowerCase()}">${escapeHtml(e.method)}</span>
            <span class="error-url" title="${escapeHtml(e.url)}">${escapeHtml(truncateUrl(e.url))}</span>
            <span class="error-time">${Math.round(e.totalTime)}ms</span>
          </li>
        `).join('')}
        ${errs.length > 10 ? `<li class="text-muted">… and ${errs.length - 10} more</li>` : ''}
      </ul>
    </div>
  `).join('');
}

// ─── Cache + Infrastructure ───────────────────────────────────────────────────

function renderCacheInsights(cache) {
  const el = document.getElementById('cache-insights');
  if (!el) return;
  el.innerHTML = `
    <div class="cache-stats">
      <div class="cache-stat">
        <div class="cache-stat-value text-success">${cache.cacheHits}</div>
        <div class="cache-stat-label">Cache Hits</div>
      </div>
      <div class="cache-stat">
        <div class="cache-stat-value text-warning">${cache.cacheMisses}</div>
        <div class="cache-stat-label">Cache Misses</div>
      </div>
      <div class="cache-stat">
        <div class="cache-stat-value">${cache.noCache}</div>
        <div class="cache-stat-label">No-Cache Directives</div>
      </div>
    </div>
    ${cache.detectedPlatforms.length ? `
      <div class="platform-tags">
        <h4>Detected Platforms / Servers</h4>
        <div class="tag-list">${cache.detectedPlatforms.map(p => `<span class="platform-tag">${escapeHtml(p)}</span>`).join('')}</div>
      </div>
    ` : ''}
  `;
}

function renderInfraInsights(platforms) {
  const el = document.getElementById('infra-insights');
  if (!el) return;
  if (!platforms.length) {
    el.innerHTML = '<p class="text-muted">No specific infrastructure detected from response headers.</p>';
    return;
  }
  el.innerHTML = `
    <h4>Infrastructure Detected</h4>
    <div class="tag-list">${platforms.map(p => `<span class="platform-tag">☁️ ${escapeHtml(p)}</span>`).join('')}</div>
  `;
}

// ─── Section / navigation helpers ────────────────────────────────────────────

function showSection(id) {
  const section = document.getElementById(id + '-section');
  if (section) section.style.display = 'block';
}

function scrollTo(id) {
  const el = document.getElementById(id + '-section') || document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i];
}

function truncateUrl(url, maxLen = 80) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    if (path.length > maxLen) return '…' + path.slice(-maxLen);
    return path;
  } catch (_) {
    return url.length > maxLen ? '…' + url.slice(-maxLen) : url;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusClass(status) {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return 'other';
}

function severityIcon(severity) {
  const icons = { critical: '🔴', high: '🟠', warning: '🟡', info: '🔵' };
  return icons[severity] || '⚪';
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Exposed for HTML event handlers ─────────────────────────────────────────

export const UI = {
  init,
  prevPage() {
    if (state.requestPage > 1) {
      state.requestPage--;
      renderRequestTable(state.filteredEntries);
    }
  },
  nextPage() {
    const totalPages = Math.ceil(state.filteredEntries.length / state.requestPageSize);
    if (state.requestPage < totalPages) {
      state.requestPage++;
      renderRequestTable(state.filteredEntries);
    }
  },
  scrollTo
};

window.UI = UI;
