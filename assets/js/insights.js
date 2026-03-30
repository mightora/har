/**
 * insights.js
 * Renders charts and visual summaries using lightweight canvas-based charts.
 * No external chart libraries — pure JS.
 */

export const Insights = {

  COLORS: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
    pink: '#ec4899',
    teal: '#14b8a6',
    orange: '#f97316',
    grey: '#6b7280',
    primary: '#6366f1'
  },

  STATUS_COLORS: {
    '2xx': '#22c55e',
    '3xx': '#f59e0b',
    '4xx': '#f97316',
    '5xx': '#ef4444',
    '1xx': '#3b82f6',
    'other': '#6b7280'
  },

  RESOURCE_COLORS: {
    document: '#6366f1',
    script: '#f59e0b',
    stylesheet: '#3b82f6',
    image: '#22c55e',
    font: '#8b5cf6',
    data: '#14b8a6',
    media: '#ec4899',
    wasm: '#f97316',
    other: '#6b7280'
  },

  /**
   * Draw a donut/pie chart on a canvas element.
   */
  drawDonut(canvas, data, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = opts.size || 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outer = (size / 2) - 10;
    const inner = outer * 0.55;

    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) {
      ctx.fillStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
      ctx.fill();
      return;
    }

    let startAngle = -Math.PI / 2;
    data.forEach(d => {
      const slice = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outer, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      startAngle += slice;
    });

    // Hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = opts.bgColor || getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff';
    ctx.fill();

    // Center label
    if (opts.centerLabel) {
      ctx.fillStyle = opts.textColor || '#111827';
      ctx.font = `bold ${Math.round(size * 0.12)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.centerLabel, cx, cy);
    }
  },

  /**
   * Draw a horizontal bar chart.
   */
  drawBars(canvas, data, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement ? canvas.parentElement.clientWidth || 400 : 400;
    const rowHeight = opts.rowHeight || 32;
    const height = data.length * rowHeight + 20;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const labelWidth = opts.labelWidth || Math.min(180, width * 0.4);
    const barArea = width - labelWidth - 60;

    data.forEach((d, i) => {
      const y = i * rowHeight + 10;
      const barWidth = (d.value / maxVal) * barArea;

      // Label
      ctx.fillStyle = opts.textColor || '#374151';
      ctx.font = `13px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = d.label.length > 28 ? '…' + d.label.slice(-26) : d.label;
      ctx.fillText(label, labelWidth - 8, y + rowHeight / 2);

      // Bar bg
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.roundRect(labelWidth, y + 4, barArea, rowHeight - 8, 4);
      ctx.fill();

      // Bar fill
      if (barWidth > 0) {
        ctx.fillStyle = d.color || opts.color || '#6366f1';
        ctx.beginPath();
        ctx.roundRect(labelWidth, y + 4, barWidth, rowHeight - 8, 4);
        ctx.fill();
      }

      // Value
      ctx.fillStyle = opts.textColor || '#374151';
      ctx.textAlign = 'left';
      ctx.fillText(d.valueLabel || d.value, labelWidth + barArea + 6, y + rowHeight / 2);
    });
  },

  /**
   * Render status code donut chart.
   */
  renderStatusChart(canvasId, statusData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const groups = statusData.groups;
    const data = Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: k, value: v, color: this.STATUS_COLORS[k] || '#6b7280' }));
    const total = data.reduce((s, d) => s + d.value, 0);
    this.drawDonut(canvas, data, { size: 180, centerLabel: String(total) });
    this.renderLegend(canvasId + '-legend', data);
  },

  /**
   * Render domain bar chart.
   */
  renderDomainChart(canvasId, domainData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const top = domainData.slice(0, 8);
    const data = top.map((d, i) => ({
      label: d.domain,
      value: d.count,
      color: Object.values(this.COLORS)[i % Object.values(this.COLORS).length]
    }));
    this.drawBars(canvas, data, { rowHeight: 36 });
  },

  /**
   * Render resource type donut.
   */
  renderResourceChart(canvasId, resourceData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const data = resourceData.map(r => ({
      label: r.type,
      value: r.count,
      color: this.RESOURCE_COLORS[r.type] || '#6b7280'
    }));
    const total = data.reduce((s, d) => s + d.value, 0);
    this.drawDonut(canvas, data, { size: 180, centerLabel: String(total) });
    this.renderLegend(canvasId + '-legend', data);
  },

  /**
   * Render duration distribution bars.
   */
  renderDurationChart(canvasId, buckets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const colors = [this.COLORS.success, this.COLORS.info, this.COLORS.warning, this.COLORS.orange, this.COLORS.error];
    const data = buckets.map((b, i) => ({
      label: b.label,
      value: b.count,
      color: colors[i] || this.COLORS.grey
    }));
    this.drawBars(canvas, data, { rowHeight: 36, labelWidth: 100 });
  },

  /**
   * Render top slowest endpoints.
   */
  renderSlowestChart(canvasId, slowest) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const data = slowest.slice(0, 8).map(e => ({
      label: e.url.split('?')[0].split('/').slice(-2).join('/') || e.domain,
      value: Math.round(e.totalTime),
      valueLabel: Math.round(e.totalTime) + 'ms',
      color: e.totalTime > 3000 ? this.COLORS.error : e.totalTime > 1000 ? this.COLORS.warning : this.COLORS.info
    }));
    this.drawBars(canvas, data, { rowHeight: 36 });
  },

  renderLegend(elementId, data) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = data.map(d =>
      `<span class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${d.label} (${d.value})</span>`
    ).join('');
  }
};
