/**
 * HAR 1.2 diagnostics. Intentionally returns ONLY minimised, sanitised data.
 * Never retain headers, cookies, request/response bodies, or original URLs.
 */
const nonNegative = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
const elapsedPart = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const trim = (v,n=90) => String(v ?? '').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);
const quantile = (sorted,p) => sorted.length ? sorted[Math.max(0,Math.ceil(p*sorted.length)-1)] : 0;
const mimeGroup = value => {
 const m=String(value||'').toLowerCase();
 if(m.includes('json'))return 'JSON / API';
 if(m.startsWith('image/'))return 'Images';
 if(m.includes('javascript'))return 'JavaScript';
 if(m.includes('css'))return 'CSS';
 if(m.includes('html'))return 'HTML';
 if(m.includes('font')||m.includes('woff'))return 'Fonts';
 if(m.includes('video')||m.includes('audio'))return 'Media';
 if(m.includes('xml'))return 'XML';
 if(m.includes('text/'))return 'Text';
 return 'Other / unknown';
};
const byteSize = e => {
 const r=e.response||{};
 const transfer=elapsedPart(r._transferSize)??elapsedPart(r.transferSize);
 const body=elapsedPart(r.bodySize);
 const content=elapsedPart(r.content?.size);
 return {transferBytes:transfer,bodyBytes:body,contentBytes:content,
  bytes:transfer??body??content??0,
  sizeBasis:transfer!==null?'Recorded transfer':body!==null?'Response body':'Content (may be decoded)'};
};
export function safeURL(value){
 try{
  const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol))return '[non-web URL]';
  const pieces=u.pathname.split('/').filter(Boolean);
  const parts=pieces.slice(0,6).map(s=>{
   let raw;try{raw=decodeURIComponent(s);}catch{return '[redacted]';}
   if(raw.length>34||/@|[?&#=:]|\d{4,}|token|password|secret|auth|session|key|credential|email|signature|user|account|identifier|contact|bearer|address/i.test(raw))return '[redacted]';
   return trim(raw.replace(/[^a-z0-9._-]/gi,'_'),34);
  });
  return u.origin+'/'+parts.join('/')+(pieces.length>6?'/…':'');
 }catch{return '[invalid URL]';}
}
function safeHost(value){
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?trim(u.hostname,160):'[invalid]';}
 catch{return '[invalid]';}
}
function statusGroup(n){if(!n)return 'Unknown';if(n>=100&&n<600)return Math.floor(n/100)+'xx';return 'Other';}
const period=v=>{const ms=Date.parse(v);return Number.isFinite(ms)?ms:null;};
const sum=(items,key)=>items.reduce((a,x)=>a+nonNegative(x[key]),0);
function grouped(items,key){
 const map=new Map();
 for(const x of items){
  const name=x[key]||'Other / unknown';
  const item=map.get(name)||{name,requests:0,errors:0,bytes:0,totalMs:0,maxMs:0};
  item.requests++;item.errors+=x.status>=400||!x.status?1:0;item.bytes+=x.bytes;item.totalMs+=x.elapsed;item.maxMs=Math.max(item.maxMs,x.elapsed);map.set(name,item);
 }
 return [...map.values()].map(x=>({...x,avgMs:x.requests?x.totalMs/x.requests:0})).sort((a,b)=>b.bytes-a.bytes);
}
function breakdown(items,key){const map={};for(const x of items)map[x[key]||'Unknown']=(map[x[key]||'Unknown']||0)+1;return Object.entries(map).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);}

