// Run: node --test ../signature-work/app-interactions.test.mjs
// Node built-ins only. Exercises the real app/core with a small explicit DOM
// fixture. This verifies branch behavior, not browser layout or native copying.
// Also works from a repository tests/ folder, or set SIGNATURE_PROJECT_ROOT.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const projectRoot = process.env.SIGNATURE_PROJECT_ROOT || [
  fileURLToPath(new URL('../', import.meta.url)),
  fileURLToPath(new URL('../gmail-signature/', import.meta.url)),
].find(path => existsSync(resolve(path, 'app.js')));
assert.ok(projectRoot, 'Set SIGNATURE_PROJECT_ROOT to the app directory.');
const appSource = readFileSync(resolve(projectRoot, 'app.js'), 'utf8');
const coreSource = readFileSync(resolve(projectRoot, 'signature-core.js'), 'utf8');
const historySource = readFileSync(resolve(projectRoot, 'editor-history.js'), 'utf8');
const sessionSource = readFileSync(resolve(projectRoot, 'session-data.js'), 'utf8');
const sessionControlsSource = readFileSync(resolve(projectRoot, 'session-controls.js'), 'utf8');
const collectionsSource = readFileSync(resolve(projectRoot, 'design-collections.js'), 'utf8');
const pageSource = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
const coreContext = { module: { exports: {} }, URL };
vm.runInNewContext(coreSource, coreContext, { filename: 'signature-core.js' });
const core = coreContext.module.exports;
const storageKey = 'signature-studio:draft:v1';
const draftHash = draft => '#v=' + Buffer.from(JSON.stringify(draft), 'utf8').toString('base64url');
const localPortrait = 'data:image/png;base64,' + readFileSync(resolve(projectRoot, 'sig/icon-web.png')).toString('base64');

