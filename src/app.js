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
});