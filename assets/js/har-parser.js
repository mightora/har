/**
 * har-parser.js
 * Responsible for loading, validating, and parsing HAR files.
 * All processing is done locally in the browser — no data is ever uploaded.
 */

export const HarParser = {

  /**
   * Parse a File object into a HAR data structure.
   * Returns a Promise that resolves with the parsed HAR object or rejects with an error.
   */
  parseFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('No file provided.'));
      }

      const allowedTypes = ['application/json', 'application/har+json', ''];
      const allowedExtension = /\.har$/i;

      if (!allowedExtension.test(file.name) && !allowedTypes.includes(file.type)) {
        return reject(new Error('Invalid file type. Please upload a .har file.'));
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const raw = e.target.result;
          const json = JSON.parse(raw);
          const validated = HarParser.validate(json);
          resolve(validated);
        } catch (err) {
          if (err instanceof SyntaxError) {
            reject(new Error('The file does not appear to be valid JSON. Please check the file and try again.'));
          } else {
            reject(err);
          }
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read the file. Please try again.'));
      };

      reader.readAsText(file);
    });
  },

  /**
   * Validate the parsed JSON as a HAR structure.
   * Returns the validated HAR or throws an error.
   */
  validate(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid HAR: root must be an object.');
    }
    if (!json.log) {
      throw new Error('Invalid HAR: missing "log" property.');
    }
    if (!Array.isArray(json.log.entries)) {
      throw new Error('Invalid HAR: "log.entries" must be an array.');
    }
    return json;
  },

  /**
   * Extract a clean, normalised list of entries from a HAR.
   */
  extractEntries(har) {
    return (har.log.entries || []).map((entry, index) => {
      const request = entry.request || {};
      const response = entry.response || {};
      const timings = entry.timings || {};
      const url = request.url || '';
      let domain = '';
      try {
        domain = new URL(url).hostname;
      } catch (_) {
        domain = url.split('/')[0] || 'unknown';
      }

      const totalTime = typeof entry.time === 'number' ? entry.time :
        Object.values(timings).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);

      const responseSize = HarParser.getResponseSize(response);
      const requestSize = HarParser.getRequestSize(request);

      return {
        index,
        url,
        domain,
        method: (request.method || 'GET').toUpperCase(),
        status: response.status || 0,
        statusText: response.statusText || '',
        mimeType: (response.content && response.content.mimeType) || '',
        resourceType: HarParser.getResourceType((response.content && response.content.mimeType) || ''),
        totalTime,
        timings,
        responseSize,
        requestSize,
        totalSize: responseSize + requestSize,
        requestHeaders: request.headers || [],
        responseHeaders: response.headers || [],
        queryString: request.queryString || [],
        cookies: request.cookies || [],
        responseCookies: response.cookies || [],
        startedDateTime: entry.startedDateTime || '',
        redirectURL: response.redirectURL || '',
        raw: entry
      };
    });
  },

  getResponseSize(response) {
    if (response.bodySize && response.bodySize > 0) return response.bodySize;
    if (response.content && response.content.size && response.content.size > 0) return response.content.size;
    if (response._transferSize && response._transferSize > 0) return response._transferSize;
    return 0;
  },

  getRequestSize(request) {
    if (request.bodySize && request.bodySize > 0) return request.bodySize;
    if (request.headersSize && request.headersSize > 0) return request.headersSize;
    return 0;
  },

  getResourceType(mimeType) {
    if (!mimeType) return 'other';
    const m = mimeType.toLowerCase();
    if (m.includes('html')) return 'document';
    if (m.includes('javascript') || m.includes('js')) return 'script';
    if (m.includes('css')) return 'stylesheet';
    if (m.includes('image') || m.includes('png') || m.includes('jpg') || m.includes('gif') || m.includes('svg') || m.includes('webp') || m.includes('ico')) return 'image';
    if (m.includes('font') || m.includes('woff') || m.includes('ttf')) return 'font';
    if (m.includes('json') || m.includes('xml') || m.includes('text/plain')) return 'data';
    if (m.includes('video') || m.includes('audio')) return 'media';
    if (m.includes('wasm')) return 'wasm';
    return 'other';
  }
};
