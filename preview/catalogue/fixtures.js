/* Stable preview identifiers. Numeric IDs connect to existing review tables. */
window.Rated420CatalogueFixtures=(()=>{
  const licensed=[
    ['treehouse','Treehouse Cannabis','OCM-CAURD-24-000122','247F0832-EE2F-415D-BA98-1FEDA9F69062',2101,'https://www.treehousecannabis.com/','https://www.youtube.com/watch?v=5A0oNueR_SM'],
    ['kings-house','Kings House of Fire','OCM-CAURD-24-000104','B4D783E6-C71E-4B60-9552-8CA67039826B',2102,'https://www.kingshouseoffire.com/',''],
    ['peek-buds','Peek Buds','OCM-CAURD-26-000342','A78B0002-E662-44C8-9CC4-8E85CE34660F',2103,'https://peekbuds.com/',''],
    ['flowery-haverstraw','The Flowery · Haverstraw','OCM-RETL-24-000157','12B5CE96-5BC6-4155-B804-09A3BC5CF55A',2104,'https://www.thefloweryny.com/',''],
    ['kushmart-haverstraw','Kushmart · Haverstraw','OCM-RETL-24-000060','C27D332E-F3F9-49C8-B52B-C416133FF54B',2105,'','']
  ].map(([id,name,license,location,reviewId,url,media])=>({id,type:'dispensary',name,reviewId,url,media,
    licenseId:'ocm-'+license+'~'+location,description:'New York dispensary profile with a location-specific OCM record.',source:'OCM license snapshot · jskf-tt3q',origin:'Official regulatory record with editorial profile',state:'Published'}));
  const brands=[
    ['rythm','RYTHM','https://rythm.com/'],
    ['find','Find.','https://findcannabis.com/'],
    ['botanist','The Botanist','https://shopbotanist.com/'],
    ['nanticoke','Nanticoke','https://nanticoke.co/']
  ].map(([id,name,url])=>({id,type:'brand',name,url,reviewId:'catalogue-'+id,
    description:'Browse the official brand site for its current product information.',source:'Official brand website · checked 2026-11-20',origin:'Rated420 editorial profile',state:'Published'}));
  const synthetic=[
    {id:'strain-citrus',type:'strain',name:'Demo Citrus',reviewId:101,description:'A fictional cultivar connected to the existing demo scorecard.'},
    {id:'strain-amber',type:'strain',name:'Amber Trail Flower',reviewId:104,description:'A fictional cultivar in the Rated420 demo catalogue.'},
    {id:'org-farm',type:'cultivator',name:'Hudson Lantern Farm',description:'Fictional New York producer. Appears in the existing founder workspace.'},
    {id:'org-brand',type:'brand',name:'Field Signal',reviewId:'org-brand',description:'Fictional brand and business account organization.'},
    {id:'org-shop',type:'dispensary',name:'North Loop Dispensary',reviewId:201,description:'Fictional dispensary with simulated community ratings.'},
    {id:'product-amber',type:'product',name:'Amber Trail Flower · Demo',description:'A synthetic example of a finished product distinct from its cultivar.',
      brand:'org-brand',strain:'strain-amber',producer:'org-farm',dispensaries:['org-shop'],format:'Flower'},
    {id:'product-citrus-roll',type:'product',name:'Demo Citrus Pre-Roll',description:'A synthetic example linking a cultivar, brand and retailer.',
      brand:'org-brand',strain:'strain-citrus',producer:'org-farm',dispensaries:['org-shop'],format:'Pre-Roll'},
    {id:'product-citrus-vape',type:'product',name:'Demo Citrus Cartridge',description:'A second fictional format for the same cultivar.',
      brand:'org-brand',strain:'strain-citrus',producer:'org-farm',dispensaries:[],format:'Vape Cartridge'}
  ].map(row=>({...row,source:'Rated420 synthetic fixtures',origin:'Synthetic demonstration',state:'Published'}));
  return {licensed,brands,records:[...licensed,...brands,...synthetic]};
})();