function harness({ storageFails = false, initialHash = '', initialDraft = null, initialThemes = null, expectPreview = true, clipboardSucceeds = false } = {}) {
  const nodes = new Map(), downloads = [], objectURLs = new Map(), revoked = [], timers = [], clipboardTexts = [], clipboardItems = [];
  const storage = new Map(initialDraft ? [[storageKey, JSON.stringify(initialDraft)]] : []);
  if (initialThemes) storage.set('signature-studio:themes:v1', JSON.stringify(initialThemes));
  const globalEvents = new Map(), documentEvents = new Map();
  let selectedRanges = [], clipboardAttempts = 0, legacyAttempts = 0, nextWriteFailure = null;
  const on = (events, type, listener) => events.set(type, [...(events.get(type) || []), listener]);
  const emit = async (events, type, event = {}) => {
    for (const listener of events.get(type) || []) await listener({ preventDefault() {}, ...event });
  };

  class Element {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase(); this.id = id; this.name = '';
      this.dataset = {}; this.style = {}; this.attributes = new Map(); this.events = new Map();
      this.children = []; this.parentElement = null; this.value = ''; this.hidden = false;
      this.clientWidth = 800; this.scrollHeight = 500; this._text = ''; this._html = '';
      const classes = new Set();
      this.classList = {
        add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
        toggle(name, force) {
          const active = force === undefined ? !classes.has(name) : force;
          if (active) classes.add(name); else classes.delete(name);
          return active;
        },
      };
    }
    set id(value) { if (this._id) nodes.delete(this._id); this._id = value; if (value) nodes.set(value, this); }
    get id() { return this._id; }
    set textContent(value) { this._text = String(value); this.children = []; this._html = ''; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set innerHTML(value) { this._html = String(value); this.children = []; this._text = ''; }
    get innerHTML() { return this._html; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setCustomValidity(value) { this.validationMessage = value; }
    addEventListener(type, listener) { on(this.events, type, listener); }
    append(child) { child.parentElement = this; this.children.push(child); }
    prepend(child) { child.parentElement = this; this.children.unshift(child); }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      this.parentElement = null;
    }
    focus() { document.activeElement = this; }
    select() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; return emit(this.events, 'close'); }
    closest(selector) {
      let node = this.parentElement;
      while (node) {
        if (selector === '[data-editor-panel]' && node.dataset.editorPanel) return node;
        if (selector === 'details' && node.tagName === 'DETAILS') return node;
        node = node.parentElement;
      }
      return null;
    }
    querySelectorAll(selector) {
      if (selector === 'a') return []; // Link navigation is outside this harness.
      if (selector === '[data-close-dialog], .dialog-close, #close-help') return [nodes.get('close-help')];
      throw new Error('Unsupported element selector: ' + selector);
    }
    click() {
      if (this.tagName === 'A') downloads.push({ href: this.href, filename: this.download });
      return emit(this.events, 'click', { target: this });
    }
  }

  // Derive IDs from the real page so removed or renamed controls fail loudly.
  for (const match of pageSource.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) new Element(match[1], match[2]);
  const node = id => { assert.ok(nodes.has(id), `Required app element #${id} exists`); return nodes.get(id); };
  const panelNames = ['details', 'layout', 'colors', 'icons', 'design', 'photo'];
  const tabs = panelNames.map(name => node(name + '-tab'));
  const panels = panelNames.map(name => node(name + '-panel'));
  tabs.forEach((element, index) => { element.dataset.editorTab = panelNames[index]; });
  panels.forEach((element, index) => { element.dataset.editorPanel = panelNames[index]; });
  const inputs = Object.fromEntries(Object.keys(core.defaults).map(key => [key, node(key)]));
  for (const [key, input] of Object.entries(inputs)) {
    input.name = key;
    const field = new Element();
    field.append(input);
    panels[key.endsWith('Icon') ? 3 : ['frontBackground', 'backBackground', 'accent'].includes(key) ? 2 : ['width', 'height', 'layout', 'imageBase'].includes(key) ? 1 : 0].append(field);
  }
  for (const key of ['frontBackground', 'backBackground', 'accent']) node(key + '-hex').dataset.colorField = key;
  node('image-scale').value = '4'; node('image-background').value = 'transparent';
  node('editor-form').elements = { namedItem: key => inputs[key] || null };
  const footer = new Element(), actionGroup = new Element(), workspace = new Element(), column = new Element();
  const views = ['card', 'email'].map(view => { const element = new Element('button'); element.dataset.view = view; return element; });
  const artworkEditButtons=[...pageSource.matchAll(/<button\b[^>]*\bdata-edit-artwork\b[^>]*>/g)].map(()=>new Element('button'));
  assert.ok(artworkEditButtons.length>0,'the real page has a manual artwork entry point');
  const one = new Map([['.rail-footer > span', footer], ['.preview-actions > div', actionGroup], ['[data-preview-view]', workspace], ['.preview-column', column]]);
  const many = new Map([['[data-editor-tab]', tabs], ['[data-editor-panel]', panels], ['[data-view]', views],['[data-edit-artwork]',artworkEditButtons]]);
  const location = new URL('http://127.0.0.1:4173/?source=regression' + initialHash);
  const document = {
    activeElement: null, body: new Element('body'),
    getElementById: id => nodes.get(id) || null,
    createElement: tag => new Element(tag),
    querySelector(selector) { assert.ok(one.has(selector), 'Unsupported document selector: ' + selector); return one.get(selector); },
    querySelectorAll(selector) { assert.ok(many.has(selector), 'Unsupported document selector: ' + selector); return many.get(selector); },
    addEventListener: (type, listener) => on(documentEvents, type, listener),
    removeEventListener(type, listener) { documentEvents.set(type, (documentEvents.get(type) || []).filter(item => item !== listener)); },
    execCommand(command) { assert.equal(command, 'copy'); legacyAttempts++; return false; },
    createRange() {
      return { container: null, selectNodeContents(element) { this.container = element; }, cloneRange() { return { ...this }; } };
    },
  };
  const selection = {
    get rangeCount() { return selectedRanges.length; }, getRangeAt: index => selectedRanges[index],
    removeAllRanges() { selectedRanges = []; }, addRange(range) { selectedRanges.push(range); },
  };
  class ClipboardItem { constructor(parts) { this.parts = parts; } }
  class HarnessURL extends URL {
    static createObjectURL(blob) { const url = `blob:test/${objectURLs.size + 1}`; objectURLs.set(url, blob); return url; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  let imageSettings = null, artworkSettings = null, artworkOpened = 0;
  const context = {
    window: { SignatureCore: core, ClipboardItem, SignatureImage: { attach(settings) { imageSettings = settings; } },
      SignatureArtworkControls: {attach(settings) {artworkSettings = settings; return {open() {artworkOpened++;}};}} }, document, location,
    history: { replaceState(_state, _title, path) { location.href = new URL(path, location).href; } },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) { if (storageFails || key === nextWriteFailure) { nextWriteFailure = null; throw new Error('QuotaExceededError'); } storage.set(key, String(value)); },
      removeItem(key) { if (storageFails) throw new Error('QuotaExceededError'); storage.delete(key); },
    },
    navigator: { clipboard: {
      async write(items) { clipboardAttempts++; if (clipboardSucceeds) { clipboardItems.push(...items); return; } throw new Error('Clipboard blocked'); },
      async writeText(value) { clipboardAttempts++; clipboardTexts.push(value); throw new Error('Clipboard blocked'); },
    } },
    URL: HarnessURL, Blob, ClipboardItem, TextEncoder, TextDecoder, Uint8Array, atob, btoa,
    innerWidth: 390, innerHeight: 844, getComputedStyle: () => ({ paddingLeft: '16', paddingRight: '16' }),
    ResizeObserver: class { observe() {} }, getSelection: () => selection,
    addEventListener: (type, listener) => on(globalEvents, type, listener),
    setTimeout(callback) { timers.push(callback); return timers.length; },
  };
  vm.runInNewContext(historySource, context, { filename: 'editor-history.js' });
  vm.runInNewContext(sessionSource, context, { filename: 'session-data.js' });
  vm.runInNewContext(sessionControlsSource, context, { filename: 'session-controls.js' });
  vm.runInNewContext(collectionsSource, context, { filename: 'design-collections.js' });
  vm.runInNewContext(appSource, context, { filename: 'app.js' });
  if (expectPreview) assert.ok(node('signature-preview').innerHTML.includes('<table'), 'Startup must render successfully; swallowed runtime errors are not a pass.');
  return {
    node, footer, storage, location, downloads, objectURLs, revoked, clipboardTexts, clipboardItems,
    hasNode: id => nodes.has(id),
    failNextWrite(key) { nextWriteFailure = key; },
    get imageSettings() { return imageSettings; },
    get artworkSettings() { return artworkSettings; },
    get artworkOpened() { return artworkOpened; },
    click: id => node(id).click(),
    async input(key, value) { const field = inputs[key] || node(key); field.value = String(value); await emit(node('editor-form').events, 'input', { target: field }); },
    async finishEdit() { await emit(node('editor-form').events, 'change'); },
    async selectTheme(id) { node('theme-select').value = id; await emit(node('theme-select').events, 'change'); },
    async pasteSession(text) { node('session-json').value = text; await emit(node('session-json').events, 'input'); },
    async importParts(information, design) { node('session-import-information').checked=information; node('session-import-design').checked=design; await emit(node('session-import-information').events,'change'); },
    async chooseSessionFile(file) { node('session-file').files = [file]; await emit(node('session-file').events, 'change'); },
    async navigateHash(hash) { location.hash = hash; await emit(globalEvents, 'hashchange'); },
    get selected() { return selectedRanges.at(-1)?.container; },
    get attempts() { return { modern: clipboardAttempts, legacy: legacyAttempts }; },
    flushTimers() { for (const callback of timers.splice(0)) callback(); },
  };
}

// These expected colors are independent of runtime catalog metadata. A palette
// must never smuggle the legacy collection's composition or pattern into a draft.
const expectedPalettes = [
  ['vermilion','#f3f0ea','#1c1c1c','#c8362a'], ['cobalt','#eef2ff','#182d59','#3659d9'],
  ['forest','#edf2ea','#1d392f','#a64435'], ['lilac','#eee6f7','#32263d','#8049a7'],
  ['saffron','#fff2d8','#353027','#a7620c'], ['rose','#f9e7e7','#462c39','#ad3e66'],
  ['midnight','#172333','#edf1f5','#d66942'],
  ['cutpaper','#f5f0e6','#f5f0e6','#2348c7'], ['colorfield','#efe9e1','#d8cbc3','#735568'],
  ['chromatic','#f0e7ce','#ece8df','#244dd7'], ['counterform','#eee5ce','#eee5ce','#575b29'],
  ['overprint','#f4e8dd','#ede4d6','#b74535'], ['gesture','#f3efe8','#f3efe8','#c94836'],
  ['galaxy','#15192e','#242041','#c396ef'], ['starlight','#18283e','#2a3f5c','#edcc83'],
  ['moonlight','#f1e7fa','#402e63','#b95689'], ['frost','#d7eef6','#102d47','#4489b3']
];

