/* Network transparency is intentionally passive: no fetch, beacon, tracking or HAR inspection. */
(function(){
  'use strict';
  const total=document.getElementById('audit-total');
  const external=document.getElementById('audit-external');
  const destinations=document.getElementById('audit-destinations');
  const mode=document.getElementById('audit-mode');
  const updated=document.getElementById('audit-updated');
  const refresh=document.getElementById('refresh-network');
  if(!total||!external||!destinations||!refresh)return;
  const offline=!!document.querySelector('[data-edition="offline"]');
  function snapshot(){
    let resources=[];
    try{resources=performance.getEntriesByType('resource')||[];}catch(e){}
    const hosts=new Map(); let outside=0, local=0;
    for(const item of resources){
      let url;try{url=new URL(item.name,location.href);}catch{continue;}
      if(!['http:','https:'].includes(url.protocol)){local++;continue;}
      const isExternal=url.origin!==location.origin;
      if(isExternal) outside++;
      const label=(isExternal?'External: ':'Same origin: ')+url.origin;
      hosts.set(label,(hosts.get(label)||0)+1);
    }
    total.textContent=String(resources.length);
    external.textContent=String(outside);
    destinations.replaceChildren();
    if(!hosts.size){
      const li=document.createElement('li');
      li.textContent='No HTTP(S) resource destinations were reported to this page.';
      destinations.append(li);
    }else{
      for(const [label,count] of [...hosts].sort((a,b)=>b[1]-a[1])){
        const li=document.createElement('li');
        li.textContent=label+' — '+count+' resource '+(count===1?'entry':'entries');
        destinations.append(li);
      }
    }
    if(offline){
      mode.textContent=location.protocol==='file:'
        ? 'Opened from your device (file://). No initial HTTP document download was needed. '+local+' local/blob resource entries observed.'
        : 'Opened using '+location.protocol+' (the initial HTML document may have been downloaded). Save and open the file from disk for fully offline use.';
    }else{
      mode.textContent='Website edition: loading this page and shared Mightora assets requires a connection. HAR processing itself stays in your browser.';
    }
    updated.textContent='Snapshot updated just now.';
  }
  refresh.addEventListener('click',snapshot);
  if(document.readyState==='complete') snapshot();
  else window.addEventListener('load',snapshot,{once:true});
})();