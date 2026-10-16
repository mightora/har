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