test('the simplified browser has two sections, collapsible layouts and seventeen distinct color palettes', () => {
  const app=harness();
  assert.deepEqual([...pageSource.matchAll(/data-library-tab="([^"]+)"/g)].map(match=>match[1]),['layouts','artwork']);
  for(const id of ['library-tab-themes','library-panel-themes','collection-gallery','abstract-collection-gallery']) assert.equal(app.hasNode(id),false,id+' is removed');
  assert.doesNotMatch(appSource,/choose-collection-/);
  assert.match(pageSource,/<details\b[^>]*id="layout-disclosure"[^>]*>[\s\S]*?<summary>Layout<\/summary>/);
  assert.match(pageSource,/<details\b[^>]*id="more-palettes"[^>]*>/);
  assert.match(pageSource,/<details\b[^>]*id="saved-palettes"[^>]*>/);
  assert.deepEqual(app.node('palette-choices').children.map(button=>button.id),expectedPalettes.slice(0,6).map(([id])=>'choose-palette-'+id));
  assert.deepEqual(app.node('extra-palette-choices').children.map(button=>button.id),expectedPalettes.slice(6).map(([id])=>'choose-palette-'+id));
  const buttons=[...app.node('palette-choices').children,...app.node('extra-palette-choices').children];
  assert.equal(buttons.length,17,'six common palettes plus eleven additional palettes');
  const actualColors=buttons.map(button=>button.children[0].children.map(swatch=>swatch.style.backgroundColor.toLowerCase()).join('|'));
  assert.equal(new Set(actualColors).size,17,'every visible palette has a unique three-color combination');
  assert.deepEqual(actualColors,expectedPalettes.map(([,front,back,accent])=>[front,back,accent].join('|')));
  assert.equal(app.hasNode('choose-palette-spruce'),false,'the duplicate remains a legacy data identity, not another palette choice');
});

test('all seventeen palettes change only three colors and survive undo, reload and selective import', async () => {
  const initial={...core.defaults,design:'signal',pattern:'counterform',layout:'stacked',nameLine1:'Jordan',
    width:400,height:300,portraitData:localPortrait,artworkPlacement:'flow',artworkScale:125,artworkPositionX:19,artworkPositionY:83};
  const app=harness({initialDraft:initial});
  for(const [id,frontBackground,backBackground,accent] of expectedPalettes) {
    await app.click('choose-palette-'+id);
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,frontBackground,backBackground,accent},id+' changes colors only');
    assert.equal(app.node('choose-palette-'+id).getAttribute('aria-pressed'),'true');
  }
  await app.click('undo-change'); assert.equal(app.node('frontBackground').value,'#f1e7fa');
  await app.click('redo-change'); assert.equal(app.node('frontBackground').value,'#d7eef6');
  await app.click('export-data'); const saved=app.node('session-json').value;
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(saved); await app.importParts(false,true); await app.click('session-restore');
  const restored=JSON.parse(app.storage.get(storageKey));
  assert.equal(restored.design,'signal'); assert.equal(restored.pattern,'counterform'); assert.equal(restored.artworkPositionY,83);
  assert.equal(restored.nameLine1,core.defaults.nameLine1); assert.equal(restored.portraitData,'');
  assert.equal(harness({initialDraft:restored}).node('frontBackground').value,'#d7eef6');
});

test('six independent abstract pattern controls preserve the chosen layout, palette, identity and photo', async () => {
  const initial = {...core.defaults,design:'signal',layout:'stacked',nameLine1:'Jordan',portraitData:localPortrait,artworkPlacement:'motif',
    frontBackground:'#f7eee4',backBackground:'#132d35',accent:'#a45341'};
  const app = harness({initialDraft:initial});
  const expected = ['cutpaper','colorfield','chromatic','counterform','overprint','gesture'];
  const assertThumbnails=mode=>{
    for(const id of expected) {
      const button=app.node('choose-pattern-'+id), img=button.children[0].children[0];
      assert.equal(img.src,'sig/pattern-'+id+(mode==='motif'?'':'-'+mode)+'.png',id+' thumbnail shows the candidate artwork that will be applied');
      assert.equal(button.classList.contains('is-flow-wide'),mode==='wide',id+' wide preview frame');
      assert.equal(button.classList.contains('is-flow-tall'),mode==='tall',id+' tall preview frame');
    }
    assert.equal(app.node('choose-pattern-galaxy').children[0].children[0].src,'sig/pattern-galaxy.png','fantasy patterns keep their side-motif thumbnail');
  };
  assert.deepEqual(app.node('abstract-pattern-choices').children.map(button=>button.id),expected.map(id=>'choose-pattern-'+id));
  assertThumbnails('motif');
  for (const pattern of expected) {
    await app.click('choose-pattern-'+pattern);
    const saved = JSON.parse(app.storage.get(storageKey));
    assert.deepEqual(saved,{...initial,pattern});
    assert.equal(app.node('choose-pattern-'+pattern).getAttribute('aria-pressed'),'true');
    assert.match(app.node('signature-preview').innerHTML,new RegExp('pattern-'+pattern+'\\.png'));
  }
  await app.click('undo-change'); assert.equal(app.node('pattern').value,'overprint');
  await app.click('redo-change'); assert.equal(app.node('pattern').value,'gesture');
  await app.input('artworkPlacement','auto');await app.input('layout','paired');assertThumbnails('wide');
  await app.input('layout','stacked');assertThumbnails('tall');
  await app.input('artworkPlacement','motif');assertThumbnails('motif');
  await app.click('undo-change');assertThumbnails('tall');
});

test('all seven layout choices preserve the complete artwork, palette and information state', async () => {
  const initial={...core.defaults,nameLine1:'Jordan',website:'https://example.org/work',pattern:'overprint',
    frontBackground:'#edf1f7',backBackground:'#181c29',accent:'#a63542',artworkPlacement:'flow',artworkScale:130,artworkPositionX:40,artworkPositionY:63};
  const app = harness({initialDraft:initial});
  for (const id of ['orbit','studio','contour','prism','editorial','signal','original']) {
    await app.click('choose-design-' + id);
    const saved = JSON.parse(app.storage.get(storageKey));
    assert.deepEqual(saved,{...initial,design:id},id+' changes only the composition');
    for(const button of app.node('design-gallery').children) assert.ok(button.children[0].children[0].innerHTML.includes('pattern-overprint-wide.png'),button.id+' preview retains the selected art');
  }
  await app.click('undo-change'); assert.equal(app.node('design').value, 'signal');
  await app.click('redo-change'); assert.equal(app.node('design').value, 'original');
});

