/* Validated, versioned session files. No browser storage or DOM access. */
(function (root, factory) {
  'use strict';
  var common = typeof module === 'object' && module.exports;
  var api = factory(common ? require('./signature-core.js') : root && root.SignatureCore);
  if (common) module.exports = api;
  if (root) root.SignatureSession = api;
}(typeof window !== 'undefined' ? window : null, function (core) {
  'use strict';
  if (!core || !core.defaults || typeof core.validate !== 'function') throw new Error('Load SignatureCore before SignatureSession.');
  var MAX_BYTES = 1024 * 1024, MAX_THEMES = 1000;
  var FORMAT = 'signature-editor-session';
  var colors = ['frontBackground', 'backBackground', 'accent'];
  var presetIds = ['preset-original', 'preset-midnight', 'preset-spruce'];
  var presetNames = ['original', 'midnight', 'spruce'];
  var uiDefaults = Object.freeze({editorTab:'details', previewView:'card', imageScale:4,
    imageBackground:'transparent', selectedThemeId:'', themeName:''});
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function fail(message) { throw new TypeError(message); }
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.prototype.toString.call(value) !== '[object Object]') fail(label + ' must be a JSON object.');
    var proto = Object.getPrototypeOf(value);
    if (proto && Object.getPrototypeOf(proto) !== null) fail(label + ' must be a plain JSON object.');
    return value;
  }
  function inspect(value, depth, seen) {
    if (!value || typeof value !== 'object') return;
    if (depth > 32) fail('The session contains too many nested objects.');
    if (seen.has(value)) fail('The session contains a circular reference.');
    seen.add(value);
    Object.keys(value).forEach(function (key) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') fail('The session contains a prohibited prototype key.');
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !own(descriptor, 'value')) fail('The session must contain plain data, not computed properties.');
      inspect(descriptor.value, depth + 1, seen);
    });
    seen.delete(value);
  }
  function checkedDraft(value) {
    object(value, 'Draft');
    var input = {};
    Object.keys(core.defaults).forEach(function (key) {
      if (!own(value, key)) return;
      if (typeof value[key] !== typeof core.defaults[key] ||
        (typeof value[key] === 'number' && !Number.isFinite(value[key]))) fail('Draft ' + key + ' must be a ' + typeof core.defaults[key] + '.');
      input[key] = value[key];
    });
    var errors = core.validate(input), keys = Object.keys(errors);
    if (keys.length) fail('Draft ' + keys[0] + ': ' + errors[keys[0]]);
    return core.normalize(input);
  }
  function themeName(value, label, empty) {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) fail(label + ' must be plain text.');
    var name = value.trim();
    if ((!name && !empty) || name.length > 40) fail(label + ' must be ' + (empty ? 'empty or ' : '') + '1–40 characters.');
    return name;
  }
  function checkedThemes(value) {
    if (!Array.isArray(value)) fail('Themes must be an array.');
    if (value.length > MAX_THEMES) fail('A session can contain at most 1,000 saved themes.');
    var ids = new Set(), names = new Set(presetNames);
    return value.map(function (entry, index) {
      object(entry, 'Theme ' + (index + 1));
      if (typeof entry.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(entry.id) || /^preset-/i.test(entry.id)) fail('Theme IDs must use 1–80 letters, digits, or hyphens and cannot start with preset-.');
      if (ids.has(entry.id)) fail('Saved theme IDs must be distinct.');
      var name = themeName(entry.name, 'Theme name', false), folded = name.toLowerCase();
      if (names.has(folded)) fail('Theme names must be distinct and cannot use Original, Midnight, or Spruce.');
      var result = {id:entry.id, name:name};
      colors.forEach(function (key) {
        if (typeof entry[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry[key])) fail('Theme ' + name + ': ' + key + ' must be a six-digit hex color.');
        result[key] = entry[key].toLowerCase();
      });
      if (own(entry, 'importedFromName')) result.importedFromName = themeName(entry.importedFromName, 'Original imported theme name', false);
      ids.add(entry.id); names.add(folded);
      return result;
    });
  }
  function selectedId(value, themes) {
    if (typeof value !== 'string' || (value !== '' && !presetIds.includes(value) && !themes.some(function (theme) { return theme.id === value; }))) {
      fail('The selected theme must be a preset or a saved theme included in this session.');
    }
    return value;
  }
  function checkedUI(value, themes) {
    if (value === undefined) return Object.assign({}, uiDefaults);
    object(value, 'UI settings');
    var result = {};
    Object.keys(uiDefaults).forEach(function (key) { result[key] = own(value, key) ? value[key] : uiDefaults[key]; });
    var enums = {editorTab:['details','layout','colors','icons'], previewView:['card','email'],
      imageScale:[2,4,6], imageBackground:['transparent','white']};
    Object.keys(enums).forEach(function (key) { if (!enums[key].includes(result[key])) fail('UI ' + key + ' must be one of: ' + enums[key].join(', ') + '.'); });
    result.selectedThemeId = selectedId(result.selectedThemeId, themes);
    result.themeName = themeName(result.themeName, 'Theme name field', true);
    return result;
  }
  function checkedSession(value, defaultThemes) {
    object(value, 'Session');
    inspect(value, 0, new Set());
    var draft = checkedDraft(value.draft);
    var themes = checkedThemes(value.themes === undefined && defaultThemes ? [] : value.themes);
    return {draft:draft, themes:themes, ui:checkedUI(value.ui, themes)};
  }
  function checkSize(text) {
    if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) fail('The session file is too large. Use a JSON file of 1 MiB or less.');
  }
  function serialize(value) {
    var data = checkedSession(value, true);
    var text = JSON.stringify({format:FORMAT, version:1, exportedAt:new Date().toISOString(),
      draft:data.draft, themes:data.themes, ui:data.ui}, null, 2) + '\n';
    checkSize(text);
    return text;
  }
  function parse(text) {
    if (typeof text !== 'string') fail('Choose a JSON session file containing text.');
    checkSize(text);
    var value;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch (_) { fail('This is not valid JSON. Choose a saved session JSON file.'); }
    object(value, 'Session file');
    inspect(value, 0, new Set());
    if (!own(value, 'format')) {
      if (!own(value, 'nameLine1') || ['version','draft','themes','ui','exportedAt'].some(function (key) { return own(value, key); })) {
        fail('This is not a signature editor session or a legacy signature draft.');
      }
      return {draft:checkedDraft(value), themes:[], ui:Object.assign({}, uiDefaults)};
    }
    if (value.format !== FORMAT) fail('This file is not a signature editor session.');
    if (value.version !== 1) fail('This session version is not supported. Use a version 1 session file.');
    var dateMatch = typeof value.exportedAt === 'string' && /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value.exportedAt);
    var timestamp = dateMatch ? Date.parse(value.exportedAt) : NaN;
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== dateMatch[1] + '.' + (dateMatch[2] || '').padEnd(3, '0') + 'Z') {
      fail('The session export date must be a valid ISO timestamp.');
    }
    return checkedSession(value, false);
  }
  function sameColors(a, b) { return colors.every(function (key) { return a[key] === b[key]; }); }
  function importedName(base, number) {
    var suffix = number === 1 ? ' (imported)' : ' (imported ' + number + ')';
    // Avoid splitting a surrogate pair when the 40-character field is full.
    return base.slice(0, 40 - suffix.length).replace(/[\uD800-\uDBFF]$/, '').trimEnd() + suffix;
  }
  function sourceName(theme) { return theme.importedFromName || theme.name; }
  function mergeThemes(existing, incoming, selectedThemeId) {
    inspect(existing, 0, new Set()); inspect(incoming, 0, new Set());
    var result = checkedThemes(existing), additions = checkedThemes(incoming);
    var selected = selectedId(selectedThemeId === undefined ? '' : selectedThemeId, additions);
    var ids = new Set(result.map(function (theme) { return theme.id; }));
    var names = new Set(presetNames.concat(result.map(function (theme) { return theme.name.toLowerCase(); })));
    var mapping = new Map(), added = 0, idNumber = 1;
    // Displayed import names may be truncated or identical across two session
    // files. Only the full source name plus colors identifies a duplicate.
    additions.forEach(function (theme) {
      var duplicate = result.find(function (saved) {
        return sameColors(saved, theme) && sourceName(saved).toLowerCase() === sourceName(theme).toLowerCase();
      });
      if (duplicate) { mapping.set(theme.id, duplicate.id); return; }
      if (result.length >= MAX_THEMES) fail('Merging these themes would exceed the limit of 1,000 saved themes.');
      var entry = Object.assign({}, theme);
      if (ids.has(entry.id) || names.has(entry.name.toLowerCase())) {
        entry.importedFromName = sourceName(theme);
        while (ids.has('theme-import-' + idNumber)) idNumber++;
        entry.id = 'theme-import-' + idNumber++;
        var nameNumber = 1;
        while (names.has(importedName(theme.name, nameNumber).toLowerCase())) nameNumber++;
        entry.name = importedName(theme.name, nameNumber);
      }
      ids.add(entry.id); names.add(entry.name.toLowerCase()); result.push(entry); added++;
      mapping.set(theme.id, entry.id);
    });
    return {themes:result, selectedThemeId:mapping.get(selected) || selected, added:added};
  }
  return Object.freeze({serialize:serialize, parse:parse, mergeThemes:mergeThemes});
}));
