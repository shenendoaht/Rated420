(() => {
  'use strict';
  const date = day => new Date().toISOString().slice(0,7)+'-'+day;
  const finance = [
    ['sponsorship','Vault season sponsor','Income','Sponsorship',480000,'02','Posted','Once','','','','opp-tour'],
    ['merch','Vault hoodie sales','Income','Merchandise',124500,'05','Posted','Once'],
    ['partner','Media partnership invoice','Income','Partnership',225000,'15','Outstanding','Once','contact-maya','','','opp-tour'],
    ['site','Editing workspace subscription','Expense','Subscription',8900,'04','Posted','Monthly'],
    ['insurance','Production insurance','Expense','Operations',24000,'06','Posted','Monthly'],
    ['campaign','Hudson Valley outreach','Expense','Marketing',38000,'08','Posted','Once','','campaign-tour'],
    ['crew','Field Signal crew deposit','Expense','Production',95000,'12','Outstanding','Once','','','project-idea'],
    ['budget','Field Signal production ceiling','Budget','Production',180000,'01','Planned','Once','','','project-idea']
  ].map(([id,name,type,category,cents,day,status,repeat,contact='',campaign='',production='',opportunity=''])=>({id,name,type,category,cents,date:date(day),status,repeat,contact,campaign,production,opportunity}));
  const regions = [
    {id:'west',name:'Western New York',shape:'22,126 85,118 94,171 24,173',label:[55,147]},
    {id:'finger',name:'Finger Lakes',shape:'85,118 125,99 158,108 165,171 94,171',label:[125,143]},
    {id:'central',name:'Central New York',shape:'125,99 169,82 199,90 207,172 165,171 158,108',label:[180,128]},
    {id:'north',name:'North Country',shape:'169,82 193,58 198,29 238,10 275,9 266,85 228,109 199,90',label:[231,65]},
    {id:'capital',name:'Capital Region',shape:'199,90 228,109 266,85 274,138 239,155 207,147',label:[239,122]},
    {id:'hudson',name:'Hudson Valley',shape:'207,147 239,155 274,138 279,191 293,207 268,220 245,194 207,172',label:[248,176]},
    {id:'metro',name:'NYC and Long Island',shape:'268,220 293,207 310,207 341,189 365,189 348,213 309,232 275,233',label:[316,220]}
  ];
  const market = [
    ['b1','Hudson Lantern Farm','hudson','Cultivator','Existing','In discussion',true,'Amber Trail Flower',360,26,72,'org-farm'],
    ['b2','Field Signal','hudson','Brand','Existing','Responded',true,'Amber Trail Flower',347,18,51,'org-brand'],
    ['b3','North Loop Dispensary','capital','Dispensary','Existing','Contacted',false,'Local flower assortment',338,33,80,'org-shop'],
    ['b4','Lakeglass Processing','finger','Processor','Prospective','Research',true,'Live resin samples',328,13,29,''],
    ['b5','Canal Lantern Retail','central','Dispensary','Prospective','Qualified',false,'Small-batch flower',345,19,36,''],
    ['b6','Harbor Meridian','metro','Brand','Prospective','Drafted',true,'Botanical edibles',354,14,45,''],
    ['b7','Snowline Cultivation','north','Cultivator','Prospective','Research',true,'Greenhouse flower',331,9,17,''],
    ['b8','West Shore Retail','west','Dispensary','Prospective','Research',false,'Regional brands',321,11,22,'']
  ].map(([id,name,region,category,relationship,outreach,filming,product,rating,reviews,engagement,org])=>({id,name,region,category,relationship,outreach,filming,product,rating,reviews,engagement,org}));
  const stash = [
    {id:'journal-citrus',product:'Demo Citrus',brand:'Field Signal',status:'Tried',favorite:true,favoriteBrand:true,flavor:'Citrus',cultivar:'Citrus hybrid',format:'Flower',notes:'Private fixture. Bright on the first taste.',scores:[70,76,78,72,77],date:date('04')},
    {id:'journal-amber',product:'Amber Trail Flower',brand:'Field Signal',status:'Wishlist',favorite:false,flavor:'Earthy',cultivar:'Amber Trail',format:'Flower',notes:'Private fixture. Ask about the next batch.',scores:[],date:date('07')}
  ];
  window.RatedExpansionFixtures = {finance,regions,market,stash};
})();
