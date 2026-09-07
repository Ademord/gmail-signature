(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SignatureCore = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var defaults = Object.freeze({
    nameLine1: 'Avery', nameLine2: 'Morgan', title: 'Software Engineer',
    subtitle: 'AI & AUTOMATION', website: 'example.com', websiteLabel: 'example.com',
    email: '', phone: '+41 00 000 00 00', linkedin: 'https://www.linkedin.com/',
    location: 'Zurich, Switzerland', tags: 'SOFTWARE · DATA · AI',
    width: 321, height: 208, layout: 'paired', design: 'original', pattern: 'auto', customPattern: '', customLayout: '', accent: '#c8362a',
    portraitData: '', portraitUrl: '', portraitShape: 'circle', portraitSize: 64,
    frontBackground: '#f3f0ea', backBackground: '#1c1c1c',
    websiteIcon: 'web', emailIcon: 'mail', phoneIcon: 'phone', linkedinIcon: 'linkedin', locationIcon: 'pin',
    imageBase: 'https://raw.githubusercontent.com/Ademord/gmail-signature/main/sig'
  });
  var limits = Object.freeze({nameLine1: 36, nameLine2: 36, title: 64, subtitle: 64,
    website: 1024, websiteLabel: 40, email: 80, phone: 32, linkedin: 512,
    location: 48, tags: 60, imageBase: 512, portraitUrl: 1024, customPattern: 2048, customLayout: 512});
  var cream = '#f3f0ea', black = '#1c1c1c';
  var sans = 'Arial,Helvetica,sans-serif', mono = "'Courier New',Courier,monospace";
  var roleMono = "'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace";
  var icons = Object.freeze({web:'Globe', mail:'Envelope', phone:'Phone', linkedin:'LinkedIn', pin:'Location pin', none:'None'});
  var patterns = Object.freeze({auto:'Design default', dots:'Dots', orbit:'Orbits', studio:'Shapes', contour:'Contours', prism:'Ribbons', editorial:'Rules', signal:'Grid', galaxy:'Galaxy', starlight:'Starlight', moonlight:'Moonlight', frost:'Frost', custom:'Custom artwork', none:'None'});
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
    result.portraitSize = dimension(input.portraitSize, defaults.portraitSize, 40, 96);
    ['accent', 'frontBackground', 'backBackground'].forEach(function (key) { result[key] = result[key].toLowerCase(); });
    result.imageBase = result.imageBase.replace(/\/+$/, '');
    return result;
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
  function hasPortrait(v) { return Boolean(v.portraitData || v.portraitUrl); }
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
    if (v.design !== 'original') return designPlan(v);
    var pad = Math.round(18 + (v.width - 280) * 0.1), top = v.height < 200 ? 18 : 22;
    var dotH = Math.min(v.height - 26, 182), dotW = Math.round(dotH * 76 / 182);
    if (selectedPattern(v) === 'none') dotW = 0;
    if (hasPortrait(v)) dotW = Math.max(dotW, v.portraitSize);
    var right = 11, gap = dotW ? 10 : 0, textW = v.width - pad - right - gap - dotW;
    var nameFont = Math.min(24, 22 * v.width / 321), longest = Math.max(units(v.nameLine1), units(v.nameLine2), 1);
    nameFont = Math.min(nameFont, (textW - 2) / longest);
    var nameLine = Math.ceil(nameFont * 1.12), titleFont = 9, subFont = 9;
    var titleLines = wrap(v.title, textW, titleFont, true, 0.73);
    var subLines = wrap(v.subtitle, textW, subFont, true);
    var names = [v.nameLine1, v.nameLine2].filter(Boolean), square = v.height < 200 ? 15 : 17;
    var titleH = titleLines.length ? 7 + titleLines.length * 11 : 0;
    var subH = subLines.length ? 11 + subLines.length * 12 : 0;
    var frontSpace = v.height - 2 * top - square - names.length * nameLine - titleH - subH;
    var innerW = v.width - pad * 2, contactW = innerW - 39, contactFont = 10.5;
    var rows = [];
    function add(key, label, text, href) {
      if (text) rows.push({key:key, label:label, icon:v[key + 'Icon'], lines:wrap(text, contactW - 2, contactFont, true), href:href});
    }
    add('website', 'Website', v.website && (v.websiteLabel || linkLabel(v.website)), webURL(v.website));
    add('email', 'Email', v.email, 'mailto:' + encodeURIComponent(v.email).replace(/%40/g, '@'));
    add('phone', 'Phone', v.phone, phoneHref(v.phone));
    add('linkedin', 'LinkedIn', v.linkedin && linkLabel(v.linkedin), webURL(v.linkedin));
    add('location', 'Location', v.location, '');
    var tagLines = wrap(v.tags, innerW, 8.5, true);
    var rowGap = v.height < 200 ? 4 : 6;
    var contactH = rows.reduce(function (sum, row) { return sum + row.lines.length * 14; }, 0) + Math.max(0, rows.length - 1) * rowGap;
    var tagH = tagLines.length ? 12 + 1 + 8 + tagLines.length * 11 : 0;
    var backSpace = v.height - top * 2 - square - contactH - tagH;
    return {pad:pad,top:top,dotH:dotH,dotW:dotW,right:right,gap:gap,textW:textW,nameFont:nameFont,
      nameLine:nameLine,names:names,square:square,titleLines:titleLines,subLines:subLines,frontSpace:frontSpace,
      innerW:innerW,contactW:contactW,contactFont:contactFont,rows:rows,rowGap:rowGap,tagLines:tagLines,backSpace:backSpace};
  }
  // Every design uses this measured plan for both validation and rendering.
  // Fixed line breaks keep email clients from stretching the declared cards.
  function designPlan(v) {
    var tall = v.layout === 'stacked', W = tall ? v.width : v.width * 2 + 20, H = tall ? v.height * 2 + 20 : v.height;
    var pad = H < 220 ? 16 : 22, compact = !tall && H < 220, idPad = tall ? pad : compact ? 8 : 12;
    var cPad = tall ? pad : compact ? (v.design === 'signal' ? 7 : 8) : 12, rowGap = compact ? 4 : 10, gridGap = 18;
    var artW = selectedPattern(v) === 'none' ? 0 : (v.design === 'editorial' ? 46 : 76);
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
    var fixedName = v.customFont ? v.customFont === 'mono' : v.design === 'signal', serif = v.customFont ? v.customFont === 'serif' : v.design === 'editorial';
    var names = [v.nameLine1, v.nameLine2].filter(Boolean);
    var nameFont = v.design === 'editorial' ? 34 : v.design === 'studio' ? 32 : 30;
    if (compact && ['contour','prism','signal'].includes(v.design)) nameFont = 26;
    var joined = !tall && !side, longest;
    if (joined) {
      var joint = names.join(' '), jointWidth = units(joint, fixedName) * (serif ? 1.12 : 1);
      if ((textW - 3) / Math.max(1,jointWidth) >= 20) names = [joint];
    }
    longest = Math.max.apply(null, names.map(function (name) { return units(name, fixedName); }).concat(1)) * (serif ? 1.12 : 1);
    nameFont = Math.min(nameFont, (textW - 3) / longest);
    var nameLine = Math.ceil(nameFont * 1.12), titleLines = wrap(v.title,textW - 2,9,true,.73), subLines = wrap(v.subtitle,textW - 2,9,true);
    var titleH = titleLines.length ? 7 + titleLines.length * 11 : 0, subH = subLines.length ? 10 + subLines.length * 12 : 0;
    var frontHead = v.design === 'studio' ? 20 : v.design === 'orbit' ? 12 : 0;
    var identityH = names.length * nameLine + titleH + subH + frontHead;
    var topH = side ? H : Math.round(bodyH * (tall ? (v.design === 'signal' ? .39 : .48) : (v.design === 'editorial' ? .52 : .47)));
    if (!side) topH = Math.max(topH, identityH + idPad * 2, !artRail && hasPortrait(v) ? v.portraitSize + idPad * 2 : 0);
    var contactPanelH = side ? H : bodyH - topH;
    var cols = side ? 1 : tall ? (v.design === 'contour' ? 2 : 1) : 2;
    var innerW = contactPanelW - cPad * 2, cellW = Math.floor((innerW - gridGap * (cols - 1)) / cols), contactW = cellW - 22;
    var rows = [], contactFont = 10.5;
    function add(key, label, text, href) {
      if (text) rows.push({key:key,label:label,icon:v[key + 'Icon'],text:text,lines:wrap(text,contactW - 2,contactFont,true),href:href});
    }
    add('website','Website',v.website && (v.websiteLabel || linkLabel(v.website)),webURL(v.website));
    add('email','Email',v.email,'mailto:' + encodeURIComponent(v.email).replace(/%40/g,'@'));
    add('phone','Phone',v.phone,phoneHref(v.phone));
    add('linkedin','LinkedIn',v.linkedin && linkLabel(v.linkedin),webURL(v.linkedin));
    add('location','Location',v.location,'');
    if (tall && cols > 1 && rows.some(function (row) { return row.lines.length > 2; })) {
      cols = 1; cellW = innerW; contactW = cellW - 22;
      rows.forEach(function (row) { row.lines = wrap(row.text,contactW - 2,contactFont,true); });
    }
    var labelH = v.design === 'signal' ? 10 : 0, contactH = 0;
    for (var i = 0; i < rows.length; i += cols) {
      contactH += Math.max.apply(null,rows.slice(i,i + cols).map(function (row) { return row.lines.length * 14 + labelH; }));
      if (i + cols < rows.length) contactH += rowGap;
    }
    var tagLines = wrap(v.tags,innerW - 2,8.5,true), tagH = tagLines.length ? 8 + tagLines.length * 11 : 0;
    if (!side) {
      var minTop = Math.max(identityH + idPad * 2, !artRail && hasPortrait(v) ? v.portraitSize + idPad * 2 : 0);
      topH = Math.max(minTop, Math.min(topH, bodyH - cPad * 2 - contactH - tagH - (['editorial','contour','prism'].includes(v.design) ? 1 : 0)));
      contactPanelH = bodyH - topH;
    }
    var dotH = Math.min(artRail ? bodyH - idPad * 2 : topH - idPad * 2, 182);
    return {tall:tall,W:W,H:H,bodyW:bodyW,bodyH:bodyH,mainW:mainW,pad:pad,idPad:idPad,cPad:cPad,rail:rail,frame:frame,
      side:side,artRail:artRail,idW:idW,topH:topH,contactPanelW:contactPanelW,contactPanelH:contactPanelH,contactOffset:contactOffset,
      dotH:dotH,dotW:artW,gap:artGap,textW:textW,nameFont:nameFont,nameLine:nameLine,names:names,titleLines:titleLines,subLines:subLines,
      frontHead:frontHead,frontSpace:topH - idPad * 2 - identityH,identityH:identityH,innerW:innerW,contactW:contactW,cellW:cellW,
      cols:cols,gridGap:gridGap,contactFont:contactFont,rows:rows,rowGap:rowGap,tagLines:tagLines,labelH:labelH,
      contactH:contactH,tagH:tagH,backSpace:contactPanelH - cPad * 2 - contactH - tagH - (['editorial','contour','prism'].includes(v.design) ? 1 : 0)};
  }

  function validate(values) {
    var v = normalize(values), errors = {};
    [['width',280,420],['height',180,320]].forEach(function (rule) {
      var raw = values && typeof values === 'object' ? values[rule[0]] : undefined;
      if (raw !== undefined && ((typeof raw !== 'number' && typeof raw !== 'string') ||
        String(raw).trim() === '' || !Number.isInteger(Number(raw)) || Number(raw) < rule[1] || Number(raw) > rule[2])) {
        errors[rule[0]] = 'Enter a whole number from ' + rule[1] + ' to ' + rule[2] + '.';
      }
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
    if (v.design !== 'custom' && !designs.some(function (design) { return design.id === v.design; })) errors.design = 'Choose an available design.';
    if (!Object.prototype.hasOwnProperty.call(patterns, v.pattern)) errors.pattern = 'Choose an available pattern or None.';
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
    var p = plan(v);
    if (p.nameFont < 17) errors[units(v.nameLine1) >= units(v.nameLine2) ? 'nameLine1' : 'nameLine2'] = 'Shorten the name lines or increase the card width for readable text.';
    if (p.titleLines.length > 2) errors.title = 'Shorten the title to fit two lines at this width.';
    if (p.subLines.length > 2) errors.subtitle = 'Shorten the subtitle to fit two lines at this width.';
    p.rows.forEach(function (row) { if (row.lines.length > 2) errors[row.key] = 'Shorten this text to fit two lines at this width.'; });
    if (p.tagLines.length > 2) errors.tags = 'Shorten the tags to fit two lines at this width.';
    if (p.frontSpace < (v.design === 'original' ? 10 : 0) || p.backSpace < (v.design === 'original' ? 10 : 0)) errors.height = 'Increase the card height or shorten the text to keep everything readable.';
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
  function spacer(height) { return '<tr><td height="' + height + '" style="padding:0;height:' + height + 'px;font-size:0;line-height:0">&nbsp;</td></tr>'; }
  function square(size, color) { return table(size, size, '<tr><td style="padding:0;background-color:' + color + ';font-size:0;line-height:0">&nbsp;</td></tr>'); }
  function textRow(lines, font, line, color, family, weight, spacing) {
    if (!lines.length) return '';
    return '<tr><td style="padding:0;font-family:' + family + ';font-size:' + font + 'px;line-height:' + line + 'px;font-weight:' + (weight || 400) + ';color:' + color + (spacing ? ';letter-spacing:' + spacing + 'px' : '') + ';white-space:nowrap">' + lines.map(escape).join('<br>') + '</td></tr>';
  }
  function blankCol(width) { return '<td width="' + width + '" style="padding:0;width:' + width + 'px;font-size:0;line-height:0">&nbsp;</td>'; }
  function portraitSource(v, options) {
    return options && (options.preview === true || options.allowPortraitData === true) ? v.portraitData || v.portraitUrl : v.portraitUrl;
  }
  function mosaic(recipe, maxWidth, maxHeight) {
    var cols = recipe.rows[0].length, count = recipe.rows.length, unit = Math.min(maxWidth / cols,maxHeight / count);
    // At least one email pixel per cell. A large portrait can replace the artwork.
    if (unit < 1) return '';
    var width = Math.floor(cols * unit), height = Math.floor(count * unit), columns = '', rows = '';
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
  function decoration(v, p, assetBase, options) {
    var pattern = selectedPattern(v), source = portraitSource(v, options), rows = '', remaining = p.dotH;
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
      if (pattern === 'custom') {
        var artwork = mosaic(parseCustomPattern(v.customPattern),p.dotW,remaining);
        return rows + (artwork ? '<tr><td align="center" style="padding:0;font-size:0;line-height:0">' + artwork + '</td></tr>' : '');
      }
      var h = Math.min(remaining, Math.floor(p.dotW * 182 / 76)), w = Math.max(1, Math.round(h * 76 / 182));
      var file = pattern === 'dots' ? 'dots.png' : 'pattern-' + pattern + '.png';
      rows += '<tr><td align="center" style="padding:0;font-size:0;line-height:0"><img src="' + escape(assetBase + '/' + file) +
        '" width="' + w + '" height="' + h + '" alt="" style="display:block;width:' + w + 'px;height:' + h + 'px;border:0"></td></tr>';
    }
    return rows;
  }
  function ruleRow(width, height, color) {
    return '<tr><td style="padding:0">' + table(width, height, '<tr><td style="padding:0;background-color:' + color + ';font-size:0;line-height:0">&nbsp;</td></tr>') + '</td></tr>';
  }
  function combineCards(v, front, back) {
    var cell = function (html) { return '<td valign="top" style="padding:0;vertical-align:top">' + html + '</td>'; };
    return v.layout === 'stacked' ? table(v.width, v.height * 2 + 20, '<tr>' + cell(front) + '</tr>' + spacer(20) + '<tr>' + cell(back) + '</tr>') :
      table(v.width * 2 + 20, v.height, '<tr>' + cell(front) + blankCol(20) + cell(back) + '</tr>');
  }
  function renderDesign(v, p, assetBase, options) {
    var ink = readable(v.frontBackground,black), muted = readable(v.frontBackground,'#5a5651');
    var font = v.customFont || (v.design === 'editorial' ? 'serif' : v.design === 'signal' ? 'mono' : 'sans');
    var nameFamily = font === 'serif' ? 'Georgia,Times,serif' : font === 'mono' ? mono : sans;
    function cell(width,content,background,align) {
      return '<td width="' + width + '" valign="' + (align || 'top') + '" style="padding:0' +
        (background ? ';background-color:' + background : '') + '">' + content + '</td>';
    }
    function identity(height) {
      var name = textRow(p.names,Math.floor(p.nameFont * 10) / 10,p.nameLine,ink,nameFamily,font === 'serif' ? 400 : 600);
      var title = p.titleLines.length ? spacer(7) + textRow(p.titleLines,9,11,readable(v.frontBackground,v.accent),roleMono,400,.73) : '';
      var subtitle = p.subLines.length ? textRow(p.subLines,9,12,muted,mono) : '';
      var rows = name + title + (subtitle ? spacer(10) + subtitle : '');
      if (v.design === 'orbit') rows = ruleRow(28,3,v.accent) + spacer(9) + rows;
      if (v.design === 'studio') rows = ruleRow(p.textW,8,v.accent) + spacer(12) + rows;
      if (v.design === 'prism' || v.design === 'signal') rows = subtitle + (subtitle ? spacer(10) : '') + name + title;
      if (v.customAlign ? v.customAlign === 'center' : v.design === 'contour') rows = rows.replace(/<td style="/g,'<td align="center" style="text-align:center;');
      var text = cell(p.textW,table(p.textW,0,rows),'','middle'), art = '';
      if (!p.artRail && p.dotW) art = cell(p.dotW,table(p.dotW,0,decoration(v,p,assetBase,options)),v.design === 'studio' ? v.backBackground : '', 'middle');
      var contents = v.design === 'orbit' || v.design === 'studio' ? art + (art ? blankCol(p.gap) : '') + text : text + (art ? blankCol(p.gap) : '') + art;
      return table(p.idW,height,'<tr>' + blankCol(p.idPad) + contents + blankCol(p.idPad) + '</tr>',v.frontBackground);
    }
    function contactPanel(width,height) {
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
            content += '<tr>' + iconCell + '<td width="' + p.contactW + '" valign="top" style="padding:0;font-family:' + mono + ';font-size:10.5px;line-height:14px;color:' + color + ';white-space:nowrap">' + label + '</td></tr>';
          }
          cells += cell(p.cellW,content ? table(p.cellW,0,content) : '');
        }
        grid += '<tr>' + cells + '</tr>';
        if (i + p.cols < p.rows.length) grid += '<tr><td colspan="' + (p.cols * 2 - 1) + '" height="' + p.rowGap + '" style="padding:0;height:' + p.rowGap + 'px;font-size:0;line-height:0">&nbsp;</td></tr>';
      }
      var rows = grid ? '<tr><td style="padding:0">' + table(p.innerW,0,grid) + '</td></tr>' : '';
      if (p.tagLines.length) {
        if (v.design === 'editorial') rows += spacer(8) + '<tr><td style="padding:0;background-color:' + v.backBackground + '">' + table(p.innerW,0,textRow(p.tagLines,8.5,11,readable(v.backBackground,cream),mono)) + '</td></tr>';
        else rows += spacer(8) + textRow(p.tagLines,8.5,11,quiet,mono);
      }
      return table(width,height,'<tr>' + blankCol(p.cPad) + cell(p.innerW,table(p.innerW,0,rows),'','middle') + blankCol(p.cPad) + '</tr>',background);
    }
    function artRail(height,background) {
      if (!p.dotW) return '';
      return cell(p.dotW + 16,table(p.dotW + 16,height,'<tr>' + blankCol(8) + cell(p.dotW,table(p.dotW,0,decoration(v,p,assetBase,options)),'','middle') + blankCol(8) + '</tr>',background),'','middle');
    }
    var output;
    if (p.side) {
      output = '<tr>' + (p.rail ? cell(p.rail,'',v.accent) : '') + cell(p.idW,identity(p.topH)) + cell(p.contactPanelW,contactPanel(p.contactPanelW,p.contactPanelH)) + '</tr>';
    } else {
      var divided = ['editorial','contour','prism'].includes(v.design), contact = contactPanel(p.contactPanelW,p.contactPanelH - (divided ? 1 : 0));
      if (p.contactOffset) contact = table(p.mainW,p.contactPanelH - (divided ? 1 : 0),'<tr>' + blankCol(p.contactOffset) + cell(p.contactPanelW,contact) + '</tr>',v.frontBackground);
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
    if (v.design !== 'original') return renderDesign(v, p, assetBase, options);
    var frontRows = spacer(p.top) + '<tr><td style="padding:0">' + square(p.square, v.accent) + '</td></tr>' +
      spacer(Math.min(Math.round(v.height * 0.19), p.frontSpace)) + textRow(p.names, Math.floor(p.nameFont * 10) / 10, p.nameLine, frontText, sans, 600);
    if (p.titleLines.length) frontRows += spacer(7) + textRow(p.titleLines, 9, 11, titleColor, roleMono, 400, 0.73);
    if (p.subLines.length) frontRows += spacer(11) + textRow(p.subLines, 9, 12, frontMuted, mono);
    var dots = spacer(13) + '<tr><td style="padding:0;font-size:0;line-height:0"><img src="' + escape(assetBase + '/dots.png') +
      '" width="' + p.dotW + '" height="' + p.dotH + '" alt="" style="display:block;width:' + p.dotW + 'px;height:' + p.dotH + 'px;border:0"></td></tr>';
    if (selectedPattern(v) !== 'dots' || hasPortrait(v)) dots = spacer(13) + decoration(v, p, assetBase, options);
    var front = table(v.width, v.height, '<tr>' + blankCol(p.pad) + '<td width="' + p.textW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.textW, 0, frontRows) + '</td>' + blankCol(p.gap) + '<td width="' + p.dotW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.dotW, 0, dots) + '</td>' + blankCol(p.right) + '</tr>', v.frontBackground);
    var contacts = p.rows.map(function (row, i) {
      var bottom = i === p.rows.length - 1 ? 0 : p.rowGap, label = row.lines.map(escape).join('<br>');
      if (row.href) label = '<a href="' + escape(row.href) + '" style="color:' + backText + ';text-decoration:none">' + label + '</a>';
      var icon = row.icon === 'none' ? '' : '<img src="' + escape(assetBase + '/' + iconFile(row.icon, v.backBackground)) + '" width="14" height="14" alt="' + row.label + '" style="display:block;width:14px;height:14px;border:0">';
      return '<tr><td width="28" valign="top" style="padding:0 0 ' + bottom + 'px;font-size:0;line-height:0">' + icon +
        '</td><td width="1" style="padding:0;background-color:' + backMuted + ';font-size:0;line-height:0">&nbsp;</td>' + blankCol(10) +
        '<td width="' + p.contactW + '" valign="top" style="padding:0 0 ' + bottom + 'px;font-family:' + mono + ';font-size:' + p.contactFont +
        'px;line-height:14px;color:' + backText + ';white-space:nowrap">' + label + '</td></tr>';
    }).join('');
    var backRows = spacer(p.top) + '<tr><td style="padding:0">' + square(p.square, v.accent) + '</td></tr>';
    if (contacts) backRows += spacer(Math.min(21, p.backSpace)) + '<tr><td style="padding:0">' + table(p.innerW, 0, contacts) + '</td></tr>';
    if (p.tagLines.length) backRows += spacer(12) + '<tr><td height="1" style="padding:0;height:1px;background-color:' + v.accent + ';font-size:0;line-height:0">&nbsp;</td></tr>' +
      spacer(8) + textRow(p.tagLines, 8.5, 11, backMuted, mono);
    var back = table(v.width, v.height, '<tr>' + blankCol(p.pad) + '<td width="' + p.innerW + '" valign="top" style="padding:0;vertical-align:top">' +
      table(p.innerW, 0, backRows) + '</td>' + blankCol(p.pad) + '</tr>', v.backBackground);
    var cell = function (html) { return '<td valign="top" style="padding:0;vertical-align:top">' + html + '</td>'; };
    var output = v.layout === 'stacked' ? table(v.width, v.height * 2 + 20, '<tr>' + cell(front) + '</tr>' + spacer(20) + '<tr>' + cell(back) + '</tr>') :
      table(v.width * 2 + 20, v.height, '<tr>' + cell(front) + blankCol(20) + cell(back) + '</tr>');
    return output;
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
    if (v.website) lines.push((v.websiteLabel ? v.websiteLabel + ': ' : '') + webURL(v.website));
    if (v.email) lines.push(v.email);
    if (v.phone) lines.push(v.phone);
    if (v.linkedin) lines.push(webURL(v.linkedin));
    if (v.location) lines.push(v.location);
    if (v.tags) lines.push(v.tags);
    return lines.filter(Boolean).join('\n');
  }
  return Object.freeze({defaults:defaults, limits:limits, icons:icons, designs:designs, customDesign:customDesign, patterns:patterns, recipeSchemas:recipeSchemas, parseCustomPattern:parseCustomPattern, parseCustomLayout:parseCustomLayout, iconFile:iconFile, normalize:normalize, validate:validate, render:render, plainText:plainText});
}));
