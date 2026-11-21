window.Rated420Scores = Object.freeze({
  display(value) {
    return value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : String(Math.round(Number(value)));
  },
  thirdDimension(format) {
    return format === 'Topical' ? 'Consistency' : 'Flavor';
  },
  topicalPrompt: 'Was it unpleasantly greasy or oily? Did it leave any residue?'
});
