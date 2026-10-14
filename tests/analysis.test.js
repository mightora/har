import {test} from 'node:test';import assert from 'node:assert/strict';import {analyseHAR,safeURL} from '../src/analysis.js';
const sample={log:{entries:[{request:{url:'https://example.com/api/items?token=hidden',method:'GET',headers:[{name:'Authorization',value:'SECRET'}]},response:{status:500,bodySize:1200,content:{text:'PRIVATE'}},time:3200,timings:{wait:1200}}]}};
test('analyses network failures',()=>{const r=analyseHAR(sample);assert.equal(r.summary.requests,1);assert.equal(r.summary.errors,1);assert.equal(r.summary.p95Ms,3200)});
test('does not expose raw credentials or response bodies',()=>{const s=JSON.stringify(analyseHAR(sample));for(const secret of ['hidden','SECRET','PRIVATE','Authorization','token='])assert.equal(s.includes(secret),false)});
test('removes query and fragment',()=>assert.equal(safeURL('https://example.com/path?secret=hello#fragment'),'https://example.com/path'));
test('redacts identifiable URL segments',()=>assert.match(safeURL('https://example.com/profile/12345678'),/redacted/));
test('rejects malformed input',()=>assert.throws(()=>analyseHAR({}),/Invalid HAR/));
test('handles empty archive',()=>assert.equal(analyseHAR({log:{entries:[]}}).summary.requests,0));
test('rejects excessive requests',()=>assert.throws(()=>analyseHAR({log:{entries:Array(20001).fill({})}}),/20,000/));