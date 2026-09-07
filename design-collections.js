(function (root, factory) {
  'use strict';
  const collections = factory();
  if (typeof module === 'object' && module.exports) module.exports = collections;
  if (root) root.SignatureCollections = collections;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return Object.freeze([
    {id:'cutpaper', name:'Cut paper', category:'abstract', description:'Cobalt, coral and saffron. Irregular forms on warm paper.', design:'orbit', pattern:'cutpaper', frontBackground:'#f5f0e6', backBackground:'#f5f0e6', accent:'#2348c7'},
    {id:'colorfield', name:'Color field', category:'abstract', description:'Atmospheric blue, clay and plum. Soft edges and quiet space.', design:'prism', pattern:'colorfield', frontBackground:'#efe9e1', backBackground:'#d8cbc3', accent:'#735568'},
    {id:'chromatic', name:'Chromatic', category:'abstract', description:'Interlocking bands of cobalt, ochre and warm red.', design:'studio', pattern:'chromatic', frontBackground:'#f0e7ce', backBackground:'#ece8df', accent:'#244dd7'},
    {id:'counterform', name:'Counterform', category:'abstract', description:'Sculptural ink and cream, interrupted by an acid yellow plane.', design:'orbit', pattern:'counterform', frontBackground:'#eee5ce', backBackground:'#eee5ce', accent:'#575b29'},
    {id:'overprint', name:'Overprint', category:'abstract', description:'Vermilion and cobalt planes meet in translucent layers.', design:'prism', pattern:'overprint', frontBackground:'#f4e8dd', backBackground:'#ede4d6', accent:'#b74535'},
    {id:'gesture', name:'Gesture', category:'abstract', description:'A sweep of ink, a vermilion mark, and room to breathe.', design:'orbit', pattern:'gesture', frontBackground:'#f3efe8', backBackground:'#f3efe8', accent:'#c94836'},
    {id:'galaxy', name:'Galaxy', description:'Violet spirals, distant stars and midnight blue.', design:'orbit', pattern:'galaxy', frontBackground:'#15192e', backBackground:'#242041', accent:'#c396ef'},
    {id:'starlight', name:'Starlight', description:'Golden constellations on a deep blue sky.', design:'editorial', pattern:'starlight', frontBackground:'#18283e', backBackground:'#2a3f5c', accent:'#edcc83'},
    {id:'moonlight', name:'Moonlight', description:'A Sailor Moon inspired crescent, ribbons and pink jewels.', design:'contour', pattern:'moonlight', frontBackground:'#f1e7fa', backBackground:'#402e63', accent:'#b95689'},
    {id:'frost', name:'Frost Crown', description:'A Frozen Throne inspired ice crown and glowing runes.', design:'signal', pattern:'frost', frontBackground:'#d7eef6', backBackground:'#102d47', accent:'#4489b3'}
  ].map(Object.freeze));
}));
