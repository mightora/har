import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('home canonical and structured data use the custom domain',()=>{
 const html=read('index.html');
 assert.match(html,/<link rel="canonical" href="https:\/\/har\.mightora\.io\/">/);
 assert.match(html,/"@type":"FAQPage"/);
 assert.match(html,/"@type":"HowTo"/);
 assert.match(html,/downloads\/mightora-har-offline\.zip/);
});
test('sitemap includes useful HAR analysis guides',()=>{
 const xml=read('sitemap.xml');
 for(const file of ['how-to-analyse-har','har-performance-timings','offline-har-analysis','har-security-privacy']) {
  assert.ok(existsSync(new URL('../guides/'+file+'.html',import.meta.url)),file);
  assert.ok(xml.includes('https://har.mightora.io/guides/'+file+'.html'));
 }
 assert.match(read('robots.txt'),/Sitemap: https:\/\/har\.mightora\.io\/sitemap\.xml/);
});
test('standalone HTML includes local styles and scripts with no external asset loads',()=>{
 const html=read('downloads/har-analyser.html');
 assert.match(html,/<style>[\s\S]+<\/style>/);
 assert.match(html,/<script>[\s\S]+<\/script>/);
 assert.match(html,/src="data:image\/png;base64,/);
 assert.doesNotMatch(html,/<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["']https?:/i);
 assert.doesNotMatch(html,/\bimport\.meta\.url\b/);
 assert.match(html,/function createLocalWorker\(\)/);
 assert.match(html,/document\.getElementById\(id\)/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'inline script exists');
 assert.doesNotThrow(()=>new Script(script),'inline JavaScript syntax is valid');
});
test('offline ZIP is valid and embeds the exact standalone HTML',()=>{
 const buf=readFileSync(new URL('../downloads/mightora-har-offline.zip',import.meta.url));
 assert.equal(buf.readUInt32LE(0),0x04034b50);
 const count=3;
 let off=0;const entries={};
 for(let i=0;i<count;i++){
  assert.equal(buf.readUInt32LE(off),0x04034b50);
  const len=buf.readUInt32LE(off+18),nlen=buf.readUInt16LE(off+26),extra=buf.readUInt16LE(off+28);
  const name=buf.toString('utf8',off+30,off+30+nlen);
  const start=off+30+nlen+extra;
  entries[name]=buf.toString('utf8',start,start+len);
  off=start+len;
 }
 assert.equal(entries['har-analyser.html'],read('downloads/har-analyser.html'));
 assert.match(entries['README.txt'],/No application install or network is required/);
 assert.match(entries['LICENSE.txt'],/MIT License/);
 const eocd=buf.length-22;
 assert.equal(buf.readUInt32LE(eocd),0x06054b50);
 assert.equal(buf.readUInt16LE(eocd+10),count);
 let cdOffset=buf.readUInt32LE(eocd+16);
 for(let i=0;i<count;i++){
  assert.equal(buf.readUInt32LE(cdOffset),0x02014b50);
  const localOffset=buf.readUInt32LE(cdOffset+42);
  assert.equal(buf.readUInt32LE(localOffset),0x04034b50);
  cdOffset+=46+buf.readUInt16LE(cdOffset+28)+buf.readUInt16LE(cdOffset+30)+buf.readUInt16LE(cdOffset+32);
 }
 assert.equal(cdOffset,eocd);
});

test('both editions explain how to check network activity independently',()=>{
 for(const p of ['index.html','downloads/har-analyser.html']){
  const html=read(p);
  assert.match(html,/id="network-audit"/);
  assert.match(html,/id="refresh-network"/);
  assert.match(html,/(?:F12|Ctrl\+Shift\+I)/);
  assert.match(html,/Preserve log/);
  assert.match(html,/Resource Timing/);
  assert.match(html,/not (?:every|a security certification)/i);
 }
 assert.match(read('src/network-audit.js'),/getEntriesByType\('resource'\)/);
});
test('offline version prominently identifies local mode and enforces restrictive CSP',()=>{
 const html=read('downloads/har-analyser.html');
 assert.match(html,/OFFLINE EDITION · SELF-CONTAINED · NO CONNECTION REQUIRED/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/default-src 'none'/);
 assert.match(html,/worker-src blob:/);
 assert.match(html,/\[data-edition="offline"\]/);
});
