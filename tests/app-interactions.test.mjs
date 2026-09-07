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
  const one = new Map([['.rail-footer > span', footer], ['.preview-actions > div', actionGroup], ['[data-preview-view]', workspace], ['.preview-column', column]]);
  const many = new Map([['[data-editor-tab]', tabs], ['[data-editor-panel]', panels], ['[data-view]', views]]);
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
  let imageSettings = null;
  const context = {
    window: { SignatureCore: core, ClipboardItem, SignatureImage: { attach(settings) { imageSettings = settings; } } }, document, location,
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
    failNextWrite(key) { nextWriteFailure = key; },
    get imageSettings() { return imageSettings; },
    click: id => node(id).click(),
    async input(key, value) { const field = inputs[key] || node(key); field.value = String(value); await emit(node('editor-form').events, 'input', { target: field }); },
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

test('fantasy collections change composition, palette and artwork together without losing photos or details', async () => {
  const app = harness({initialDraft:{...core.defaults,nameLine1:'Jordan',portraitData:localPortrait}});
  for (const [id,design,background] of [['galaxy','orbit','#15192e'],['starlight','editorial','#18283e'],['moonlight','contour','#f1e7fa'],['frost','signal','#d7eef6']]) {
    await app.click('choose-collection-' + id);
    const saved = JSON.parse(app.storage.get(storageKey));
    assert.equal(saved.design,design); assert.equal(saved.pattern,id); assert.equal(saved.frontBackground,background);
    assert.equal(saved.nameLine1,'Jordan'); assert.equal(saved.portraitData,localPortrait);
    assert.match(app.node('signature-preview').innerHTML, new RegExp('pattern-' + id + '\\.png'));
  }
  await app.click('undo-change'); assert.equal(app.node('pattern').value,'moonlight');
  await app.click('redo-change'); assert.equal(app.node('pattern').value,'frost');
  await app.click('export-data'); const saved = app.node('session-json').value;
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(saved); await app.click('session-restore');
  assert.equal(app.node('pattern').value,'frost'); assert.equal(app.node('portraitData').value,localPortrait);
});

test('all six abstract collections are usable in their gallery and preserve identity and uploaded photos', async () => {
  const app = harness({initialDraft:{...core.defaults,nameLine1:'Jordan',portraitData:localPortrait}});
  const expected = [
    ['cutpaper','orbit','#f5f0e6'], ['colorfield','prism','#efe9e1'], ['chromatic','studio','#f0e7ce'],
    ['counterform','orbit','#eee5ce'], ['overprint','prism','#f4e8dd'], ['gesture','orbit','#f3efe8']
  ];
  assert.deepEqual(app.node('abstract-collection-gallery').children.map(button=>button.id),expected.map(([id])=>'choose-collection-'+id));
  for (const [id,design,background] of expected) {
    await app.click('choose-collection-' + id);
    const saved = JSON.parse(app.storage.get(storageKey));
    assert.equal(saved.design,design); assert.equal(saved.pattern,id); assert.equal(saved.frontBackground,background);
    assert.equal(saved.nameLine1,'Jordan'); assert.equal(saved.portraitData,localPortrait);
    assert.equal(app.node('choose-collection-'+id).getAttribute('aria-pressed'),'true');
    assert.match(app.node('signature-preview').innerHTML,new RegExp('pattern-'+id+'\\.png'));
  }
  await app.click('undo-change'); assert.equal(app.node('pattern').value,'overprint');
  await app.click('redo-change'); assert.equal(app.node('pattern').value,'gesture');
  await app.click('export-data'); const saved = app.node('session-json').value;
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(saved); await app.click('session-restore');
  assert.equal(app.node('pattern').value,'gesture'); assert.equal(app.node('portraitData').value,localPortrait);
});

test('six independent abstract pattern controls preserve the chosen layout, palette, identity and photo', async () => {
  const initial = {...core.defaults,design:'signal',layout:'stacked',nameLine1:'Jordan',portraitData:localPortrait,
    frontBackground:'#f7eee4',backBackground:'#132d35',accent:'#a45341'};
  const app = harness({initialDraft:initial});
  const expected = ['cutpaper','colorfield','chromatic','counterform','overprint','gesture'];
  assert.deepEqual(app.node('abstract-pattern-choices').children.map(button=>button.id),expected.map(id=>'choose-pattern-'+id));
  for (const pattern of expected) {
    await app.click('choose-pattern-'+pattern);
    const saved = JSON.parse(app.storage.get(storageKey));
    assert.deepEqual(saved,{...initial,pattern});
    assert.equal(app.node('choose-pattern-'+pattern).getAttribute('aria-pressed'),'true');
    assert.match(app.node('signature-preview').innerHTML,new RegExp('pattern-'+pattern+'\\.png'));
  }
  await app.click('undo-change'); assert.equal(app.node('pattern').value,'overprint');
  await app.click('redo-change'); assert.equal(app.node('pattern').value,'gesture');
});

test('all seven design choices preserve identity and can be undone', async () => {
  const app = harness();
  await app.input('nameLine1', 'Jordan'); await app.input('website', 'https://example.org/work');
  for (const id of ['orbit','studio','contour','prism','editorial','signal','original']) {
    await app.click('choose-design-' + id);
    const saved = JSON.parse(app.storage.get(storageKey));
    assert.equal(saved.design, id); assert.equal(saved.nameLine1, 'Jordan'); assert.equal(saved.website, 'https://example.org/work');
  }
  await app.click('undo-change'); assert.equal(app.node('design').value, 'signal');
  await app.click('redo-change'); assert.equal(app.node('design').value, 'original');
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
