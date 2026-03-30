/**
 * analyser.js
 * Core analysis logic — extracts metrics, security insights, JWTs, cookies, etc.
 * All processing is local. No data leaves the browser.
 */

export const Analyser = {

  /**
   * Build a full analysis object from an array of normalised entries.
   */
  analyse(entries) {
    return {
      summary: Analyser.buildSummary(entries),
      statusCodes: Analyser.groupByStatus(entries),
      domains: Analyser.groupByDomain(entries),
      resourceTypes: Analyser.groupByResourceType(entries),
      slowest: Analyser.getSlowest(entries, 10),
      largest: Analyser.getLargest(entries, 10),
      errors: Analyser.getErrors(entries),
      redirects: Analyser.getRedirects(entries),
      cookies: Analyser.extractAllCookies(entries),
      jwts: Analyser.detectJWTs(entries),
      authInsights: Analyser.detectAuthPatterns(entries),
      cacheInsights: Analyser.detectCacheHeaders(entries),
      durationBuckets: Analyser.buildDurationBuckets(entries),
      timeline: Analyser.buildTimeline(entries),
      thirdPartyDomains: Analyser.detectThirdPartyDomains(entries),
      infraInsights: Analyser.detectInfrastructure(entries)
    };
  },

  buildSummary(entries) {
    const totalRequests = entries.length;
    const uniqueDomains = new Set(entries.map(e => e.domain)).size;
    const totalSize = entries.reduce((s, e) => s + e.responseSize, 0);
    const failed = entries.filter(e => e.status >= 400).length;
    const redirects = entries.filter(e => e.status >= 300 && e.status < 400).length;
    const times = entries.map(e => e.totalTime).filter(t => t > 0);
    const avgTime = times.length ? times.reduce((s, t) => s + t, 0) / times.length : 0;
    const slowest = times.length ? Math.max(...times) : 0;
    const fastest = times.length ? Math.min(...times) : 0;

    return {
      totalRequests,
      uniqueDomains,
      totalSize,
      failed,
      redirects,
      avgTime: Math.round(avgTime),
      slowestTime: Math.round(slowest),
      fastestTime: Math.round(fastest)
    };
  },

  groupByStatus(entries) {
    const groups = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, 'other': 0 };
    const detail = {};
    entries.forEach(e => {
      const s = e.status;
      const code = String(s);
      if (s >= 100 && s < 200) groups['1xx']++;
      else if (s >= 200 && s < 300) groups['2xx']++;
      else if (s >= 300 && s < 400) groups['3xx']++;
      else if (s >= 400 && s < 500) groups['4xx']++;
      else if (s >= 500) groups['5xx']++;
      else groups['other']++;
      detail[code] = (detail[code] || 0) + 1;
    });
    return { groups, detail };
  },

  groupByDomain(entries) {
    const map = {};
    entries.forEach(e => {
      if (!map[e.domain]) map[e.domain] = { count: 0, size: 0, totalTime: 0 };
      map[e.domain].count++;
      map[e.domain].size += e.responseSize;
      map[e.domain].totalTime += e.totalTime;
    });
    return Object.entries(map)
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.count - a.count);
  },

  groupByResourceType(entries) {
    const map = {};
    entries.forEach(e => {
      const t = e.resourceType;
      if (!map[t]) map[t] = { count: 0, size: 0 };
      map[t].count++;
      map[t].size += e.responseSize;
    });
    return Object.entries(map)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count);
  },

  getSlowest(entries, n = 10) {
    return [...entries]
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, n);
  },

  getLargest(entries, n = 10) {
    return [...entries]
      .sort((a, b) => b.responseSize - a.responseSize)
      .slice(0, n);
  },

  getErrors(entries) {
    return entries.filter(e => e.status >= 400).sort((a, b) => b.status - a.status);
  },

  getRedirects(entries) {
    return entries.filter(e => e.status >= 300 && e.status < 400);
  },

  buildDurationBuckets(entries) {
    const buckets = [
      { label: '0–100ms', min: 0, max: 100, count: 0 },
      { label: '100–500ms', min: 100, max: 500, count: 0 },
      { label: '500ms–1s', min: 500, max: 1000, count: 0 },
      { label: '1s–3s', min: 1000, max: 3000, count: 0 },
      { label: '3s+', min: 3000, max: Infinity, count: 0 }
    ];
    entries.forEach(e => {
      const t = e.totalTime;
      const bucket = buckets.find(b => t >= b.min && t < b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  },

  buildTimeline(entries) {
    if (!entries.length) return [];
    const sorted = [...entries].sort((a, b) =>
      new Date(a.startedDateTime) - new Date(b.startedDateTime)
    );
    return sorted.slice(0, 100); // limit for perf
  },

  detectThirdPartyDomains(entries) {
    if (!entries.length) return { firstParty: [], thirdParty: [] };
    const domainCounts = {};
    entries.forEach(e => {
      domainCounts[e.domain] = (domainCounts[e.domain] || 0) + 1;
    });
    const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
    const primaryDomain = sorted[0] ? sorted[0][0] : '';
    const primaryBase = Analyser.getBaseDomain(primaryDomain);
    const firstParty = [];
    const thirdParty = [];
    sorted.forEach(([domain, count]) => {
      const base = Analyser.getBaseDomain(domain);
      if (base === primaryBase) {
        firstParty.push({ domain, count });
      } else {
        thirdParty.push({ domain, count });
      }
    });
    return { firstParty, thirdParty, primaryDomain };
  },

  getBaseDomain(hostname) {
    const parts = hostname.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
  },

  extractAllCookies(entries) {
    const cookieMap = {};
    entries.forEach(e => {
      const allCookies = [...(e.cookies || []), ...(e.responseCookies || [])];
      allCookies.forEach(c => {
        const key = `${e.domain}:${c.name}`;
        if (!cookieMap[key]) {
          cookieMap[key] = {
            name: c.name,
            value: c.value || '',
            domain: c.domain || e.domain,
            path: c.path || '/',
            expires: c.expires || null,
            httpOnly: !!c.httpOnly,
            secure: !!c.secure,
            sameSite: c.sameSite || '',
            issues: []
          };
          // Flag potential issues
          if (!c.secure) cookieMap[key].issues.push('Not Secure');
          if (!c.httpOnly) cookieMap[key].issues.push('Not HttpOnly');
          if (c.sameSite === 'None' && !c.secure) cookieMap[key].issues.push('SameSite=None without Secure');
          const looksLikeSession = /sess|token|auth|jwt|sid/i.test(c.name);
          if (looksLikeSession && !c.secure) cookieMap[key].issues.push('Possible session cookie without Secure flag');
        }
      });
    });
    return Object.values(cookieMap);
  },

  detectJWTs(entries) {
    const jwtRegex = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
    const found = [];
    const seen = new Set();

    entries.forEach(e => {
      const sources = [
        ...e.requestHeaders.map(h => ({ source: `Request Header: ${h.name}`, value: h.value })),
        ...e.responseHeaders.map(h => ({ source: `Response Header: ${h.name}`, value: h.value })),
        ...e.cookies.map(c => ({ source: `Cookie: ${c.name}`, value: c.value })),
        ...e.queryString.map(q => ({ source: `Query Param: ${q.name}`, value: q.value }))
      ];

      sources.forEach(({ source, value }) => {
        if (!value) return;
        const matches = String(value).match(jwtRegex);
        if (matches) {
          matches.forEach(token => {
            if (seen.has(token)) return;
            seen.add(token);
            const decoded = Analyser.decodeJWT(token);
            found.push({
              token,
              source,
              url: e.url,
              domain: e.domain,
              ...decoded
            });
          });
        }
      });
    });

    return found;
  },

  decodeJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return { valid: false, error: 'Not a valid JWT structure' };

      const decodeB64 = (str) => {
        const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - str.length % 4);
        return JSON.parse(atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad));
      };

      const header = decodeB64(parts[0]);
      const payload = decodeB64(parts[1]);

      const now = Math.floor(Date.now() / 1000);
      const expired = payload.exp && payload.exp < now;
      const expiry = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : null;
      const issuedAt = payload.iat ? new Date(payload.iat * 1000).toLocaleString() : null;

      const warnings = [];
      if (expired) warnings.push('Token has EXPIRED');
      if (header.alg === 'none') warnings.push('Algorithm is "none" — extremely insecure!');
      if (header.alg && header.alg.startsWith('HS')) warnings.push(`Uses symmetric algorithm (${header.alg}) — shared secret risk`);

      return {
        valid: true,
        header,
        payload,
        algorithm: header.alg || 'unknown',
        expired,
        expiry,
        issuedAt,
        subject: payload.sub || null,
        issuer: payload.iss || null,
        warnings
      };
    } catch (e) {
      return { valid: false, error: 'Failed to decode JWT: ' + e.message };
    }
  },

  detectAuthPatterns(entries) {
    const insights = [];
    entries.forEach(e => {
      e.requestHeaders.forEach(h => {
        const name = (h.name || '').toLowerCase();
        const val = h.value || '';

        if (name === 'authorization') {
          if (val.toLowerCase().startsWith('bearer ')) {
            insights.push({
              type: 'Bearer Token',
              severity: 'warning',
              url: e.url,
              domain: e.domain,
              detail: 'Bearer token in Authorization header',
              value: val.substring(0, 30) + '...'
            });
          } else if (val.toLowerCase().startsWith('basic ')) {
            insights.push({
              type: 'Basic Auth',
              severity: 'high',
              url: e.url,
              domain: e.domain,
              detail: 'Basic authentication credentials in header',
              value: '[redacted]'
            });
          } else {
            insights.push({
              type: 'Auth Header',
              severity: 'info',
              url: e.url,
              domain: e.domain,
              detail: 'Custom Authorization header',
              value: val.substring(0, 30) + '...'
            });
          }
        }

        // API key patterns
        if (/api[-_]?key|x-api-key|apikey/i.test(name)) {
          insights.push({
            type: 'API Key',
            severity: 'high',
            url: e.url,
            domain: e.domain,
            detail: `API key found in header: ${h.name}`,
            value: '[redacted]'
          });
        }
      });

      // API key in query params
      e.queryString.forEach(q => {
        if (/api[-_]?key|apikey|access_token|token|secret/i.test(q.name)) {
          insights.push({
            type: 'API Key in URL',
            severity: 'critical',
            url: e.url,
            domain: e.domain,
            detail: `Sensitive param in query string: ${q.name}`,
            value: '[redacted]'
          });
        }
      });
    });
    return insights;
  },

  detectCacheHeaders(entries) {
    let cacheHits = 0;
    let cacheMisses = 0;
    let noCache = 0;
    const cdnSignals = new Set();

    entries.forEach(e => {
      let hit = false;
      e.responseHeaders.forEach(h => {
        const name = (h.name || '').toLowerCase();
        const val = (h.value || '').toLowerCase();

        if (name === 'x-cache' || name === 'cf-cache-status' || name === 'x-cache-status') {
          if (val.includes('hit')) { cacheHits++; hit = true; }
          else if (val.includes('miss')) cacheMisses++;
        }
        if (name === 'cache-control' && (val.includes('no-cache') || val.includes('no-store'))) {
          noCache++;
        }
        // CDN detection
        if (name === 'cf-ray') cdnSignals.add('Cloudflare');
        if (name === 'x-amz-cf-id') cdnSignals.add('AWS CloudFront');
        if (name === 'x-fastly-request-id') cdnSignals.add('Fastly');
        if (name === 'x-cache' && val.includes('akamai')) cdnSignals.add('Akamai');
        if (name === 'server') {
          if (val.includes('cloudflare')) cdnSignals.add('Cloudflare');
          if (val.includes('nginx')) cdnSignals.add('Nginx');
          if (val.includes('apache')) cdnSignals.add('Apache');
          if (val.includes('iis')) cdnSignals.add('IIS');
          if (val.includes('vercel')) cdnSignals.add('Vercel');
          if (val.includes('netlify')) cdnSignals.add('Netlify');
        }
        if (name === 'x-powered-by') {
          if (val.includes('next')) cdnSignals.add('Next.js');
          if (val.includes('express')) cdnSignals.add('Express');
          if (/\basp\.net\b/i.test(val)) cdnSignals.add('ASP.NET');
        }
      });
    });

    return {
      cacheHits,
      cacheMisses,
      noCache,
      detectedPlatforms: [...cdnSignals]
    };
  },

  detectInfrastructure(entries) {
    const platforms = new Set();
    entries.forEach(e => {
      e.responseHeaders.forEach(h => {
        const name = (h.name || '').toLowerCase();
        const val = (h.value || '').toLowerCase();
        if (name === 'cf-ray') platforms.add('Cloudflare');
        if (name === 'x-amz-cf-id' || name === 'x-amz-request-id') platforms.add('AWS');
        if (name === 'x-goog-resource-id') platforms.add('Google Cloud');
        if (name === 'x-azure-ref') platforms.add('Azure');
        if (name === 'server') {
          if (val.includes('vercel')) platforms.add('Vercel');
          if (val.includes('netlify')) platforms.add('Netlify');
          if (val.includes('github')) platforms.add('GitHub Pages');
          if (val.includes('fastly')) platforms.add('Fastly');
          if (val.includes('cloudflare')) platforms.add('Cloudflare');
        }
      });
    });
    return [...platforms];
  }
};
