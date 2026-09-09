(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./signature-core.js') : root.SignatureCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SignatureAI = api;
}(typeof window !== 'undefined' ? window : null, function (core) {
  'use strict';

  var colorKeys = ['frontBackground', 'backBackground', 'accent'];
  var layoutKeys = ['design', 'customLayout', 'layout', 'width', 'height'];
  var artworkKeys = ['pattern', 'customPattern', 'artworkPlacement', 'artworkScale', 'artworkPositionX', 'artworkPositionY', 'motifScale', 'motifPositionX', 'motifPositionY'];
  var iconKeys = ['websiteIcon', 'emailIcon', 'phoneIcon', 'linkedinIcon', 'locationIcon'];
  var photoKeys = ['portraitShape', 'portraitSize'];
  var textKeys = ['title', 'subtitle', 'tags'];
  var detailKeys = ['nameLine1', 'nameLine2', 'title', 'subtitle', 'website', 'websiteLabel', 'email', 'phone', 'linkedin', 'location', 'tags'];
  var sectionKeys = Object.freeze({
    design: Object.freeze(layoutKeys.concat(artworkKeys, colorKeys, iconKeys, photoKeys)),
    artwork: Object.freeze(artworkKeys.concat(colorKeys)), layout: Object.freeze(layoutKeys),
    colors: Object.freeze(colorKeys), details: Object.freeze(detailKeys),
    icons: Object.freeze(iconKeys), photo: Object.freeze(photoKeys)
  });
  var sectionLabels = Object.freeze({design:'Design', artwork:'Artwork', layout:'Layout', colors:'Colors', details:'Details', icons:'Icons', photo:'Photo format'});
  var proposals = new WeakMap();
  var forbidden = ['__proto__', 'prototype', 'constructor'];
  function fail(message) { throw new TypeError(message); }
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function scan(value, depth) {
    if (depth > 8) fail('The response is nested too deeply. Ask for just the requested JSON object.');
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(function (key) {
      if (forbidden.includes(key)) fail('The response contains an unsupported property.');
      scan(value[key], depth + 1);
    });
  }
  function exactKeys(value, allowed, label) {
    if (!plain(value)) fail(label + ' must be a JSON object.');
    Object.keys(value).forEach(function (key) { if (!allowed.includes(key)) fail('Unsupported ' + label.toLowerCase() + ' field: ' + key + '.'); });
  }
  function sectionOK(section) { if (!Object.hasOwn(sectionKeys, section)) fail('Choose an available AI section.'); }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonical(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function freeze(value) { if (value && typeof value === 'object') { Object.keys(value).forEach(function (key) { freeze(value[key]); }); Object.freeze(value); } return value; }
  function sample() { return {...core.defaults}; }
  function recipe(key, value) {
    if (!plain(value)) fail(key + ' must be an object, not a JSON string or code.');
    var parse = key === 'customPattern' ? core.parseCustomPattern : core.parseCustomLayout;
    if (typeof parse !== 'function') fail('Custom recipes are unavailable. Reload the editor and try again.');
    return JSON.stringify(parse(JSON.stringify(value)));
  }
  function strictField(key, value) {
    if (key === 'customPattern' || key === 'customLayout') return recipe(key, value);
    if (['width','height','portraitSize','artworkScale','artworkPositionX','artworkPositionY','motifScale','motifPositionX','motifPositionY'].includes(key)) {
      var bounds = key === 'width' ? [280,420] : key === 'height' ? [180,320] : key === 'artworkScale' ? [75,150] : key === 'motifScale' ? [25,100] : (key.startsWith('artworkPosition') || key.startsWith('motifPosition')) ? [0,100] : [40,96];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < bounds[0] || value > bounds[1]) fail(key + ' must be a whole number from ' + bounds[0] + ' to ' + bounds[1] + '.');
      return value;
    }
    if (typeof value !== 'string') fail(key + ' must be text.');
    if (/[\u0000-\u001f\u007f]/.test(value)) fail(key + ' must be a single line of text.');
    if (colorKeys.includes(key) && !/^#[0-9a-f]{6}$/i.test(value)) fail(key + ' must be a six-digit hex color.');
    if (detailKeys.includes(key) && (value.length > core.limits[key] || /[<>]/.test(value))) fail(key + ' is too long or contains markup. Use plain text within the requested limit.');
    var choices = key === 'design' ? core.designs.map(function (item) { return item.id; }).concat('custom') :
      key === 'pattern' ? Object.keys(core.patterns) : key === 'layout' ? ['paired','stacked'] :
      key === 'artworkPlacement' ? ['auto','motif','flow'] : key === 'portraitShape' ? ['circle','rounded','square'] : iconKeys.includes(key) ? Object.keys(core.icons) : null;
    if (choices && !choices.includes(value)) fail('Choose an available value for ' + key + '.');
    return colorKeys.includes(key) ? value.toLowerCase() : value;
  }
  function parseResponse(text, settings) {
    settings = settings || {}; sectionOK(settings.section);
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > 65536) fail('Paste a JSON response smaller than 64 KB.');
    text = text.trim();
    var fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    if (fenced) text = fenced[1];
    var data;
    try { data = JSON.parse(text); } catch (_) { fail('Could not read this response. Ask your AI for only the JSON object, then paste it here.'); }
    scan(data, 0);
    exactKeys(data, ['format','version','section','name','changes'], 'Response');
    if (data.format !== 'signature-ai' || data.version !== 1) fail('Use the signature-ai format, version 1, from the copied prompt.');
    if (data.section !== settings.section) fail('This response is for another section. Open that section or ask your AI to use the current prompt.');
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80 || /[<>\u0000-\u001f\u007f]/.test(data.name)) fail('Give the design a plain-text name of 1–80 characters.');
    var allowed = settings.section === 'details' && settings.includeDetails !== true ? textKeys : sectionKeys[settings.section];
    exactKeys(data.changes, allowed, 'Changes');
    if (!Object.keys(data.changes).length) fail('The response contains no changes. Ask your AI to change at least one allowed field.');
    var changes = {};
    Object.keys(data.changes).forEach(function (key) { changes[key] = strictField(key, data.changes[key]); });
    if (Object.hasOwn(changes,'customPattern') && changes.pattern !== 'custom') fail('A customPattern recipe must also set pattern to custom.');
    if (Object.hasOwn(changes,'customLayout') && changes.design !== 'custom') fail('A customLayout recipe must also set design to custom.');
    var draft = settings.draft || core.defaults;
    var candidate = {...draft, ...changes};
    var errors = core.validate(candidate), first = Object.keys(errors)[0];
    if (first) fail(errors[first] + ' Ask your AI to revise the response.');
    return freeze({format:data.format, version:data.version, section:data.section, name:data.name.trim(), changes:changes});
  }
  function createProposal(text, settings) {
    var parsed = parseResponse(text, settings), draft = core.normalize(settings.draft || core.defaults);
    var candidate = core.normalize({...draft, ...parsed.changes});
    var result = freeze({...parsed, candidate:candidate});
    proposals.set(result, canonical(draft));
    return result;
  }
  function applyProposal(proposal, currentDraft) {
    if (!proposals.has(proposal)) fail('Preview the response before applying it.');
    if (proposals.get(proposal) !== canonical(core.normalize(currentDraft))) fail('Your signature changed since this preview. Preview the response again before applying it.');
    var errors = core.validate({...currentDraft, ...proposal.changes}), first = Object.keys(errors)[0];
    if (first) fail(errors[first]);
    return {...proposal.changes};
  }
  function buildPrompt(section, draft, settings) {
    sectionOK(section); settings = settings || {}; draft = draft || core.defaults;
    var includeDetails = section === 'details' && settings.includeDetails === true;
    var keys = section === 'details' && !includeDetails ? textKeys : sectionKeys[section];
    var current = {}, example = sample();
    keys.forEach(function (key) {
      var value = section === 'details' && !includeDetails ? example[key] : draft[key];
      if ((key === 'customPattern' || key === 'customLayout') && value) {
        try { current[key] = JSON.parse(recipe(key, JSON.parse(value))); } catch (_) { /* Only documented recipes leave the editor. */ }
      } else if (value !== undefined && value !== '') {
        try { current[key] = strictField(key,value); } catch (_) { /* Do not copy unvalidated fields. */ }
      }
    });
    var brief = typeof settings.brief === 'string' ? settings.brief.trim().slice(0,2000) : '';
    var lines = [
      'Help me customize an email signature in a browser-local design tool.',
      'Section: ' + section + '. My request: ' + (brief || 'Create a distinctive, readable variation with thoughtful visual balance.'),
      includeDetails ? 'I chose to include my current text and contact details below. Preserve factual identity and links unless I explicitly request changes.' :
        section === 'details' ? 'The text below is a fictional example. Rewrite only title, subtitle and tags. Do not invent or change personal or contact information.' :
          'Only style settings are included. My identity, contact details, URLs and photo are intentionally omitted; preserve them.',
      'Return exactly one JSON object, without commentary, HTML, CSS, JavaScript, SVG, image data, links to generated assets, or markdown.',
      'Use this envelope: {"format":"signature-ai","version":1,"section":' + JSON.stringify(section) + ',"name":"Short descriptive name","changes":{}}.',
      'Only include fields you change. Allowed changes: ' + keys.join(', ') + '.',
      'Current ' + (section === 'details' && !includeDetails ? 'example text' : 'settings') + ': ' + JSON.stringify(current) + '.'
    ];
    if (keys.some(function (key) { return colorKeys.includes(key); })) lines.push('Colors use six-digit hex values (#rrggbb). frontBackground is the light/front field, backBackground is the second field, accent is decorative color. Prefer coordinated colors and readable contrast; the renderer chooses readable text automatically.');
    if (keys.includes('design')) {
      lines.push('Built-in design choices: ' + core.designs.map(function (item) { return item.id; }).join(', ') + '. To create a layout variation use design:"custom" plus customLayout:{"composition":"orbit","font":"sans","align":"left"}. composition is orbit|studio|contour|prism|editorial|signal; font is sans|serif|mono; align is left|center. These are structured variations of six email-compatible compositions, not arbitrary layout code.');
      lines.push('layout:"paired" is wide; layout:"stacked" is tall. width is an integer 280–420; height is an integer 180–320. The final wide signature is (width*2+20) by height; tall is width by (height*2+20). Avoid reducing dimensions for unknown text lengths.');
    }
    if (keys.includes('pattern')) lines.push('pattern choices: ' + Object.keys(core.patterns).join(', ') + '. To create new artwork use pattern:"custom" and customPattern:{"palette":["#b6a1ed","#ffe9a5"],"rows":["....00..","....00..","........","..11....","..11....","........","......00","......00"]}. palette contains 1–8 six-digit hex colors; rows contains 4–32 equal strings, each 4–16 characters wide, no more than 384 cells total. A dot is transparent; digits 0–7 select an existing palette entry. Prefer sparse pixel art and long contiguous color runs: email HTML must stay under 10,000 characters. Avoid noisy checkerboards. Custom grid artwork occupies a side motif; the six built-in abstract studies also support full-canvas placement.');
    if (keys.includes('artworkPlacement')) lines.push('artworkPlacement is auto|motif|flow. Auto uses full-canvas artwork for cutpaper|colorfield|chromatic|counterform|overprint|gesture; all other patterns and custom recipes use a side motif. Explicit flow is only for those six abstract patterns. artworkScale is an integer 75–150 percent; artworkPositionX and artworkPositionY are integers 0–100 for the full-canvas focal position. Set artworkPlacement:"motif" when switching to a custom recipe from flow. Side motifs use motifScale (integer 25–100 percent of the fitted maximum), motifPositionX (0–100, left to right), and motifPositionY (0–100, top to bottom). Reduce motifScale to leave room for movement; never crop the motif. The four AI-inspired built-ins are neural (Neural bloom), latent (Latent field), tokenweave (Token weave), and resonance (Resonance). Choose a built-in or create a customPattern recipe to replace it; existing PNG shapes cannot be edited individually. Preserve the panel colors unless the brief explicitly requests changing them. Keep flowing marks clear of readable text.');
    if (keys.some(function (key) { return iconKeys.includes(key); })) lines.push('Each icon field accepts web|mail|phone|linkedin|pin|none. These use the built-in PNG icon set; no custom URLs or icon code.');
    if (keys.includes('portraitShape')) lines.push('portraitShape is circle|rounded|square. portraitSize is an integer 40–96 pixels. My photo is preserved and is never included in this prompt. Cropping and brightness are adjusted privately in the editor, not by this JSON.');
    if (section === 'details') lines.push('Text length limits: ' + keys.map(function (key) { return key + '=' + core.limits[key]; }).join(', ') + '. Use plain, single-line text. Keep identity and contact information factual; do not insert markup.');
    lines.push('Use no extra keys at any level. Keep unchanged fields out of changes. The editor validates the response and shows a preview before I choose whether to apply it. If a preview reports a fit or size error, revise your JSON to address that error.');
    return lines.join('\n\n');
  }
  function exampleResponse(section) {
    sectionOK(section);
    var examples = {
      design:{design:'orbit',pattern:'starlight',artworkPlacement:'auto',frontBackground:'#e6edf6',backBackground:'#17253f',accent:'#cda762'},
      artwork:{pattern:'custom',artworkPlacement:'motif',customPattern:{palette:['#dcc18a'],rows:['....00..','....00..','........','00......','00......','........','......00','......00']}},
      layout:{design:'custom',customLayout:{composition:'editorial',font:'serif',align:'center'}},
      colors:{frontBackground:'#e6edf6',backBackground:'#17253f',accent:'#cda762'},
      details:{title:'Creative Developer',subtitle:'DESIGN & TECHNOLOGY',tags:'DESIGN · BUILD · EXPLORE'},
      icons:{websiteIcon:'web',emailIcon:'mail',phoneIcon:'none',linkedinIcon:'none',locationIcon:'pin'},
      photo:{portraitShape:'rounded',portraitSize:56}
    };
    return JSON.stringify({format:'signature-ai',version:1,section:section,name:sectionLabels[section] + ' example',changes:examples[section]},null,2);
  }
  return Object.freeze({sections:sectionLabels, sectionKeys:sectionKeys, buildPrompt:buildPrompt, exampleResponse:exampleResponse, parseResponse:parseResponse, createProposal:createProposal, applyProposal:applyProposal});
}));
