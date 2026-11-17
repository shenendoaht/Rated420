import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const projectRoot=fileURLToPath(new URL('..',import.meta.url));
// No production URLs or credentials are accepted by this isolated Docker harness.
function registerDatabaseTests() {
  const container=process.env.COMMUNITY_TEST_CONTAINER||'rated420-averages-pg';
  assert.equal(execFileSync('docker',['inspect','--format','{{.HostConfig.NetworkMode}}',container],{encoding:'utf8'}).trim(),'none');
  const db='community_test_'+Date.now();
  const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',db,'-At'],{input:q,encoding:'utf8'}).trim();
  const row=q=>JSON.parse(sql(`select row_to_json(t) from (${q}) t;`).split('\n').at(-1));
  const u1='11111111-1111-4111-8111-111111111111',u2='22222222-2222-4222-8222-222222222222';
  const asUser=(id,q)=>sql(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);${q}`);
  const strain=(user,brand,type,score)=>asUser(user,`insert into public.strain_reviews(strain_id,user_id,brand,product_type,aesthetic,aroma,flavor,effects,overall) values(1,'${user}','${brand}','${type}',${score},${score},${score},${score},${score});`);
  before(()=>{
    execFileSync('docker',['exec',container,'createdb','-U','postgres',db]);
    sql(`do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;end $$;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${u1}'),('${u2}');`);
    const historical=readFileSync(path.join(projectRoot,'supabase/migrations/20261116002045_create_strain_catalogue_reviews_and_photo_bucket.sql'),'utf8');
    sql(historical.split('insert into storage.buckets')[0]);
    const disp=readFileSync(path.join(projectRoot,'supabase/migrations/20261116004719_rated420_dispensary_and_avatars.sql'),'utf8');
    sql(disp.slice(disp.indexOf('create table public.dispensary_reviews'),disp.indexOf('insert into storage.buckets')));
    asUser(u1,"insert into public.dispensary_reviews(name,location,aesthetic,accessibility,staff,menu,overall,notes,photo_path) values('Fixture Shop','Test City',60,60,60,60,60,'Preserve legacy notes',null);");
    sql(readFileSync(path.join(projectRoot,'supabase/migrations/20261117191511_community_listing_averages.sql'),'utf8'));
  });
  test('zero reviews and legacy dispensary backfill preserve data',()=>{
    assert.equal(sql('select count(*) from public.strain_community_stats'),'0');
    assert.deepEqual(row('select name,location,notes,dispensary_id is not null as linked from public.dispensary_reviews'),{name:'Fixture Shop',location:'Test City',notes:'Preserve legacy notes',linked:true});
  });
  test('per-user contributions have equal weight and retain decimals',()=>{
    strain(u1,'Fixture Brand A','Flower',20);strain(u1,'Fixture Brand B','Pre-Roll',40);
    let r=row('select * from public.strain_community_stats where strain_id=1 and product_type is null');assert.equal(r.review_count,1);assert.equal(r.avg_total,150);
    strain(u2,'Fixture Brand C','Flower',81);
    r=row('select * from public.strain_community_stats where strain_id=1 and product_type is null');assert.equal(r.review_count,2);assert.equal(r.avg_total,277.5);assert.equal(r.avg_aesthetic,55.5);
    strain(u1,'Fixture Brand D','Flower',21);
    r=row('select * from public.strain_community_stats where strain_id=1 and product_type is null');assert.equal(r.review_count,2);assert.equal(r.avg_total,270);assert.equal(r.avg_aesthetic,54);
    const format=row("select * from public.strain_community_stats where strain_id=1 and product_type='Flower'");assert.equal(format.review_count,2);assert.equal(format.avg_aesthetic,50.75);
  });
  test('edit/delete recalculate, repeated tuple is rejected and ownership is enforced',()=>{
    asUser(u1,"update public.strain_reviews set aesthetic=30 where brand='Fixture Brand A';");
    assert.equal(row('select * from public.strain_community_stats where strain_id=1 and product_type is null').review_count,2);
    assert.throws(()=>strain(u1,'Fixture Brand A','Flower',84),/duplicate key/);
    asUser(u2,"update public.strain_reviews set aesthetic=0 where brand='Fixture Brand A';");
    assert.equal(sql("select aesthetic from public.strain_reviews where brand='Fixture Brand A'"),'30');
    asUser(u2,'delete from public.strain_reviews;');
    assert.equal(row('select * from public.strain_community_stats where strain_id=1 and product_type is null').review_count,1);
    asUser(u1,'delete from public.strain_reviews;');assert.equal(sql('select count(*) from public.strain_community_stats'),'0');
  });
  test('dispensary ID aggregation, duplicate protection and edit/delete',()=>{
    const id=sql('select id from public.dispensaries limit 1');
    asUser(u2,`insert into public.dispensary_reviews(dispensary_id,name,location,aesthetic,accessibility,staff,menu,overall) values(${id},'Fixture Shop','Test City',61,62,63,64,65);`);
    let r=row('select * from public.dispensary_community_stats');assert.equal(r.review_count,2);assert.equal(r.avg_total,307.5);assert.equal(r.avg_menu,62);
    assert.throws(()=>asUser(u2,`insert into public.dispensary_reviews(dispensary_id,name,location,aesthetic,accessibility,staff,menu,overall) values(${id},'Alternate Name','Elsewhere',84,84,84,84,84);`),/duplicate key/);
    asUser(u2,'update public.dispensary_reviews set menu=80;');assert.equal(row('select * from public.dispensary_community_stats').avg_menu,70);
    asUser(u2,'delete from public.dispensary_reviews;');r=row('select * from public.dispensary_community_stats');assert.equal(r.review_count,1);assert.equal(r.avg_total,300);
  });
  test('public stats match member stats; private IDs, helper role and writes remain protected',()=>{
    const anon=sql('set role anon;select row_to_json(s) from public.dispensary_community_stats s;').split('\n').at(-1);
    const member=asUser(u1,'select row_to_json(s) from public.dispensary_community_stats s;').split('\n').at(-1);assert.equal(anon,member);assert(!anon.includes('user_id'));
    assert.throws(()=>sql('set role anon;select user_id from public.dispensary_reviews;'),/permission denied/);
    assert.throws(()=>sql('set session authorization anon;set role rated420_community_reader;'),/permission denied/);
    assert.throws(()=>asUser(u1,'delete from public.dispensaries;'),/permission denied/);
    assert.throws(()=>asUser(u2,`insert into public.strain_reviews(strain_id,user_id,brand,product_type,aesthetic,aroma,flavor,effects,overall) values(1,'${u1}','Spoof Fixture','Flower',84,84,84,84,84);`),/row-level security/);
    assert.equal(sql("select bool_and(reloptions @> array['security_invoker=true']) from pg_class where relname in ('strain_community_stats','dispensary_community_stats')"),'t');
    assert.deepEqual(row("select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname='rated420_community_reader'"),{rolcanlogin:false,rolbypassrls:false,rolsuper:false});
  });
  after(()=>{execFileSync('docker',['exec',container,'dropdb','-U','postgres',db]);execFileSync('docker',['exec',container,'psql','-U','postgres','-c','drop role rated420_community_reader;']);});
}
registerDatabaseTests();
