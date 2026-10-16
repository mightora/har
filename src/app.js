/* Online analyser: HAR parsed in a dedicated local Web Worker. */
let worker=null;
const file=document.getElementById('file'),status=document.getElementById('status-text');
function clear(){
 if(worker){worker.terminate();worker=null;}
 window.MightoraWorkbench?.clear();
 file.value='';
 status.textContent='No HAR data loaded.';
}
document.getElementById('clear').addEventListener('click',clear);
file.addEventListener('change',()=>{
 const picked=file.files?.[0];if(!picked)return;
 analyseFile(picked);
});
function analyseFile(picked){
 if(worker){worker.terminate();worker=null;}
 window.MightoraWorkbench?.clear();
 if(!/\.har$/i.test(picked.name)){status.textContent='Select a .har file.';return;}
 if(picked.size>50*1024*1024){status.textContent='Maximum file size is 50 MiB.';return;}
 status.textContent='Building detailed report locally…';
 try{
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   worker?.terminate();worker=null;
   if(!data.ok){status.textContent='Could not analyse HAR: '+data.error;return;}
   window.MightoraWorkbench.show(data.report);
   status.textContent='Detailed analysis complete. Raw HAR data has not been uploaded.';
  };
  worker.onerror=()=>{worker?.terminate();worker=null;status.textContent='Worker error while reading HAR. Try another file.';};
  worker.postMessage({file:picked});
 }catch(e){status.textContent='Unable to start local analyser: '+String(e.message||e);}
}
/* Local synthetic example: no download, upload or real-world data involved. */
function sampleHAR(){
 const types=['application/json','text/html','text/css','image/png','application/javascript'];
 const entries=Array.from({length:34},(_,i)=>{
  const host=i%5===0?'https://cdn.example.test':'https://api.example.test';
  const slow=i%11===0,err=i%13===0,duration=slow?3900+i*30:80+(i*71)%1300;
  const wait=Math.floor(duration*(slow?.68:.43));
  return {startedDateTime:new Date(Date.UTC(2026,9,15,8,0,0)+i*280).toISOString(),
   time:duration,request:{url:host+'/samples/resource-'+(i%7)+(i%4?'':'?demo=true'),method:i%8===0?'POST':'GET',httpVersion:'HTTP/2'},
   response:{status:err?(i%2?404:503):i%9===0?302:200,httpVersion:'HTTP/2',bodySize:i%8===0?1800000:1400+i*18000,
    content:{mimeType:types[i%types.length],size:1800+i*18000}},
   timings:{blocked:5,dns:i%5===0?120:0,connect:i%5===0?50:0,ssl:-1,send:9,wait,receive:Math.max(0,duration-wait-64)}};
 });
 return {log:{version:'1.2',creator:{name:'Mightora Demo',version:'1.0'},browser:{name:'Chrome',version:'120.0'},entries}};
}
const demo=document.createElement('button');demo.type='button';demo.className='secondary';demo.textContent='Try a sample HAR';
demo.title='Explore graphs, waterfall timings and JSON views using entirely synthetic data';
document.getElementById('clear').after(demo);
demo.addEventListener('click',()=>{
 const content=JSON.stringify(sampleHAR());
 const generated=new File([content],'mightora-demo.har',{type:'application/json'});
 // Browser FileList is not assignable; run the same analysis flow using an explicit file.
 analyseFile(generated);
});
