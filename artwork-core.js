/* Editable email-table shape studies. No canvas, image uploads or draft extensions. */
(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./signature-core.js') : root.SignatureCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SignatureArtwork = api;
}(typeof window !== 'undefined' ? window : null, function (core) {
  'use strict';
  var definitions = [
    {id:'cutforms', name:'Cut forms', description:'Broad cut edges and an open interval.', palette:['#2348c7','#e3634a','#e6b83d'], bands:['..0000..','.000000.','.000....','..00022.','....222.','.11111..','.111....','..1111..']},
    {id:'interlock', name:'Interlock', description:'Unequal bands meeting at stepped edges.', palette:['#244dd7','#dd5946','#e3ae30'], bands:['000..11.','0000011.','..00011.','22.0011.','22222...','..222.00','..222.00','......00']},
    {id:'colorblocks', name:'Color blocks', description:'Blue, clay and plum in quiet fields.', palette:['#477b9f','#c18572','#735568'], bands:['00000...','0000011.','0000011.','000..11.','...2222.','.222222.','.222222.','........']},
    {id:'counterspace', name:'Counterspace', description:'Dark and light forms around an open center.', palette:['#1d2021','#eee5ce','#d4de46'], bands:['000000..','000.11..','00..111.','00..111.','000..22.','0000....','..000011','..000011']},
    {id:'offsetplanes', name:'Offset planes', description:'Two shifted planes and a third overlap color.', palette:['#dc4e37','#244eb8','#513960'], bands:['00000...','0000011.','0022211.','0022211.','..11111.','..11111.','..11111.','.....11.']},
    {id:'rhythm', name:'Rhythm', description:'A changing cadence of ink, gray and red.', palette:['#21262a','#a8a093','#c94836'], bands:['00....','0000..','..00..','..0022','..11..','1111..','11....']}
  ];
  var studies = Object.freeze(definitions.map(function (item) { return Object.freeze({id:item.id,name:item.name,description:item.description}); }));
  var mapping = {cutpaper:'cutforms',colorfield:'colorblocks',chromatic:'interlock',counterform:'counterspace',overprint:'offsetplanes',gesture:'rhythm',studio:'interlock',prism:'offsetplanes',editorial:'counterspace',signal:'rhythm'};
  var proposals = new WeakMap();
  function fail(message) { throw new TypeError(message); }
  function clone(value) {
    var parsed = core.parseCustomPattern(typeof value === 'string' ? value : JSON.stringify(value));
    return {palette:parsed.palette.slice(),rows:parsed.rows.slice()};
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.keys(value).forEach(function (key) { freeze(value[key]); }); Object.freeze(value); }
    return value;
  }
  function identity(draft) {
    var normalized = core.normalize(draft);
    return JSON.stringify(Object.keys(normalized).sort().map(function (key) { return [key,normalized[key]]; }));
  }
  function seedNumber(value) {
    if (Number.isSafeInteger(value) && value >= 0) return value;
    if (typeof value !== 'string') fail('Use a nonnegative whole number or text for the variation seed.');
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i),16777619) >>> 0;
    return hash;
  }
  function createStudy(id, seed) {
    var study = definitions.find(function (item) { return item.id === id; });
    if (!study) fail('Choose an available shape study.');
    var value = seedNumber(seed === undefined ? 0 : seed), bands = study.bands.slice();
    // Moving whole bands keeps the marks contiguous and the email table small.
    // Every seed yields the same recipe without random state or hidden metadata.
    if (value) {
      var shift = value % bands.length;
      bands = bands.slice(shift).concat(bands.slice(0,shift));
      if (value % 2) bands = bands.map(function (row) { return Array.from(row).reverse().join(''); });
      if (Math.floor(value / bands.length) % 2) bands.reverse();
    }
    return clone({palette:study.palette.slice(),rows:bands.flatMap(function (row) { return [row,row]; })});
  }
  function coordinate(recipe, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || y >= recipe.rows.length || x >= recipe.rows[0].length) fail('Choose a cell inside the artwork grid.');
  }
  function inkValue(recipe, ink) {
    if (ink === '.') return ink;
    if ((typeof ink !== 'number' && typeof ink !== 'string') || !/^[0-7]$/.test(String(ink)) || Number(ink) >= recipe.palette.length) fail('Choose an ink from this palette or the eraser.');
    return String(ink);
  }
  function paint(recipe, x, y, ink) {
    var result = clone(recipe), value = inkValue(result,ink);
    coordinate(result,x,y);
    result.rows[y] = result.rows[y].slice(0,x) + value + result.rows[y].slice(x + 1);
    return result;
  }
  function paintLine(recipe, from, to, ink) {
    var result = clone(recipe), value = inkValue(result,ink);
    if (!from || !to) fail('Choose the first and last cells of a stroke.');
    coordinate(result,from.x,from.y); coordinate(result,to.x,to.y);
    var x = from.x, y = from.y, dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1, error = dx + dy;
    while (true) {
      result.rows[y] = result.rows[y].slice(0,x) + value + result.rows[y].slice(x + 1);
      if (x === to.x && y === to.y) break;
      var twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
    return result;
  }
  function mirror(recipe, axis) {
    var result = clone(recipe);
    if (axis === 'horizontal') result.rows = result.rows.map(function (row) { return Array.from(row).reverse().join(''); });
    else if (axis === 'vertical') result.rows.reverse();
    else fail('Choose horizontal or vertical mirroring.');
    return result;
  }
  function setColor(recipe, index, hex) {
    var result = clone(recipe);
    if (!Number.isInteger(index) || index < 0 || index >= result.palette.length || typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) fail('Use an existing ink and a six-digit hex color, such as #2348c7.');
    result.palette[index] = hex.toLowerCase();
    return result;
  }
  function fromDraft(draft) {
    if (draft && draft.pattern === 'custom' && draft.customPattern) return {recipe:clone(draft.customPattern),studyId:'',isCustom:true};
    var id = mapping[draft && draft.pattern] || mapping[draft && draft.design] || 'cutforms';
    return {recipe:createStudy(id,0),studyId:id,isCustom:false};
  }
  function createProposal(recipe, draft) {
    var serialized = JSON.stringify(clone(recipe)), original = core.normalize(draft);
    // Opening and applying an unchanged imported recipe preserves its exact JSON.
    if (original.pattern === 'custom' && original.customPattern && JSON.stringify(clone(original.customPattern)) === serialized) serialized = original.customPattern;
    var changes = {pattern:'custom',customPattern:serialized};
    if (original.artworkPlacement === 'flow') changes.artworkPlacement = 'motif';
    var candidate = {...original,...changes};
    var errors = core.validate(candidate), first = Object.keys(errors)[0];
    if (first) fail(errors[first]);
    var html = core.render(candidate,{preview:true}), characters = html.length;
    if (candidate.portraitData) characters -= candidate.portraitData.length;
    if (characters >= 10000) fail('Simplify the artwork to keep the signature below 10,000 HTML characters.');
    var result = freeze({candidate:candidate,changes:changes,html:html,characters:characters});
    proposals.set(result,identity(draft));
    return result;
  }
  function applyProposal(proposal, currentDraft) {
    if (!proposals.has(proposal)) fail('Preview this artwork before applying it.');
    if (proposals.get(proposal) !== identity(currentDraft)) fail('Your signature changed while the artwork editor was open. Close and reopen it before applying.');
    var errors = core.validate({...currentDraft,...proposal.changes}), first = Object.keys(errors)[0];
    if (first) fail(errors[first]);
    return {...proposal.changes};
  }
  return Object.freeze({studies:studies,createStudy:createStudy,clone:clone,paint:paint,paintLine:paintLine,mirror:mirror,setColor:setColor,fromDraft:fromDraft,createProposal:createProposal,applyProposal:applyProposal});
}));