test('width and height sliders stay synchronized with numeric inputs, real dimensions, undo and import',async()=>{
  const app=harness();
  for(const [key,min,max] of [['width',280,420],['height',180,320]]) {
    for(const id of [key,key+'-range']) {
      const tag=pageSource.match(new RegExp('<input\\b[^>]*id="'+id+'"[^>]*>'))[0];
      assert.match(tag,new RegExp('min="'+min+'"')); assert.match(tag,new RegExp('max="'+max+'"'));
      assert.match(tag,/step="1"/); assert.match(tag,new RegExp('type="'+(id===key?'number':'range')+'"'));
    }
  }
  await app.input('width-range',420); await app.finishEdit();
  assert.equal(Number(app.node('width').value),420); assert.equal(Number(app.node('width-range').value),420);
  assert.match(app.node('dimension-label').textContent,/860 × 208/); assert.match(app.node('size-explanation').textContent,/860 × 208/);
  await app.input('height-range',320); await app.finishEdit();
  assert.equal(Number(app.node('height').value),320); assert.match(app.node('dimension-label').textContent,/860 × 320/);
  await app.input('width',280); await app.finishEdit(); assert.equal(Number(app.node('width-range').value),280);
  await app.click('undo-change'); assert.equal(Number(app.node('width-range').value),420);
  await app.click('redo-change'); assert.equal(Number(app.node('width-range').value),280);
  await app.input('layout','stacked'); assert.match(app.node('size-explanation').textContent,/280 × 660/);
  const before=app.node('signature-preview').innerHTML;
  await app.input('width',''); assert.match(app.node('size-explanation').textContent,/Each value sets one panel/);
  assert.equal(app.node('signature-preview').innerHTML,before,'invalid empty numeric input never replaces the last valid preview');
  await app.input('width',400); await app.input('height',300);
  await app.click('export-data'); const text=app.node('session-json').value;
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(text); await app.click('session-restore');
  assert.equal(Number(app.node('width-range').value),400); assert.equal(Number(app.node('height-range').value),300);
  assert.match(app.node('dimension-label').textContent,/400 × 620/);
});

test('legacy preset identities still restore, export and apply colors without resetting artwork',async()=>{
  const initial={...core.defaults,design:'prism',pattern:'gesture',artworkPlacement:'flow',artworkScale:120};
  const app=harness({initialDraft:initial});
  await app.click('choose-palette-midnight');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,frontBackground:'#172333',backBackground:'#edf1f5',accent:'#d66942'});
  await app.click('export-data'); const text=app.node('session-json').value;
  assert.equal(JSON.parse(text).ui.selectedThemeId,'preset-midnight');
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(text); await app.click('session-restore');
  await app.click('export-data'); assert.equal(JSON.parse(app.node('session-json').value).ui.selectedThemeId,'preset-midnight');
  await app.click('close-session');
  assert.equal(app.node('pattern').value,'gesture'); assert.equal(Number(app.node('artworkScale').value),120);
  const legacySpruce=JSON.parse(text), spruceColors={frontBackground:'#edf2ea',backBackground:'#1d392f',accent:'#a64435'};
  Object.assign(legacySpruce.draft,spruceColors);legacySpruce.ui.selectedThemeId='preset-spruce';
  await app.click('import-data');await app.pasteSession(JSON.stringify(legacySpruce));await app.click('session-restore');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,...spruceColors});
  assert.equal(app.node('choose-palette-forest').getAttribute('aria-pressed'),'true','the equivalent visible palette is selected');
  await app.click('export-data');const reexported=JSON.parse(app.node('session-json').value);
  assert.equal(reexported.ui.selectedThemeId,'preset-spruce','old selected palette identities remain round-trip compatible');
  assert.deepEqual(reexported.draft,legacySpruce.draft,'restoring a legacy palette never replaces the chosen artwork or composition');
});

test('flow controls change numeric draft values, retain one gesture undo and follow artwork switches',async()=>{
  const initial={...core.defaults,pattern:'counterform',artworkPlacement:'flow'};
  const app=harness({initialDraft:initial});
  assert.equal(app.node('artwork-flow-settings').hidden,false);assert.equal(app.node('artwork-flow-option').disabled,false);
  assert.equal(app.node('artworkPositionX').disabled,true,'an exactly fitted axis has no position range');
  assert.equal(app.node('artwork-position-note').hidden,false);
  await app.input('artworkScale',110);await app.input('artworkScale',120);await app.input('artworkScale',130);await app.finishEdit();
  assert.equal(JSON.parse(app.storage.get(storageKey)).artworkScale,130);
  assert.equal(app.node('artworkScale-value').textContent,'130%');
  assert.equal(app.node('artworkPositionX').disabled,false,'changing scale enables meaningful positioning');
  assert.equal(app.node('artwork-position-note').hidden,true);
  assert.match(app.node('signature-preview').innerHTML,/background-size:860\.6px 320\.223px/);
  await app.click('undo-change'); assert.equal(Number(app.node('artworkScale').value),100);
  assert.equal(app.node('undo-change').disabled,true,'one slider gesture makes one undo entry');
  await app.click('redo-change');assert.equal(Number(app.node('artworkScale').value),130);
  await app.input('artworkPositionX',0);await app.finishEdit();await app.input('artworkPositionY',100);await app.finishEdit();
  assert.equal(JSON.parse(app.storage.get(storageKey)).artworkPositionX,0);assert.equal(app.node('artworkPositionY-value').textContent,'100%');
  await app.click('choose-pattern-galaxy');
  assert.equal(app.node('artworkPlacement').value,'auto');assert.equal(app.node('artwork-flow-settings').hidden,true);assert.equal(app.node('artwork-flow-option').disabled,true);
  assert.match(app.node('signature-preview').innerHTML,/pattern-galaxy\.png/);assert.doesNotMatch(app.node('signature-preview').innerHTML,/background-image/);
  await app.click('undo-change');assert.equal(app.node('pattern').value,'counterform');assert.equal(app.node('artworkPlacement').value,'flow');
  assert.equal(app.node('artwork-flow-settings').hidden,false);
  await app.input('pattern','none');assert.equal(app.node('artworkPlacement').value,'auto');assert.equal(app.node('artwork-flow-option').disabled,true);
  await app.click('choose-pattern-overprint');assert.equal(app.node('artwork-flow-settings').hidden,false);
  assert.equal(Number(app.node('artworkScale').value),130,'returning to flow keeps the previous framing');
});

