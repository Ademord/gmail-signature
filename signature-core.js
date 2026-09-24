(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SignatureCore = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // Format controls default to the historical template rendering. Zero sizes
  // mean Auto/Template (never 0 px) and -1 padding keeps each template inset.
  var typographyDefaults = Object.freeze({
    nameLayout: 'template', nameFontSize: 0, titleFontSize: 0, subtitleFontSize: 0, contactFontSize: 0, footerFontSize: 0,
    lineSpacing: 100, textSpacing: 100, contactSpacing: 100, sectionSpacing: 100, contentPadding: -1,
    singleArrangement: 'auto', contactLayout: 'template', contactFont: 'template', footerVisible: 'show'
  });
  // Contact presentation: hidden contacts keep their saved values, labels,
  // icons and URLs. Separators decorate inline rows only; none keeps markup.
  var contactDefaults = Object.freeze({
    contactSeparator: 'none', websiteVisible: 'show', emailVisible: 'show', phoneVisible: 'show', linkedinVisible: 'show', locationVisible: 'show'
  });
  var contactSeparators = Object.freeze({none:'', bar:'|', dot:'·', slash:'/', dash:'–'});
  var defaults = Object.freeze(Object.assign({
    nameLine1: 'Avery', nameLine2: 'Morgan', title: 'Software Engineer',
    subtitle: 'AI & AUTOMATION', website: 'example.com', websiteLabel: 'example.com',
    email: '', phone: '+41 00 000 00 00', linkedin: 'https://www.linkedin.com/',
    location: 'Zurich, Switzerland', tags: 'SOFTWARE · DATA · AI',
    width: 321, height: 208, cardGap: 20, cardFormat: 'auto', layout: 'paired', design: 'original', pattern: 'auto', customPattern: '', customLayout: '', accent: '#c8362a',
    artworkPlacement: 'auto', artworkScale: 100, artworkOpacity: 100, artworkPositionX: 50, artworkPositionY: 50,
    artworkFade: 'none', artworkFadeAngle: 90, artworkFadeDirection: 'normal', artworkFadeX: 50, artworkFadeY: 50,
    motifScale: 100, motifPositionX: 50, motifPositionY: 0,
    portraitData: '', portraitUrl: '', portraitShape: 'circle', portraitSize: 64,
    frontBackground: '#f3f0ea', backBackground: '#1c1c1c',
    websiteIcon: 'web', emailIcon: 'mail', phoneIcon: 'phone', linkedinIcon: 'linkedin', locationIcon: 'pin',
    imageBase: 'https://raw.githubusercontent.com/Ademord/gmail-signature/main/sig'
  }, typographyDefaults, contactDefaults));
  // A reversible compact starting point. It changes format only, never the
  // personal details, photo, colors or artwork.
  var compactPreset = Object.freeze({cardFormat:'single', layout:'paired', singleArrangement:'rows', width:280, height:180,
    contentPadding:24, portraitSize:96, nameLayout:'single', nameFontSize:22, titleFontSize:13, subtitleFontSize:13, contactFontSize:13,
    contactFont:'sans', contactLayout:'inline', contactSeparator:'bar', lineSpacing:100, textSpacing:100, contactSpacing:100, sectionSpacing:150, footerVisible:'hide'});
  var fontSizes = Object.freeze([['nameFontSize',12,40],['titleFontSize',8,24],['subtitleFontSize',8,24],['contactFontSize',8,24],['footerFontSize',8,24]]);
  var formatChoices = Object.freeze({
    nameLayout:[['template','single','wrap'],'Choose Template, Single line or Wrap for the name layout.'],
    singleArrangement:[['auto','rows','columns'],'Choose Automatic, Rows or Columns for the single-card arrangement.'],
    contactLayout:[['template','stacked','inline'],'Choose Template, Stacked or Inline contacts.'],
    contactFont:[['template','sans','mono'],'Choose Template, Sans or Mono for the contact font.'],
    footerVisible:[['show','hide'],'Choose to show or hide the footer.'],
    contactSeparator:[Object.keys(contactSeparators),'Choose None, Bar, Dot, Slash or Dash for the contact separator.'],
    websiteVisible:[['show','hide'],'Choose to show or hide the website.'],
    emailVisible:[['show','hide'],'Choose to show or hide the email address.'],
    phoneVisible:[['show','hide'],'Choose to show or hide the phone number.'],
    linkedinVisible:[['show','hide'],'Choose to show or hide LinkedIn.'],
    locationVisible:[['show','hide'],'Choose to show or hide the location.']});
  var limits = Object.freeze({nameLine1: 36, nameLine2: 36, title: 64, subtitle: 64,
    website: 1024, websiteLabel: 40, email: 80, phone: 32, linkedin: 512,
    location: 48, tags: 60, imageBase: 512, portraitUrl: 1024, customPattern: 2048, customLayout: 512});
  var cream = '#f3f0ea', black = '#1c1c1c';
  var sans = 'Arial,Helvetica,sans-serif', mono = "'Courier New',Courier,monospace";
  var roleMono = "'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace";
  var icons = Object.freeze({web:'Globe', mail:'Envelope', phone:'Phone', linkedin:'LinkedIn', pin:'Location pin', none:'None'});
  var patterns = Object.freeze({auto:'Design default', cutpaper:'Cut paper', colorfield:'Color field', chromatic:'Chromatic', counterform:'Counterform', overprint:'Overprint', gesture:'Gesture', neural:'Neural bloom', latent:'Latent field', tokenweave:'Token weave', resonance:'Resonance', dots:'Dots', orbit:'Orbits', studio:'Shapes', contour:'Contours', prism:'Ribbons', editorial:'Rules', signal:'Grid', galaxy:'Galaxy', starlight:'Starlight', moonlight:'Moonlight', frost:'Frost', custom:'Custom artwork', none:'None'});
  var designs = Object.freeze([
    {id:'original', name:'Original', description:'The original two-card signature, with its quiet dot field.', frontBackground:'#f3f0ea', backBackground:'#1c1c1c', accent:'#c8362a', pattern:'auto'},
    {id:'orbit', name:'Orbit', description:'Open space, orbital arcs and a floating typographic composition.', frontBackground:'#edf2fb', backBackground:'#152849', accent:'#496aca', pattern:'auto'},
    {id:'studio', name:'Studio', description:'Bold shapes, an asymmetric art column and a strong color bar.', frontBackground:'#f5dfcd', backBackground:'#442525', accent:'#d94a32', pattern:'auto'},
    {id:'contour', name:'Contour', description:'Topographic lines and grounded type in a natural palette.', frontBackground:'#eaf0e5', backBackground:'#213c32', accent:'#5d794b', pattern:'auto'},
    {id:'prism', name:'Prism', description:'Diagonal ribbons, bright edges and a lively split composition.', frontBackground:'#f3eefe', backBackground:'#30214f', accent:'#9951d2', pattern:'auto'},
    {id:'editorial', name:'Editorial', description:'Expressive serif names, fine rules and a calm reading order.', frontBackground:'#f5f0e6', backBackground:'#38372f', accent:'#a87845', pattern:'auto'},
    {id:'signal', name:'Signal', description:'A technical grid, monospaced name and precise frame details.', frontBackground:'#e4f1f0', backBackground:'#123534', accent:'#087e82', pattern:'auto'}
  ].map(Object.freeze));
  var customDesign = Object.freeze({id:'custom',name:'Custom layout',description:'Your composition, typography and alignment.',frontBackground:'#f3f0ea',backBackground:'#1c1c1c',accent:'#c8362a',pattern:'auto'});
  function deepFreeze(value) {
    Object.keys(value).forEach(function (key) { if (value[key] && typeof value[key] === 'object') deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  var recipeSchemas = deepFreeze({
    customPattern:{type:'object',additionalProperties:false,required:['palette','rows'],properties:{
      palette:{type:'array',minItems:1,maxItems:8,items:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}},
      rows:{type:'array',minItems:4,maxItems:32,items:{type:'string',minLength:4,maxLength:16,pattern:'^[.0-7]+$'}}},
      description:'Equal-width rows, at most 384 cells. A dot is transparent; digits index palette colors. Favor sparse shapes and contiguous color runs. The complete email must stay below 10,000 HTML characters.'},
    customLayout:{type:'object',additionalProperties:false,required:['composition','font','align'],properties:{
      composition:{type:'string',enum:['orbit','studio','contour','prism','editorial','signal']},
      font:{type:'string',enum:['sans','serif','mono'],description:'Display name font. The role keeps its original regular monospace typography.'},
      align:{type:'string',enum:['left','center'],description:'Identity text alignment.'}}}
  });
  function recipeObject(value, keys, limit) {
    if (typeof value !== 'string' || value.length > limit) throw new TypeError('Use a small JSON recipe.');
    var parsed;
    try { parsed = JSON.parse(value); } catch (_) { throw new TypeError('Use valid JSON for the recipe.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== keys.length ||
      keys.some(function (key) { return !Object.prototype.hasOwnProperty.call(parsed,key); }) ||
      Object.keys(parsed).some(function (key) { return keys.indexOf(key) === -1; })) throw new TypeError('Use only the required recipe fields: ' + keys.join(', ') + '.');
    return parsed;
  }
  function parseCustomPattern(value) {
    var recipe = recipeObject(value,['palette','rows'],2048);
    if (!Array.isArray(recipe.palette) || !recipe.palette.length || recipe.palette.length > 8 ||
      recipe.palette.some(function (color) { return typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color); })) throw new TypeError('Use one to eight six-digit hex colors.');
    if (!Array.isArray(recipe.rows) || recipe.rows.length < 4 || recipe.rows.length > 32 ||
      recipe.rows.some(function (row) { return typeof row !== 'string' || !/^[.0-7]{4,16}$/.test(row); })) throw new TypeError('Use 4–32 rows of 4–16 dots or palette digits.');
    var width = recipe.rows[0].length;
    if (width * recipe.rows.length > 384 || recipe.rows.some(function (row) { return row.length !== width || Array.from(row).some(function (cell) { return cell !== '.' && Number(cell) >= recipe.palette.length; }); }))
      throw new TypeError('Use equal-width rows, valid palette digits and at most 384 cells.');
    return deepFreeze({palette:recipe.palette.map(function (color) { return color.toLowerCase(); }),rows:recipe.rows.slice()});
  }
  function parseCustomLayout(value) {
    var recipe = recipeObject(value,['composition','font','align'],512), spec = recipeSchemas.customLayout.properties;
    if (!spec.composition.enum.includes(recipe.composition) || !spec.font.enum.includes(recipe.font) || !spec.align.enum.includes(recipe.align))
      throw new TypeError('Choose an available composition, name font and identity alignment.');
    return deepFreeze({composition:recipe.composition,font:recipe.font,align:recipe.align});
  }
  function compositionValues(v) {
    if (v.design !== 'custom') return v;
    var recipe = parseCustomLayout(v.customLayout);
    return Object.assign({},v,{design:recipe.composition,customFont:recipe.font,customAlign:recipe.align});
  }
  var contactKeys = ['website', 'email', 'phone', 'linkedin', 'location'];
  function escape(value) { return String(value).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  }); }
  function clean(value) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function dimension(value, fallback, min, max) {
    var number = value === undefined || value === null || value === '' ||
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') ? fallback : Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? Math.round(number) : fallback));
  }
  function normalize(values) {
    var input = values && typeof values === 'object' ? values : {}, result = {};
    Object.keys(defaults).forEach(function (key) {
      result[key] = input[key] === undefined ? defaults[key] : clean(input[key]);
    });
    result.width = dimension(input.width, defaults.width, 280, 420);
    result.height = dimension(input.height, defaults.height, 180, 320);
    result.cardGap = dimension(input.cardGap, defaults.cardGap, 0, 60);
    result.artworkScale = dimension(input.artworkScale, defaults.artworkScale, 25, 400);
    result.artworkOpacity = dimension(input.artworkOpacity, defaults.artworkOpacity, 0, 100);
    result.artworkFadeAngle = dimension(input.artworkFadeAngle, defaults.artworkFadeAngle, 0, 360);
    result.artworkFadeX = dimension(input.artworkFadeX, defaults.artworkFadeX, 0, 100);
    result.artworkFadeY = dimension(input.artworkFadeY, defaults.artworkFadeY, 0, 100);
    result.artworkPositionX = dimension(input.artworkPositionX, defaults.artworkPositionX, 0, 100);
    result.artworkPositionY = dimension(input.artworkPositionY, defaults.artworkPositionY, 0, 100);
    result.motifScale = dimension(input.motifScale, defaults.motifScale, 25, 100);
    result.motifPositionX = dimension(input.motifPositionX, defaults.motifPositionX, 0, 100);
    result.motifPositionY = dimension(input.motifPositionY, defaults.motifPositionY, 0, 100);
    result.portraitSize = dimension(input.portraitSize, defaults.portraitSize, 40, 96);
    fontSizes.forEach(function (rule) {
      var size = dimension(input[rule[0]], 0, 0, rule[2]);
      result[rule[0]] = size && size < rule[1] ? rule[1] : size;
    });
    result.lineSpacing = dimension(input.lineSpacing, defaults.lineSpacing, 80, 200);
    ['textSpacing', 'contactSpacing', 'sectionSpacing'].forEach(function (key) { result[key] = dimension(input[key], defaults[key], 0, 200); });
    result.contentPadding = dimension(input.contentPadding, defaults.contentPadding, -1, 48);
    ['accent', 'frontBackground', 'backBackground'].forEach(function (key) { result[key] = result[key].toLowerCase(); });
    result.imageBase = result.imageBase.replace(/\/+$/, '');
    return result;
  }
  function canvasSize(v) {
    if (v.cardFormat === 'single') {
      var composed = v;
      try { composed = compositionValues(v); } catch (_) { /* Incomplete custom drafts remain measurable. */ }
      var single = singlePlan(composed);
      return {width:single.W,height:single.H};
    }
    // Joined compositions use their original canvas dimensions; only Original
    // has two separate cards and therefore a physical inter-card gap.
    var gap = v.cardFormat === 'front-back' || v.design === 'original' ? v.cardGap : defaults.cardGap;
    return {width:v.layout === 'stacked' ? v.width : v.width * 2 + gap,
      height:v.layout === 'stacked' ? v.height * 2 + gap : v.height};
  }
  function dimensions(values) { return canvasSize(normalize(values)); }
  function effectiveFormat(values) {
    var v = normalize(values);
    return v.cardFormat === 'auto' ? (v.design === 'original' ? 'front-back' : 'single') : v.cardFormat;
  }
  function webURL(value) {
    if (!value || /[\s\\<>"'\u0000-\u001f\u007f]/.test(value)) return null;
    var candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : 'https://' + value;
    try {
      var url = new URL(candidate), host = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
      if (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null;
      if (!/^[a-z\d.-]+$/.test(host) || host.split('.').some(function (part) {
        return !part || part.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(part);
      })) return null;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        var n = host.split('.').map(Number);
        if (n.some(function (x) { return x > 255; }) || n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224 ||
          (n[0] === 100 && n[1] >= 64 && n[1] <= 127) || (n[0] === 169 && n[1] === 254) ||
          (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168) ||
          (n[0] === 198 && (n[1] === 18 || n[1] === 19))) return null;
      }
      return url.href;
    } catch (_) { return null; }
  }
  function emailOK(value) {
    if (!/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(value)) return false;
    var parts = value.split('@');
    return parts[0].length <= 64 && value.indexOf('..') === -1 && value[0] !== '.' && value.indexOf('.@') === -1 &&
      parts[1].split('.').every(function (label) {
        return label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label);
      });
  }
  function phoneHref(value) { return 'tel:' + value.replace(/[^+\d]/g, ''); }
  function luminance(hex) {
    var rgb = [1, 3, 5].map(function (i) {
      var channel = parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  function contrast(a, b) {
    var first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }
  function readable(background, preferred) {
    if (contrast(background, preferred) >= 4.5) return preferred;
    return contrast(background, '#000000') >= contrast(background, '#ffffff') ? '#000000' : '#ffffff';
  }
  function iconFile(icon, background) {
    if (!Object.prototype.hasOwnProperty.call(icons, icon) || !/^#[0-9a-f]{6}$/i.test(background)) throw new TypeError('Use an available icon and six-digit background color.');
    return icon === 'none' ? '' : 'icon-' + icon + (contrast(background, cream) >= 3 ? '' : '-dark') + '.png';
  }
  // Arial bold advances plus a small allowance for rounding and fallback fonts.
  var glyphGroups = [[0.278, " .,/'Iijl"], [0.333, '!()-:;[]`ft'], [0.389, '*r'],
    [0.474, '"'], [0.5, 'z'], [0.556, '#$0123456789Jaceksvxy'],
    [0.584, '+<=>^~'], [0.611, '?FLTZbdghnopqu'], [0.667, 'EPSVXY'],
    [0.722, '&ABCDHKNRU'], [0.778, 'GOQw'], [0.833, 'M'], [0.889, '%m'],
    [0.944, 'W'], [0.975, '@'], [0.556, '_'], [0.333, '{}'], [0.28, '|\\']];
  function units(text, fixed) {
    return Array.from(text).reduce(function (sum, c) {
      // Color emoji fallback glyphs can be wider than a full em on Windows.
      if (c.codePointAt(0) > 0xffff) return sum + 1.5;
      if (fixed) return sum + (/[^\u0000-\u00ff]/.test(c) && c !== '·' ? 1 : 0.61);
      var base = c.normalize('NFD')[0], group = glyphGroups.find(function (entry) { return entry[1].indexOf(base) !== -1; });
      return sum + (group ? group[0] + 0.025 : 1.1);
    }, 0);
  }
  function wrap(text, width, font, fixed, spacing) {
    if (!text) return [];
    var lines = [], current = '';
    text.split(' ').forEach(function (word) {
      var next = current ? current + ' ' + word : word;
      if (units(next, fixed) * font + Array.from(next).length * (spacing || 0) <= width) { current = next; return; }
      if (current) { lines.push(current); current = ''; }
      Array.from(word).forEach(function (c) {
        if (current && units(current + c, fixed) * font + Array.from(current + c).length * (spacing || 0) > width) { lines.push(current); current = ''; }
        current += c;
      });
    });
    if (current) lines.push(current);
    return lines;
  }
  function linkLabel(value) {
    var safe = webURL(value);
    if (!safe) return '';
    var url = new URL(safe), host = url.hostname.replace(/^www\./, ''), label = host + url.pathname.replace(/\/$/, '');
    return label.length <= 34 ? label : host;
  }
  function selectedPattern(v) { return v.pattern === 'auto' ? (v.design === 'original' ? 'dots' : v.design) : v.pattern; }
  var flowingPatterns = Object.freeze(['cutpaper','colorfield','chromatic','counterform','overprint','gesture']);
  function resolveArtworkPlacement(values) {
    var v = values || defaults, placement = v.artworkPlacement || 'auto';
    return placement === 'auto' ? (flowingPatterns.includes(selectedPattern(v)) ? 'flow' : 'motif') : placement;
  }
  function flowAsset(values) {
    var v = values || defaults;
    return resolveArtworkPlacement(v) === 'flow' && flowingPatterns.includes(selectedPattern(v)) ?
      'pattern-' + selectedPattern(v) + (v.layout === 'stacked' ? '-tall.png' : '-wide.png') : '';
  }
  function isFlow(v) { return resolveArtworkPlacement(v) === 'flow' && flowingPatterns.includes(selectedPattern(v)); }
  function isBackground(v) { return resolveArtworkPlacement(v) === 'background'; }
  function isCanvasArtwork(v) { return isFlow(v) || isBackground(v); }
  function hasPortrait(v) { return Boolean(v.portraitData || v.portraitUrl); }
  function lineWidth(lines,font,fixed,spacing,factor) {
    return Math.ceil(Math.max.apply(null,lines.map(function (text) { return units(text,fixed) * font * (factor || 1) + Array.from(text).length * (spacing || 0); }).concat(0)));
  }
  // Format controls resolve once into the sizes shared by measurement and
  // markup. Zero sizes keep the template; percentages scale template gaps.
  function scaled(base, percent) { return percent === 100 ? base : Math.round(base * percent / 100); }
  function leading(base, v) { return v.lineSpacing === 100 ? base : Math.max(1, Math.round(base * v.lineSpacing / 100)); }
  function gapRow(height) { return height > 0 ? spacer(height) : ''; }
  function typeStyle(v) {
    var title = v.titleFontSize, subtitle = v.subtitleFontSize, contact = v.contactFontSize, footer = v.footerFontSize, fixed = v.contactFont !== 'sans';
    return {titleFont:title || 9, titleLine:leading(title ? Math.ceil(title * 11 / 9) : 11,v), titleSpacing:title ? Math.round(title * 73 / 9) / 100 : .73,
      subFont:subtitle || 9, subLine:leading(subtitle ? Math.ceil(subtitle * 4 / 3) : 12,v),
      contactFont:contact || 10.5, contactLine:leading(contact ? Math.ceil(contact * 4 / 3) : 14,v), contactFixed:fixed, contactFamily:fixed ? mono : sans,
      tagFont:footer || 8.5, tagLine:leading(footer ? Math.ceil(footer * 22 / 17) : 11,v), separator:Object.prototype.hasOwnProperty.call(contactSeparators,v.contactSeparator) ? contactSeparators[v.contactSeparator] : ''};
  }
  // Name layouts change only the displayed lines; stored manual breaks remain.
  // Automatic sizes shrink into the measured room. An explicit size is kept
  // and validation reports the overflow instead of silently reducing it.
  function nameFit(v, lines, room, size, fixed, factor) {
    var joined = [v.nameLine1, v.nameLine2].filter(Boolean).join(' ');
    if (v.nameLayout === 'wrap') {
      var word = Math.max.apply(null,joined.split(' ').map(function (part) { return units(part,fixed); }).concat(1)) * factor;
      size = v.nameFontSize || Math.floor(Math.min(size,room / word) * 10) / 10;
      // The tiny allowance stops float rounding from splitting a word that fits exactly.
      return {lines:wrap(joined,room + 1e-9,size * factor,fixed),size:size,need:word * size,room:room};
    }
    if (v.nameLayout === 'single') lines = joined ? [joined] : [];
    var longest = Math.max.apply(null,lines.map(function (name) { return units(name,fixed); }).concat(1)) * factor;
    size = v.nameFontSize || Math.min(size,room / longest);
    return {lines:lines,size:size,need:longest * size,room:room};
  }
  function contactRows(v, room, st) {
    var rows = [];
    // Hidden contacts are left out of every layout; their stored values remain.
    function add(key, label, text, href) {
      if (text && v[key + 'Visible'] !== 'hide') rows.push({key:key,label:label,icon:v[key + 'Icon'],text:text,room:room,lines:wrap(text,room,st.contactFont,st.contactFixed),href:href});
    }
    add('website','Website',v.website && (v.websiteLabel || linkLabel(v.website)),webURL(v.website));
    add('email','Email',v.email,'mailto:' + encodeURIComponent(v.email).replace(/%40/g,'@'));
    add('phone','Phone',v.phone,phoneHref(v.phone));
    add('linkedin','LinkedIn',v.linkedin && linkLabel(v.linkedin),webURL(v.linkedin));
    add('location','Location',v.location,'');
    return rows;
  }
  // Stacked rows are as tall as their text or their 14 px icon, whichever is taller.
  function contactHeight(row, st, labelH) { return (labelH || 0) + Math.max(row.lines.length * st.contactLine,row.icon === 'none' ? 0 : 14); }
  // Inline contacts keep every item whole and start another measured row only
  // when the next item would cross the available width. An item wider than a
  // whole row wraps inside its own cell rather than being clipped.
  // A separator cell replaces the gap between two items in the same row, so
  // it is measured with the packing and can never lead, trail or stand alone.
  function packContacts(rows, room, st, itemGap, rowGap, labelH) {
    var iconTop = st.contactLine > 14 ? Math.floor((st.contactLine - 14) / 2) : 0, lines = [];
    var joint = st.separator ? itemGap + lineWidth([st.separator],st.contactFont,st.contactFixed) + 2 : itemGap;
    rows.forEach(function (row) {
      var iconW = row.icon === 'none' ? 0 : 20, labelW = labelH ? lineWidth([row.label.toUpperCase()],7.5,st.contactFixed) : 0;
      row.room = room - iconW - 2;
      row.lines = iconW + lineWidth([row.text],st.contactFont,st.contactFixed) + 2 > room ? wrap(row.text,row.room,st.contactFont,st.contactFixed) : [row.text];
      var textW = Math.max(lineWidth(row.lines,st.contactFont,st.contactFixed),labelW) + 2, width = iconW + textW, line = lines[lines.length - 1];
      var height = labelH + Math.max(row.lines.length * st.contactLine,iconW ? iconTop + 14 : 0);
      if (line && line.width + joint + width <= room) line.width += joint + width;
      else lines.push(line = {items:[],width:width,height:0});
      line.items.push({row:row,iconW:iconW,textW:textW});
      line.height = Math.max(line.height,height);
    });
    return {lines:lines,iconTop:iconTop,joint:joint,width:Math.max.apply(null,lines.map(function (line) { return line.width; }).concat(0)),
      height:lines.reduce(function (sum,line) { return sum + line.height; },0) + Math.max(0,lines.length - 1) * rowGap};
  }
  function typed(p, st, name, packed) {
    return Object.assign(p,st,{nameNeed:name.need,nameRoom:name.room,inline:packed ? packed.lines : null,iconTop:packed ? packed.iconTop : 0,separatorW:packed ? packed.joint : 0});
  }
  var crcTable = Array.from({length:256}, function (_, n) {
    for (var k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function imageBytes(body, length) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', bytes = new Uint8Array(length), out = 0;
    for (var i = 0; i < body.length; i += 4) {
      var n = (alphabet.indexOf(body[i]) << 18) | (alphabet.indexOf(body[i + 1]) << 12) |
        (Math.max(0, alphabet.indexOf(body[i + 2])) << 6) | Math.max(0, alphabet.indexOf(body[i + 3]));
      if (out < length) bytes[out++] = n >>> 16;
      if (out < length) bytes[out++] = n >>> 8;
      if (out < length) bytes[out++] = n;
    }
    return bytes;
  }
  function croppedDimensionsOK(w, h) { return w > 0 && w === h && w <= 4096; }
  function pngStructureOK(bytes) {
    var signature = [137,80,78,71,13,10,26,10];
    if (bytes.length < 67 || !signature.every(function (value, i) { return value === bytes[i]; })) return false;
    var view = new DataView(bytes.buffer), offset = 8, header = false, data = false;
    while (offset + 12 <= bytes.length) {
      var length = view.getUint32(offset), end = offset + length + 12;
      if (end > bytes.length) return false;
      var type = String.fromCharCode.apply(null, bytes.subarray(offset + 4, offset + 8));
      var crc = 0xffffffff;
      for (var i = offset + 4; i < end - 4; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
      if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end - 4)) return false;
      if (!header) {
        if (type !== 'IHDR' || length !== 13 || !croppedDimensionsOK(view.getUint32(offset + 8),view.getUint32(offset + 12))) return false;
        var depth = bytes[offset + 16], color = bytes[offset + 17];
        var depths = {0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
        if (!depths[color] || !depths[color].includes(depth) || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20] > 1) return false;
        header = true;
      } else if (type === 'IHDR') return false;
      if (type === 'IDAT' && length) data = true;
      if (type === 'IEND') return length === 0 && data && end === bytes.length;
      offset = end;
    }
    return false;
  }
  function jpegStructureOK(bytes) {
    if (bytes.length < 32 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) return false;
    var offset = 2, frame = false;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) return false;
      while (bytes[offset] === 255) offset++;
      var marker = bytes[offset++], length = (bytes[offset] << 8) | bytes[offset + 1], end = offset + length;
      if (length < 2 || end > bytes.length - 2) return false;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        if (length < 11 || ![8,12,16].includes(bytes[offset + 2]) || !croppedDimensionsOK((bytes[offset + 5] << 8) | bytes[offset + 6],(bytes[offset + 3] << 8) | bytes[offset + 4])) return false;
        var components = bytes[offset + 7];
        if (components < 1 || components > 4 || length !== 8 + components * 3) return false;
        frame = true;
      }
      if (marker === 218) {
        var scanComponents = bytes[offset + 2];
        return frame && scanComponents >= 1 && scanComponents <= 4 && length === 6 + scanComponents * 2 && end < bytes.length - 2;
      }
      if (marker === 0 || marker === 216 || marker === 217) return false;
      offset = end;
    }
    return false;
  }
  var lastPortraitData = '', lastPortraitValid = false;
  function portraitDataOK(value) {
    if (value === lastPortraitData) return lastPortraitValid;
    lastPortraitData = value; lastPortraitValid = false;
    var match = /^data:image\/(jpeg|png);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(value);
    if (!match || !match[2]) return false;
    var body = match[2], bytes = body.length * 3 / 4 - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0);
    if (bytes > 240 * 1024 || bytes < 32) return false;
    var decoded = imageBytes(body, bytes);
    lastPortraitValid = match[1] === 'png' ? pngStructureOK(decoded) : jpegStructureOK(decoded);
    return lastPortraitValid;
  }
  function plan(v) {
    v = compositionValues(v);
    if (v.cardFormat === 'single') return singlePlan(v);
    if (v.design !== 'original' && v.cardFormat !== 'front-back') return designPlan(v);
    var st = typeStyle(v), padded = v.contentPadding >= 0;
    var pad = padded ? v.contentPadding : Math.round(18 + (v.width - 280) * 0.1), top = padded ? v.contentPadding : v.height < 200 ? 18 : 22;
    var dotH = Math.min(v.height - 26, 182), dotW = Math.round(dotH * 76 / 182);
    if (selectedPattern(v) === 'none' || isCanvasArtwork(v)) dotW = 0;
    if (hasPortrait(v)) dotW = Math.max(dotW, v.portraitSize);
    var right = padded ? v.contentPadding : 11, gap = dotW ? 10 : 0, textW = v.width - pad - right - gap - dotW;
    var matPad = isFlow(v) ? 7 : 0, contentW = textW - matPad * 2;
    var typography = nameTypography(v), styledFace = v.cardFormat === 'front-back' && v.design !== 'original';
    var fixedName = styledFace && typography.fixed, factor = styledFace && typography.serif ? 1.12 : 1;
    var name = nameFit(v, [v.nameLine1, v.nameLine2].filter(Boolean), contentW - 2, styledFace ? typography.size : Math.min(24, 22 * v.width / 321), fixedName, factor);
    var names = name.lines, nameFont = name.size, nameLine = leading(Math.ceil(nameFont * 1.12), v);
    var titleLines = wrap(v.title, contentW, st.titleFont, true, st.titleSpacing);
    var subLines = wrap(v.subtitle, contentW, st.subFont, true);
    var square = v.height < 200 ? 15 : 17, titleGap = scaled(7, v.textSpacing), subGap = scaled(11, v.textSpacing);
    var titleH = titleLines.length ? titleGap + titleLines.length * st.titleLine : 0;
    var subH = subLines.length ? subGap + subLines.length * st.subLine : 0;
    var frontSpace = v.height - 2 * top - square - names.length * nameLine - titleH - subH - matPad * 2;
    var innerW = v.width - pad * 2, contactW = innerW - 39 - matPad * 2;
    var rows = contactRows(v, contactW - 2, st), rowGap = scaled(v.height < 200 ? 4 : 6, v.contactSpacing), itemGap = scaled(18, v.contactSpacing);
    var packed = v.contactLayout === 'inline' ? packContacts(rows, innerW - matPad * 2, st, itemGap, rowGap, 0) : null;
    var tagLines = v.footerVisible === 'hide' ? [] : wrap(v.tags, innerW - matPad * 2, st.tagFont, true);
    var contactH = packed ? packed.height : rows.reduce(function (sum, row) { return sum + contactHeight(row, st); }, 0) + Math.max(0, rows.length - 1) * rowGap;
    var footerGap = scaled(12, v.sectionSpacing), tagH = tagLines.length ? footerGap + 1 + 8 + tagLines.length * st.tagLine : 0;
    var backSpace = v.height - top * 2 - square - contactH - tagH - matPad * 2;
    var identityW = Math.min(contentW,Math.max(lineWidth(names,Math.floor(nameFont * 10) / 10,fixedName,0,factor),lineWidth(titleLines,st.titleFont,true,st.titleSpacing),lineWidth(subLines,st.subFont,true)));
    var contactsW = packed ? packed.width : Math.max.apply(null,rows.map(function (row) { return 39 + lineWidth(row.lines,st.contactFont,st.contactFixed); }).concat(0));
    var groupW = Math.min(innerW - matPad * 2,Math.max(lineWidth(tagLines,st.tagFont,true),contactsW));
    return typed({pad:pad,top:top,dotH:dotH,dotW:dotW,right:right,gap:gap,textW:textW,nameFont:nameFont,
      nameLine:nameLine,names:names,square:square,titleLines:titleLines,subLines:subLines,frontSpace:frontSpace,
      innerW:innerW,contactW:contactW,rows:rows,rowGap:rowGap,tagLines:tagLines,backSpace:backSpace,matPad:matPad,identityW:identityW,groupW:groupW,
      labelH:0,itemGap:itemGap,titleGap:titleGap,subGap:subGap,footerGap:footerGap,frontGap:scaled(Math.round(v.height * 0.19), v.sectionSpacing),
      backGap:scaled(21, v.sectionSpacing),titleRoom:contentW,tagRoom:innerW - matPad * 2},st,name,packed);
  }
  function nameTypography(v) {
    var font = v.customFont || (v.design === 'editorial' ? 'serif' : v.design === 'signal' ? 'mono' : 'sans');
    return {family:font === 'serif' ? 'Georgia,Times,serif' : font === 'mono' ? mono : sans,
      fixed:font === 'mono',serif:font === 'serif',weight:font === 'serif' ? 400 : 600,
      size:v.design === 'original' ? Math.min(24,22 * v.width / 321) : v.design === 'editorial' ? 34 : v.design === 'studio' ? 32 : 30};
  }
  // Single cards measure complete content groups instead of joining two fixed
  // faces. This plan never calls canvasSize, so dimensions can share it safely.
  function singlePlan(v) {
    var tall = v.layout === 'stacked', W = tall ? v.width : v.width * 2, st = typeStyle(v);
    // Rows keeps identity above contacts on either canvas; Automatic keeps the
    // historical wide columns and tall stacking.
    var stack = v.singleArrangement === 'rows' || (v.singleArrangement !== 'columns' && tall);
    var frame = v.design === 'signal' ? 4 : 0, rail = v.design === 'studio' ? 14 : 0;
    var pad = v.contentPadding >= 0 ? v.contentPadding : v.width < 300 ? 18 : 22, bodyW = W - frame * 2 - rail, innerW = bodyW - pad * 2;
    var sectionGap = scaled(stack ? 18 : 24,v.sectionSpacing), idW = stack ? innerW : Math.floor((innerW - sectionGap) * .5);
    var contactPanelW = stack ? innerW : innerW - idW - sectionGap;
    var motif = selectedPattern(v) !== 'none' && !isCanvasArtwork(v);
    var dotW = motif ? 76 : 0, dotH = motif ? Math.min(160,v.height - 26) : 0;
    if (hasPortrait(v)) { dotW = Math.max(dotW,v.portraitSize); dotH = Math.max(dotH,v.portraitSize); }
    var gap = dotW ? 14 : 0, textW = idW - dotW - gap, matPad = isFlow(v) ? 7 : 0, contentW = textW - matPad * 2;
    var typography = nameTypography(v), factor = typography.serif ? 1.12 : 1;
    var name = nameFit(v,[v.nameLine1,v.nameLine2].filter(Boolean),contentW - 2,typography.size,typography.fixed,factor);
    var names = name.lines, nameFont = name.size, nameLine = leading(Math.ceil(nameFont * 1.12),v);
    var titleLines = wrap(v.title,contentW - 2,st.titleFont,true,st.titleSpacing), subLines = wrap(v.subtitle,contentW - 2,st.subFont,true);
    var titleGap = scaled(7,v.textSpacing), subGap = scaled(11,v.textSpacing);
    var textH = names.length * nameLine + (titleLines.length ? titleGap + titleLines.length * st.titleLine : 0) + (subLines.length ? subGap + subLines.length * st.subLine : 0) + matPad * 2;
    var brandH = frame || rail ? 0 : v.design === 'original' ? 17 : v.design === 'orbit' ? 3 : 2;
    var brandW = v.design === 'original' ? 17 : v.design === 'editorial' ? 42 : 28, brandGap = brandH ? scaled(14,v.textSpacing) : 0;
    dotH = Math.min(dotH,Math.max(hasPortrait(v) ? v.portraitSize : 0,brandH + brandGap + textH));
    var identityH = Math.max(brandH + brandGap + textH,dotH);
    var contactW = contactPanelW - 39 - matPad * 2, rowGap = scaled(6,v.contactSpacing), itemGap = scaled(18,v.contactSpacing), labelH = v.design === 'signal' ? 10 : 0;
    var rows = contactRows(v,contactW - 2,st), packed = v.contactLayout === 'inline' ? packContacts(rows,contactPanelW - matPad * 2,st,itemGap,rowGap,labelH) : null;
    var tagLines = v.footerVisible === 'hide' ? [] : wrap(v.tags,contactPanelW - matPad * 2,st.tagFont,true);
    var contactH = packed ? packed.height : rows.reduce(function (sum,row) { return sum + contactHeight(row,st,labelH); },0) + Math.max(0,rows.length - 1) * rowGap;
    var footerGap = scaled(v.design === 'original' ? 12 : 14,v.sectionSpacing);
    var tagSpace = v.design === 'original' ? (rows.length ? footerGap : 0) + 1 + 8 : (rows.length ? footerGap : 0);
    contactH += tagLines.length ? tagSpace + tagLines.length * st.tagLine : 0;
    if (rows.length || tagLines.length) contactH += matPad * 2;
    var hasContacts = contactH > 0, groupH = stack ? identityH + (hasContacts ? sectionGap + contactH : 0) : Math.max(identityH,contactH);
    var H = Math.max(v.height,Math.ceil(groupH + pad * 2 + frame * 2));
    var identityW = Math.min(contentW,Math.max(lineWidth(names,Math.floor(nameFont * 10) / 10,typography.fixed,0,factor),lineWidth(titleLines,st.titleFont,true,st.titleSpacing),lineWidth(subLines,st.subFont,true)));
    var contactsW = packed ? packed.width : Math.max.apply(null,rows.map(function (row) {return 39 + Math.max(lineWidth(row.lines,st.contactFont,st.contactFixed),labelH ? lineWidth([row.label.toUpperCase()],7.5,st.contactFixed) : 0);}).concat(0));
    var groupW = Math.min(contactPanelW - matPad * 2,Math.max(lineWidth(tagLines,st.tagFont,true),contactsW));
    return typed({single:true,tall:tall,stack:stack,W:W,H:H,frame:frame,rail:rail,pad:pad,bodyW:bodyW,bodyH:H - frame * 2,innerW:innerW,
      idW:idW,contactPanelW:contactPanelW,sectionGap:sectionGap,textW:textW,matPad:matPad,dotW:dotW,dotH:dotH,gap:gap,
      typography:typography,names:names,nameFont:nameFont,nameLine:nameLine,titleLines:titleLines,subLines:subLines,
      brandW:brandW,brandH:brandH,brandGap:brandGap,identityH:identityH,identityW:identityW,
      rows:rows,contactW:contactW,rowGap:rowGap,labelH:labelH,tagLines:tagLines,contactH:contactH,groupW:groupW,
      hasContacts:hasContacts,frontSpace:0,backSpace:0,itemGap:itemGap,titleGap:titleGap,subGap:subGap,footerGap:footerGap,
      titleRoom:contentW - 2,tagRoom:contactPanelW - matPad * 2},st,name,packed);
  }
  // Every design uses this measured plan for both validation and rendering.
  // Fixed line breaks keep email clients from stretching the declared cards.
  function designPlan(v) {
    var tall = v.layout === 'stacked', size = canvasSize(v), W = size.width, H = size.height, st = typeStyle(v);
    var pad = H < 220 ? 16 : 22, compact = !tall && H < 220, idPad = tall ? pad : compact ? 8 : 12;
    var cPad = tall ? pad : compact ? (v.design === 'signal' ? 7 : 8) : 12, rowGap = scaled(compact ? 4 : 10,v.contactSpacing), gridGap = scaled(18,v.contactSpacing);
    var matPad = isFlow(v) ? 7 : 0;
    // Flowing artwork keeps its readable mat inside the chosen padding.
    if (v.contentPadding >= 0) idPad = cPad = Math.max(v.contentPadding,matPad);
    idPad -= matPad; cPad -= matPad;
    var artW = selectedPattern(v) === 'none' || isCanvasArtwork(v) ? 0 : (v.design === 'editorial' ? 46 : 76);
    if (hasPortrait(v)) artW = Math.max(artW, v.portraitSize);
    var artGap = artW ? 16 : 0, rail = v.design === 'studio' ? 14 : 0, frame = v.design === 'signal' ? 4 : 0;
    var bodyW = W - rail - frame * 2, bodyH = H - frame * 2, mainW = bodyW;
    var side = !tall && (v.design === 'orbit' || v.design === 'studio');
    var idW = side ? Math.round(bodyW * (v.design === 'studio' ? .57 : .56)) : bodyW;
    var contactPanelW = side ? bodyW - idW : bodyW, contactOffset = 0;
    var artRail = v.design === 'prism' || (v.design === 'signal' && !tall);
    if (artRail && artW) { mainW = bodyW - artW - 16; idW = mainW; contactPanelW = mainW; }
    if (v.design === 'prism' && !tall) { contactOffset = 36; contactPanelW -= contactOffset; }
    var textW = idW - idPad * 2 - (!artRail ? artW + artGap : 0);
    var contentW = textW - matPad * 2;
    var fixedName = v.customFont ? v.customFont === 'mono' : v.design === 'signal', serif = v.customFont ? v.customFont === 'serif' : v.design === 'editorial';
    var names = [v.nameLine1, v.nameLine2].filter(Boolean);
    var nameFont = v.design === 'editorial' ? 34 : v.design === 'studio' ? 32 : 30;
    if (compact && ['contour','prism','signal'].includes(v.design)) nameFont = 26;
    var joined = !tall && !side;
    if (joined) {
      var joint = names.join(' '), jointWidth = units(joint, fixedName) * (serif ? 1.12 : 1);
      if ((contentW - 3) / Math.max(1,jointWidth) >= (v.nameFontSize || 20)) names = [joint];
    }
    var name = nameFit(v,names,contentW - 3,nameFont,fixedName,serif ? 1.12 : 1);
    names = name.lines; nameFont = name.size;
    var nameLine = leading(Math.ceil(nameFont * 1.12),v), titleLines = wrap(v.title,contentW - 2,st.titleFont,true,st.titleSpacing), subLines = wrap(v.subtitle,contentW - 2,st.subFont,true);
    var titleGap = scaled(7,v.textSpacing), subGap = scaled(10,v.textSpacing), headGap = scaled(v.design === 'studio' ? 12 : 9,v.textSpacing);
    var titleH = titleLines.length ? titleGap + titleLines.length * st.titleLine : 0, subH = subLines.length ? subGap + subLines.length * st.subLine : 0;
    var frontHead = v.design === 'studio' ? 8 + headGap : v.design === 'orbit' ? 3 + headGap : 0;
    var identityH = names.length * nameLine + titleH + subH + frontHead + matPad * 2;
    var topH = side ? H : Math.round(bodyH * (tall ? (v.design === 'signal' ? .39 : .48) : (v.design === 'editorial' ? .52 : .47)));
    if (!side) topH = Math.max(topH, identityH + idPad * 2, !artRail && hasPortrait(v) ? v.portraitSize + idPad * 2 : 0);
    var contactPanelH = side ? H : bodyH - topH;
    var cols = v.contactLayout === 'stacked' || side ? 1 : tall ? (v.design === 'contour' ? 2 : 1) : 2;
    var innerW = contactPanelW - cPad * 2, workingW = innerW - matPad * 2;
    var cellW = Math.floor((workingW - gridGap * (cols - 1)) / cols), contactW = cellW - 22;
    var rows = contactRows(v,contactW - 2,st);
    if (tall && cols > 1 && rows.some(function (row) { return row.lines.length > 2; })) {
      cols = 1; cellW = workingW; contactW = cellW - 22;
      rows.forEach(function (row) { row.room = contactW - 2; row.lines = wrap(row.text,row.room,st.contactFont,st.contactFixed); });
    }
    var labelH = v.design === 'signal' ? 10 : 0, contactH = 0;
    var packed = v.contactLayout === 'inline' ? packContacts(rows,workingW,st,gridGap,rowGap,labelH) : null;
    if (packed) contactH = packed.height;
    else for (var i = 0; i < rows.length; i += cols) {
      contactH += Math.max.apply(null,rows.slice(i,i + cols).map(function (row) { return contactHeight(row,st,labelH); }));
      if (i + cols < rows.length) contactH += rowGap;
    }
    var tagLines = v.footerVisible === 'hide' ? [] : wrap(v.tags,workingW - 2,st.tagFont,true), footerGap = scaled(8,v.sectionSpacing);
    var tagH = tagLines.length ? footerGap + tagLines.length * st.tagLine : 0;
    contactH += matPad * 2;
    var gridW = innerW, groupW = innerW;
    if (matPad) {
      if (packed) gridW = packed.width;
      else {
        cellW = Math.min(cellW,22 + Math.max.apply(null,rows.map(function (row) { return Math.max(lineWidth(row.lines,st.contactFont,st.contactFixed),v.design === 'signal' ? lineWidth([row.label.toUpperCase()],7.5,st.contactFixed) : 0); }).concat(0)));
        contactW = cellW - 22;
        gridW = cellW * cols + gridGap * (cols - 1);
      }
      groupW = Math.min(workingW,Math.max(rows.length ? gridW : 0,lineWidth(tagLines,st.tagFont,true)));
    }
    var identityW = Math.min(contentW,Math.max(lineWidth(names,Math.floor(nameFont * 10) / 10,fixedName,0,serif ? 1.12 : 1),lineWidth(titleLines,st.titleFont,true,st.titleSpacing),lineWidth(subLines,st.subFont,true),frontHead ? 28 : 0));
    if (!side) {
      var minTop = Math.max(identityH + idPad * 2, !artRail && hasPortrait(v) ? v.portraitSize + idPad * 2 : 0);
      topH = Math.max(minTop, Math.min(topH, bodyH - cPad * 2 - contactH - tagH - (['editorial','contour','prism'].includes(v.design) ? 1 : 0)));
      contactPanelH = bodyH - topH;
    }
    var dotH = Math.min(artRail ? bodyH - idPad * 2 : topH - idPad * 2, 182);
    return typed({tall:tall,W:W,H:H,bodyW:bodyW,bodyH:bodyH,mainW:mainW,pad:pad,idPad:idPad,cPad:cPad,rail:rail,frame:frame,
      side:side,artRail:artRail,idW:idW,topH:topH,contactPanelW:contactPanelW,contactPanelH:contactPanelH,contactOffset:contactOffset,
      dotH:dotH,dotW:artW,gap:artGap,textW:textW,nameFont:nameFont,nameLine:nameLine,names:names,titleLines:titleLines,subLines:subLines,
      frontHead:frontHead,frontSpace:topH - idPad * 2 - identityH,identityH:identityH,innerW:innerW,contactW:contactW,cellW:cellW,
      cols:cols,gridGap:gridGap,rows:rows,rowGap:rowGap,tagLines:tagLines,labelH:labelH,
      contactH:contactH,tagH:tagH,backSpace:contactPanelH - cPad * 2 - contactH - tagH - (['editorial','contour','prism'].includes(v.design) ? 1 : 0),matPad:matPad,identityW:identityW,gridW:gridW,groupW:groupW,
      itemGap:gridGap,titleGap:titleGap,subGap:subGap,headGap:headGap,footerGap:footerGap,titleRoom:contentW - 2,tagRoom:workingW - 2},st,name,packed);
  }

  function validate(values) {
    var v = normalize(values), errors = {};
    [['width',280,420],['height',180,320],['cardGap',0,60],['artworkScale',25,400],['artworkOpacity',0,100],['artworkFadeAngle',0,360],['artworkFadeX',0,100],['artworkFadeY',0,100],['artworkPositionX',0,100],['artworkPositionY',0,100],['motifScale',25,100],['motifPositionX',0,100],['motifPositionY',0,100],
      ['lineSpacing',80,200],['textSpacing',0,200],['contactSpacing',0,200],['sectionSpacing',0,200]].forEach(function (rule) {
      var raw = values && typeof values === 'object' ? values[rule[0]] : undefined;
      if (raw !== undefined && ((typeof raw !== 'number' && typeof raw !== 'string') ||
        String(raw).trim() === '' || !Number.isInteger(Number(raw)) || Number(raw) < rule[1] || Number(raw) > rule[2])) {
        errors[rule[0]] = 'Enter a whole number from ' + rule[1] + ' to ' + rule[2] + '.';
      }
    });
    // Sizes use 0 for Auto/Template and padding uses -1 for the template inset;
    // values between those sentinels and the minimum are rejected, not clamped.
    fontSizes.concat([['contentPadding',0,48]]).forEach(function (rule) {
      var raw = values && typeof values === 'object' ? values[rule[0]] : undefined, auto = rule[0] === 'contentPadding' ? -1 : 0;
      if (raw !== undefined && ((typeof raw !== 'number' && typeof raw !== 'string') || String(raw).trim() === '' || !Number.isInteger(Number(raw)) ||
        (Number(raw) !== auto && (Number(raw) < rule[1] || Number(raw) > rule[2])))) {
        errors[rule[0]] = rule[0] === 'contentPadding' ? 'Use -1 for the template padding or a whole number from 0 to 48.' :
          'Use 0 for ' + (rule[0] === 'nameFontSize' ? 'the automatic size' : 'the template size') + ' or a whole number from ' + rule[1] + ' to ' + rule[2] + '.';
      }
    });
    Object.keys(formatChoices).forEach(function (key) {
      if (!formatChoices[key][0].includes(v[key])) errors[key] = formatChoices[key][1];
    });
    Object.keys(limits).forEach(function (key) {
      if (v[key].length > limits[key]) errors[key] = 'Use ' + limits[key] + ' characters or fewer.';
    });
    if (!v.nameLine1) errors.nameLine1 = 'Enter a first name line.';
    contactKeys.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(icons, v[key + 'Icon'])) errors[key + 'Icon'] = 'Choose an available icon or None.';
    });
    ['accent', 'frontBackground', 'backBackground'].forEach(function (key) {
      if (!/^#[0-9a-f]{6}$/i.test(v[key])) errors[key] = 'Use a six-digit hex color, such as #c8362a.';
    });
    if (v.layout !== 'paired' && v.layout !== 'stacked') errors.layout = 'Choose paired or stacked.';
    if (!['auto','single','front-back'].includes(v.cardFormat)) errors.cardFormat = 'Choose Single card or Front & back.';
    if (v.design !== 'custom' && !designs.some(function (design) { return design.id === v.design; })) errors.design = 'Choose an available design.';
    if (!Object.prototype.hasOwnProperty.call(patterns, v.pattern)) errors.pattern = 'Choose an available pattern or None.';
    if (!['auto','motif','flow','background'].includes(v.artworkPlacement)) errors.artworkPlacement = 'Choose automatic, motif, flowing or background artwork.';
    if (!['none','linear','radial'].includes(v.artworkFade)) errors.artworkFade = 'Choose no fade, linear or radial.';
    if (!['normal','reverse'].includes(v.artworkFadeDirection)) errors.artworkFadeDirection = 'Choose normal or reverse fade direction.';
    if (v.artworkPlacement === 'flow' && !flowingPatterns.includes(selectedPattern(v))) errors.artworkPlacement = 'Flow is available for the six abstract artworks. Choose automatic or motif for this pattern.';
    [['customPattern',parseCustomPattern],['customLayout',parseCustomLayout]].forEach(function (entry) {
      if (v[entry[0]]) try { entry[1](v[entry[0]]); } catch (error) { errors[entry[0]] = error.message; }
    });
    if (v.pattern === 'custom' && !v.customPattern) errors.customPattern = 'Add a valid custom artwork recipe first.';
    if (v.design === 'custom' && !v.customLayout) errors.customLayout = 'Add a valid custom layout recipe first.';
    if (!['circle','rounded','square'].includes(v.portraitShape)) errors.portraitShape = 'Choose circle, rounded or square.';
    var rawPortraitSize = values && typeof values === 'object' ? values.portraitSize : undefined;
    if (rawPortraitSize !== undefined && ((typeof rawPortraitSize !== 'number' && typeof rawPortraitSize !== 'string') ||
      String(rawPortraitSize).trim() === '' || !Number.isInteger(Number(rawPortraitSize)) || Number(rawPortraitSize) < 40 || Number(rawPortraitSize) > 96)) {
      errors.portraitSize = 'Enter a whole number from 40 to 96.';
    }
    if (v.portraitData && (v.portraitData.length > 327703 || !portraitDataOK(v.portraitData))) errors.portraitData = 'Use a cropped PNG or JPEG photo of 240 KB or less.';
    if (v.portraitUrl && (!webURL(v.portraitUrl) || !/^https:\/\//i.test(v.portraitUrl))) errors.portraitUrl = 'Use a public HTTPS URL for the cropped photo.';
    ['website', 'linkedin', 'imageBase'].forEach(function (key) {
      if ((v[key] || key === 'imageBase') && !webURL(v[key])) errors[key] = 'Use a public HTTP or HTTPS URL.';
    });
    if (v.imageBase && /[?#]/.test(v.imageBase)) errors.imageBase = 'Use an image folder URL without a query or fragment.';
    if (v.email && !emailOK(v.email)) errors.email = 'Enter a valid email address.';
    if (v.phone && (!/^\+?[\d ()-]+$/.test(v.phone) || v.phone.replace(/\D/g, '').length < 5 || v.phone.replace(/\D/g, '').length > 20)) {
      errors.phone = 'Use 5–20 digits with an optional leading +, spaces, brackets, or hyphens.';
    }
    if (Object.keys(errors).length) return errors;
    var p = plan(v), wrapped = v.nameLayout === 'wrap';
    // An explicit size is never reduced. Errors name the control that caused
    // the overflow: a chosen size only when the template size would have fit.
    if (v.nameFontSize && p.nameNeed > p.nameRoom) {
      errors.nameFontSize = 'At ' + v.nameFontSize + ' px the ' + (wrapped ? 'longest name word' : 'name') + ' needs ' + Math.ceil(p.nameNeed) + ' px but ' +
        Math.max(0,Math.floor(p.nameRoom)) + ' px is available. Choose a smaller name size' + (wrapped ? '' : ', Wrap name layout') + ' or a wider card.';
    } else if (!v.nameFontSize && p.nameFont < 17) {
      if (v.nameLayout === 'single' && v.nameLine2) errors.nameLayout = 'The joined name cannot stay on one readable line here. Choose Wrap or Template name layout, or widen the card.';
      else errors[units(v.nameLine1) >= units(v.nameLine2) ? 'nameLine1' : 'nameLine2'] = 'Shorten the name lines or increase the card width for readable text.';
    }
    function tooLong(label, key) { return 'At ' + v[key] + ' px the ' + label + ' needs more than two lines here. Choose a smaller ' + label + ' size or a wider card.'; }
    if (p.titleLines.length > 2) {
      if (v.titleFontSize && wrap(v.title,p.titleRoom,9,true,.73).length <= 2) errors.titleFontSize = tooLong('title','titleFontSize');
      else errors.title = 'Shorten the title to fit two lines at this width.';
    }
    if (p.subLines.length > 2) {
      if (v.subtitleFontSize && wrap(v.subtitle,p.titleRoom,9,true).length <= 2) errors.subtitleFontSize = tooLong('subtitle','subtitleFontSize');
      else errors.subtitle = 'Shorten the subtitle to fit two lines at this width.';
    }
    p.rows.forEach(function (row) {
      if (row.lines.length <= 2) return;
      var control = v.contactFontSize ? 'contactFontSize' : v.contactFont === 'sans' ? 'contactFont' : '';
      if (control && wrap(row.text,row.room,10.5,true).length <= 2) errors[control] = row.label + ' needs more than two lines ' +
        (control === 'contactFont' ? 'in Sans. Choose Template or Mono contact font' : 'at ' + v.contactFontSize + ' px. Choose a smaller contact size') + ' or a wider card.';
      else errors[row.key] = 'Shorten this text to fit two lines at this width.';
    });
    if (p.tagLines.length > 2) {
      if (v.footerFontSize && wrap(v.tags,p.tagRoom,8.5,true).length <= 2) errors.footerFontSize = 'At ' + v.footerFontSize + ' px the footer needs more than two lines here. Choose a smaller footer size, hide the footer or use a wider card.';
      else errors.tags = 'Shorten the tags to fit two lines at this width.';
    }
    var minimumSpace = v.cardFormat !== 'single' && (v.design === 'original' || v.cardFormat === 'front-back') && !isFlow(v) ? 10 : 0;
    var formatted = Object.keys(typographyDefaults).some(function (key) { return v[key] !== typographyDefaults[key]; });
    if (p.frontSpace < minimumSpace || p.backSpace < minimumSpace) errors.height = formatted ?
      'Increase the card height, or reduce text sizes, spacing, padding or wrapped lines, to keep everything readable.' : 'Increase the card height or shorten the text to keep everything readable.';
    if (v.cardFormat === 'single' && v.layout === 'stacked' && v.singleArrangement === 'columns' && Object.keys(errors).length) {
      errors.singleArrangement = 'Side-by-side columns are narrow in the tall layout. Choose Rows or Automatic arrangement, or widen the card.';
    }
    if (!Object.keys(errors).length && renderUnchecked(v).length >= 10000) {
      errors[v.pattern === 'custom' ? 'customPattern' : 'website'] = v.pattern === 'custom' ? 'Simplify the custom artwork or shorten URLs to keep the email under 10,000 HTML characters.' : 'Shorten the URLs to keep the HTML under 10,000 characters.';
    }
    return errors;
  }
  function checked(values) {
    var errors = validate(values);
    if (Object.keys(errors).length) { var error = new TypeError('Invalid signature values.'); error.errors = errors; throw error; }
    return normalize(values);
  }
  function table(width, height, content, background) {
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="' + width + '"' +
      (height ? ' height="' + height + '"' : '') + ' style="border-collapse:collapse;table-layout:fixed;width:' + width + 'px;' +
      (height ? 'height:' + height + 'px;' : '') + (background ? 'background-color:' + background + ';' : '') + '">' + content + '</table>';
  }
  // All painted panels sample one canvas transform. In particular, the second
  // Original card continues the first painting instead of restarting the image.
  // Only backgrounds are decorative: removing them leaves every text/link intact.
  function artworkGeometry(v) {
    var size = canvasSize(v), W = size.width, H = size.height, pattern = selectedPattern(v);
    if (!isCanvasArtwork(v) || pattern === 'none') return {width:0,height:0,x:0,y:0,availableWidth:W,availableHeight:H};
    var tall = v.layout === 'stacked', wideAsset = flowingPatterns.includes(pattern);
    var baseW = wideAsset ? (tall ? 420 : 860) : 76, baseH = wideAsset ? (tall ? 660 : 320) : 182;
    if (pattern === 'custom') {
      var recipe = parseCustomPattern(v.customPattern);
      baseW = recipe.rows[0].length; baseH = recipe.rows.length;
    }
    var scale = (isBackground(v) ? Math.min(W / baseW,H / baseH) : Math.max(W / baseW,H / baseH)) * v.artworkScale / 100;
    var width = baseW * scale, height = baseH * scale;
    return {width:width,height:height,x:(W - width) * v.artworkPositionX / 100,y:(H - height) * v.artworkPositionY / 100,availableWidth:W,availableHeight:H};
  }
  function artworkBounds(values) {
    var v = normalize(values);
    try { return artworkGeometry(compositionValues(v)); }
    catch (_) {
      // Incomplete recipes still need stable slider limits while being edited.
      var size = canvasSize(v);
      return {width:0,height:0,x:0,y:0,availableWidth:size.width,availableHeight:size.height};
    }
  }
  // Native CSS rectangles keep hand-drawn art editable and avoid embedded SVG,
  // data URLs or an extra hosted upload. Equal rows and contiguous pixels merge
  // into one rectangle; validation still enforces the complete email budget.
  function backgroundRectangles(recipe) {
    var rectangles = [], cols = recipe.rows[0].length, count = recipe.rows.length;
    for (var y = 0; y < count;) {
      var repeat = 1;
      while (y + repeat < count && recipe.rows[y + repeat] === recipe.rows[y]) repeat++;
      for (var x = 0; x < cols;) {
        var run = 1, color = recipe.rows[y][x];
        while (x + run < cols && recipe.rows[y][x + run] === color) run++;
        if (color !== '.') rectangles.push({x:x / cols,y:y / count,width:run / cols,height:repeat / count,color:recipe.palette[Number(color)]});
        x += run;
      }
      y += repeat;
    }
    return rectangles;
  }
  function backgroundSurface(v, assetBase) {
    var pattern = selectedPattern(v);
    if (pattern === 'none' || !v.artworkOpacity) return table;
    var bounds = artworkGeometry(v), rectangles = pattern === 'custom' ? backgroundRectangles(parseCustomPattern(v.customPattern)) : null;
    var file = pattern === 'dots' ? 'dots.png' : 'pattern-' + pattern + (flowingPatterns.includes(pattern) ? (v.layout === 'stacked' ? '-tall' : '-wide') : '') + '.png';
    var source = (assetBase + '/' + file).replace(/[\\'"()]/g,function (character) { return '%' + character.charCodeAt(0).toString(16).toUpperCase(); });
    function px(value) { return Math.round(value * 1000) / 1000; }
    function paintStyle(x,y,background,width,height) {
      var color = background || v.frontBackground, alpha = (100 - v.artworkOpacity) / 100;
      var channels = [1,3,5].map(function (i) { return parseInt(color.slice(i,i + 2),16); }).join(',');
      var wash = 'rgba(' + channels + ',' + alpha + ')';
      var images = ['linear-gradient(' + wash + ',' + wash + ')'], sizes = ['100% 100%'], positions = ['0px 0px'];
      if (v.artworkFade !== 'none') {
        var opaque = 'rgba(' + channels + ',1)', first = v.artworkFadeDirection === 'reverse' ? opaque : wash, last = v.artworkFadeDirection === 'reverse' ? wash : opaque;
        images[0] = v.artworkFade === 'radial' ? 'radial-gradient(circle farthest-corner at ' + v.artworkFadeX + '% ' + v.artworkFadeY + '%,' + first + ' 0%,' + last + ' 100%)' :
          'linear-gradient(' + v.artworkFadeAngle + 'deg,' + first + ' 0%,' + last + ' 100%)';
        // Each face samples the same full-canvas opacity field. Positioning the
        // wash in card coordinates would restart its fade at every panel seam.
        sizes[0] = bounds.availableWidth + 'px ' + bounds.availableHeight + 'px';
        positions[0] = px(-(x || 0)) + 'px ' + px(-(y || 0)) + 'px';
      }
      function layer(image,w,h,left,top) {
        images.push(image); sizes.push(px(w) + 'px ' + px(h) + 'px'); positions.push(px(left) + 'px ' + px(top) + 'px');
      }
      if (rectangles) rectangles.forEach(function (rect) {
        var left = bounds.x + rect.x * bounds.width - (x || 0), top = bounds.y + rect.y * bounds.height - (y || 0);
        var w = rect.width * bounds.width, h = rect.height * bounds.height;
        if (left >= width || top >= height || left + w <= 0 || top + h <= 0) return;
        layer('linear-gradient(' + rect.color + ',' + rect.color + ')',w,h,left,top);
      });
      else layer('url(&quot;' + escape(source) + '&quot;)',bounds.width,bounds.height,bounds.x - (x || 0),bounds.y - (y || 0));
      return 'background-image:' + images.join(',') + ';background-repeat:no-repeat;background-size:' + sizes.join(',') + ';background-position:' + positions.join(',') + ';';
    }
    return function (width,height,content,background,x,y) {
      return table(width,height,content,background).replace('style="','style="' + paintStyle(x,y,background,width,height));
    };
  }
  function flowSurface(v, assetBase) {
    if (isBackground(v)) return backgroundSurface(v,assetBase);
    if (!isFlow(v)) return table;
    var tall = v.layout === 'stacked', size = canvasSize(v), W = size.width, H = size.height;
    var baseW = tall ? 420 : 860, baseH = tall ? 660 : 320;
    var scale = Math.max(W / baseW,H / baseH) * v.artworkScale / 100;
    var imageW = baseW * scale, imageH = baseH * scale;
    var originX = (W - imageW) * v.artworkPositionX / 100, originY = (H - imageH) * v.artworkPositionY / 100;
    var source = (assetBase + '/' + flowAsset(v)).replace(/[\\'"()]/g,function (character) { return '%' + character.charCodeAt(0).toString(16).toUpperCase(); });
    function px(value) { return Math.round(value * 1000) / 1000; }
    function paintStyle(x,y) {
      return 'background-image:url(&quot;' + escape(source) + '&quot;);background-repeat:no-repeat;background-size:' +
        px(imageW) + 'px ' + px(imageH) + 'px;background-position:' + px(originX - (x || 0)) + 'px ' + px(originY - (y || 0)) + 'px;';
    }
    function surface(width,height,content,background,x,y) {
      return table(width,height,content,background).replace('style="','style="' + paintStyle(x,y));
    }
    surface.paintStyle = paintStyle;
    return surface;
  }
  function spacer(height) { return '<tr><td height="' + height + '" style="padding:0;height:' + height + 'px;font-size:0;line-height:0">&nbsp;</td></tr>'; }
  function square(size, color) { return table(size, size, '<tr><td style="padding:0;background-color:' + color + ';font-size:0;line-height:0">&nbsp;</td></tr>'); }
  function backedText(text, background) {
    return background ? '<span style="background:' + background + '">' + text + '</span>' : text;
  }
  function informationMat(width,rows,background,pad) {
    if (!rows) return '';
    return table(width + pad * 2,0,'<tr><td style="padding:' + pad + 'px;background-color:' + background + '">' + table(width,0,rows) + '</td></tr>');
  }
  function textRow(lines, font, line, color, family, weight, spacing, background) {
    if (!lines.length) return '';
    return '<tr><td style="padding:0;font-family:' + family + ';font-size:' + font + 'px;line-height:' + line + 'px;font-weight:' + (weight || 400) + ';color:' + color + (spacing ? ';letter-spacing:' + spacing + 'px' : '') + ';white-space:nowrap">' + lines.map(function (text) { return backedText(escape(text),background); }).join('<br>') + '</td></tr>';
  }
  function blankCol(width) { return '<td width="' + width + '" style="padding:0;width:' + width + 'px;font-size:0;line-height:0">&nbsp;</td>'; }
  // Inline contact rows are ordinary fixed-width email tables: each measured
  // item keeps its icon, optional label and live link without flex or floats.
  function inlineContacts(p, color, quiet, background, assetBase) {
    // The decorative separator sits in its own unlinked cell between items.
    var mark = p.separator ? '<td width="' + p.separatorW + '" align="center" valign="top" aria-hidden="true" style="padding:' + p.labelH + 'px 0 0;font-family:' + p.contactFamily +
      ';font-size:' + p.contactFont + 'px;line-height:' + p.contactLine + 'px;color:' + quiet + ';text-align:center;white-space:nowrap">' + escape(p.separator) + '</td>' : '';
    return p.inline.map(function (line, index) {
      var cells = line.items.map(function (item, i) {
        var row = item.row, label = row.lines.map(escape).join('<br>'), icon = '';
        if (row.href) label = '<a href="' + escape(row.href) + '" style="color:' + color + ';text-decoration:none">' + label + '</a>';
        if (p.labelH) label = '<span style="display:block;font-size:7.5px;line-height:10px;color:' + quiet + '">' + row.label.toUpperCase() + '</span>' + label;
        if (item.iconW) icon = '<td width="' + item.iconW + '" valign="top" style="padding:' + (p.labelH + p.iconTop) + 'px 0 0;font-size:0;line-height:0"><img src="' +
          escape(assetBase + '/' + iconFile(row.icon,background)) + '" width="14" height="14" alt="' + row.label + '" style="display:block;width:14px;height:14px;border:0"></td>';
        return (i ? mark || (p.itemGap ? blankCol(p.itemGap) : '') : '') + icon + '<td width="' + item.textW + '" valign="top" style="padding:0;font-family:' + p.contactFamily +
          ';font-size:' + p.contactFont + 'px;line-height:' + p.contactLine + 'px;color:' + color + ';white-space:nowrap">' + label + '</td>';
      }).join('');
      return '<tr><td style="padding:' + (index < p.inline.length - 1 && p.rowGap ? '0 0 ' + p.rowGap + 'px' : '0') + '">' + table(line.width,0,'<tr>' + cells + '</tr>') + '</td></tr>';
    }).join('');
  }
  function portraitSource(v, options) {
    return options && (options.preview === true || options.allowPortraitData === true) ? v.portraitData || v.portraitUrl : v.portraitUrl;
  }
  function mosaic(recipe, maxWidth, maxHeight, exactSize) {
    var cols = recipe.rows[0].length, count = recipe.rows.length, unit = Math.min(maxWidth / cols,maxHeight / count);
    // At least one email pixel per cell. A large portrait can replace the artwork.
    if (unit < 1) return '';
    var width = exactSize ? exactSize.width : Math.floor(cols * unit), height = exactSize ? exactSize.height : Math.floor(count * unit), columns = '', rows = '';
    for (var col = 0; col < cols; col++) columns += '<col width="' + (Math.round((col + 1) * width / cols) - Math.round(col * width / cols)) + '">';
    for (var y = 0; y < count;) {
      var repeat = 1;
      while (y + repeat < count && recipe.rows[y + repeat] === recipe.rows[y]) repeat++;
      var h = Math.round((y + repeat) * height / count) - Math.round(y * height / count), cells = '';
      for (var x = 0; x < cols;) {
        var run = 1, index = recipe.rows[y][x];
        while (x + run < cols && recipe.rows[y][x + run] === index) run++;
        cells += '<td' + (run > 1 ? ' colspan="' + run + '"' : '') + (index === '.' ? '' : ' bgcolor="' + recipe.palette[Number(index)] + '"') + '></td>';
        x += run;
      }
      rows += '<tr height="' + h + '" style="height:' + h + 'px">' + cells + '</tr>';
      y += repeat;
    }
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="' + width + '" height="' + height + '" style="border-collapse:collapse;table-layout:fixed;width:' + width + 'px;height:' + height + 'px;font-size:0;line-height:0"><colgroup>' + columns + '</colgroup>' + rows + '</table>';
  }
  function motifGeometry(v, p) {
    var pattern = selectedPattern(v), availableW = p.dotW, availableH = Math.max(0,p.dotH - (hasPortrait(v) ? v.portraitSize + 10 : 0));
    if (isCanvasArtwork(v) || pattern === 'none' || availableW < 1 || availableH < 1) return {width:0,height:0,x:0,y:0,availableWidth:availableW,availableHeight:availableH};
    var width, height;
    if (pattern === 'custom') {
      var recipe = parseCustomPattern(v.customPattern), cols = recipe.rows[0].length, count = recipe.rows.length;
      var unit = Math.min(availableW / cols,availableH / count);
      if (unit < 1) return {width:0,height:0,x:0,y:0,availableWidth:availableW,availableHeight:availableH};
      unit = Math.max(1,unit * v.motifScale / 100);
      width = Math.floor(cols * unit); height = Math.floor(count * unit);
    } else {
      height = Math.max(1,Math.floor(Math.min(availableH,Math.floor(availableW * 182 / 76)) * v.motifScale / 100));
      width = Math.max(1,Math.round(height * 76 / 182));
    }
    return {width:width,height:height,x:Math.round((availableW - width) * v.motifPositionX / 100),y:Math.round((availableH - height) * v.motifPositionY / 100),availableWidth:availableW,availableHeight:availableH};
  }
  function motifBounds(values) {
    var v = compositionValues(normalize(values));
    return motifGeometry(v,plan(v));
  }
  function decoration(v, p, assetBase, options) {
    var pattern = isCanvasArtwork(v) ? 'none' : selectedPattern(v), source = portraitSource(v, options), rows = '', remaining = p.dotH;
    if (source) {
      var radius = v.portraitShape === 'circle' ? '50%' : v.portraitShape === 'rounded' ? '12px' : '0';
      rows += '<tr><td align="center" style="padding:0;font-size:0;line-height:0"><img src="' + escape(source) + '" width="' + v.portraitSize +
        '" height="' + v.portraitSize + '" alt="' + escape([v.nameLine1,v.nameLine2].filter(Boolean).join(' ')) + '" style="display:block;width:' +
        v.portraitSize + 'px;height:' + v.portraitSize + 'px;border:0;border-radius:' + radius + '"></td></tr>';
      remaining -= v.portraitSize + 10;
      if (pattern !== 'none' && remaining > 0) rows += spacer(10);
    } else if (hasPortrait(v)) {
      // Preview-only uploads still reserve their space when measuring email HTML.
      remaining -= v.portraitSize + 10;
      rows += spacer(v.portraitSize + (pattern !== 'none' && remaining > 0 ? 10 : 0));
    }
    if (pattern !== 'none' && remaining > 0) {
      var bounds = motifGeometry(v,p), neutral = v.motifScale === 100 && v.motifPositionX === 50 && v.motifPositionY === 0;
      if (!bounds.width || !bounds.height) return rows;
      function place(artwork) {
        if (!artwork) return '';
        if (neutral) return '<tr><td align="center" style="padding:0;font-size:0;line-height:0">' + artwork + '</td></tr>';
        return '<tr><td align="left" style="padding:' + bounds.y + 'px ' + (p.dotW - bounds.width - bounds.x) + 'px ' + (remaining - bounds.height - bounds.y) + 'px ' + bounds.x + 'px;font-size:0;line-height:0">' + artwork + '</td></tr>';
      }
      if (pattern === 'custom') {
        var artwork = mosaic(parseCustomPattern(v.customPattern),neutral ? p.dotW : bounds.width,neutral ? remaining : bounds.height,neutral ? null : bounds);
        return rows + place(artwork);
      }
      var h = bounds.height, w = bounds.width;
      var file = pattern === 'dots' ? 'dots.png' : 'pattern-' + pattern + '.png';
      rows += place('<img src="' + escape(assetBase + '/' + file) +
        '" width="' + w + '" height="' + h + '" alt="" style="display:block;width:' + w + 'px;height:' + h + 'px;border:0">');
    }
    return rows;
  }
  function ruleRow(width, height, color) {
    return '<tr><td style="padding:0">' + table(width, height, '<tr><td style="padding:0;background-color:' + color + ';font-size:0;line-height:0">&nbsp;</td></tr>') + '</td></tr>';
  }
  function combineCards(v, front, back) {
    var cell = function (html) { return '<td valign="top" style="padding:0;vertical-align:top">' + html + '</td>'; };
    var size = canvasSize(v);
    return v.layout === 'stacked' ? table(size.width, size.height, '<tr>' + cell(front) + '</tr>' + (v.cardGap ? spacer(v.cardGap) : '') + '<tr>' + cell(back) + '</tr>') :
      table(size.width, size.height, '<tr>' + cell(front) + (v.cardGap ? blankCol(v.cardGap) : '') + cell(back) + '</tr>');
  }
  function renderDesign(v, p, assetBase, options) {
    var ink = readable(v.frontBackground,black), muted = readable(v.frontBackground,'#5a5651');
    var flow = isFlow(v), surface = flowSurface(v,assetBase), frontMat = '';
    var mainX = p.frame + (p.artRail && p.dotW && v.design === 'prism' ? p.dotW + 16 : 0);
    var identityX = p.side ? p.rail : mainX, identityY = p.frame;
    var font = v.customFont || (v.design === 'editorial' ? 'serif' : v.design === 'signal' ? 'mono' : 'sans');
    var nameFamily = font === 'serif' ? 'Georgia,Times,serif' : font === 'mono' ? mono : sans;
    function cell(width,content,background,align) {
      return '<td width="' + width + '" valign="' + (align || 'top') + '" style="padding:0' +
        (background ? ';background-color:' + background : '') + '">' + content + '</td>';
    }
    function identity(height) {
      var name = textRow(p.names,Math.floor(p.nameFont * 10) / 10,p.nameLine,ink,nameFamily,font === 'serif' ? 400 : 600,0,frontMat);
      var title = p.titleLines.length ? gapRow(p.titleGap) + textRow(p.titleLines,p.titleFont,p.titleLine,readable(v.frontBackground,v.accent),roleMono,400,p.titleSpacing,frontMat) : '';
      var subtitle = p.subLines.length ? textRow(p.subLines,p.subFont,p.subLine,muted,mono,400,0,frontMat) : '';
      var rows = name + title + (subtitle ? gapRow(p.subGap) + subtitle : '');
      if (v.design === 'orbit') rows = ruleRow(28,3,v.accent) + gapRow(p.headGap) + rows;
      if (v.design === 'studio') rows = ruleRow(flow ? p.identityW : p.textW,8,v.accent) + gapRow(p.headGap) + rows;
      if (v.design === 'prism' || v.design === 'signal') rows = subtitle + (subtitle ? gapRow(p.subGap) : '') + name + title;
      if (v.customAlign ? v.customAlign === 'center' : v.design === 'contour') rows = rows.replace(/<td style="/g,'<td align="center" style="text-align:center;');
      var identity = flow ? informationMat(p.identityW,rows,v.frontBackground,p.matPad) : table(p.textW,0,rows);
      if (flow && (v.customAlign ? v.customAlign === 'center' : v.design === 'contour')) identity = identity.replace('<table ','<table align="center" ');
      var text = cell(p.textW,identity,'','middle'), art = '';
      if (!p.artRail && p.dotW) art = cell(p.dotW,table(p.dotW,0,decoration(v,p,assetBase,options)),v.design === 'studio' && !isCanvasArtwork(v) ? v.backBackground : '', 'middle');
      var contents = v.design === 'orbit' || v.design === 'studio' ? art + (art ? blankCol(p.gap) : '') + text : text + (art ? blankCol(p.gap) : '') + art;
      return surface(p.idW,height,'<tr>' + blankCol(p.idPad) + contents + blankCol(p.idPad) + '</tr>',v.frontBackground,identityX,identityY);
    }
    function contactPanel(width,height,x,y) {
      var background = v.design === 'editorial' ? v.frontBackground : v.backBackground;
      var color = readable(background,black), quiet = readable(background,'#5a5651');
      var grid = '';
      for (var i = 0; i < p.rows.length; i += p.cols) {
        var cells = '';
        for (var j = 0; j < p.cols; j++) {
          if (j) cells += blankCol(p.gridGap);
          var row = p.rows[i + j], content = '';
          if (row) {
            var label = row.lines.map(escape).join('<br>');
            if (row.href) label = '<a href="' + escape(row.href) + '" style="color:' + color + ';text-decoration:none">' + label + '</a>';
            var icon = row.icon === 'none' ? '' : '<img src="' + escape(assetBase + '/' + iconFile(row.icon,background)) + '" width="14" height="14" alt="' + row.label + '" style="display:block;width:14px;height:14px;border:0">';
            if (p.labelH) label = '<span style="display:block;font-size:7.5px;line-height:10px;color:' + quiet + '">' + row.label.toUpperCase() + '</span>' + label;
            var iconCell = cell(22,icon);
            if (p.labelH) iconCell = iconCell.replace('padding:0','padding:10px 0 0');
            content += '<tr>' + iconCell + '<td width="' + p.contactW + '" valign="top" style="padding:0;font-family:' + p.contactFamily + ';font-size:' + p.contactFont + 'px;line-height:' + p.contactLine + 'px;color:' + color + ';white-space:nowrap">' + label + '</td></tr>';
          }
          cells += cell(p.cellW,content ? table(p.cellW,0,content) : '');
        }
        grid += '<tr>' + cells + '</tr>';
        if (i + p.cols < p.rows.length && p.rowGap) grid += '<tr><td colspan="' + (p.cols * 2 - 1) + '" height="' + p.rowGap + '" style="padding:0;height:' + p.rowGap + 'px;font-size:0;line-height:0">&nbsp;</td></tr>';
      }
      if (p.inline) grid = inlineContacts(p,color,quiet,background,assetBase);
      var rows = grid ? '<tr><td style="padding:0">' + table(p.gridW,0,grid) + '</td></tr>' : '';
      if (p.tagLines.length) {
        if (v.design === 'editorial') rows += gapRow(p.footerGap) + '<tr><td style="padding:0;background-color:' + v.backBackground + '">' + table(flow ? p.groupW : p.innerW,0,textRow(p.tagLines,p.tagFont,p.tagLine,readable(v.backBackground,cream),mono)) + '</td></tr>';
        else rows += gapRow(p.footerGap) + textRow(p.tagLines,p.tagFont,p.tagLine,quiet,mono);
      }
      var information = flow ? informationMat(p.groupW,rows,background,p.matPad) : table(p.innerW,0,rows);
      return surface(width,height,'<tr>' + blankCol(p.cPad) + cell(p.innerW,information,'','middle') + blankCol(p.cPad) + '</tr>',background,x,y);
    }
    function artRail(height,background) {
      if (!p.dotW) return '';
      if (flow) return '<td width="' + (p.dotW + 16) + '" align="center" valign="middle" style="padding:0;background-color:' + background + ';' +
        surface.paintStyle(v.design === 'prism' ? p.frame : mainX + p.mainW,p.frame) + '">' + table(p.dotW,0,decoration(v,p,assetBase,options)) + '</td>';
      return cell(p.dotW + 16,surface(p.dotW + 16,height,'<tr>' + blankCol(8) + cell(p.dotW,table(p.dotW,0,decoration(v,p,assetBase,options)),'','middle') + blankCol(8) + '</tr>',background,v.design === 'prism' ? p.frame : mainX + p.mainW,p.frame),'','middle');
    }
    var output;
    if (p.side) {
      output = '<tr>' + (p.rail ? cell(p.rail,'',v.accent) : '') + cell(p.idW,identity(p.topH)) + cell(p.contactPanelW,contactPanel(p.contactPanelW,p.contactPanelH,p.rail + p.idW,0)) + '</tr>';
    } else {
      var divided = ['editorial','contour','prism'].includes(v.design), contactY = p.frame + p.topH + (divided ? 1 : 0);
      var contact = contactPanel(p.contactPanelW,p.contactPanelH - (divided ? 1 : 0),mainX + p.contactOffset,contactY);
      if (p.contactOffset) contact = surface(p.mainW,p.contactPanelH - (divided ? 1 : 0),'<tr>' + blankCol(p.contactOffset) + cell(p.contactPanelW,contact) + '</tr>',v.frontBackground,mainX,contactY);
      var bodyRows = '<tr>' + cell(p.idW,identity(p.topH)) + '</tr>';
      if (divided) bodyRows += ruleRow(p.mainW,1,v.accent);
      bodyRows += '<tr>' + cell(p.mainW,contact) + '</tr>';
      var main = table(p.mainW,p.bodyH,bodyRows,v.frontBackground);
      if (p.artRail && p.dotW) main = table(p.bodyW,p.bodyH,'<tr>' + (v.design === 'prism' ? artRail(p.bodyH,v.frontBackground) + cell(p.mainW,main) : cell(p.mainW,main) + artRail(p.bodyH,v.backBackground)) + '</tr>',v.frontBackground);
      if (p.frame) {
        var edge = '<tr>' + blankCol(p.frame).replace('style="','height="' + p.frame + '" style="height:' + p.frame + 'px;') + blankCol(p.bodyW) + blankCol(p.frame) + '</tr>';
        output = edge + '<tr>' + blankCol(p.frame) + cell(p.bodyW,main) + blankCol(p.frame) + '</tr>' + edge;
      }
      else output = '<tr>' + (p.rail ? cell(p.rail,'',v.accent) : '') + cell(p.bodyW,main) + '</tr>';
    }
    return table(p.W,p.H,output,p.frame ? v.accent : v.frontBackground);
  }

  function renderSingle(v, p, assetBase, options) {
    var background = v.frontBackground, ink = readable(background,black), quiet = readable(background,'#5a5651');
    var flow = isFlow(v), surface = flowSurface(v,assetBase);
    function cell(width,html,style) { return '<td width="' + width + '" valign="top" style="padding:0;vertical-align:top' + (style ? ';' + style : '') + '">' + html + '</td>'; }
    var names = textRow(p.names,Math.floor(p.nameFont * 10) / 10,p.nameLine,ink,p.typography.family,p.typography.weight);
    var title = p.titleLines.length ? gapRow(p.titleGap) + textRow(p.titleLines,p.titleFont,p.titleLine,readable(background,v.accent),roleMono,400,p.titleSpacing) : '';
    var subtitle = p.subLines.length ? textRow(p.subLines,p.subFont,p.subLine,quiet,mono,400) : '';
    var identityRows = v.design === 'prism' || v.design === 'signal' ? subtitle + (subtitle ? gapRow(p.subGap) : '') + names + title : names + title + (subtitle ? gapRow(p.subGap) + subtitle : '');
    var centered = v.customAlign ? v.customAlign === 'center' : v.design === 'contour';
    if (centered) identityRows = identityRows.replace(/<td style="/g,'<td align="center" style="text-align:center;');
    var mat = flow ? informationMat(p.identityW,identityRows,background,p.matPad) : '';
    if (centered && mat) mat = mat.replace('<table ','<table align="center" ');
    var identity = flow ? '<tr><td style="padding:0">' + mat + '</td></tr>' : identityRows;
    if (p.brandH) identity = ruleRow(p.brandW,p.brandH,v.accent) + gapRow(p.brandGap) + identity;
    var text = cell(p.textW,table(p.textW,0,identity));
    var art = p.dotW ? cell(p.dotW,table(p.dotW,0,decoration(v,p,assetBase,options))) : '';
    var identityContent = v.design === 'orbit' || v.design === 'studio' ? art + (art ? blankCol(p.gap) : '') + text : text + (art ? blankCol(p.gap) : '') + art;
    var identityTable = table(p.idW,0,'<tr>' + identityContent + '</tr>');
    var contacts = p.inline ? inlineContacts(p,ink,quiet,background,assetBase) : p.rows.map(function (row,index) {
      var bottom = index === p.rows.length - 1 ? 0 : p.rowGap, label = row.lines.map(escape).join('<br>');
      if (row.href) label = '<a href="' + escape(row.href) + '" style="color:' + ink + ';text-decoration:none">' + label + '</a>';
      if (p.labelH) label = '<span style="display:block;font-size:7.5px;line-height:10px;color:' + quiet + '">' + row.label.toUpperCase() + '</span>' + label;
      var icon = row.icon === 'none' ? '' : '<img src="' + escape(assetBase + '/' + iconFile(row.icon,background)) + '" width="14" height="14" alt="' + row.label + '" style="display:block;width:14px;height:14px;border:0">';
      return '<tr><td width="28" valign="top" style="padding:' + p.labelH + 'px 0 ' + bottom + 'px;font-size:0;line-height:0">' + icon +
        '</td><td width="1" style="padding:0;background-color:' + quiet + ';font-size:0;line-height:0">&nbsp;</td>' + blankCol(10) +
        '<td width="' + (flow ? p.groupW - 39 : p.contactW) + '" valign="top" style="padding:0 0 ' + bottom + 'px;font-family:' + p.contactFamily + ';font-size:' + p.contactFont + 'px;line-height:' + p.contactLine + 'px;color:' + ink + ';white-space:nowrap">' + label + '</td></tr>';
    }).join('');
    var contactRows = contacts ? '<tr><td style="padding:0">' + table(flow ? p.groupW : p.contactPanelW,0,contacts) + '</td></tr>' : '';
    if (p.tagLines.length) contactRows += (v.design === 'original'
      ? (contacts ? gapRow(p.footerGap) : '') + ruleRow(flow ? p.groupW : p.contactPanelW,1,v.accent) + spacer(8)
      : (contacts ? gapRow(p.footerGap) : '')) + textRow(p.tagLines,p.tagFont,p.tagLine,quiet,mono);
    var contactTable = flow ? informationMat(p.groupW,contactRows,background,p.matPad) : table(p.contactPanelW,0,contactRows);
    var groupRows = p.stack ? '<tr>' + cell(p.innerW,identityTable) + '</tr>' + (p.hasContacts ? gapRow(p.sectionGap) + '<tr>' + cell(p.innerW,contactTable) + '</tr>' : '') :
      '<tr>' + cell(p.idW,identityTable) + (p.sectionGap ? blankCol(p.sectionGap) : '') + cell(p.contactPanelW,p.hasContacts ? contactTable : '') + '</tr>';
    var body = surface(p.bodyW,p.bodyH,'<tr><td width="' + p.innerW + '" valign="top" style="padding:' + p.pad + 'px;vertical-align:top">' + table(p.innerW,0,groupRows) + '</td></tr>',background,p.frame + p.rail,p.frame);
    if (p.frame) {
      var edge = '<tr>' + blankCol(p.frame).replace('style="','height="' + p.frame + '" style="height:' + p.frame + 'px;') + blankCol(p.bodyW) + blankCol(p.frame) + '</tr>';
      return table(p.W,p.H,edge + '<tr>' + blankCol(p.frame) + cell(p.bodyW,body) + blankCol(p.frame) + '</tr>' + edge,v.accent);
    }
    if (p.rail) return table(p.W,p.H,'<tr>' + cell(p.rail,'','background-color:' + v.accent) + cell(p.bodyW,body) + '</tr>',background);
    return body;
  }

  function renderUnchecked(v, options) {
    v = compositionValues(v);
    var p = plan(v), assetBase = webURL(v.imageBase).replace(/\/+$/, '');
    var frontText = readable(v.frontBackground, black), frontMuted = readable(v.frontBackground, '#5a5651');
    var backText = readable(v.backBackground, cream), backMuted = readable(v.backBackground, '#b5b0a8');
    var titleColor = readable(v.frontBackground, v.accent);
    if (options && options.assetBase !== undefined) {
      assetBase = clean(options.assetBase).replace(/\/+$/, '');
      if (/^\/\//.test(assetBase) || /(?:^|\/)\.\.(?:\/|$)/.test(assetBase.replace(/%2e/gi, '.')) ||
        (!/^(?:\.\/|\/)?[a-z\d_-]+(?:\/[a-z\d_-]+)*$/i.test(assetBase) && !webURL(assetBase))) {
        throw new TypeError('Use a safe relative or public asset folder URL without traversal.');
      }
      if (/[?#]/.test(assetBase)) throw new TypeError('Use an asset folder URL without a query or fragment.');
      if (webURL(assetBase)) assetBase = webURL(assetBase).replace(/\/+$/, '');
    }
    // All tables already declare zero cellspacing, cellpadding and borders.
    // The duplicate collapse rule buys no extra geometry here; removing it in
    // Flow leaves room for the decorative surface URLs inside Gmail's budget.
    if (v.cardFormat === 'single') {
      var single = renderSingle(v,p,assetBase,options);
      return isCanvasArtwork(v) ? single.replace(/border-collapse:collapse;/g,'') : single;
    }
    if (v.design !== 'original' && v.cardFormat !== 'front-back') {
      var designed = renderDesign(v, p, assetBase, options);
      return isCanvasArtwork(v) ? designed.replace(/border-collapse:collapse;/g,'') : designed;
    }
    var flow = isFlow(v), surface = flowSurface(v,assetBase);
    var faceTypography = v.cardFormat === 'front-back' ? nameTypography(v) : {family:sans,weight:600};
    var identityRows = textRow(p.names, Math.floor(p.nameFont * 10) / 10, p.nameLine, frontText, faceTypography.family, faceTypography.weight);
    if (p.titleLines.length) identityRows += gapRow(p.titleGap) + textRow(p.titleLines, p.titleFont, p.titleLine, titleColor, roleMono, 400, p.titleSpacing);
    if (p.subLines.length) identityRows += gapRow(p.subGap) + textRow(p.subLines, p.subFont, p.subLine, frontMuted, mono);
    var centeredFace = v.cardFormat === 'front-back' && (v.customAlign ? v.customAlign === 'center' : v.design === 'contour');
    if (centeredFace) identityRows = identityRows.replace(/<td style="/g,'<td align="center" style="text-align:center;');
    var faceMat = flow ? informationMat(p.identityW,identityRows,v.frontBackground,p.matPad) : '';
    if (centeredFace && faceMat) faceMat = faceMat.replace('<table ','<table align="center" ');
    var frontRows = spacer(p.top) + '<tr><td style="padding:0">' + square(p.square, v.accent) + '</td></tr>' +
      spacer(Math.min(p.frontGap, p.frontSpace)) + (flow ? '<tr><td style="padding:0">' + faceMat + '</td></tr>' : identityRows);
    var dots = spacer(13) + '<tr><td style="padding:0;font-size:0;line-height:0"><img src="' + escape(assetBase + '/dots.png') +
      '" width="' + p.dotW + '" height="' + p.dotH + '" alt="" style="display:block;width:' + p.dotW + 'px;height:' + p.dotH + 'px;border:0"></td></tr>';
    if (selectedPattern(v) !== 'dots' || hasPortrait(v) || isBackground(v)) dots = spacer(13) + decoration(v, p, assetBase, options);
    var artworkCell = isCanvasArtwork(v) && !p.dotW ? '' : blankCol(p.gap) + '<td width="' + p.dotW + '" valign="top" style="padding:0;vertical-align:top">' + table(p.dotW, 0, dots) + '</td>';
    var front = surface(v.width, v.height, '<tr>' + blankCol(p.pad) + '<td width="' + p.textW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.textW, 0, frontRows) + '</td>' + artworkCell + blankCol(p.right) + '</tr>', v.frontBackground,0,0);
    var contacts = p.inline ? inlineContacts(p, backText, backMuted, v.backBackground, assetBase) : p.rows.map(function (row, i) {
      var bottom = i === p.rows.length - 1 ? 0 : p.rowGap, label = row.lines.map(escape).join('<br>');
      if (row.href) label = '<a href="' + escape(row.href) + '" style="color:' + backText + ';text-decoration:none">' + label + '</a>';
      var icon = row.icon === 'none' ? '' : '<img src="' + escape(assetBase + '/' + iconFile(row.icon, v.backBackground)) + '" width="14" height="14" alt="' + row.label + '" style="display:block;width:14px;height:14px;border:0">';
      return '<tr><td width="28" valign="top" style="padding:0 0 ' + bottom + 'px;font-size:0;line-height:0">' + icon +
        '</td><td width="1" style="padding:0;background-color:' + backMuted + ';font-size:0;line-height:0">&nbsp;</td>' + blankCol(10) +
        '<td width="' + (flow ? p.groupW - 39 : p.contactW) + '" valign="top" style="padding:0 0 ' + bottom + 'px;font-family:' + p.contactFamily + ';font-size:' + p.contactFont +
        'px;line-height:' + p.contactLine + 'px;color:' + backText + ';white-space:nowrap">' + label + '</td></tr>';
    }).join('');
    var backRows = spacer(p.top) + '<tr><td style="padding:0">' + square(p.square, v.accent) + '</td></tr>';
    var backInformation = contacts ? '<tr><td style="padding:0">' + table(flow ? p.groupW : p.innerW,0,contacts) + '</td></tr>' : '';
    var tagRows = p.tagLines.length ? gapRow(p.footerGap) + '<tr><td height="1" style="padding:0;height:1px;background-color:' + v.accent + ';font-size:0;line-height:0">&nbsp;</td></tr>' +
      spacer(8) + textRow(p.tagLines,p.tagFont,p.tagLine,backMuted,mono) : '';
    if (flow && (backInformation || tagRows)) backRows += spacer(Math.min(p.backGap,p.backSpace)) + '<tr><td style="padding:0">' + informationMat(p.groupW,backInformation + tagRows,v.backBackground,p.matPad) + '</td></tr>';
    else if (!flow) backRows += (contacts ? spacer(Math.min(p.backGap,p.backSpace)) + backInformation : '') + tagRows;
    var back = surface(v.width, v.height, '<tr>' + blankCol(p.pad) + '<td width="' + p.innerW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.innerW, 0, backRows) + '</td>' + blankCol(p.pad) + '</tr>', v.backBackground,v.layout === 'stacked' ? 0 : v.width + v.cardGap,v.layout === 'stacked' ? v.height + v.cardGap : 0);
    var cell = function (html) { return '<td valign="top" style="padding:0;vertical-align:top">' + html + '</td>'; };
    var size = canvasSize(v);
    var outer = isBackground(v) ? table : surface;
    var output = v.layout === 'stacked' ? outer(size.width, size.height, '<tr>' + cell(front) + '</tr>' + (v.cardGap ? spacer(v.cardGap) : '') + '<tr>' + cell(back) + '</tr>',flow ? v.frontBackground : '',0,0) :
      outer(size.width, size.height, '<tr>' + cell(front) + (v.cardGap ? blankCol(v.cardGap) : '') + cell(back) + '</tr>',flow ? v.frontBackground : '',0,0);
    return isCanvasArtwork(v) ? output.replace(/border-collapse:collapse;/g,'') : output;
  }
  function render(values, options) {
    var v = checked(values);
    if (v.portraitData && !v.portraitUrl && !(options && (options.preview === true || options.allowPortraitData === true))) {
      var portraitError = new TypeError('Add a public HTTPS URL for the cropped photo before exporting email HTML, or use PNG export.');
      portraitError.errors = {portraitUrl:portraitError.message}; throw portraitError;
    }
    var output = renderUnchecked(v, options), budgetOutput = v.portraitData ? output.replace(escape(v.portraitData), '') : output;
    if (budgetOutput.length >= 10000) { var error = new TypeError('The signature HTML is too long. Simplify custom artwork or shorten image and website URLs.'); error.errors = {}; error.errors[v.pattern === 'custom' ? 'customPattern' : 'website'] = 'Simplify the artwork or shorten URLs to keep the HTML under 10,000 characters.'; throw error; }
    return output;
  }
  function plainText(values) {
    var v = checked(values), lines = [[v.nameLine1, v.nameLine2].filter(Boolean).join(' '), v.title, v.subtitle];
    // Hidden contacts keep their saved values but are omitted like the footer.
    function shown(key) { return v[key] && v[key + 'Visible'] !== 'hide'; }
    if (shown('website')) lines.push((v.websiteLabel ? v.websiteLabel + ': ' : '') + webURL(v.website));
    if (shown('email')) lines.push(v.email);
    if (shown('phone')) lines.push(v.phone);
    if (shown('linkedin')) lines.push(webURL(v.linkedin));
    if (shown('location')) lines.push(v.location);
    // A hidden footer keeps its saved tags but is omitted from every export.
    if (v.tags && v.footerVisible !== 'hide') lines.push(v.tags);
    return lines.filter(Boolean).join('\n');
  }
  // Email size is an output preference: whole percentages from 50 to 150,
  // never coerced. It is applied to a fresh render every time, so repeated
  // changes cannot compound, and 100% returns the original render bytes.
  function emailScale(scale) {
    if (scale === undefined) return 100;
    if (typeof scale !== 'number' || !Number.isInteger(scale) || scale < 50 || scale > 150) {
      var error = new TypeError('Use a whole email size from 50 to 150 percent.');
      error.errors = {emailScale:error.message}; throw error;
    }
    return scale;
  }
  // CSS lengths keep at most three decimals; rounding is symmetric around 0.
  function scaleLength(value, scale) {
    var size = Math.round(Math.abs(value) * scale * 10) / 1000;
    return value < 0 && size ? -size : size;
  }
  // Only px lengths outside url(...) change. Asset URLs, including file names
  // such as 10px.png, colors, percentages, angles and unitless zeros stay exact.
  function scaleStyle(style, scale) {
    return style.split(/(url\([^)]*\))/i).map(function (part, i) {
      if (i % 2) return part;
      if (/url\(/i.test(part)) throw new Error('Unexpected email style markup.');
      return part.replace(/(^|[^\w.#%-])(-?(?:\d+(?:\.\d+)?|\.\d+))px(?![\w%-])/g, function (_, lead, number) {
        return lead + scaleLength(Number(number),scale) + 'px';
      });
    }).join('');
  }
  // The finished markup is rescaled tag by tag. Escaped text between tags is
  // copied untouched; each tag is read attribute by attribute, so user text in
  // alt, href or src can never be mistaken for a width, height or style.
  // Legacy width/height attributes are whole pixels, within 0.5 px of exact.
  function scaleMarkup(html, scale) {
    return html.replace(/<[^>]*>/g, function (tag) {
      if (/^<\/[a-z][a-z\d]*>$/i.test(tag)) return tag;
      var head = /^<[a-z][a-z\d]*/i.exec(tag), attribute = /\s+([a-z][a-z\d-]*)="([^"]*)"/iy, match, out, position;
      if (!head) throw new Error('Unexpected email markup.');
      out = head[0]; position = attribute.lastIndex = out.length;
      while ((match = attribute.exec(tag))) {
        var key = match[1].toLowerCase(), value = match[2];
        if (key === 'style') value = scaleStyle(value,scale);
        else if ((key === 'width' || key === 'height') && /^\d+(?:\.\d+)?$/.test(value) && Number(value)) {
          value = String(Math.max(1,Math.round(Number(value) * scale / 100)));
        }
        out += match[0].slice(0,match[0].length - match[2].length - 1) + value + '"';
        position = attribute.lastIndex;
      }
      if (!/^\s*\/?>$/.test(tag.slice(position))) throw new Error('Unexpected email markup.');
      return out + tag.slice(position);
    });
  }
  // Email copies share render validation, photo export guard and source; the
  // scaled result is checked against the same 10,000-character budget.
  function renderEmail(values, options) {
    if (options !== undefined && options !== null && typeof options !== 'object') throw new TypeError('Use an options object for the email copy.');
    var scale = emailScale(options ? options.scale : undefined), output = render(values, options);
    if (scale === 100) return output;
    var v = normalize(values), scaledOutput = scaleMarkup(output, scale);
    var budgetOutput = v.portraitData ? scaledOutput.replace(escape(v.portraitData), '') : scaledOutput;
    if (budgetOutput.length >= 10000) {
      var error = new TypeError('The signature HTML is too long. Simplify custom artwork or shorten image and website URLs.'); error.errors = {};
      error.errors[v.pattern === 'custom' ? 'customPattern' : 'website'] = 'Simplify the artwork or shorten URLs to keep the HTML under 10,000 characters.';
      throw error;
    }
    return scaledOutput;
  }
  function emailDimensions(values, scale) {
    var percent = emailScale(scale), size = dimensions(values);
    return {width:scaleLength(size.width,percent),height:scaleLength(size.height,percent)};
  }
  return Object.freeze({defaults:defaults, typographyDefaults:typographyDefaults, contactDefaults:contactDefaults, compactPreset:compactPreset, limits:limits, icons:icons, designs:designs, customDesign:customDesign, patterns:patterns, flowingPatterns:flowingPatterns, resolveArtworkPlacement:resolveArtworkPlacement, flowAsset:flowAsset, motifBounds:motifBounds, artworkBounds:artworkBounds, recipeSchemas:recipeSchemas, parseCustomPattern:parseCustomPattern, parseCustomLayout:parseCustomLayout, iconFile:iconFile, normalize:normalize, dimensions:dimensions, effectiveFormat:effectiveFormat, validate:validate, render:render, renderEmail:renderEmail, emailDimensions:emailDimensions, plainText:plainText});
}));
