import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyseHAR,safeURL} from '../src/analysis.js';

const make=(extra={})=>({
 request:{url:'https://api.example.test/v1/items?access_token=TOPSECRET',method:'GET',headers:[{name:'Authorization',value:'Bearer PRIVATE_HEADER'}],cookies:[{name:'session',value:'PRIVATE_COOKIE'}]},
 response:{status:200,bodySize:500,content:{mimeType:'application/json',text:'PRIVATE_RESPONSE'}},
 startedDateTime:'2026-10-16T07:00:00.000Z',time:120,timings:{blocked:5,dns:10,connect:20,send:10,wait:50,receive:25},
 ...extra
});
const har={log:{browser:{name:'Chrome',version:'123.1'},pages:[],entries:[
 make(),make({time:3500,startedDateTime:'2026-10-16T07:00:00.120Z',response:{status:500,bodySize:2000000,content:{mimeType:'image/png',text:'BODY_SECRET'}},timings:{blocked:-1,dns:320,connect:600,send:10,wait:2000,receive:570}}),
 make({time:900,startedDateTime:'2026-10-16T07:00:03.000Z',request:{url:'https://another.example.test/download/123456789?password=HIDDEN',method:'POST',postData:{text:'REQUEST_SECRET'}},response:{status:404,bodySize:-1,content:{mimeType:'text/html',size:10000,text:'RESPONSE_SECRET'}},timings:{wait:400,receive:100}}),
]}};
test('detailed percentiles, hosts and capture span are calculated',()=>{
 const x=analyseHAR(har);
 assert.equal(x.summary.requests,3);
 assert.equal(x.summary.errors,2);
 assert.equal(x.summary.hosts,2);
 assert.equal(x.summary.medianMs,900);
 assert.equal(x.summary.p95Ms,3500);
 assert.equal(x.summary.p99Ms,3500);
 assert.equal(x.summary.captureSpanMs,3900);
 assert.equal(x.summary.slowRequests,1);
 assert.equal(x.hosts.length,2);
 assert.equal(x.mimes.length,3);
 assert.equal(x.histogram.reduce((a,b)=>a+b.count,0),3);
});
test('detailed request retains useful but safe timing, MIME, flags and offset',()=>{
 const x=analyseHAR(har),e=x.entries.find(i=>i.id===2);
 assert.equal(e.offsetMs,120);
 assert.equal(e.status,500);
 assert.equal(e.mime,'Images');
 assert.equal(e.timings.dns,320);
 assert.equal(e.timings.blocked,null);
 assert.equal(e.bytes,2000000);
 assert.equal(e.serverWaitMs,2000);
 assert.ok(x.issues.some(i=>i.rule==='slow-dns'));
 assert.ok(x.issues.some(i=>i.rule==='slow-connect'));
 assert.ok(x.issues.some(i=>i.rule==='large-response'));
});
test('all nested JSON data remains free of raw secrets',()=>{
 const output=JSON.stringify(analyseHAR(har));
 for(const secret of ['TOPSECRET','PRIVATE_HEADER','PRIVATE_COOKIE','PRIVATE_RESPONSE','BODY_SECRET','REQUEST_SECRET','RESPONSE_SECRET','HIDDEN','access_token=','password=']){
  assert.equal(output.includes(secret),false,secret);
 }
 assert.match(output,/example\.test/);
});
test('invalid and empty HAR gracefully handled',()=>{
 assert.throws(()=>analyseHAR(null),/Invalid HAR/);
 assert.throws(()=>analyseHAR({log:{entries:{}}}),/Invalid HAR/);
 assert.throws(()=>analyseHAR({log:{entries:Array(20001).fill({})}}),/20,000/);
 const report=analyseHAR({log:{entries:[]}});
 assert.equal(report.summary.requests,0);assert.equal(report.summary.captureSpanMs,null);
});
test('sanitised URL removes query values, user details and invalid protocols',()=>{
 assert.equal(safeURL('https://user:password@example.com/private/123456789?token=secret#fragment'),'https://example.com/private/[redacted]');
 assert.equal(safeURL('file:///Users/someone/data'),'[non-web URL]');
});

test('page milestones are distinct from request timings and omit page titles',()=>{
 const capture={log:{pages:[{id:'internal-session-SECRET',title:'TOP SECRET URL',startedDateTime:'2026-10-16T07:00:00Z',pageTimings:{onContentLoad:750,onLoad:2200}}],entries:[{...make(),pageref:'internal-session-SECRET'}]}};
 const result=analyseHAR(capture);
 assert.equal(result.pageTimings[0].domContentLoadedMs,750);
 assert.equal(result.pageTimings[0].loadMs,2200);
 assert.equal(result.pageTimings[0].requests,1);
 const output=JSON.stringify(result);
 assert.equal(output.includes('internal-session-SECRET'),false);
 assert.equal(output.includes('TOP SECRET URL'),false);
});
test('waterfall does not turn missing negative timings into fake zero values',()=>{
 const capture={log:{entries:[make({timings:{blocked:-1,dns:-1,ssl:-1,wait:80,receive:20},time:100})]}};
 const result=analyseHAR(capture);
 assert.equal(result.entries[0].timings.blocked,null);
 assert.equal(result.entries[0].timings.dns,null);
 assert.equal(result.entries[0].timings.wait,80);
});

test('HTTP header evidence reports safe indicators and never captured header values',()=>{
 const capture={log:{entries:[make({
  request:{url:'https://example.com/ok',method:'GET',headers:[{name:'Authorization',value:'Bearer VERY_PRIVATE'}]},
  response:{status:200,headers:[
   {name:'Content-Encoding',value:'gzip'},
   {name:'Cache-Control',value:'private, max-age=3600 SECRET_CACHE'},
   {name:'Strict-Transport-Security',value:'max-age=31536000'},
   {name:'Content-Security-Policy',value:"default-src 'self'"},
   {name:'Access-Control-Allow-Origin',value:'https://INTERNAL_PRIVATE.example'}
  ],bodySize:100}
 })]}};
 const result=analyseHAR(capture),flags=result.entries[0].headerSignals;
 assert.equal(flags.compression,'gzip');
 assert.equal(flags.hasCacheControl,true);
 assert.equal(flags.hasStrictTransportSecurity,true);
 assert.equal(flags.hasContentSecurityPolicy,true);
 assert.equal(flags.hasAccessControlAllowOrigin,true);
 const raw=JSON.stringify(result);
 for(const secret of ['VERY_PRIVATE','SECRET_CACHE','INTERNAL_PRIVATE','31536000'])assert.equal(raw.includes(secret),false);
});