test('import cards apply information, design or both and leave unselected parts unchanged', async () => {
  const incoming={format:'signature-editor-session',version:1,exportedAt:'2026-09-05T21:54:10.556Z',draft:{...core.defaults,nameLine1:'Jordan',design:'signal',pattern:'frost',frontBackground:'#e0eff6'},themes:[],ui:{}};
  const app=harness({initialDraft:{...core.defaults,nameLine1:'Avery',design:'prism',portraitData:localPortrait}});
  await app.click('import-data'); await app.pasteSession(JSON.stringify(incoming));
  await app.importParts(false,false); assert.equal(app.node('session-restore').disabled,true);
  await app.importParts(false,true); assert.equal(app.node('session-restore').disabled,false);
  await app.click('session-restore'); assert.equal(app.node('nameLine1').value,'Avery'); assert.equal(app.node('design').value,'signal'); assert.equal(app.node('portraitData').value,localPortrait);
  await app.click('undo-change'); assert.equal(app.node('design').value,'prism');
  await app.click('import-data'); await app.pasteSession(JSON.stringify(incoming)); await app.importParts(true,false); await app.click('session-restore');
  assert.equal(app.node('nameLine1').value,'Jordan'); assert.equal(app.node('design').value,'prism'); assert.equal(app.node('portraitData').value,'');
  await app.click('import-data'); await app.pasteSession(JSON.stringify(incoming)); await app.click('session-restore');
  assert.equal(app.node('design').value,'signal'); assert.equal(app.node('nameLine1').value,'Jordan');
});

test('design and uploaded photo survive export reset restore and history', async () => {
  const app = harness({initialDraft: {...core.defaults, nameLine1:'Jordan', design:'prism', pattern:'contour', portraitData:localPortrait, portraitShape:'rounded', portraitSize:64}});
  await app.input('theme-name', 'Portrait colors'); await app.click('save-theme'); await app.click('photo-tab');
  await app.click('export-data'); const exported = app.node('session-json').value;
  assert.equal(JSON.parse(exported).ui.editorTab, 'photo');
  await app.click('close-session'); await app.click('reset-draft');
  assert.equal(app.node('portraitData').value, '');
  await app.click('import-data'); await app.pasteSession(exported); await app.click('session-restore');
  const restored = JSON.parse(app.storage.get(storageKey));
  assert.equal(restored.nameLine1,'Jordan'); assert.equal(restored.design,'prism'); assert.equal(restored.pattern,'contour');
  assert.equal(restored.portraitData,localPortrait); assert.equal(restored.portraitShape,'rounded');
  assert.equal(JSON.parse(app.storage.get('signature-studio:themes:v1')).themes[0].name,'Portrait colors');
  assert.equal(app.node('photo-tab').getAttribute('aria-selected'),'true');
  await app.click('undo-change'); assert.equal(app.node('portraitData').value,'');
  await app.click('redo-change'); assert.equal(app.node('portraitData').value,localPortrait);
});

test('uploaded-only portraits never silently become broken email HTML or oversized draft links', async () => {
  const app = harness({initialDraft:{...core.defaults,portraitData:localPortrait},clipboardSucceeds:true});
  assert.ok(app.node('signature-preview').innerHTML.includes(localPortrait));
  await app.click('copy-signature'); assert.equal(app.clipboardItems.length,0);
  assert.equal(app.node('photo-tab').getAttribute('aria-selected'),'true');
  assert.match(app.node('status').textContent,/photo|portrait|hosted/i);
  await app.click('download-html'); assert.equal(app.downloads.length,0);
  await app.click('share-link'); assert.equal(app.clipboardTexts.length,0);
  assert.match(app.node('status').textContent,/Export data/);
  await app.click('export-data'); assert.equal(JSON.parse(app.node('session-json').value).draft.portraitData,localPortrait);
});

test('blocked storage guides photo users to a backup that can preserve the portrait', async () => {
  const app=harness({initialDraft:{...core.defaults,portraitData:localPortrait},storageFails:true});
  assert.match(app.footer.textContent,/Export data/);
  await app.click('export-data'); await app.click('session-download');
  const download=app.downloads.at(-1), backup=JSON.parse(await app.objectURLs.get(download.href).text());
  assert.equal(backup.draft.portraitData,localPortrait);
});

test('normal rich clipboard writes both clickable public HTML and meaningful plain text', async () => {
  const app = harness({initialDraft:{...core.defaults,nameLine1:'Jordan',design:'editorial',portraitUrl:'https://example.org/portrait.jpg'},clipboardSucceeds:true});
  await app.click('copy-signature'); assert.equal(app.clipboardItems.length,1); assert.equal(app.attempts.legacy,0);
  const parts=app.clipboardItems[0].parts, html=await parts['text/html'].text(), plain=await parts['text/plain'].text();
  assert.match(html,/Jordan/); assert.match(html,/https:\/\/example\.org\/portrait\.jpg/); assert.match(html,/href="https:\/\/example.com/);
  assert.doesNotMatch(html,/src="(?:data:|blob:|\.\/)/); assert.match(plain,/Jordan/); assert.match(plain,/example.com/);
  assert.match(app.node('status').textContent,/Signature copied/);
});

test('manual clipboard fallback selects the current export with public image URLs', async () => {
  const app = harness();
  await app.input('nameLine1', 'Zoë');
  await app.click('copy-signature');
  const expected = core.render({ ...core.defaults, nameLine1: 'Zoë' });
  assert.deepEqual(app.attempts, { modern: 1, legacy: 1 });
  assert.ok(app.selected, 'A manual-copy selection must exist after both clipboard APIs fail.');
  assert.equal(app.selected.innerHTML, expected);
  assert.doesNotMatch(app.selected.innerHTML, /src="(?:\.\/|https?:\/\/(?:127\.0\.0\.1|localhost))/);
  assert.match(app.node('status').textContent, /blocked/i);
  assert.match(app.node('status').textContent, /Ctrl\+C/);
  assert.doesNotMatch(app.node('status').textContent, /signature copied/i);
});

test('failed browser storage never claims a draft import or failed share was saved', async () => {
  const app = harness({ storageFails: true, initialHash: draftHash({ ...core.defaults, nameLine1: 'Zoë' }) });
  assert.equal(app.node('nameLine1').value, 'Zoë');
  assert.equal(app.storage.size, 0);
  assert.match(app.footer.textContent, /not saved|storage unavailable/i);
  assert.equal(app.footer.getAttribute('role'), 'status');
  assert.doesNotMatch(app.node('status').textContent, /saved in this browser|still saved|and saved/i);
  await app.click('share-link');
  assert.match(app.node('status').textContent, /blocked/i);
  assert.doesNotMatch(app.node('status').textContent, /saved here|still saved|saved in this browser/i);
  assert.match(app.footer.textContent, /not saved|storage unavailable/i);
});

test('same-page hashchange imports Unicode draft details and removes the fragment', async () => {
  const app = harness();
  const incoming = { ...core.defaults, nameLine1: 'Zoë', nameLine2: 'Mörgán', website: 'https://example.com/portfolio', websiteLabel: 'Portfolio' };
  await app.navigateHash(draftHash(incoming));
  assert.equal(app.node('nameLine1').value, incoming.nameLine1);
  assert.equal(app.node('nameLine2').value, incoming.nameLine2);
  assert.equal(app.node('website').value, incoming.website);
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)), JSON.parse(JSON.stringify(core.normalize(incoming))));
  assert.match(app.node('signature-preview').innerHTML, /Mörgán/);
  assert.equal(app.location.hash, '');
  assert.equal(app.location.search, '?source=regression');
  assert.match(app.node('status').textContent, /loaded from the link/i);
});

