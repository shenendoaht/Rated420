/* Shared identity and catalog references for the complete offline build. */
const COMPLETE_ACCOUNTS = [
  {id:'11111111-1111-4111-8111-111111111111',label:'Community member · Maya',username:'demo_a',name:'Maya Vale',email:'maya@example.test'},
  {id:'22222222-2222-4222-8222-222222222222',label:'Alternate member · Riley',username:'demo_b',name:'Riley West',email:'riley@example.test'},
  {id:'aaaa0000-0000-4000-8000-000000000002',label:'Administrator · Adair',username:'demo_admin',name:'Adair Hart',email:'adair@example.test',role:'administrator'},
  {id:'aaaa0000-0000-4000-8000-000000000003',label:'Moderator · Camille',username:'demo_staff',name:'Camille Brooks',email:'camille@example.test',role:'staff'},
  {id:'aaaa0000-0000-4000-8000-000000000004',label:'Business representative · Morgan',username:'demo_business',name:'Morgan Lane',email:'morgan@example.test',organization:'org-brand'},
  {id:'aaaa0000-0000-4000-8000-000000000005',label:'Founder · Jordan',username:'demo_founder',name:'Jordan Ellis',email:'jordan@example.test',role:'staff',founder:true}
];
const COMPLETE_ENTITIES = [
  {id:'org-farm',name:'Hudson Lantern Farm',kind:'Producer',products:[101,104]},
  {id:'org-brand',name:'Field Signal',kind:'Brand',products:[101,104]},
  {id:'org-shop',name:'North Loop Dispensary',kind:'Dispensary',products:[101,104],listing:201}
];
const COMPLETE_REVIEW_FORMATS=['Flower','Pre-Roll','Infused Pre-Roll','Vape Cartridge','Disposable Vape','Concentrate','Edible','Tincture','Topical','Other'];
COMMUNITY_DEMO_SEED.strains.push({id:104,name:'Amber Trail Flower'});

Object.assign(COMMUNITY_DEMO_SEED.dispensaries[0],{name:'North Loop Dispensary',location:'Albany, NY'});
