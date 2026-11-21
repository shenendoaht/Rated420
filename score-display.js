const rated420ReviewModels = Object.freeze({
  dispensary: {
    fields: [['aesthetic','Aesthetic'],['accessibility','Accessibility'],['staff','Staff'],['menu','Menu'],['overall','Overall']],
    prompts: ['How did the shop look and feel inside?','How easy was it to get there, get in, and find your way around?',
      'Were the staff welcoming and helpful?','How was the selection? Was it easy to find what you wanted?','How was the visit as a whole? Would you go back?']
  },
  brand: {
    fields: [['presentation','Presentation'],['consistency','Consistency'],['selection','Selection'],['transparency','Transparency'],['overall','Overall']],
    prompts: ['How clearly and thoughtfully was the product presented?','How consistent was your experience across the products you tried?',
      'Did the range of products meet your needs?','How clearly could you find information about the products?','Would you choose this brand again?']
  },
  accessory: {
    fields: [['design','Design'],['build','Build quality'],['ease','Ease of use'],['performance','Performance'],['overall','Overall']],
    prompts: ['How well does the design suit its purpose?','How sturdy and well made does it feel?',
      'How easy is it to set up, use and maintain?','How well does it perform its intended job?','Would you use or recommend it again?']
  }
});
window.Rated420Scores = Object.freeze({
  models: rated420ReviewModels,
  display(value) {
    return value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : String(Math.round(Number(value)));
  },
  thirdDimension(format) {
    return format === 'Topical' ? 'Consistency' : 'Flavor';
  },
  topicalPrompt: 'Was it unpleasantly greasy or oily? Did it leave any residue?'
});
