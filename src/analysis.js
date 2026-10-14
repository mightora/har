/** Parse HAR locally. Raw headers, bodies, cookies, credentials, query strings are not returned. */
const safeNum=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
const clean=v=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,100);
export function safeURL(value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))return '[non-web URL]';
 const path=u.pathname.split('/').filter(Boolean).slice(0,5).map(segment=>{
  let s;try{s=decodeURIComponent(segment)}catch{return '[redacted]'}
  if(s.length>30||/@|[?&#=]|\d{4,}|token|password|secret|auth|session|key|credential|email|signature|user|account|id/i.test(s))return '[redacted]';
  return clean(s.replace(/[^a-z0-9._-]/gi,'_'));
 });return u.origin+'/'+path.join('/')+(u.pathname.split('/').filter(Boolean).length>5?'/…':'');
 }catch{return '[invalid URL]'}
}
export function analyseHAR(har){
 if(!har||!Array.isArray(har.log?.entries))throw Error('Invalid HAR: expected log.entries array.');
 if(har.log.entries.length>20000)throw Error('Maximum 20,000 entries.');
 const entries=[],map=new Map(),statuses={},methods={},issues=[];
 har.log.entries.forEach((item,i)=>{
 if(!item||typeof item!=='object')return;
 const req=item.request||{},res=item.response||{},t=item.timings||{};
 const url=safeURL(req.url),status=Number.isInteger(res.status)?res.status:0;
 let host='[invalid]';try{const u=new URL(req.url);if(['http:','https:'].includes(u.protocol))host=clean(u.hostname)}catch{}
 const elapsed=safeNum(item.time),bytes=safeNum(res.bodySize)||safeNum(res.content?.size),wait=safeNum(t.wait);
 const method=/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(req.method)?req.method.toUpperCase():'OTHER';
 const e={id:i+1,url,host,status,method,elapsed,bytes,wait,dns:safeNum(t.dns),connect:safeNum(t.connect),ssl:safeNum(t.ssl)};
 entries.push(e);let h=map.get(host);if(!h){h={host,count:0,bytes:0,totalMs:0,errors:0};map.set(host,h)}
 h.count++;h.bytes+=bytes;h.totalMs+=elapsed;if(status>=400||!status)h.errors++;
 const bucket=status?Math.floor(status/100)+'xx':'unknown';statuses[bucket]=(statuses[bucket]||0)+1;methods[method]=(methods[method]||0)+1;
 if(status>=500)issues.push({request:i+1,severity:'high',reason:'Server error ('+status+')'});
 else if(status>=400||!status)issues.push({request:i+1,severity:'medium',reason:'HTTP error ('+status+')'});
 if(elapsed>3000)issues.push({request:i+1,severity:'medium',reason:'Slow request (>3 seconds)'});
 if(wait>1000)issues.push({request:i+1,severity:'medium',reason:'Long server wait (>1 second)'});
 if(bytes>1000000)issues.push({request:i+1,severity:'low',reason:'Large response (>1 MB)'});
 });
 entries.sort((a,b)=>b.elapsed-a.elapsed);
 const sorted=entries.map(e=>e.elapsed).sort((a,b)=>a-b),total=entries.reduce((n,e)=>n+e.elapsed,0);
 const hosts=[...map.values()].sort((a,b)=>b.totalMs-a.totalMs);
 return {summary:{requests:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0),avgMs:entries.length?Math.round(total/entries.length):0,p95Ms:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:0,errors:entries.filter(e=>e.status>=400||!e.status).length,hosts:hosts.length},entries,hosts,statuses,methods,issues:issues.slice(0,1000),issueCount:issues.length,meta:{privacy:'Sanitised. May contain identifying hostnames and URL paths.',generatedAt:new Date().toISOString()}};
}