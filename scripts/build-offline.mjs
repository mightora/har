/**
 * Rebuild the self-contained file:// edition from shared source.
 * Requires Node 22 and no external dependencies or network access.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const write=(p,c)=>writeFileSync(new URL('../'+p,import.meta.url),c);
const shell=read('downloads/har-analyser.html');
const analyser=read('src/analysis.js').replace(/\bexport\s+(?=(?:function|const|class)\b)/g,'');
const workbench=read('src/workbench.js');
const monitor=read('src/network-audit.js');
const main=read('src/app.js').replace("new Worker(new URL('./worker.js',import.meta.url),{type:'module'})",'createLocalWorker()');
const workerSource=analyser+[
 'self.onmessage=async ({data})=>{',
 'try{const f=data?.file;',
 "if(!(f instanceof Blob))throw Error('Select a valid HAR file.');",
 "if(f.size>50*1024*1024)throw Error('Maximum file size is 50 MiB.');",
 "const raw=await f.text();const report=analyseHAR(JSON.parse(raw.replace(/^\\uFEFF/,'')));",
 'self.postMessage({ok:true,report});',
 "}catch(error){self.postMessage({ok:false,error:String(error.message||error).slice(0,180)});}",
 '};'
].join('\n');
const bridge=[
 'function createLocalWorker(){',
 'try{const blob=new Blob([OFFLINE_WORKER_SOURCE],{type:"text/javascript"});',
 'const url=URL.createObjectURL(blob);const worker=new Worker(url);URL.revokeObjectURL(url);return worker;}',
 'catch(error){return {onmessage:null,onerror:null,terminate(){},',
 'postMessage({file}){Promise.resolve().then(async()=>{',
 "try{const raw=await file.text();const report=analyseHAR(JSON.parse(raw.replace(/^\\uFEFF/,'')));",
 'this.onmessage?.({data:{ok:true,report}});}',
 "catch(e){this.onmessage?.({data:{ok:false,error:String(e.message||e).slice(0,180)}});}",
 '});}};}}'
].join('\n');
const offlineCSS=[
 '.offline-top{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:15px 22px;background:#fff;border-bottom:1px solid #dce6f0}',
 '.offline-top img{width:min(190px,45vw);height:auto;max-height:46px;object-fit:contain}',
 '.offline-top span{font-weight:700;color:var(--har-primary)}',
 '.offline-nav{background:var(--har-primary);padding:10px 18px;display:flex;flex-wrap:wrap;gap:18px}',
 '.offline-nav a{color:#fff;font-weight:700}.offline-footer{text-align:center;padding:30px 20px;color:#43546f;border-top:1px solid #dce6f0}',
 '.offline-note{margin:20px 0;padding:15px 20px;background:#e7f4ed;border:1px solid #b9dbca;border-radius:12px}',
 '.offline-note strong{color:#12633b}.offline-badges{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}',
 '.offline-badges span{padding:5px 10px;border:1px solid #bccadd;border-radius:16px;font-size:.8rem;font-weight:700}',
 '.offline-footer p{margin:4px 0}'
].join('\n');
let out=shell;
out=out.replace(/<style>[\s\S]*?<\/style>/,'<style>'+read('src/styles.css')+'\n'+offlineCSS+'</style>');
const script='const OFFLINE_WORKER_SOURCE='+JSON.stringify(workerSource)+';\n'+analyser+'\n'+bridge+'\n'+workbench+'\n'+monitor+'\n'+main;
if(!out.includes('<script>'))throw Error('Missing offline script insertion point.');
out=out.replace(/<script>[\s\S]*?<\/script>/,'<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
if(!out.includes('window.MightoraWorkbench')||!out.includes('Offline edition'))throw Error('Offline build validation failed.');
if(/<script[^>]+src=|<link[^>]+href="https?:|<img[^>]+src="https?:/.test(out))throw Error('Offline build unexpectedly requires external resources.');
write('downloads/har-analyser.html',out);
console.log('Built self-contained HAR analyser ('+Buffer.byteLength(out)+' bytes)');
