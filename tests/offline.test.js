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
});
