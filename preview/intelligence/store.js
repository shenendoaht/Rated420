(() => {
  'use strict';
  const snapshot=window.Rated420OfficialSnapshot;
  const key='rated420-intelligence-v1';
  const columns=['sourceId','locationId','category','licenseStatus','issued','expires','name','dba','city','county','region'];
  const dataFields=['sourceId','locationId','category','licenseStatus','issued','expires','name','dba','city','county','region'];
  const read=()=>JSON.parse(localStorage.getItem(key)||'{"batches":[],"settings":{}}');
  const fold=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
  const identity=(ref,location)=>JSON.stringify([fold(ref),fold(location)]);
  const official=snapshot.rows.map((values,i)=>{
    const row=Object.fromEntries(columns.map((field,j)=>[field,values[j]]));
    return {...row,id:'ocm-'+encodeURIComponent(row.sourceId)+'~'+encodeURIComponent(row.locationId??''),source:'ocm',verified:true,version:snapshot.version,sourceIndex:i};
  });
  const officialExact=new Set(official.map(row=>identity(row.sourceId,row.locationId)));
  const officialIds=new Set(official.map(row=>fold(row.sourceId)));
  const byName=new Set(official.flatMap(row=>[row.name,row.dba]).filter(Boolean).map(fold));
  const standardRegions={
    'western ny':'west','finger lakes':'finger','central ny':'central','north country':'north',
    'capital district':'capital','capital region':'capital','mid-hudson':'hudson',
    bronx:'metro',brooklyn:'metro',manhattan:'metro',queens:'metro',richmond:'metro',nyc:'metro','long island':'metro'
  };
  function marketRegion(region){return standardRegions[fold(region)]??'';}
  function records(state=read()){
    const local=new Map();
    for(const batch of state.batches){
      if(batch.revertedAt)continue;
      for(const row of batch.records)local.set(row.id,row);
    }
    return [...local.values()];
  }
  function parseCSV(input){
    const rows=[];let row=[],field='',state='start';
    const finish=()=>{row.push(field);field='';state='start';};
    const line=()=>{finish();if(row.some(v=>v.trim()))rows.push(row);row=[];};
    for(let i=0;i<input.length;i++){
      const c=input[i];
      if(state==='quote'){
        if(c==='"'&&input[i+1]==='"'){field+='"';i++;}
        else if(c==='"')state='end';
        else field+=c;
      }else if(c===',')finish();
      else if(c==='\r'||c==='\n'){if(c==='\r'&&input[i+1]==='\n')i++;line();}
      else if(c==='"'&&state==='start')state='quote';
      else if(c==='"'||state==='end')throw Error('Malformed CSV quote near character '+(i+1)+'.');
      else {field+=c;state='text';}
    }
    if(state==='quote')throw Error('CSV has an unclosed quoted field.');
    if(row.length||field||state==='end')line();
    const header=rows.shift()?.map(v=>v.trim())??[];
    if(!header.length||header.some(v=>!v)||new Set(header).size!==header.length)throw Error('CSV needs distinct, nonempty headers.');
    return rows.map((values,i)=>{
      if(values.length!==header.length)return {__error:'Expected '+header.length+' columns, received '+values.length+'.',__line:i+2};
      return Object.fromEntries(header.map((name,j)=>[name,values[j]]));
    });
  }
  function parse(input,format){
    if(input.length>500000)throw Error('Use an input under 500 KB.');
    const text=input.replace(/^\uFEFF/,'').trim();
    const parsed=format==='json'?JSON.parse(text):parseCSV(text);
    if(!Array.isArray(parsed)||!parsed.length||parsed.length>500)throw Error('Use 1–500 rows as a CSV or JSON object array.');
    return parsed.map((row,i)=>row&&typeof row==='object'&&!Array.isArray(row)?row:{__error:'Expected an object.',__line:i+1});
  }
  function normalize(raw,mapping){
    if(raw.__error)return {error:raw.__error,line:raw.__line};
    const row={};
    for(const field of dataFields){
      const mapped=mapping[field];
      const value=mapped&&Object.hasOwn(raw,mapped)?raw[mapped]:null;
      if(value!=null&&typeof value!=='string'&&typeof value!=='number')return {error:field+' must be text or a number.'};
      row[field]=value==null?'':String(value).normalize('NFKC').trim().replace(/\s+/g,' ');
      if(row[field].length>180)return {error:field+' is too long.'};
    }
    if(!row.name||!row.sourceId||!row.category)return {error:'Business, source identifier and classification are required.'};
    if(Object.values(row).some(text=>/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:sb[_]secret[_]|github_pat_|-----BEGIN )[\w -]*/i.test(text)))
      return {error:'Remove contact information or credentials before importing.'};
    for(const field of ['issued','expires']){
      if(!row[field])continue;
      const date=row[field].slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return {error:'Invalid '+field+' date.'};
      row[field]=date;
    }
    return {row};
  }
  function preview(input,format,mapping,source='manual'){
    if(source==='ocm'||!window.Rated420DataSources.some(row=>row.id===source))throw Error('Select a local source.');
    const existing=records();
    const exact=new Set(existing.map(row=>row.id));
    const names=new Set([...byName,...existing.map(row=>fold(row.name))]);
    const seen=new Set();
    return parse(input,format).map((raw,i)=>{
      const result=normalize(raw,mapping);
      const base={line:result.line??i+1,...result};
      if(!result.row)return base;
      const rowIdentity=identity(result.row.sourceId,result.row.locationId);
      const row={...result.row,id:source+':'+rowIdentity,source,verified:false,kind:source==='manual'?'Unverified local import':'Synthetic demonstration'};
      const duplicate=seen.has(row.id)?'In this file':(officialExact.has(rowIdentity)||(!row.locationId&&officialIds.has(fold(row.sourceId))))?'Official identity':exact.has(row.id)?'Existing local identity':names.has(fold(row.name))?'Possible name match':'';
      seen.add(row.id);
      return {...base,row,duplicate};
    });
  }
  function session(guard){
    return {
      async commit({input,format,mapping,source,choices,label,expected}){
        await guard();
        const rows=preview(input,format,mapping,source);
        if(JSON.stringify(rows)!==expected)throw Error('Records changed since preview. Preview the input again before committing.');
        const committed=rows.filter((row,i)=>row.row&&(!row.duplicate||row.duplicate==='Existing local identity'&&choices[i]==='supersede'||row.duplicate==='Possible name match'&&choices[i]==='distinct'));
        if(!committed.length)throw Error('No eligible records. Correct errors or resolve matching rows.');
        const state=read(),at=new Date().toISOString(),id=crypto.randomUUID();
        state.batches.push({id,label,source,at,actor:window.RatedComplete?.actor()??'',received:rows.length,rejected:rows.filter(r=>r.error).length,
          skipped:rows.length-committed.length,records:committed.map(({row})=>({...row,batch:id,at})),decisions:committed.map(row=>({line:row.line,recordId:row.row.id,decision:row.duplicate||'New record'}))});
        localStorage.setItem(key,JSON.stringify(state));
        return committed.length;
      },
      async revert(id){
        await guard();const state=read();
        const batch=state.batches.find(item=>item.id===id&&!item.revertedAt);
        if(!batch)throw Error('Import was already reverted or is missing.');
        batch.revertedAt=new Date().toISOString();batch.revertedBy=window.RatedComplete?.actor()??'';
        localStorage.setItem(key,JSON.stringify(state));
      },
      async check(source){
        await guard();
        if(!window.Rated420DataSources.some(item=>item.id===source))throw Error('Unknown source.');
        const state=read();
        const outcome=source==='ocm'?'Bundled snapshot available. No live synchronization attempted.':source==='manual'?'Local file ingestion available. No live connection configured.':'No live connection or approved credentials configured.';
        state.settings[source]={...state.settings[source],checkedAt:new Date().toISOString(),outcome};
        localStorage.setItem(key,JSON.stringify(state));
        return outcome;
      },
      async settings(source,mode,interval){
        await guard();
        if(!window.Rated420DataSources.some(item=>item.id===source)||!['Manual','Scheduled proposal'].includes(mode)||!['Daily','Weekly','Monthly'].includes(interval))throw Error('Invalid synchronization settings.');
        const state=read();state.settings[source]={...state.settings[source],mode,interval};
        localStorage.setItem(key,JSON.stringify(state));
      }
    };
  }
  function summary(rows){
    const count=(field)=>Object.entries(rows.reduce((acc,row)=>{const k=row[field]||'Not reported';acc[k]=(acc[k]||0)+1;return acc;},Object.create(null))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const byYear=rows.filter(row=>row.issued).map(row=>({...row,year:row.issued.slice(0,4)}));
    const issued=Object.entries(byYear.reduce((acc,row)=>{acc[row.year]=(acc[row.year]||0)+1;return acc;},Object.create(null))).sort();
    return {rows:rows.length,licenses:new Set(rows.map(row=>row.sourceId)).size,verified:rows.filter(row=>row.verified).length,
      geo:rows.filter(row=>row.city||row.county||row.region).length,dated:byYear.length,active:rows.filter(row=>row.licenseStatus==='Active').length,classes:count('category'),issued};
  }
  window.Rated420Intelligence={snapshot,official,records,read,parse,preview,session,summary,fold,marketRegion,dataFields,
    record:id=>official.find(row=>row.id===id),recordUrl:row=>'https://data.ny.gov/resource/jskf-tt3q.json?license_number='+encodeURIComponent(row.sourceId)+(row.locationId?'&location_id='+encodeURIComponent(row.locationId):'')};
})();