test('invalid hashchange preserves the current draft and clears the invalid fragment', async () => {
  const app = harness();
  await app.input('nameLine1', 'Zoë');
  const saved = app.storage.get(storageKey);
  await app.navigateHash('#v=this-is-not-json');
  assert.equal(app.node('nameLine1').value, 'Zoë');
  assert.equal(app.storage.get(storageKey), saved);
  assert.equal(app.location.hash, '');
  assert.match(app.node('status').textContent, /invalid/i);
});

test('download requests a Blob containing the current standalone export and public assets', async () => {
  const app = harness();
  await app.input('nameLine1', 'Zoë');
  await app.click('download-html');
  assert.equal(app.downloads.length, 1);
  const download = app.downloads[0], blob = app.objectURLs.get(download.href);
  assert.equal(download.filename, 'my-signature.html');
  assert.ok(blob instanceof Blob);
  assert.match(blob.type, /^text\/html/i);
  const html = await blob.text();
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.includes(core.render({ ...core.defaults, nameLine1: 'Zoë' })));
  assert.doesNotMatch(html, /src="(?:\.\/|https?:\/\/(?:127\.0\.0\.1|localhost))/);
  assert.match(app.node('status').textContent, /requested/i);
  assert.doesNotMatch(app.node('status').textContent, /downloaded|file saved/i);
  app.flushTimers();
  assert.deepEqual(app.revoked, [download.href]);
});

