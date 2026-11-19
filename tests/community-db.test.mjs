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
  let legacyReview;
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
    sql(readFileSync(path.join(projectRoot,'supabase/migrations/20261115232821_create_member_profiles_foundation.sql'),'utf8'));
    sql(disp.split('insert into storage.buckets')[0]);
    asUser(u1,`insert into public.dispensary_reviews(name,location,aesthetic,accessibility,staff,menu,overall,notes,photo_path) values('Fixture Shop','Test City',60,60,60,60,60,'Preserve legacy notes','${u1}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg');`);
    legacyReview=row('select id,user_id,name,location,aesthetic,accessibility,staff,menu,overall,total,notes,photo_path,created_at from public.dispensary_reviews');
    const migration=readFileSync(path.join(projectRoot,'supabase/migrations/20261117191511_community_listing_averages.sql'),'utf8');
    sql('begin;\n'+migration+'\nrollback;');
    assert.equal(sql("select to_regclass('public.dispensaries') is null and not exists(select 1 from pg_roles where rolname='rated420_community_reader') and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dispensary_reviews' and column_name='dispensary_id')"),'t');
    assert.deepEqual(row('select id,user_id,name,location,aesthetic,accessibility,staff,menu,overall,total,notes,photo_path,created_at from public.dispensary_reviews'),legacyReview);
    sql('begin;\n'+migration+'\ncommit;');
    sql(readFileSync(path.join(projectRoot,'supabase/migrations/20261118120000_community_review_display.sql'),'utf8'));
  });
  test('Build 01 imports brands safely and isolates scores, favorites, and poll administration',()=>{
    const migration=readFileSync(path.join(projectRoot,'supabase/migrations/20261119170000_build01.sql'),'utf8');
    const seed=readFileSync(path.join(projectRoot,'preview/build01-seed.sql'),'utf8');
    const imports=readFileSync(path.join(projectRoot,'scripts/import-build01-brands.sql'),'utf8');
    const poll='33333333-3333-4333-8333-333333333333';
    const rpc=(user,operation,payload={})=>JSON.parse(asUser(user,
      `select public.rated420_build01('${operation}','${JSON.stringify(payload)}');`).split('\n').at(-1));
    strain(u1,'Fixture Imported Brand','Flower',60);
    const beforeImport=row('select id, user_id, total, flavor, photo_path from public.strain_reviews');
    sql(migration);
    sql(seed); sql(seed); sql(imports); sql(imports);
    assert.deepEqual(row('select id, user_id, total, flavor, photo_path from public.strain_reviews'),beforeImport);
    assert.equal(sql("select count(*) from rated420_build.items where name='Fixture Imported Brand'"),'1');
    assert.equal(sql("select count(*) from rated420_build.items where kind='accessory'"),'2');
    const id='demo-brand';
    rpc(u1,'review',{id,scores:[60,60,60,60,60],notes:'A'});
    rpc(u2,'review',{id,scores:[80,80,80,80,80],notes:'B'});
    rpc(u1,'review',{id,scores:[65,65,65,65,65],notes:'A updated'});
    const item=rpc(u2,'item',{id,kind:'brand'});
    assert.deepEqual([item.average,item.count,item.own.notes],[362.5,2,'B']);
    assert.deepEqual(item.reviews.map(r=>r.total),[400,325]);
    assert(item.reviews.every(r=>!('actor' in r) && !('email' in r)));
    assert.throws(()=>rpc(u2,'review',{id,scores:[85,0,0,0,0]}),/constraint/);
    assert.throws(()=>asUser(u2,'select * from rated420_build.reviews'),/permission denied/);
    rpc(u1,'favorite',{id,kind:'brand',active:true});
    assert.equal(rpc(u1,'favorites').length,1);
    assert.equal(rpc(u2,'favorites').length,0);
    rpc(u2,'vote',{id:poll,option:1});
    assert.throws(()=>rpc(u2,'vote',{id:poll,option:2}),/already voted/);
    assert.throws(()=>rpc(u2,'close',{id:poll}),/Action unavailable/);
    sql(`insert into rated420_build.staff values('${u1}');`);
    rpc(u1,'close',{id:poll});
    assert.throws(()=>rpc(u1,'vote',{id:poll,option:2}),/Voting is closed/);
    assert.equal(rpc(u2,'polls').polls[0].options[0].votes,1);
    asUser(u1,'delete from public.strain_reviews;');
  });
  test('zero reviews and legacy dispensary backfill preserve data',()=>{
    assert.equal(sql('select count(*) from public.strain_community_stats'),'0');
    assert.deepEqual(row('select name,location,notes,dispensary_id is not null as linked from public.dispensary_reviews'),{name:'Fixture Shop',location:'Test City',notes:'Preserve legacy notes',linked:true});
  });
  test('legacy backfill preserves IDs, timestamps, all scores, notes and photo reference',()=>{
    assert.deepEqual(row('select id,user_id,name,location,aesthetic,accessibility,staff,menu,overall,total,notes,photo_path,created_at from public.dispensary_reviews'),legacyReview);
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
    const edited=row('select * from public.strain_community_stats where strain_id=1 and product_type is null');
    assert.equal(edited.review_count,2);assert(Math.abs(edited.avg_total-815/3)<1e-10);assert(Math.abs(edited.avg_aesthetic-167/3)<1e-10);assert.equal(edited.avg_aroma,54);
    assert.throws(()=>strain(u1,'Fixture Brand A','Flower',84),/duplicate key/);
    asUser(u2,"update public.strain_reviews set aesthetic=0 where brand='Fixture Brand A';");
    assert.equal(sql("select aesthetic from public.strain_reviews where brand='Fixture Brand A'"),'30');
    asUser(u2,'delete from public.strain_reviews;');
    const remaining=row('select * from public.strain_community_stats where strain_id=1 and product_type is null');
    assert.equal(remaining.review_count,1);assert(Math.abs(remaining.avg_total-415/3)<1e-10);
    asUser(u1,'delete from public.strain_reviews;');assert.equal(sql('select count(*) from public.strain_community_stats'),'0');
  });
  test('dispensary ID aggregation, duplicate protection and edit/delete',()=>{
    const id=sql('select id from public.dispensaries limit 1');
    asUser(u2,`insert into public.dispensary_reviews(dispensary_id,name,location,aesthetic,accessibility,staff,menu,overall) values(${id},'Fixture Shop','Test City',61,62,63,64,65);`);
    let r=row('select * from public.dispensary_community_stats');assert.equal(r.review_count,2);assert.equal(r.avg_total,307.5);assert.equal(r.avg_menu,62);
    assert.throws(()=>asUser(u2,`insert into public.dispensary_reviews(dispensary_id,name,location,aesthetic,accessibility,staff,menu,overall) values(${id},'Alternate Name','Elsewhere',84,84,84,84,84);`),/duplicate key/);
    asUser(u2,'update public.dispensary_reviews set menu=80;');const edited=row('select * from public.dispensary_community_stats');assert.equal(edited.avg_menu,70);assert.equal(edited.avg_total,315.5);assert.equal(edited.review_count,2);
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
  test('same-name dispensaries in different locations aggregate by distinct listing IDs',()=>{
    for(const [location,score] of [['Fixture East',20],['Fixture West',70]]){
      asUser(u1,`insert into public.dispensary_reviews(name,location,aesthetic,accessibility,staff,menu,overall) values('Fixture Shop','${location}',${score},${score},${score},${score},${score});`);
    }
    const east=row("select d.id,s.review_count,s.avg_total from public.dispensaries d join public.dispensary_community_stats s on s.dispensary_id=d.id where d.location='Fixture East'");
    const west=row("select d.id,s.review_count,s.avg_total from public.dispensaries d join public.dispensary_community_stats s on s.dispensary_id=d.id where d.location='Fixture West'");
    assert.notEqual(east.id,west.id);assert.equal(east.review_count,1);assert.equal(west.review_count,1);assert.equal(east.avg_total,100);assert.equal(west.avg_total,350);
  });
  test('previous frontend can insert, read and edit dispensary reviews without listing IDs',()=>{
    asUser(u2,"insert into public.dispensary_reviews(name,location,aesthetic,accessibility,staff,menu,overall,notes) values('Legacy Client Shop','Fixture North',25,25,25,25,25,'Legacy compatibility fixture');");
    const before=row("select id,dispensary_id from public.dispensary_reviews where name='Legacy Client Shop'");
    assert(before.dispensary_id);
    asUser(u2,"update public.dispensary_reviews set location='Fixture South' where name='Legacy Client Shop';");
    const after=row("select id,dispensary_id,location,total,notes from public.dispensary_reviews where name='Legacy Client Shop'");
    assert.equal(after.id,before.id);assert.notEqual(after.dispensary_id,before.dispensary_id);assert.equal(after.location,'Fixture South');assert.equal(after.total,125);assert.equal(after.notes,'Legacy compatibility fixture');
    const legacyRead=sql("set role anon;select total from public.dispensary_reviews where name='Legacy Client Shop';").split('\n').at(-1);assert.equal(legacyRead,'125');
  });
  test('individual score feed exposes only opted-in handles and preset avatars',()=>{
    sql('delete from public.strain_reviews');
    asUser(u1,`insert into public.member_profiles(id,username,display_name,avatar_choice) values('${u1}','fixture_public','Private Name',2)`);
    asUser(u2,`insert into public.member_profiles(id,username,avatar_path) values('${u2}','fixture_private','${u2}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')`);
    strain(u1,'Public Flower','Flower',20);
    strain(u1,'Public Pre-Roll','Pre-Roll',40);
    strain(u2,'Private Flower','Flower',81);
    const feed=()=>JSON.parse(sql("set role anon; select json_agg(json_build_array(total,username,avatar_choice) order by total) from public.strain_community_reviews where strain_id=1").split('\n').at(-1));
    assert.deepEqual(feed(),[[100,null,null],[200,null,null],[405,null,null]]);
    asUser(u1,'update public.member_profiles set show_review_identity=true');
    assert.deepEqual(feed(),[[100,'fixture_public',2],[200,'fixture_public',2],[405,null,null]]);
    assert.equal(sql("set role anon; select count(*) from public.strain_community_reviews where strain_id=1 and product_type='Flower'").split('\n').at(-1),'2');
    assert.throws(()=>sql('set role anon; select username from public.member_profiles'));
    assert.throws(()=>sql('set role anon; select avatar_path from public.strain_community_reviews'));
    assert.throws(()=>sql('set role anon; select user_id from public.strain_community_reviews'));
    asUser(u1,'update public.member_profiles set show_review_identity=false');
    assert.deepEqual(feed(),[[100,null,null],[200,null,null],[405,null,null]]);
  });
  after(()=>{execFileSync('docker',['exec',container,'dropdb','-U','postgres',db]);execFileSync('docker',['exec',container,'psql','-U','postgres','-c','drop role rated420_community_reader;']);});
}
registerDatabaseTests();
