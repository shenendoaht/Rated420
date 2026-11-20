(() => {
  'use strict';
  const fixtures = window.RatedExpansionFixtures;
  const key = (area, actor) => 'rated420-expansion-v1:'+area+(actor ? ':'+encodeURIComponent(actor) : '');
  const read = (area, actor) => JSON.parse(localStorage.getItem(key(area,actor)) ?? JSON.stringify(area==='public' ? [] : fixtures[area]));
  const write = (area,actor,rows) => localStorage.setItem(key(area,actor),JSON.stringify(rows));
  const total = scores => scores.reduce((sum,n)=>sum+n,0);
  function project(rows, from, to) {
    return rows.flatMap(row=>{
      if (row.type==='Budget') return [];
      const occurrences = row.date>=from && row.date<=to ? [{...row,forecast:false}] : [];
      if (row.repeat!=='Monthly') return occurrences;
      const cursor = new Date((row.date.slice(0,7))+'-01T00:00:00Z');
      cursor.setUTCMonth(cursor.getUTCMonth()+1);
      const horizon = to.slice(0,7);
      while (cursor.toISOString().slice(0,7)<=horizon) {
        const month=cursor.toISOString().slice(0,7);
        const last=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0)).getUTCDate();
        const date=month+'-'+String(Math.min(last,Number(row.date.slice(-2)))).padStart(2,'0');
        if(date>=from&&date<=to)occurrences.push({...row,date,status:'Planned',forecast:true});
        cursor.setUTCMonth(cursor.getUTCMonth()+1);
      }
      return occurrences;
    });
  }
  function session(area, guard, actor='') {
    const access = async () => {
      await guard();
      if (area==='stash'&&!actor) throw Error('Sign in to access your journal.');
    };
    return {
      async list(){await access();return read(area,actor);},
      async save(fields,id){
        await access();
        const rows=read(area,actor);
        const index=rows.findIndex(row=>row.id===id);
        if (id&&index<0) throw Error('This record is no longer available.');
        const row={...fields,id:id||crypto.randomUUID()};
        if(area==='finance'&&(!Number.isSafeInteger(row.cents)||row.cents<=0)) throw Error('Enter a positive amount.');
        if(index===-1)rows.unshift(row);else rows[index]={...rows[index],...row};
        write(area,actor,rows);
      },
      async remove(id){await access();write(area,actor,read(area,actor).filter(row=>row.id!==id));},
      async reset(){await access();localStorage.removeItem(key(area,actor));},
      async publish(preview, publicText){
        await access();
        if(area!=='stash')throw Error('Journal access required.');
        const row=read('stash',actor).find(record=>record.id===preview.id);
        if(!row||row.status!=='Tried'||row.scores.length!==5||row.scores.some(n=>!Number.isInteger(n)||n<0||n>84))throw Error('A tried product with five valid scores is required.');
        if(row.product!==preview.product||row.format!==preview.format||row.scores.some((score,i)=>score!==preview.scores[i]))throw Error('This entry changed. Open a fresh preview before publishing.');
        const publicId=actor+':'+row.id;
        const reviews=read('public');
        const existing=reviews.find(record=>record.id===publicId);
        const payload={product:row.product,format:row.format,scores:[...row.scores],total:total(row.scores),text:publicText.trim(),id:publicId};
        write('public','',[payload,...reviews.filter(record=>record!==existing)]);
      }
    };
  }
  window.RatedExpansionStore={session,project,total,publicReviews:()=>read('public').map(({id,...review})=>review)};
})();