test('themes save only colors and survive reload without replacing contact details', async () => {
  const app = harness();
  await app.input('nameLine1', 'Zoë');
  await app.input('frontBackground-hex', '#112233');
  await app.input('backBackground', '#ddeeff');
  await app.input('theme-name', 'Blue draft');
  await app.click('save-theme');
  const saved = JSON.parse(app.storage.get('signature-studio:themes:v1'));
  assert.equal(saved.themes.length, 1);
  assert.deepEqual(Object.keys(saved.themes[0]).sort(), ['accent', 'backBackground', 'frontBackground', 'id', 'name']);
  assert.equal(saved.themes[0].frontBackground, '#112233');
  assert.equal(saved.themes[0].backBackground, '#ddeeff');
  assert.doesNotMatch(JSON.stringify(saved), /Zoë|example\.com/);
  const restored = harness({ initialThemes: saved, initialDraft: { ...core.defaults, nameLine1: 'Renée' } });
  await restored.selectTheme(saved.themes[0].id);
  assert.equal(restored.node('frontBackground').value, '#112233');
  assert.equal(restored.node('nameLine1').value, 'Renée');
  await restored.click('copy-signature');
  assert.match(restored.selected.innerHTML, /background-color:#112233/);
  assert.match(restored.selected.innerHTML, /background-color:#ddeeff/);
});

test('saved themes can be updated and deleted with undo while retaining current colors', async () => {
  const app = harness();
  await app.input('theme-name', 'Experiment');
  await app.click('save-theme');
  await app.input('accent-hex', '#123456');
  assert.match(app.node('theme-state').textContent, /Modified/);
  await app.click('update-theme');
  const saved = () => JSON.parse(app.storage.get('signature-studio:themes:v1')).themes;
  assert.equal(saved()[0].accent, '#123456');
  await app.click('delete-theme');
  assert.equal(saved().length, 0);
  assert.equal(app.node('accent').value, '#123456');
  await app.node('theme-notice').children[0].click();
  assert.equal(saved().length, 1);
  assert.equal(saved()[0].name, 'Experiment');
});

test('invalid colors and duplicate theme names cannot overwrite saved themes', async () => {
  const app = harness();
  await app.input('theme-name', 'My theme');
  await app.click('save-theme');
  const before = app.storage.get('signature-studio:themes:v1');
  await app.click('save-theme');
  assert.equal(app.storage.get('signature-studio:themes:v1'), before);
  assert.match(app.node('theme-notice').textContent, /already used/);
  await app.input('frontBackground-hex', '#zzzzzz');
  await app.click('update-theme');
  assert.equal(app.storage.get('signature-studio:themes:v1'), before);
  assert.equal(app.node('frontBackground-hex').getAttribute('aria-invalid'), 'true');
  assert.match(app.node('theme-notice').textContent, /valid/);
});

test('theme storage failures remain truthful and presets remain usable', async () => {
  const app = harness({ storageFails: true });
  await app.selectTheme('preset-midnight');
  assert.equal(app.node('frontBackground').value, '#172333');
  await app.input('theme-name', 'Night');
  await app.click('save-theme');
  assert.equal(app.storage.has('signature-studio:themes:v1'), false);
  assert.match(app.node('theme-notice').textContent, /not saved/);
  assert.equal(app.node('update-theme').disabled, true);
});

test('icon choices survive reload, draft links, themes, and HTML export', async () => {
  const app = harness();
  await app.input('websiteIcon', 'mail');
  await app.input('phoneIcon', 'none');
  assert.equal(app.node('phoneIcon-preview').hidden, true);
  assert.match(app.node('websiteIcon-preview').src, /icon-mail\.png$/);
  const saved = JSON.parse(app.storage.get(storageKey));
  const restored = harness({ initialDraft: saved });
  assert.equal(restored.node('websiteIcon').value, 'mail');
  assert.equal(restored.node('phoneIcon').value, 'none');
  await restored.selectTheme('preset-midnight');
  await restored.click('copy-signature');
  assert.match(restored.selected.innerHTML, /icon-mail-dark\.png/);
  assert.doesNotMatch(restored.selected.innerHTML, /icon-phone(?:-dark)?\.png/);
  assert.match(restored.selected.innerHTML, /href="tel:/);
  await restored.click('share-link');
  const shared = JSON.parse(Buffer.from(restored.clipboardTexts.at(-1).split('#v=')[1], 'base64url').toString());
  assert.equal(shared.websiteIcon, 'mail');
  assert.equal(shared.phoneIcon, 'none');
  const imported = harness({ initialHash: draftHash(shared) });
  assert.equal(imported.node('websiteIcon').value, 'mail');
  assert.equal(imported.node('phoneIcon-preview').hidden, true);
});

test('compact older drafts retain their details and height when icons are inherited', () => {
  const older = { ...core.defaults, nameLine1: 'Jamie', height: 180, email: 'hello@example.com' };
  for (const key of Object.keys(older).filter(key => key.endsWith('Icon'))) delete older[key];
  const app = harness({ initialDraft: older });
  const saved = JSON.parse(app.storage.get(storageKey));
  assert.equal(saved.nameLine1, 'Jamie');
  assert.equal(saved.email, 'hello@example.com');
  assert.equal(saved.height, 180);
  assert.equal(saved.emailIcon, 'mail');
  assert.match(app.node('signature-preview').innerHTML, /icon-mail\.png/);
});

test('unusable saved drafts are not overwritten by startup', () => {
  const invalid = { ...core.defaults, nameLine1: 'Jamie', website: 'javascript:alert(1)' };
  const app = harness({ initialDraft: invalid, expectPreview: false });
  assert.equal(app.node('nameLine1').value, 'Jamie');
  assert.equal(app.storage.get(storageKey), JSON.stringify(invalid));
  assert.equal(app.node('website').getAttribute('aria-invalid'), 'true');
  assert.match(app.footer.textContent, /not saved/);
  const unreadable = harness({ initialDraft: ['unrecognized', 'draft'] });
  assert.equal(unreadable.storage.get(storageKey), JSON.stringify(['unrecognized', 'draft']));
  assert.match(unreadable.footer.textContent, /left in storage/);
});

test('editor undo/redo restores typing, invalid dimensions, icons, colors, and reset', async () => {
  const app = harness();
  assert.equal(app.node('undo-change').disabled,true);
  await app.input('nameLine1','Z'); await app.input('nameLine1','Zo'); await app.input('nameLine1','Zoë');
  await app.click('undo-change'); assert.equal(app.node('nameLine1').value,'Avery');
  await app.click('redo-change'); assert.equal(app.node('nameLine1').value,'Zoë');
  await app.input('height','999'); assert.equal(app.node('height').getAttribute('aria-invalid'),'true');
  await app.click('undo-change'); assert.equal(app.node('height').value,208);
  assert.equal(app.node('height').getAttribute('aria-invalid'),'false');
  await app.input('websiteIcon','none'); await app.selectTheme('preset-midnight');
  await app.click('undo-change'); assert.equal(app.node('frontBackground').value,'#f3f0ea');
  assert.equal(app.node('websiteIcon').value,'none');
  await app.click('undo-change'); assert.equal(app.node('websiteIcon').value,'web');
  await app.click('reset-draft'); await app.click('undo-change');
  assert.equal(app.node('nameLine1').value,'Zoë');
  assert.equal(JSON.parse(app.storage.get(storageKey)).nameLine1,'Zoë');
});

test('same-page draft imports are undoable and new edits clear redo', async () => {
  const app = harness();
  await app.navigateHash(draftHash({...core.defaults,nameLine1:'Jamie'}));
  await app.click('undo-change'); assert.equal(app.node('nameLine1').value,'Avery');
  assert.equal(app.node('redo-change').disabled,false);
  await app.input('location','Basel'); assert.equal(app.node('redo-change').disabled,true);
  assert.equal(app.imageSettings.getDraft().location,'Basel');
  assert.equal(app.imageSettings.validate(),true);
});

test('session JSON exports and restores draft, themes, and view settings after reset', async () => {
  const app = harness();
  await app.input('nameLine1','Zoë'); await app.input('websiteIcon','mail');
  await app.input('theme-name','My colors'); await app.click('save-theme');
  await app.click('colors-tab');
  await app.click('export-data');
  const exported = app.node('session-json').value;
  const session = JSON.parse(exported);
  assert.equal(session.draft.nameLine1,'Zoë'); assert.equal(session.themes[0].name,'My colors');
  assert.equal(session.ui.editorTab,'colors');
  await app.click('session-download');
  const file = app.downloads.at(-1);
  assert.match(file.filename,/^signature-session-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(await app.objectURLs.get(file.href).text(),exported);
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(exported);
  assert.equal(app.node('session-restore').disabled,false);
  await app.click('session-restore');
  assert.equal(app.node('nameLine1').value,'Zoë');
  assert.equal(app.node('websiteIcon').value,'mail');
  assert.equal(app.node('colors-tab').getAttribute('aria-selected'),'true');
  assert.equal(JSON.parse(app.storage.get(storageKey)).nameLine1,'Zoë');
  assert.equal(JSON.parse(app.storage.get('signature-studio:themes:v1')).themes.length,1);
  await app.click('undo-change'); assert.equal(app.node('nameLine1').value,'Avery');
});

test('bad session files and failed reads never replace a draft or allow stale restoration', async () => {
  const app = harness(); await app.input('nameLine1','Zoë');
  const before=app.storage.get(storageKey);
  await app.click('import-data'); await app.pasteSession('{broken');
  assert.equal(app.node('session-restore').disabled,true); await app.click('session-restore');
  assert.equal(app.storage.get(storageKey),before);
  await app.pasteSession(JSON.stringify({...core.defaults,nameLine1:'Jamie'}));
  assert.equal(app.node('session-restore').disabled,false);
  await app.chooseSessionFile({size:2*1024*1024,text:async()=>'{broken'});
  assert.equal(app.node('session-restore').disabled,true); await app.click('session-restore');
  assert.equal(app.node('nameLine1').value,'Zoë');
});

test('storage failure restores a session for the current tab without claiming persistence',async()=>{
  const app=harness({storageFails:true});
  await app.click('import-data'); await app.pasteSession(JSON.stringify({...core.defaults,nameLine1:'Jamie'}));
  await app.click('session-restore');
  assert.equal(app.node('nameLine1').value,'Jamie');
  assert.equal(app.storage.size,0); assert.match(app.node('status').textContent,/this tab/);
  assert.match(app.footer.textContent,/Not saved/);
});

test('imported themes persist with the draft when storage recovers after a failed restore',async()=>{
  const incoming=harness(); await incoming.input('theme-name','Incoming'); await incoming.click('save-theme');
  await incoming.input('nameLine1','Jamie'); await incoming.click('export-data');
  const app=harness(); await app.input('theme-name','Existing'); await app.click('save-theme');
  app.failNextWrite(storageKey);
  await app.click('import-data'); await app.pasteSession(incoming.node('session-json').value); await app.click('session-restore');
  assert.match(app.node('status').textContent,/this tab/);
  assert.equal(JSON.parse(app.storage.get('signature-studio:themes:v1')).themes.length,1,'partial restore was rolled back');
  await app.input('location','Basel');
  assert.match(app.node('save-status').textContent,/Saved in this browser/);
  assert.deepEqual(JSON.parse(app.storage.get('signature-studio:themes:v1')).themes.map(t=>t.name),['Existing','Incoming']);
  assert.equal(JSON.parse(app.storage.get(storageKey)).nameLine1,'Jamie');
});

test('long imported theme identities survive browser reload, reimport, and session export',async()=>{
  const originalName='A'.repeat(40), otherName='A'.repeat(29)+'B'.repeat(11);
  const palette={frontBackground:'#f3f0ea',backBackground:'#1c1c1c',accent:'#c8362a'};
  const existing={id:'old',name:originalName,...palette,accent:'#111111'};
  const incoming=[{id:'new-a',name:originalName,...palette},{id:'new-b',name:otherName,...palette}];
  const file=JSON.stringify({format:'signature-editor-session',version:1,exportedAt:'2026-09-06T00:00:00.000Z',draft:{...core.defaults},themes:incoming,ui:{selectedThemeId:'new-a'}});
  const app=harness({initialThemes:{version:1,themes:[existing]}});
  await app.click('import-data'); await app.pasteSession(file); await app.click('session-restore');
  const stored=JSON.parse(app.storage.get('signature-studio:themes:v1'));
  assert.equal(stored.themes.length,3);
  const identity=stored.themes.find(theme=>theme.importedFromName===originalName);
  assert.ok(identity,'the complete source name is retained');
  const reloaded=harness({initialThemes:stored});
  await reloaded.click('import-data'); await reloaded.pasteSession(file); await reloaded.click('session-restore');
  await reloaded.click('export-data');
  const roundtrip=JSON.parse(reloaded.node('session-json').value);
  assert.equal(roundtrip.themes.length,3,'reimport after reload adds no duplicate');
  assert.equal(roundtrip.ui.selectedThemeId,identity.id);
  assert.equal(roundtrip.themes.find(theme=>theme.id===identity.id).importedFromName,originalName);
});

test('manual artwork applies only artwork with one undo step and survives session restore', async () => {
  const initial = {...core.defaults,design:'orbit',pattern:'cutpaper',nameLine1:'Jordan',portraitData:localPortrait};
  const app = harness({initialDraft:initial});
  const recipe = JSON.stringify({palette:['#2348c7','#dd6146'],rows:['00..','00..','....','..11','..11','....','....','....']});
  app.artworkSettings.applyChanges({pattern:'custom',customPattern:recipe,nameLine1:'Unexpected replacement',design:'signal'});
  const applied = app.artworkSettings.getDraft();
  assert.equal(applied.pattern,'custom'); assert.equal(applied.customPattern,recipe);
  for (const key of Object.keys(initial).filter(key=>!['pattern','customPattern'].includes(key))) assert.equal(applied[key],initial[key],key+' stays');
  assert.match(app.node('signature-preview').innerHTML,/bgcolor="#2348c7"/);
  await app.click('undo-change'); assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('undo-change').disabled,true,'one application creates exactly one undo step');
  await app.click('redo-change'); await app.click('export-data'); const backup=app.node('session-json').value;
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(backup); await app.click('session-restore');
  assert.equal(app.artworkSettings.getDraft().customPattern,recipe);
  assert.equal(app.artworkSettings.getDraft().portraitData,localPortrait);
  const reloaded=harness({initialDraft:JSON.parse(app.storage.get(storageKey))});
  assert.equal(reloaded.artworkSettings.getDraft().customPattern,recipe);
});

test('manual artwork rejects invalid recipes before changing storage or history and opens from Custom artwork', async () => {
  const app=harness(), before=app.storage.get(storageKey);
  await app.click('choose-pattern-custom');
  assert.equal(app.artworkOpened,1); assert.equal(app.storage.get(storageKey),before);
  for (const customPattern of ['{broken',JSON.stringify({palette:['red'],rows:['0000','0000','0000','0000']})]) {
    assert.throws(()=>app.artworkSettings.applyChanges({customPattern}));
    assert.equal(app.storage.get(storageKey),before); assert.equal(app.node('undo-change').disabled,true);
  }
});

test('manual artwork explicitly leaves flow without losing framing settings or introducing unrelated changes',async()=>{
  const initial={...core.defaults,pattern:'gesture',artworkPlacement:'flow',artworkScale:140,artworkPositionX:10,artworkPositionY:89};
  const app=harness({initialDraft:initial});
  const customPattern=JSON.stringify({palette:['#123456'],rows:['00..','00..','....','....']});
  app.artworkSettings.applyChanges({customPattern,artworkPlacement:'flow',artworkScale:75,nameLine1:'Unexpected'});
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern:'custom',customPattern,artworkPlacement:'motif'});
  assert.equal(app.node('artwork-flow-settings').hidden,true);assert.match(app.node('signature-preview').innerHTML,/bgcolor="#123456"/);
  assert.doesNotMatch(app.node('signature-preview').innerHTML,/background-image/);
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('artwork-flow-settings').hidden,false);assert.equal(app.node('undo-change').disabled,true);
});

test('reapplying an untouched imported artwork preserves its exact recipe without a new undo entry', () => {
  const customPattern=JSON.stringify({palette:['#2348C7'],rows:['00..','00..','....','....']},null,2);
  const app=harness({initialDraft:{...core.defaults,pattern:'custom',customPattern}}), before=app.storage.get(storageKey);
  app.artworkSettings.applyChanges({customPattern:app.artworkSettings.getDraft().customPattern});
  assert.equal(app.storage.get(storageKey),before);
  assert.equal(app.node('undo-change').disabled,true);
});