function headerSignals(request,response){
 const req=Array.isArray(request.headers)?request.headers:[];
 const res=Array.isArray(response.headers)?response.headers:[];
 const has=(key)=>res.some(h=>String(h?.name||'').toLowerCase()===key);
 const encoding=res.find(h=>String(h?.name||'').toLowerCase()==='content-encoding')?.value;
 const e=String(encoding||'').toLowerCase().trim();
 const compression=['br','gzip','deflate','zstd','identity'].includes(e)?e:'Not recorded / unknown';
 return {
  requestHeaderCount:req.length,responseHeaderCount:res.length,
  compression,
  hasContentSecurityPolicy:has('content-security-policy'),
  hasStrictTransportSecurity:has('strict-transport-security'),
  hasAccessControlAllowOrigin:has('access-control-allow-origin'),
  hasCacheControl:has('cache-control'),
  hasETag:has('etag'),
  hasLastModified:has('last-modified'),
  hasVary:has('vary'),
  hasContentEncoding:has('content-encoding')
 };
}

export function analyseHAR(har){
 if(!har||!Array.isArray(har.log?.entries))throw Error('Invalid HAR: expected log.entries array.');
 if(har.log.entries.length>20000)throw Error('Maximum 20,000 requests per file.');
 const originCandidates=har.log.entries.map(x=>period(x?.startedDateTime)).filter(x=>x!==null);
 const origin=originCandidates.length?Math.min(...originCandidates):null;
 const entries=[],issues=[];
 for(const [i,item] of har.log.entries.entries()){
  if(!item||typeof item!=='object')continue;
  const req=item.request||{},r=item.response||{},timings=item.timings||{};
  const size=byteSize(item);
  const status=Number.isInteger(r.status)&&r.status>=0&&r.status<=999?r.status:0;
  const raw=String(req.url||'');
  const method=/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS|TRACE)$/i.test(req.method)?req.method.toUpperCase():'OTHER';
  const timing={blocked:elapsedPart(timings.blocked),dns:elapsedPart(timings.dns),connect:elapsedPart(timings.connect),ssl:elapsedPart(timings.ssl),send:elapsedPart(timings.send),wait:elapsedPart(timings.wait),receive:elapsedPart(timings.receive)};
  const elapsed=nonNegative(item.time);
  const started=period(item.startedDateTime);
  const path=safeURL(raw);
  const e={
   id:i+1,url:path,host:safeHost(raw),method,status,
   statusGroup:statusGroup(status),
   protocol:trim(r.httpVersion||req.httpVersion||'unknown',32),
   headerSignals:headerSignals(req,r),
   mime:mimeGroup(r.content?.mimeType),elapsed,
   offsetMs:started!==null&&origin!==null?Math.max(0,started-origin):null,
   startTime:started!==null?new Date(started).toISOString():null,
   ...size,timings:timing,
   serverWaitMs:timing.wait, requestHeadersBytes:elapsedPart(req.headersSize),
   responseHeadersBytes:elapsedPart(r.headersSize),
   redirect:status>=300&&status<400,
   cacheHit:status===304,
   hasCacheMetadata:Boolean(item.cache?.beforeRequest||item.cache?.afterRequest),
   hasCookies:Array.isArray(req.cookies)&&req.cookies.length>0,
   hasQueryParams:Array.isArray(req.queryString)&&req.queryString.length>0,
   hasRequestBody:Boolean(req.postData),
   hasResponseBody:Boolean(r.content?.text),
   hasSetCookie:Array.isArray(r.cookies)&&r.cookies.length>0
  };
  // Avoid copying arbitrary free-text headers or request metadata.
  entries.push(e);
  const flag=(severity,rule,description,suggestion)=>issues.push({id:i+1,severity,rule,description,suggestion,url:e.url,host:e.host,elapsed:e.elapsed});
  if(status>=500)flag('high','server-error','Server returned HTTP '+status,'Check server logs and upstream dependencies for this request.');
  else if(status>=400)flag('medium','client-error','HTTP '+status+' response','Check authentication, URL routing, request validation and permissions.');
  else if(status===0)flag('medium','unknown-status','Response status is missing or zero','A HAR with no status may represent a cancelled or incomplete request.');
  if(elapsed>=3000)flag('medium','slow-request','Request took '+Math.round(elapsed)+' ms','Compare timing phases and investigate high wait or transfer duration.');
  if((timing.wait??0)>=1000)flag('medium','server-wait','Long response wait ('+Math.round(timing.wait)+' ms)','Investigate server processing and network latency to first byte.');
  if(e.bytes>=1048576)flag('low','large-response','Recorded response size exceeds 1 MiB','Check compression, payload size and whether all data is needed.');
  if((timing.dns??0)>=300)flag('low','slow-dns','DNS resolution exceeded 300 ms','Investigate resolver caching and network conditions.');
  if((timing.connect??0)>=500)flag('low','slow-connect','Connection phase exceeded 500 ms','Check connection reuse, network paths and TLS negotiation.');
 }
 const durations=entries.map(e=>e.elapsed).sort((a,b)=>a-b);
 const sums=sum(entries,'elapsed');
 const histogram=[0,100,300,1000,3000,10000,Infinity].slice(0,-1).map((min,i,all)=>{
  const max=[100,300,1000,3000,10000,Infinity][i];
  return {label:max===Infinity?'10s+':(min===0?'<100ms':min+'–'+max+'ms'),count:entries.filter(e=>e.elapsed>=min&&e.elapsed<max).length};
 });
 const hosts=grouped(entries,'host');
 const mimes=grouped(entries,'mime');
 const methods=breakdown(entries,'method');
 const statuses=breakdown(entries,'statusGroup');
 const responseCodes=breakdown(entries,'status');
 const latest=entries.reduce((m,e)=>Math.max(m,(e.offsetMs??0)+e.elapsed),0);
 const rawPages=Array.isArray(har.log.pages)?har.log.pages:[];
 const pageTimings=rawPages.slice(0,100).map((p,i)=>({
  page:i+1,
  domContentLoadedMs:elapsedPart(p?.pageTimings?.onContentLoad),
  loadMs:elapsedPart(p?.pageTimings?.onLoad),
  startTime:period(p?.startedDateTime)!==null?new Date(Date.parse(p.startedDateTime)).toISOString():null,
  requests:entries.filter(e=>har.log.entries[e.id-1]?.pageref===p?.id).length
 }));
 const summary={
  requests:entries.length,hosts:hosts.length,errors:entries.filter(e=>e.status>=400||!e.status).length,
  redirects:entries.filter(e=>e.redirect).length,
  transferredBytes:entries.reduce((n,e)=>n+e.bytes,0),
  sizeNote:'Bytes are best available per-request estimate: transfer size, HAR body size, or content size. These may not be comparable.',
  totalDurationMs:sums,
  captureSpanMs:origin!==null?latest:null,
  avgMs:entries.length?sums/entries.length:0,
  medianMs:quantile(durations,.5),p75Ms:quantile(durations,.75),p90Ms:quantile(durations,.9),
  p95Ms:quantile(durations,.95),p99Ms:quantile(durations,.99),
  maxMs:durations.at(-1)||0,slowRequests:entries.filter(e=>e.elapsed>=3000).length
 };
 return {
  summary,entries,hosts,mimes,methods,statuses,responseCodes,histogram,pageTimings,
  issues:issues.slice(0,3000),issueCount:issues.length,
  metadata:{format:'HAR 1.2',browser:/^(Chrome|Chromium|Firefox|Safari|Edge|Microsoft Edge)$/i.test(String(har.log.browser?.name||''))?String(har.log.browser.name):'Other / unknown',browserVersion:/^\d+(?:\.\d+){0,4}$/.test(String(har.log.browser?.version||''))?String(har.log.browser.version):'Unknown',
   pages:Array.isArray(har.log.pages)?har.log.pages.length:0,
   captureStart:origin!==null?new Date(origin).toISOString():null,
   privacy:'Sanitised output. Hostnames and some URL paths can still identify services or people. Review exports before sharing.',
   timingCaveat:'HAR phases can be missing (-1); connection/SSL can overlap. Sum of request durations is not page-load time.',
   generatedAt:new Date().toISOString()}
 };
}
