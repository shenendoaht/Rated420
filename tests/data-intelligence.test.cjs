const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
  const stored=new Map();
  const scope=vm.createContext({window:{},crypto:require('node:crypto').webcrypto,localStorage:{
    getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)
  }});
  for(const name of ['official-data.js','sources.js','store.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../preview/intelligence',name),'utf8'),scope);
  }
  return scope.window.Rated420Intelligence;
}
const mapping={name:'name',sourceId:'id',category:'category',issued:'issued'};
test('official projection has unique location identities and reported counts',()=>{
  const data=setup();
  const summary=data.summary(data.official);
  assert.equal(summary.rows,2673);
  assert.equal(summary.licenses,2287);
  assert.equal(summary.active,2397);
  assert.equal(new Set(data.official.map(row=>row.id)).size,2673);
  assert(!Object.hasOwn(data.official[0],'primary_contact_name'));
});
test('CSV quoting, invalid dates and official collisions',()=>{
  const data=setup();
  assert.equal(data.parse('name,id\r\n"One, ""Two""\nThree",1','csv')[0].name,'One, "Two"\nThree');
  assert.throws(()=>data.parse('name,id\n"Unclosed','csv'),/unclosed/);
  const rows=data.preview('[{"name":"One","id":"MM0106D","category":"Retail"},{"name":"Two","id":"X","category":"Retail","issued":"2026-02-31"}]','json',mapping);
  assert.equal(rows[0].duplicate,'Official identity');
  assert.match(rows[1].error,/Invalid issued date/);
});
test('commit rejects a stale preview and blocked roles; revert preserves audit',async()=>{
  const data=setup();
  const input='name,id,category\nFixture,LOCAL-1,Retail';
  const args={input,format:'csv',source:'manual',mapping,choices:{},label:'Sample batch'};
  args.expected=JSON.stringify(data.preview(input,args.format,mapping));
  await assert.rejects(data.session(async()=>{throw Error('Role denied');}).commit(args),/Role denied/);
  const session=data.session(async()=>{});
  assert.equal(await session.commit(args),1);
  await assert.rejects(session.commit(args),/changed since preview/);
  await session.revert(data.read().batches[0].id);
  assert.equal(data.records().length,0);
  assert.ok(data.read().batches[0].revertedAt);
});
