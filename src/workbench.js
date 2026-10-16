/* Detailed Mightora HAR workbench. Sanitised reports only, no network calls. */
(function(){
'use strict';
let report=null,selected=null,page=0;const perPage=70;
const $=id=>document.getElementById(id);
const num=x=>Number(x||0).toLocaleString('en-GB',{maximumFractionDigits:1});
const ms=x=>num(x)+' ms';
const bytes=x=>x>=1048576?(x/1048576).toFixed(2)+' MiB':x>=1024?(x/1024).toFixed(1)+' KiB':num(x)+' B';
const cols=['#2563eb','#0f9488','#df9a36','#b35ed0','#df6673','#607ea0','#46a676'];
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el};
const add=(host,tag,text,cls)=>{const el=node(tag,text,cls);host.append(el);return el};
const download=(file,content,type)=>{const u=URL.createObjectURL(new Blob([content],{type}));const a=node('a');a.href=u;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const json=value=>JSON.stringify(value,null,2);
function layout(){
 const root=$('results');if(!root)return;
 root.innerHTML=[
 '<div class="heading-row"><div><div class="eyebrow">Technical diagnostics</div><h2>Detailed HAR workbench</h2></div><div class="wb-actions"><button id="wb-export">Download sanitised JSON</button><button id="wb-csv" class="secondary">Export CSV</button></div></div>',
 '<p class="wb-hint">Private analysis · Only sanitised information is displayed. Hostnames and some paths may identify services; review all exports before sharing.</p>',
 '<div class="wb-tabs" role="tablist" aria-label="Analysis views"><button data-view="overview" role="tab">Overview &amp; graphs</button><button data-view="waterfall" role="tab">Waterfall</button><button data-view="requests" role="tab">Request explorer</button><button data-view="issues" role="tab">Diagnostics</button><button data-view="json" role="tab">JSON viewer</button></div>',
 '<section id="wb-overview" class="wb-view" role="tabpanel"><div id="wb-metrics" class="wb-metrics"></div><div class="wb-chart-grid"><section class="panel"><h3>HTTP status distribution</h3><div id="wb-status"></div></section><section class="panel"><h3>Request duration buckets</h3><div id="wb-duration"></div></section><section class="panel"><h3>Hosts by transferred bytes</h3><div id="wb-hosts"></div></section><section class="panel"><h3>Response content types</h3><div id="wb-mimes"></div></section><section class="panel"><h3>HTTP methods</h3><div id="wb-methods"></div></section><section class="panel"><h3>Request latency percentiles</h3><div id="wb-percentiles"></div></section></div><p class="wb-hint">Response sizes are estimates from available HAR fields. Summed request durations are not page-load time.</p></section>',
 '<section id="wb-waterfall" class="wb-view" role="tabpanel" hidden><section class="panel"><h3>Network activity timeline</h3><p>Each point represents a request start. Red or amber points indicate failed responses; violet denotes slow requests.</p><div id="wb-timeline" class="wb-timeline"></div></section><section class="panel"><div class="heading-row"><h3>Request waterfall</h3><label>Order <select id="wb-water-sort"><option value="start">Start time</option><option value="slow">Slowest first</option></select></label></div><p>Timing phases do not always sum to the recorded duration. TLS can overlap with the connection phase; unreported time is grey.</p><div id="wb-water-legend" class="wb-legend"></div><div id="wb-water-rows"></div></section></section>',
 '<section id="wb-requests" class="wb-view" role="tabpanel" hidden><section class="panel"><h3>Request explorer</h3><div class="wb-controls"><label>Search <input type="search" id="wb-search" placeholder="URL, host, method, status"></label><label>Status <select id="wb-status-filter"><option value="">All</option><option value="error">Errors</option><option value="slow">Slow ≥3s</option><option value="2xx">2xx</option><option value="3xx">3xx</option></select></label><label>Host <select id="wb-host-filter"><option value="">All hosts</option></select></label><label>Content type <select id="wb-mime-filter"><option value="">All types</option></select></label><label>Sort <select id="wb-sort"><option value="elapsed">Duration</option><option value="bytes">Response size</option><option value="offsetMs">Start</option><option value="status">Status</option><option value="host">Host</option></select></label><label>Direction <select id="wb-dir"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></div><p id="wb-count"></p><div class="table-scroll"><table class="wb-table"><thead><tr><th>Sanitised URL</th><th>Method</th><th>Status</th><th>Type</th><th>Duration</th><th>Size</th><th>Wait</th></tr></thead><tbody id="wb-request-body"></tbody></table></div><div class="wb-pager"><button class="secondary" id="wb-prev">Previous</button><span id="wb-page"></span><button class="secondary" id="wb-next">Next</button></div></section></section>',
 '<section id="wb-issues" class="wb-view" role="tabpanel" hidden><section class="panel"><div class="heading-row"><h3>Diagnostic findings and recommendations</h3><label>Severity <select id="wb-severity"><option value="">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div><p>These rules identify possible issues, not confirmed root causes. Correlate with server and application telemetry.</p><p id="wb-issue-count"></p><div id="wb-issue-list"></div></section></section>',
 '<section id="wb-json" class="wb-view" role="tabpanel" hidden><section class="panel"><h3>Privacy-safe JSON explorer</h3><p>Switch between expandable JSON tree and formatted JSON. View report metadata, host aggregations, findings and a selected request. Original headers, query strings, cookies and bodies are never exposed.</p><div class="wb-controls"><label>Data <select id="wb-json-kind"><option value="summary">Summary and capture metadata</option><option value="selected">Selected request</option><option value="hosts">Hosts and content types</option><option value="issues">Issues</option><option value="requests">Filtered requests (current page)</option></select></label><label>Display <select id="wb-json-mode"><option value="tree">Expandable tree</option><option value="formatted">Formatted JSON</option></select></label><label>Find <input type="search" id="wb-json-q" placeholder="Search JSON values"></label></div><div class="wb-actions"><button class="secondary" id="wb-copy">Copy displayed JSON</button><button class="secondary" id="wb-save">Download displayed JSON</button></div><div id="wb-json-content" class="wb-json-area"></div></section></section>',
 '<section class="panel wb-inspector" id="wb-inspector" hidden tabindex="-1"><div class="heading-row"><h3>Request details</h3><button class="secondary" id="wb-close">Close</button></div><div id="wb-inspector-body"></div></section>'
 ].join('');
 root.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
 $('wb-export').addEventListener('click',()=>report&&download('mightora-har-analysis.json',json(report),'application/json'));
 $('wb-csv').addEventListener('click',exportCSV);
 for(const id of ['wb-search','wb-status-filter','wb-host-filter','wb-mime-filter','wb-sort','wb-dir'])$(id).addEventListener(id==='wb-search'?'input':'change',()=>{page=0;requests();});
 $('wb-prev').addEventListener('click',()=>{page=Math.max(0,page-1);requests();});
 $('wb-next').addEventListener('click',()=>{page++;requests();});
 $('wb-severity').addEventListener('change',issues);
 $('wb-water-sort').addEventListener('change',waterfall);
 for(const id of ['wb-json-kind','wb-json-mode','wb-json-q'])$(id).addEventListener(id==='wb-json-q'?'input':'change',showJSON);
 $('wb-copy').addEventListener('click',()=>{const text=json(jsonData());if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).catch(()=>copyFallback(text));else copyFallback(text)});
 $('wb-save').addEventListener('click',()=>download('mightora-har-view.json',json(jsonData()),'application/json'));
 $('wb-close').addEventListener('click',()=>{$('wb-inspector').hidden=true});
}
function copyFallback(s){const t=node('textarea');t.value=s;document.body.append(t);t.select();document.execCommand('copy');t.remove();}
function switchView(view){
 for(const key of ['overview','waterfall','requests','issues','json'])$('wb-'+key).hidden=key!==view;
 document.querySelectorAll('.wb-tabs [data-view]').forEach(b=>{const active=b.dataset.view===view;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
 if(!report)return;
 if(view==='waterfall')waterfall();if(view==='requests')requests();if(view==='issues')issues();if(view==='json')showJSON();
}
function chart(id,data,key='count',format=num,limit=12){
 const root=$(id);root.replaceChildren();const rows=data.slice(0,limit),max=Math.max(1,...rows.map(x=>x[key]||0));
 if(!rows.length){add(root,'p','No data available');return;}
 rows.forEach((x,i)=>{const row=node('div',undefined,'wb-chart-row'),title=node('div',undefined,'wb-chart-label');
 add(title,'span',x.label||x.name);add(title,'strong',format(x[key]));row.append(title);
 const track=node('div',undefined,'wb-chart-track'),fill=node('div',undefined,'wb-chart-fill');
 fill.style.width=Math.min(100,100*(x[key]||0)/max)+'%';fill.style.background=cols[i%cols.length];track.append(fill);row.append(track);root.append(row)});
}
function kpi(label,value,note){const card=node('div',undefined,'wb-kpi');add(card,'small',label);add(card,'strong',value);if(note)add(card,'span',note);return card;}
function overview(){
 const s=report.summary,root=$('wb-metrics');root.replaceChildren();
 for(const [name,value,note] of [
 ['Requests',num(s.requests),'HTTP entries'],['Errors',num(s.errors),'4xx, 5xx or missing'],['Hosts',num(s.hosts),'Unique origins'],['Response size',bytes(s.transferredBytes),'Best available estimates'],
 ['Median',ms(s.medianMs),'P50'],['P90',ms(s.p90Ms),'90th percentile'],['P95',ms(s.p95Ms),'95th percentile'],['P99',ms(s.p99Ms),'99th percentile'],
 ['Slow',num(s.slowRequests),'≥3 seconds'],['Maximum',ms(s.maxMs),'Slowest entry'],['Capture span',s.captureSpanMs===null?'Unknown':ms(s.captureSpanMs),'Not equivalent to page load']
 ])root.append(kpi(name,value,note));
 chart('wb-status',report.statuses);chart('wb-duration',report.histogram);
 chart('wb-hosts',report.hosts,'bytes',bytes);chart('wb-mimes',report.mimes,'bytes',bytes);chart('wb-methods',report.methods);
 chart('wb-percentiles',[{label:'Median',count:s.medianMs},{label:'P75',count:s.p75Ms},{label:'P90',count:s.p90Ms},{label:'P95',count:s.p95Ms},{label:'P99',count:s.p99Ms},{label:'Max',count:s.maxMs}],'count',ms);
}
function filterRequests(){
 const q=$('wb-search').value.toLowerCase(),status=$('wb-status-filter').value,host=$('wb-host-filter').value,mime=$('wb-mime-filter').value;
 const data=report.entries.filter(e=>(!q||(e.url+' '+e.method+' '+e.host+' '+e.status).toLowerCase().includes(q))&&(!host||e.host===host)&&(!mime||e.mime===mime)&&(!status||(status==='error'?(e.status>=400||!e.status):status==='slow'?e.elapsed>=3000:e.statusGroup===status)));
 const key=$('wb-sort').value,dir=$('wb-dir').value==='asc'?1:-1;
 data.sort((a,b)=>{const x=a[key],y=b[key];return dir*(typeof x==='string'?x.localeCompare(y):((x??-1)-(y??-1)))});
 return data;
}
function requests(){
 if(!report)return;const rows=filterRequests();const count=Math.max(1,Math.ceil(rows.length/perPage));page=Math.max(0,Math.min(page,count-1));
 const root=$('wb-request-body');root.replaceChildren();
 for(const e of rows.slice(page*perPage,(page+1)*perPage)){
  const row=node('tr',undefined,'wb-clickable');row.tabIndex=0;row.title='Inspect request';
  for(const v of [e.url,e.method,e.status||'Unknown',e.mime,ms(e.elapsed),bytes(e.bytes),e.serverWaitMs===null?'n/a':ms(e.serverWaitMs)])add(row,'td',v);
  row.addEventListener('click',()=>inspect(e.id));row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect(e.id)}});root.append(row);
 }
 $('wb-count').textContent=num(rows.length)+' matches. Showing up to '+perPage+' requests per page.';
 $('wb-page').textContent='Page '+(page+1)+' of '+count;
 $('wb-prev').disabled=page===0;$('wb-next').disabled=page===count-1;
}
const phases=[['blocked','#9daac0'],['dns','#8965cc'],['connect','#3c839f'],['send','#ed9a45'],['wait','#dc566f'],['receive','#25a879']];
function svgPlot(){
 const root=$('wb-timeline');root.replaceChildren();
 const entries=report.entries.filter(x=>x.offsetMs!==null);
 if(!entries.length){add(root,'p','No usable start timestamps were supplied.');return;}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),max=Math.max(1,report.summary.captureSpanMs||0);
 svg.setAttribute('viewBox','0 0 960 235');svg.setAttribute('role','img');svg.setAttribute('aria-label','HAR request start times');
 for(let i=0;i<=5;i++){const x=38+i*180,l=document.createElementNS(ns,'line');for(const [key,v] of Object.entries({x1:x,y1:10,x2:x,y2:208,stroke:'#e5eaf2'}))l.setAttribute(key,v);svg.append(l);
 const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',228);t.setAttribute('text-anchor','middle');t.setAttribute('font-size',12);t.textContent=num(i*max/5000)+'s';svg.append(t);}
 const step=Math.max(1,Math.ceil(entries.length/800));
 for(let i=0;i<entries.length;i+=step){const e=entries[i],dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',38+900*e.offsetMs/max);dot.setAttribute('cy',18+(i%31)*5.9);dot.setAttribute('r',e.status>=400||!e.status?4:2.6);
 dot.setAttribute('fill',e.status>=500?'#cf354b':e.status>=400||!e.status?'#d69d37':e.elapsed>=3000?'#8958c9':'#2874ac');const title=document.createElementNS(ns,'title');title.textContent='#'+e.id+' '+e.host+' '+ms(e.elapsed);dot.append(title);svg.append(dot);}
 root.append(svg);add(root,'small','Showing '+num(Math.ceil(entries.length/step))+' of '+num(entries.length)+' start points.');
}
function waterfall(){
 if(!report)return;svgPlot();
 const root=$('wb-water-rows'),legend=$('wb-water-legend');root.replaceChildren();legend.replaceChildren();
 for(const [name,color] of [...phases,['Unspecified','#cbd5e1']]){const x=node('span'),dot=node('i');dot.style.background=color;x.append(dot,document.createTextNode(name));legend.append(x);}
 const rows=report.entries.filter(e=>e.offsetMs!==null).sort($('wb-water-sort').value==='slow'?(a,b)=>b.elapsed-a.elapsed:(a,b)=>a.offsetMs-b.offsetMs);
 const scale=Math.max(1,report.summary.captureSpanMs??report.summary.maxMs);
 for(const e of rows.slice(0,120)){
  const btn=node('button',undefined,'wb-water-item');btn.type='button';
  add(btn,'span','#'+e.id+' '+e.host,'wb-water-label');const track=node('div',undefined,'wb-water-track');
  const offset=node('span',undefined,'wb-water-offset');offset.style.width=Math.min(100,100*e.offsetMs/scale)+'%';track.append(offset);
  let used=0;
  for(const [key,color] of phases){const v=e.timings[key]??0;if(v<=0)continue;used+=v;const seg=node('span',undefined,'wb-water-phase');seg.style.background=color;seg.style.width=Math.max(.18,100*v/scale)+'%';seg.title=key+': '+ms(v);track.append(seg);}
  if(e.elapsed>used){const other=node('span',undefined,'wb-water-phase');other.style.background='#cbd5e1';other.style.width=Math.max(.18,100*(e.elapsed-used)/scale)+'%';track.append(other);}
  btn.append(track);add(btn,'strong',ms(e.elapsed));btn.addEventListener('click',()=>inspect(e.id));root.append(btn);
 }
 if(!rows.length)add(root,'p','No start times available for a waterfall.');
}
function issues(){
 if(!report)return;const choice=$('wb-severity').value,items=report.issues.filter(x=>!choice||x.severity===choice);
 $('wb-issue-count').textContent=num(report.issueCount)+' total findings; '+num(items.length)+' in this view.';
 const root=$('wb-issue-list');root.replaceChildren();
 for(const i of items.slice(0,250)){const row=node('div',undefined,'wb-finding');
 add(row,'span',i.severity.toUpperCase(),'wb-severity '+i.severity);
 const body=node('div');add(body,'strong',i.description);add(body,'p',i.suggestion);add(body,'small','#'+i.id+' · '+i.url);row.append(body);
 const btn=node('button','Inspect','secondary');btn.addEventListener('click',()=>inspect(i.id));row.append(btn);root.append(row);}
 if(!items.length)add(root,'p','No findings in this severity group.');
 if(items.length>250)add(root,'p','Additional findings are in the downloadable JSON report.');
}
function inspect(id){
 const e=report.entries.find(e=>e.id===id);if(!e)return;selected=e;
 const root=$('wb-inspector-body');root.replaceChildren();add(root,'p','#'+e.id+' · '+e.method+' '+e.url,'wb-request-url');
 const grid=node('div',undefined,'wb-metrics');
 for(const [k,v] of [['Host',e.host],['Status',e.status||'Unknown'],['Duration',ms(e.elapsed)],['Size',bytes(e.bytes)],['MIME category',e.mime],['Protocol',e.protocol],['Start',e.startTime||'Not recorded'],['Size basis',e.sizeBasis]])grid.append(kpi(k,v));
 root.append(grid);add(root,'h4','Timing breakdown');
 const timing=node('div',undefined,'wb-timing');
 for(const [name,value] of Object.entries(e.timings))timing.append(kpi(name,value===null?'n/a':ms(value)));root.append(timing);
 add(root,'h4','Privacy-safe request flags');
 const flags=node('div',undefined,'wb-flags');
 for(const [name,v] of [['Has cookies',e.hasCookies],['Has query string',e.hasQueryParams],['Request body present',e.hasRequestBody],['Response body present',e.hasResponseBody],['Response cookies',e.hasSetCookie],['Redirect',e.redirect],['Cache evidence',e.cacheHit]])add(flags,'span',name+': '+(v?'Yes':'No'));
 root.append(flags);const b=node('button','View sanitised JSON','secondary');b.addEventListener('click',()=>{$('wb-json-kind').value='selected';switchView('json');});root.append(b);
 $('wb-inspector').hidden=false;$('wb-inspector').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function jsonData(){
 let value;switch($('wb-json-kind').value){
 case 'selected':value=selected||{message:'Select a request from Request Explorer first.'};break;
 case 'hosts':value={hosts:report.hosts,contentTypes:report.mimes,methods:report.methods,statuses:report.statuses};break;
 case 'issues':value=report.issues;break;
 case 'requests':value=filterRequests().slice(page*perPage,(page+1)*perPage);break;
 default:value={summary:report.summary,metadata:report.metadata,responseCodes:report.responseCodes,histogram:report.histogram};
 }
 const q=$('wb-json-q').value.toLowerCase().trim();if(!q)return value;
 if(Array.isArray(value))return value.filter(v=>JSON.stringify(v).toLowerCase().includes(q));
 return Object.fromEntries(Object.entries(value).filter(([k,v])=>(k+' '+JSON.stringify(v)).toLowerCase().includes(q)));
}
function tree(value,depth=0){
 if(value===null||typeof value!=='object')return node('span',typeof value==='string'?JSON.stringify(value):String(value),'wb-json-leaf');
 const keys=Object.keys(value),details=node('details',undefined,'wb-json-tree');details.open=depth===0;add(details,'summary',(Array.isArray(value)?'Array ['+keys.length+']':'Object {'+keys.length+'}'));
 const inner=node('div',undefined,'wb-json-inner');
 for(const key of keys.slice(0,120)){const line=node('div',undefined,'wb-json-line');add(line,'span',key+': ','wb-json-key');line.append(depth>5&&value[key]&&typeof value[key]==='object'?node('span','[more nested data]'):tree(value[key],depth+1));inner.append(line);}
 if(keys.length>120)add(inner,'span','More fields are available in the downloaded JSON.');
 details.append(inner);return details;
}
function showJSON(){
 if(!report)return;const data=jsonData(),root=$('wb-json-content');root.replaceChildren();
 if($('wb-json-mode').value==='formatted')add(root,'pre',json(data),'wb-json-pre');
 else root.append(tree(data));
}
function exportCSV(){
 if(!report)return;const names=['id','host','url','method','status','mime','elapsed','bytes','serverWaitMs','startTime','sizeBasis'];
 const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const csv='\uFEFF'+names.join(',')+'\n'+report.entries.map(e=>names.map(k=>esc(e[k])).join(',')).join('\n');
 download('mightora-har-requests.csv',csv,'text/csv;charset=utf-8');
}
function init(newReport){
 if(!$('wb-overview'))layout();
 report=newReport;selected=null;page=0;
 for(const id of ['wb-search','wb-status-filter','wb-host-filter','wb-mime-filter','wb-json-q'])$(id).value='';
 for(const [id,values] of [['wb-host-filter',report.hosts.map(x=>x.name)],['wb-mime-filter',report.mimes.map(x=>x.name)]]){
 const box=$(id);while(box.options.length>1)box.remove(1);for(const v of values){const opt=node('option',v);opt.value=v;box.append(opt)}}
 $('wb-sort').value='elapsed';$('wb-dir').value='desc';
 overview();switchView('overview');$('wb-inspector').hidden=true;$('results').hidden=false;
}
window.MightoraWorkbench={show:init,clear(){report=null;selected=null;if($('results'))$('results').hidden=true}};
})();