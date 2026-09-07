(function (root, factory) {
  'use strict';
  const collections = factory();
  if (typeof module === 'object' && module.exports) module.exports = collections;
  if (root) root.SignatureCollections = collections;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return Object.freeze([
    {id:'galaxy', name:'Galaxy', description:'Violet spirals, distant stars and midnight blue.', design:'orbit', pattern:'galaxy', frontBackground:'#15192e', backBackground:'#242041', accent:'#c396ef'},
    {id:'starlight', name:'Starlight', description:'Golden constellations on a deep blue sky.', design:'editorial', pattern:'starlight', frontBackground:'#18283e', backBackground:'#2a3f5c', accent:'#edcc83'},
    {id:'moonlight', name:'Moonlight', description:'A Sailor Moon inspired crescent, ribbons and pink jewels.', design:'contour', pattern:'moonlight', frontBackground:'#f1e7fa', backBackground:'#402e63', accent:'#b95689'},
    {id:'frost', name:'Frost Crown', description:'A Frozen Throne inspired ice crown and glowing runes.', design:'signal', pattern:'frost', frontBackground:'#d7eef6', backBackground:'#102d47', accent:'#4489b3'}
  ].map(Object.freeze));
}));
