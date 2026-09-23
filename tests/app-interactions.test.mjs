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
const previewSource = readFileSync(resolve(projectRoot, 'preview-dom.js'), 'utf8');
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
// Fresh editor seeds are independent of the legacy renderer/migration defaults.
const plumColors = {frontBackground:'#ffffff',backBackground:'#faf8f4',accent:'#583da6'};
const freshDraft = {...core.defaults,...plumColors};

function harness({ storageFails = false, sharedStorage = null, initialHash = '', initialDraft = null, initialThemes = null, initialAppearance = null, expectPreview = true, clipboardSucceeds = false, viewportWidth=800, screenWidth=390 } = {}) {
  const nodes = new Map(), downloads = [], objectURLs = new Map(), revoked = [], timers = [], clipboardTexts = [], clipboardItems = [];
  const storage = sharedStorage || new Map();
  if (initialDraft) storage.set(storageKey, JSON.stringify(initialDraft));
  if (initialThemes) storage.set('signature-studio:themes:v1', JSON.stringify(initialThemes));
  if (initialAppearance !== null) storage.set('signature-studio:appearance:v1',initialAppearance);
  const globalEvents = new Map(), documentEvents = new Map();
  let selectedRanges = [], clipboardAttempts = 0, legacyAttempts = 0, nextWriteFailure = null, previewTransformWrites=0;
  const on = (events, type, listener, options) => {
    const registered=options?.once ? event=>{
      events.set(type,(events.get(type)||[]).filter(item=>item!==registered));
      return listener(event);
    } : listener;
    events.set(type,[...(events.get(type)||[]),registered]);
  };
  const eventFor=(type,details={})=>({type,defaultPrevented:false,cancelBubble:false,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.cancelBubble=true;},...details});
  const emit = async (events, type, event = {}) => {
    const dispatched=eventFor(type,event);
    await Promise.all([...(events.get(type)||[])].map(listener=>listener(dispatched)));
    return dispatched;
  };
  const dispatch = async (target,type,details={}) => {
    const event=eventFor(type,{target,...details}),pending=[];
    // Native listeners run synchronously through the complete bubbling path;
    // promises returned by handlers do not defer a parent/document listener.
    for(let current=target;current;current=current.parentElement) {
      event.currentTarget=current;
      for(const listener of [...(current.events.get(type)||[])]) pending.push(listener(event));
      if(event.cancelBubble) break;
    }
    if(!event.cancelBubble) for(const listener of [...(documentEvents.get(type)||[])]) pending.push(listener(event));
    await Promise.all(pending);
    return event;
  };

  class Element {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase(); this.id = id; this.name = '';
      this.dataset = {}; this.style = new Proxy({}, {set:(target,key,value)=>{if(this.id==='signature-preview'&&key==='transform')previewTransformWrites++;target[key]=value;return true;}}); this.attributes = new Map(); this.events = new Map();
      this.children = []; this.parentElement = null; this.value = ''; this.hidden = false;
      this.clientWidth = 800; this.clientHeight = 400; this.scrollHeight = 500; this._text = ''; this._html = '';
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
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'open') this.open = true; }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'open') this.open = false; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setCustomValidity(value) { this.validationMessage = value; }
    addEventListener(type, listener, options) { on(this.events, type, listener, options); }
    append(child) { child.remove(); child.parentElement = this; this.children.push(child); }
    prepend(child) { child.parentElement = this; this.children.unshift(child); }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      this.parentElement = null;
    }
    focus() { document.activeElement = this; }
    select() { document.activeElement = this; }
    showModal() { this._previousFocus=document.activeElement; this.open=true; this.focus(); }
    close() {
      if(!this.open) return Promise.resolve();
      this.open=false;this._previousFocus?.focus();
      return emit(this.events,'close',{target:this});
    }
    get options() { return this.children.filter(child => child.tagName === 'OPTION'); }
    closest(selector) {
      let node = this;
      while (node) {
        if (selector === '[data-editor-panel]' && node.dataset.editorPanel) return node;
        if (selector === 'details' && node.tagName === 'DETAILS') return node;
        if (selector === 'button' && node.tagName === 'BUTTON') return node;
        if (selector.startsWith('#') && node.id === selector.slice(1)) return node;
        node = node.parentElement;
      }
      return null;
    }
    querySelector(selector) {
      assert.equal(selector,'summary','Only explicit fixture selectors are supported');
      const find=element=>{for(const child of element.children){if(child.tagName==='SUMMARY')return child;const nested=find(child);if(nested)return nested;}return null;};
      return find(this);
    }
    querySelectorAll(selector) {
      if (selector === 'a' || selector === 'img') return []; // Link navigation and image loading are outside this harness.
      if (selector === '[data-close-dialog], .dialog-close, #close-help') return [nodes.get('close-help')];
      throw new Error('Unsupported element selector: ' + selector);
    }
    click() {
      if(this.disabled&&['BUTTON','INPUT','SELECT','TEXTAREA'].includes(this.tagName)) return Promise.resolve();
      if (this.tagName === 'A') downloads.push({ href: this.href, filename: this.download });
      return dispatch(this,'click');
    }
  }

  // Read actual form ancestry, native options and tab order from the page. A
  // moved field must not remain in a fictional old panel/disclosure here.
  const pageRoot = new Element('body'), stack = [pageRoot], pageElements = [];
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const match of pageSource.matchAll(/<!--[\s\S]*?-->|<\/?([a-z][\w-]*)\b([^>]*?)>/gi)) {
    if (!match[1]) continue;
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex(element => element.tagName === tag.toUpperCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const attributes = new Map([...match[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(attribute => [attribute[1],attribute[2] ?? attribute[3] ?? attribute[4] ?? '']));
    const element = new Element(tag, attributes.get('id') || '');
    for (const [key,value] of attributes) {
      element.setAttribute(key,value);
      if (key.startsWith('data-')) element.dataset[key.slice(5).replace(/-([a-z])/g,(_all,letter)=>letter.toUpperCase())] = value;
      if (['name','value','type'].includes(key)) element[key] = value;
      if (['hidden','disabled','checked','open'].includes(key)) element[key] = true;
    }
    stack.at(-1).append(element); pageElements.push(element);
    if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(element);
  }
  const node = id => { assert.ok(nodes.has(id), `Required app element #${id} exists`); return nodes.get(id); };
  node('preview-viewport').clientWidth=viewportWidth;
  const tabs = pageElements.filter(element => element.dataset.editorTab);
  const panels = pageElements.filter(element => element.dataset.editorPanel);
  const inputs = Object.fromEntries(Object.keys(core.defaults).map(key => [key, node(key)]));
  for (const [key, input] of Object.entries(inputs)) {
    input.name = key;
  }
  for (const key of ['frontBackground', 'backBackground', 'accent']) node(key + '-hex').dataset.colorField = key;
  node('image-scale').value = '4'; node('image-background').value = 'transparent';
  node('editor-form').elements = { namedItem: key => inputs[key] || pageElements.find(element=>element.name===key) || null };
  const footer = new Element(), workspace = new Element(), column = new Element();
  workspace.dataset.emailDevice='desktop';
  const views = ['card', 'email'].map(view => { const element = new Element('button'); element.dataset.view = view; return element; });
  const emailDevices=[...pageSource.matchAll(/<button\b[^>]*\bdata-email-device="([^"]+)"[^>]*>/g)].map(([tag,device])=>{
    const id=tag.match(/\bid="([^"]+)"/)?.[1],element=id?node(id):new Element('button');element.dataset.emailDevice=device;return element;
  });
  const artworkEditButtons=[...pageSource.matchAll(/<button\b[^>]*\bdata-edit-artwork\b[^>]*>/g)].map(()=>new Element('button'));
  assert.ok(artworkEditButtons.length>0,'the real page has a manual artwork entry point');
  const one = new Map([['.rail-footer > span', footer], ['[data-preview-view]', workspace], ['.preview-column', column]]);
  // The workspace carries the same data attribute for CSS. It is deliberately
  // included in the generic selector so confusing it with buttons fails here.
  const cycleButtons = pageElements.filter(element => element.dataset.cycleField);
  const arrangementButtons = pageElements.filter(element => element.dataset.arrangement);
  const skinButtons = pageElements.filter(element => element.tagName==='BUTTON'&&element.dataset.editorSkin);
  const many = new Map([['[data-editor-tab]', tabs], ['[data-editor-panel]', panels], ['[data-view]', views],['[data-edit-artwork]',artworkEditButtons],['[data-email-device]',[workspace,...emailDevices]],['button[data-email-device]',emailDevices],['[data-cycle-field]',cycleButtons],['button[data-cycle-field]',cycleButtons],['[data-arrangement]',arrangementButtons],['button[data-arrangement]',arrangementButtons],['button[data-editor-skin]',skinButtons]]);
  const location = new URL('http://127.0.0.1:4173/?source=regression' + initialHash);
  const document = {
    activeElement: null, body: new Element('body'),documentElement:pageElements.find(element=>element.tagName==='HTML'),
    getElementById: id => nodes.get(id) || null,
    createElement: tag => new Element(tag),
    querySelector(selector) {
      if(selector==='dialog[open]') return pageElements.find(element=>element.tagName==='DIALOG'&&element.open)||null;
      assert.ok(one.has(selector), 'Unsupported document selector: ' + selector); return one.get(selector);
    },
    querySelectorAll(selector) { assert.ok(many.has(selector), 'Unsupported document selector: ' + selector); return many.get(selector); },
    addEventListener: (type, listener, options) => on(documentEvents, type, listener, options),
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
  const portraitReveals = [];
  const context = {
    window: { SignatureCore: core, ClipboardItem, SignatureImage: { attach(settings) { imageSettings = settings; } },
      PortraitControls: {attach() {return {sync() {},revealLink() {portraitReveals.push(node('photo-tab').getAttribute('aria-selected'));}};}},
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
    URL: HarnessURL, Blob, ClipboardItem, TextEncoder, TextDecoder, Uint8Array, atob, btoa, queueMicrotask,
    innerWidth: screenWidth, innerHeight: 844, getComputedStyle: () => ({ paddingLeft: '16', paddingRight: '16' }),
    ResizeObserver: class { observe() {} }, getSelection: () => selection,
    addEventListener: (type, listener) => on(globalEvents, type, listener),
    setTimeout(callback) { timers.push(callback); return timers.length; },
  };
  vm.runInNewContext(historySource, context, { filename: 'editor-history.js' });
  vm.runInNewContext(previewSource, context, { filename: 'preview-dom.js' });
  vm.runInNewContext(sessionSource, context, { filename: 'session-data.js' });
  vm.runInNewContext(sessionControlsSource, context, { filename: 'session-controls.js' });
  vm.runInNewContext(collectionsSource, context, { filename: 'design-collections.js' });
  vm.runInNewContext(appSource, context, { filename: 'app.js' });
  if (expectPreview) assert.ok(node('signature-preview').innerHTML.includes('<table'), 'Startup must render successfully; swallowed runtime errors are not a pass.');
  return {
    node, footer, storage, location, downloads, objectURLs, revoked, clipboardTexts, clipboardItems,emailDevices,previewWorkspace:workspace,tabs,panels,arrangementButtons,portraitReveals,
    get activeElement() { return document.activeElement; },
    focusBody() { document.body.focus(); },
    get editorSkin() { return document.documentElement.dataset.editorSkin; },
    hasNode: id => nodes.has(id),
    failNextWrite(key) { nextWriteFailure = key; },
    get imageSettings() { return imageSettings; },
    get artworkSettings() { return artworkSettings; },
    get artworkOpened() { return artworkOpened; },
    click: id => node(id).click(),
    async key(id,key,details={}) { return dispatch(node(id),'keydown',{key,...details}); },
    onDocument(type,listener) { on(documentEvents,type,listener); },
    menuAIButton(section) { return pageElements.find(element=>element.dataset.aiSection===section&&element.closest('#editor-options')); },
    async clickMenuButton(id) { const button=node(id);button.focus();return button.click(); },
    async arrange(value) { const button=arrangementButtons.find(item=>item.dataset.arrangement===value);assert.ok(button,'arrangement '+value+' exists');await button.click(); },
    async previewView(view) { const button=views.find(item=>item.dataset.view===view);assert.ok(button);await button.click(); },
    async emailDevice(device) { const button=emailDevices.find(item=>item.dataset.emailDevice===device);assert.ok(button,'email device '+device+' exists');await button.click(); },
    async bubbleWorkspaceClick(id) { await emit(workspace.events,'click',{target:node(id)}); },
    get previewTransformWrites() { return previewTransformWrites; },
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
  ['plum','#ffffff','#faf8f4','#583da6'],
  ['vermilion','#f3f0ea','#1c1c1c','#c8362a'], ['cobalt','#eef2ff','#182d59','#3659d9'],
  ['forest','#edf2ea','#1d392f','#a64435'], ['lilac','#eee6f7','#32263d','#8049a7'],
  ['rose','#f9e7e7','#462c39','#ad3e66'], ['saffron','#fff2d8','#353027','#a7620c'],
  ['midnight','#172333','#edf1f5','#d66942'],
  ['cutpaper','#f5f0e6','#f5f0e6','#2348c7'], ['colorfield','#efe9e1','#d8cbc3','#735568'],
  ['chromatic','#f0e7ce','#ece8df','#244dd7'], ['counterform','#eee5ce','#eee5ce','#575b29'],
  ['overprint','#f4e8dd','#ede4d6','#b74535'], ['gesture','#f3efe8','#f3efe8','#c94836'],
  ['galaxy','#15192e','#242041','#c396ef'], ['starlight','#18283e','#2a3f5c','#edcc83'],
  ['moonlight','#f1e7fa','#402e63','#b95689'], ['frost','#d7eef6','#102d47','#4489b3']
];

test('the browser has two library sections, secondary sizing and eighteen distinct color palettes', () => {
  const app=harness();
  assert.deepEqual([...pageSource.matchAll(/data-library-tab="([^"]+)"/g)].map(match=>match[1]),['layouts','artwork']);
  for(const id of ['library-tab-themes','library-panel-themes','collection-gallery','abstract-collection-gallery']) assert.equal(app.hasNode(id),false,id+' is removed');
  assert.doesNotMatch(appSource,/choose-collection-/);
  assert.match(pageSource,/<details\b[^>]*id="size-disclosure"[^>]*>\s*<summary>Size &amp; spacing<\/summary>/);
  assert.match(pageSource,/<details\b[^>]*id="more-palettes"[^>]*>/);
  assert.match(pageSource,/<details\b[^>]*id="saved-palettes"[^>]*>/);
  assert.deepEqual(app.node('palette-choices').children.map(button=>button.id),expectedPalettes.slice(0,6).map(([id])=>'choose-palette-'+id));
  assert.deepEqual(app.node('extra-palette-choices').children.map(button=>button.id),expectedPalettes.slice(6).map(([id])=>'choose-palette-'+id));
  const buttons=[...app.node('palette-choices').children,...app.node('extra-palette-choices').children];
  assert.equal(buttons.length,18,'six common palettes plus twelve additional palettes');
  const actualColors=buttons.map(button=>button.children[0].children.map(swatch=>swatch.style.backgroundColor.toLowerCase()).join('|'));
  assert.equal(new Set(actualColors).size,18,'every visible palette has a unique three-color combination');
  assert.deepEqual(actualColors,expectedPalettes.map(([,front,back,accent])=>[front,back,accent].join('|')));
  assert.equal(app.hasNode('choose-palette-spruce'),false,'the duplicate remains a legacy data identity, not another palette choice');
});

test('all eighteen palettes change only three colors and survive undo, reload and selective import', async () => {
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

test('fresh drafts use the reference Plum colors while renderer and migration defaults remain original',async()=>{
  assert.deepEqual(['frontBackground','backBackground','accent'].map(key=>core.defaults[key]),['#f3f0ea','#1c1c1c','#c8362a']);
  const app=harness();
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),freshDraft);
  assert.equal(app.node('choose-palette-plum').getAttribute('aria-pressed'),'true');
  assert.equal(app.node('signature-preview').innerHTML,core.render(freshDraft,{preview:true,assetBase:'./sig'}));
  await app.click('export-data');const backup=app.node('session-json').value;
  assert.deepEqual(JSON.parse(backup).draft,freshDraft,'a new session records its explicit palette');
  const reloaded=harness({initialDraft:JSON.parse(backup).draft});
  assert.deepEqual(JSON.parse(reloaded.storage.get(storageKey)),freshDraft);
  const broken=harness({initialDraft:'unreadable stored draft'});
  assert.equal(broken.storage.get(storageKey),JSON.stringify('unreadable stored draft'),'failed reads never overwrite saved data with the new seed');
  assert.equal(broken.node('signature-preview').innerHTML,core.render(freshDraft,{preview:true,assetBase:'./sig'}));
});

test('new palette defaults never replace a saved personal draft or a user palette named Plum',async()=>{
  const initial={...core.defaults,nameLine1:'Jordan',title:'Designer',design:'signal',pattern:'counterform',width:400,height:300,
    frontBackground:'#f7eee4',backBackground:'#132d35',accent:'#a45341',portraitData:localPortrait,portraitSize:80,
    artworkPlacement:'flow',artworkScale:125,artworkPositionX:19,artworkPositionY:83};
  const themes={version:1,themes:[{id:'theme-my-plum',name:'Plum',frontBackground:'#f7eee4',backBackground:'#132d35',accent:'#a45341'}]};
  const app=harness({initialDraft:initial,initialThemes:themes});
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.deepEqual(JSON.parse(app.storage.get('signature-studio:themes:v1')),themes);
  await app.click('export-data');const saved=JSON.parse(app.node('session-json').value);await app.click('close-session');
  assert.deepEqual(saved.draft,initial);assert.deepEqual(saved.themes,themes.themes);
  await app.click('choose-palette-plum');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,...plumColors});
  assert.deepEqual(JSON.parse(app.storage.get('signature-studio:themes:v1')),themes,'selecting a built-in palette leaves the user palette library intact');
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('undo-change').disabled,true,'the palette application is one undo step');
});

test('legacy partial stored drafts, links and JSON keep omitted-color semantics instead of the new seed',async()=>{
  for(const overrides of [{},{frontBackground:'#eeddcc'},{accent:'#294675'}]) {
    const legacy={nameLine1:'Jordan',height:240,...overrides},expected={...core.defaults,...legacy};
    const stored=harness({initialDraft:legacy});
    assert.deepEqual(JSON.parse(stored.storage.get(storageKey)),expected,'stored partial fields inherit original values');
    const linked=harness({initialHash:draftHash(legacy)});
    assert.deepEqual(JSON.parse(linked.storage.get(storageKey)),expected,'old links inherit original values');
    const imported=harness();
    await imported.click('import-data');await imported.pasteSession(JSON.stringify(legacy));await imported.click('session-restore');
    assert.deepEqual(JSON.parse(imported.storage.get(storageKey)),expected,'legacy bare JSON inherits original values');
    const envelope={format:'signature-editor-session',version:1,exportedAt:'2026-09-09T12:00:00.000Z',draft:legacy,themes:[],ui:{}};
    await imported.click('reset-draft');await imported.click('import-data');await imported.pasteSession(JSON.stringify(envelope));await imported.click('session-restore');
    assert.deepEqual(JSON.parse(imported.storage.get(storageKey)),expected,'versioned sessions with missing fields retain original semantics');
  }
});

test('Reset uses the new reference palette and Undo restores the complete prior draft and photo',async()=>{
  const initial={...core.defaults,nameLine1:'Jordan',email:'jordan@example.com',design:'prism',pattern:'gesture',layout:'stacked',width:400,height:300,
    frontBackground:'#eeeeff',backBackground:'#181d2b',accent:'#a23567',portraitData:localPortrait,portraitShape:'rounded',portraitSize:80,
    artworkPlacement:'flow',artworkScale:140,artworkPositionX:15,artworkPositionY:89};
  const themes={version:1,themes:[{id:'theme-saved',name:'Personal',frontBackground:'#eeeeff',backBackground:'#181d2b',accent:'#a23567'}]};
  const app=harness({initialDraft:initial,initialThemes:themes});
  await app.click('reset-draft');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),freshDraft);
  assert.equal(app.node('choose-palette-plum').getAttribute('aria-pressed'),'true');
  assert.deepEqual(JSON.parse(app.storage.get('signature-studio:themes:v1')),themes);
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('undo-change').disabled,true,'Reset is one undo action');
  assert.ok(app.node('signature-preview').innerHTML.includes(localPortrait));
  await app.click('redo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),freshDraft);
  await app.click('undo-change');await app.click('export-data');const backup=JSON.parse(app.node('session-json').value);
  assert.deepEqual(backup.draft,initial);assert.deepEqual(backup.themes,themes.themes);
});

test('desktop and mobile email previews change only the viewing frame, leaving saved and exported signatures identical',async()=>{
  const initial={...core.defaults,nameLine1:'Jordan',pattern:'gesture',design:'signal',artworkScale:125};
  const app=harness({initialDraft:initial,viewportWidth:1000,screenWidth:1280});
  assert.deepEqual(app.emailDevices.map(button=>button.dataset.emailDevice),['desktop','mobile']);
  assert.equal(app.previewWorkspace.events.get('click')?.length||0,0,'CSS device state on the workspace does not make the whole page a device button');
  assert.equal(app.previewWorkspace.getAttribute('aria-pressed'),null,'only actual device buttons have pressed state');
  assert.equal(app.node('email-device-controls').hidden,true,'device controls belong to Email view');
  const stored=app.storage.get(storageKey),signature=app.node('signature-preview').innerHTML;
  await app.previewView('email');assert.equal(app.node('email-device-controls').hidden,false);
  assert.equal(parseFloat(app.node('preview-sizer').style.width),740,'desktop email uses 780px minus 40px padding');
  await app.click('export-data');const desktopSession=JSON.parse(app.node('session-json').value);await app.click('close-session');
  await app.click('download-html');const desktopHTML=await app.objectURLs.get(app.downloads.at(-1).href).text();
  await app.click('share-link');const desktopLink=app.clipboardTexts.at(-1);
  await app.emailDevice('mobile');
  assert.equal(parseFloat(app.node('preview-sizer').style.width),366,'mobile email uses 390px minus 24px padding');
  assert.equal(app.node('signature-preview').style.width,'662px','device choice does not change exported card dimensions');
  assert.equal(app.node('signature-preview').innerHTML,signature,'links and signature markup are unchanged');
  assert.match(app.node('preview-size-note').textContent,/Choose Vertical in Layout/);
  assert.equal(app.storage.get(storageKey),stored);assert.deepEqual(JSON.parse(JSON.stringify(app.imageSettings.getDraft())),initial);
  assert.equal(app.node('undo-change').disabled,true,'view controls do not enter design history');
  for(const button of app.emailDevices) assert.equal(button.getAttribute('aria-pressed'),String(button.dataset.emailDevice==='mobile'));
  assert.equal(app.previewWorkspace.getAttribute('aria-pressed'),null,'changing device never adds button semantics to the workspace');
  const fitsBeforeContentClick=app.previewTransformWrites;
  await app.bubbleWorkspaceClick('signature-preview');
  assert.equal(app.previewTransformWrites,fitsBeforeContentClick,'a bubbled content click does not trigger another fit');
  assert.equal(app.node('preview-sizer').style.width,'366px');
  await app.click('export-data');const mobileSession=JSON.parse(app.node('session-json').value);await app.click('close-session');
  delete desktopSession.exportedAt;delete mobileSession.exportedAt;assert.deepEqual(mobileSession,desktopSession,'device preview does not enter session data');
  await app.click('download-html');assert.equal(await app.objectURLs.get(app.downloads.at(-1).href).text(),desktopHTML);
  await app.click('share-link');assert.equal(app.clipboardTexts.at(-1),desktopLink,'shared drafts do not inherit the simulated device');
  await app.previewView('card');assert.equal(app.node('email-device-controls').hidden,true);
  await app.previewView('email');assert.equal(parseFloat(app.node('preview-sizer').style.width),366,'device choice persists within this page');
  await app.emailDevice('desktop');assert.equal(parseFloat(app.node('preview-sizer').style.width),740);
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

test('four shared editor tabs keep sizing in Layout and icons in Details without editing the draft', async () => {
  const app=harness();
  assert.deepEqual(app.tabs.map(tab=>tab.dataset.editorTab),['layout','details','photo','design']);
  assert.deepEqual(app.panels.map(panel=>panel.dataset.editorPanel).sort(),['design','details','layout','photo']);
  for(const id of ['colors-tab','icons-tab','icons-panel','size-explanation','copy-preview']) assert.equal(app.hasNode(id),false,id+' is removed');
  assert.equal([...pageSource.matchAll(/id="copy-signature"/g)].length,1);
  assert.equal(app.node('copy-signature').closest('[data-editor-panel]'),null,'the copy action remains outside editor tabs');
  assert.equal(app.node('size-disclosure').closest('[data-editor-panel]').dataset.editorPanel,'layout');
  assert.equal(app.node('icons-disclosure').closest('[data-editor-panel]').dataset.editorPanel,'details');
  assert.equal(Boolean(app.node('size-disclosure').open),false);
  assert.equal(Boolean(app.node('icons-disclosure').open),false);
  for(const key of ['width','height','layout','imageBase']) assert.equal(app.node(key).closest('[data-editor-panel]').dataset.editorPanel,'layout',key);
  for(const key of ['websiteIcon','emailIcon','phoneIcon','linkedinIcon','locationIcon']) assert.equal(app.node(key).closest('[data-editor-panel]').dataset.editorPanel,'details',key);
  assert.deepEqual([...new Set([...pageSource.matchAll(/data-ai-section="([^"]+)"/g)].map(match=>match[1]))].sort(),['artwork','colors','design','details','icons','layout','photo'],'all existing AI section entry points remain');
  const saved=app.storage.get(storageKey);
  for(const [from,key,to] of [['layout','ArrowLeft','design'],['design','ArrowRight','layout'],['layout','End','design'],['design','Home','layout'],['layout','ArrowRight','details']]) {
    await app.key(from+'-tab',key);
    assert.equal(app.activeElement,app.node(to+'-tab'));
    for(const tab of app.tabs) {
      assert.equal(tab.getAttribute('aria-selected'),String(tab.dataset.editorTab===to));
      assert.equal(tab.tabIndex,tab.dataset.editorTab===to?0:-1);
    }
    for(const panel of app.panels) assert.equal(panel.hidden,panel.dataset.editorPanel!==to);
    assert.equal(app.previewWorkspace.dataset.editorView,to,'the preview uses the selected inspector width');
  }
  assert.equal(app.storage.get(storageKey),saved,'section navigation does not edit the signature');
  assert.equal(app.node('undo-change').disabled,true);
});

test('the original branded header keeps exports while the editor rail owns tabs and history', async () => {
  const app=harness(), saved=app.storage.get(storageKey);
  const ancestors=element=>{const list=[];for(let parent=element.parentElement;parent;parent=parent.parentElement)list.push(parent);return list;};
  assert.match(pageSource,/<span class="brand-mark"[^>]*>/);
  assert.match(pageSource,/<span>Signature<span class="brand-descriptor">STUDIO<\/span><\/span>/);
  assert.match(pageSource,/<div class="rail-heading">\s*<div><h1 id="editor-heading">Edit signature<\/h1>/);
  for(const id of ['copy-signature','export-image','download-html','share-link','export-data','import-data']) {
    assert.ok(ancestors(app.node(id)).some(parent=>parent.tagName==='HEADER'),id+' is available in the shared header');
    assert.equal(app.node(id).closest('[data-editor-panel]'),null);
  }
  assert.equal(app.node('export-image').parentElement,app.node('export-options'));
  assert.equal(app.node('export-options').children[0],app.node('export-image'));
  const rail=app.node('signature-settings');
  for(const id of ['undo-change','redo-change']) {
    assert.equal(app.node(id).parentElement.parentElement,rail,id+' stays with the editor card');
    assert.equal(app.node(id).closest('[data-editor-panel]'),null,id+' is available across all editor tabs');
    assert.ok(!ancestors(app.node(id)).some(parent=>parent.tagName==='HEADER'));
  }
  for(const tab of app.tabs) {
    assert.equal(tab.parentElement.tagName,'NAV');
    assert.equal(tab.parentElement.parentElement,rail);
  }
  assert.ok(rail.children.indexOf(app.tabs[0].parentElement)<rail.children.indexOf(app.node('undo-change').parentElement));
  assert.ok(rail.children.indexOf(app.node('undo-change').parentElement)<rail.children.indexOf(app.node('editor-form')));
  await app.click('photo-tab');await app.click('design-tab');
  const colors=app.node('colors-panel'),artwork=app.node('artwork-panel');
  assert.equal(colors.parentElement,artwork.parentElement,'Colors and Artwork share one Design grid');
  assert.match(colors.parentElement.getAttribute('class'),/\bdesign-columns\b/);
  for(const column of [colors,artwork]) {
    assert.equal(column.tagName,'SECTION');assert.notEqual(column.getAttribute('role'),'tabpanel');
    assert.equal(column.closest('[data-editor-panel]'),app.node('design-panel'));
    for(const ancestor of [column,...ancestors(column)]) assert.equal(Boolean(ancestor.hidden),false);
  }
  assert.equal(app.hasNode('color-values'),false,'inline color values do not require a separate disclosure');
  assert.equal(Boolean(app.node('saved-palettes').open),false);
  await app.click('save-palette-shortcut');
  assert.equal(app.node('saved-palettes').open,true);
  assert.equal(app.activeElement,app.node('theme-name'));
  assert.equal(app.storage.get(storageKey),saved,'opening Design and its palette form does not alter the draft');
});

test('menu Escape closes only its active level and restores a visible summary', async () => {
  const app=harness();let outerEscapes=0;
  app.onDocument('keydown',event=>{if(event.key==='Escape')outerEscapes++;});
  app.node('editor-options').open=true;app.node('appearance-menu').open=true;
  app.node('skin-plum').focus();
  const nested=await app.key('skin-plum','Escape');
  assert.equal(nested.defaultPrevented,true);assert.equal(nested.cancelBubble,true);
  assert.equal(app.node('appearance-menu').open,false);
  assert.equal(app.node('editor-options').open,true,'dismissing Appearance must not dismiss its parent menu');
  assert.equal(app.activeElement.id,'appearance-toggle');assert.equal(outerEscapes,0);
  await app.key('appearance-toggle','Escape');
  assert.equal(app.node('editor-options').open,false,'a second Escape dismisses the outer menu after Appearance is closed');
  assert.ok(app.activeElement===app.node('editor-options').querySelector('summary'));
  for(const [menuId,buttonId] of [['editor-options','install-help'],['export-menu','download-html']]) {
    const menu=app.node(menuId);menu.open=true;app.node(buttonId).focus();
    const event=await app.key(buttonId,'Escape');
    assert.equal(event.defaultPrevented,true);assert.equal(event.cancelBubble,true);
    assert.equal(menu.open,false);assert.ok(app.activeElement===menu.querySelector('summary'));
  }
  assert.equal(outerEscapes,0,'handled Escape must not trigger outer shortcuts');
});

test('menu Escape respects an already-handled key without dismissing its content', async () => {
  const app=harness(),menu=app.node('export-menu'),button=app.node('download-html');
  menu.open=true;button.focus();
  button.addEventListener('keydown',event=>{if(event.key==='Escape')event.preventDefault();});
  const event=await app.key('download-html','Escape');
  assert.equal(event.defaultPrevented,true);assert.equal(event.cancelBubble,false);
  assert.equal(menu.open,true);assert.equal(app.activeElement.id,'download-html');
});

test('menu actions restore trigger focus but preserve validation and nested preference focus', async () => {
  const app=harness(),menu=app.node('export-menu'),button=app.node('download-html');
  menu.open=true;button.focus();
  await button.children[0].click();
  assert.equal(menu.open,false);assert.ok(app.activeElement===menu.querySelector('summary'));
  assert.equal(app.downloads.at(-1).filename,'my-signature.html','clicking an action icon still invokes its button');
  button.addEventListener('click',()=>app.focusBody(),{once:true});
  menu.open=true;await app.clickMenuButton('download-html');
  assert.ok(app.activeElement===menu.querySelector('summary'),'restore the trigger when the browser clears focus as details closes');

  await app.input('width',999);menu.open=true;await app.clickMenuButton('download-html');
  assert.equal(menu.open,false);assert.equal(app.activeElement.id,'width','menu dismissal must preserve validation focus');
  const settings=app.node('editor-options');settings.open=true;app.node('appearance-menu').open=true;
  await app.clickMenuButton('skin-plum');
  assert.equal(settings.open,true,'nested preference buttons do not dismiss the parent menu');
  assert.equal(app.activeElement.id,'appearance-toggle');
});

test('menu-launched dialogs retain modal focus and restore the visible trigger once on close', async () => {
  for(const [menuId,buttonId,dialogId,closeId] of [['export-menu','export-data','session-dialog','close-session'],['editor-options','install-help','help-dialog','close-help']]) {
    const app=harness(),menu=app.node(menuId),dialog=app.node(dialogId);
    menu.open=true;await app.clickMenuButton(buttonId);
    assert.equal(menu.open,false);assert.equal(dialog.open,true);
    assert.equal(app.activeElement.id,dialogId,'dismissing the menu must not move focus outside the modal');
    await app.click(closeId);
    assert.equal(dialog.open,false);assert.ok(app.activeElement===menu.querySelector('summary'));
    app.node('nameLine1').focus();dialog.showModal();await dialog.close();
    assert.equal(app.activeElement.id,'nameLine1','a later non-menu dialog open must not reuse an old close listener');
  }
});

test('menu focus restoration waits for delegated document launchers before finding a dialog', async () => {
  const app=harness(),menu=app.node('editor-options'),button=app.menuAIButton('design'),dialog=app.node('help-dialog');
  assert.ok(button,'the real page includes an AI action inside the menu');
  let launchedAfterDismissal=false;
  app.onDocument('click',event=>{
    if(event.target!==button)return;
    launchedAfterDismissal=!menu.open;dialog.showModal();
  });
  menu.open=true;button.focus();await button.click();
  assert.equal(launchedAfterDismissal,true,'the delegated launcher follows the ancestor menu listener');
  assert.equal(dialog.open,true);assert.equal(app.activeElement.id,'help-dialog');
  await dialog.close();assert.ok(app.activeElement===menu.querySelector('summary'));
});

test('featured artwork and the full library stay synchronized without replacing photos or other design settings', async () => {
  const featured=['none','auto','orbit','studio','contour','cutpaper'];
  const initial={...core.defaults,nameLine1:'Jordan',design:'signal',portraitData:localPortrait,portraitShape:'rounded',portraitSize:80,
    layout:'stacked',width:400,height:300,artworkPlacement:'motif',motifScale:73,motifPositionX:20,motifPositionY:60,accent:'#543b91'};
  const app=harness({initialDraft:initial});
  assert.deepEqual(app.node('compact-pattern-choices').children.map(button=>button.id),featured.map(id=>'quick-pattern-'+id));
  const checkSelected=pattern=>{
    for(const id of featured) assert.equal(app.node('quick-pattern-'+id).getAttribute('aria-pressed'),String(id===pattern),id+' featured selection');
    for(const id of Object.keys(core.patterns)) assert.equal(app.node('choose-pattern-'+id).getAttribute('aria-pressed'),String(id===pattern),id+' library selection');
  };
  checkSelected('auto');
  for(const pattern of featured) {
    await app.click('quick-pattern-'+pattern);
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern});
    assert.ok(app.node('signature-preview').innerHTML.includes(localPortrait),'the selected photo remains in the preview');
    checkSelected(pattern);
  }
  await app.click('choose-pattern-prism');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern:'prism'});checkSelected('prism');
  await app.click('undo-change');checkSelected('cutpaper');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern:'cutpaper'});
  await app.click('redo-change');checkSelected('prism');
  await app.click('choose-pattern-contour');checkSelected('contour');
});

test('layout arrows wrap, preserve the complete draft and create one undo entry per click', async () => {
  const initial={...core.defaults,nameLine1:'Jordan',pattern:'overprint',portraitData:localPortrait,layout:'stacked',width:400,height:300,
    frontBackground:'#edf1f7',backBackground:'#181c29',accent:'#a63542',artworkPlacement:'flow',artworkScale:130,artworkPositionX:40,artworkPositionY:63};
  const app=harness({initialDraft:initial});
  const next=app.node('next-design');next.focus();await app.click('next-design');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,design:'orbit'});
  assert.equal(app.activeElement,next,'the update handler does not displace an already focused cycle button');
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('undo-change').disabled,true,'one click requires exactly one undo');
  await app.click('redo-change');assert.equal(app.node('design').value,'orbit');
  await app.click('previous-design');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  await app.click('previous-design');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,design:'signal'});
  await app.click('next-design');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial,'last built-in wraps to first while Custom is disabled');
  assert.equal(app.node('custom-design-option').disabled,true);
  const native=harness({initialDraft:initial});await native.input('design','prism');await native.finishEdit();
  assert.deepEqual(JSON.parse(native.storage.get(storageKey)),{...initial,design:'prism'});
  await native.click('undo-change');assert.deepEqual(JSON.parse(native.storage.get(storageKey)),initial);
  assert.equal(native.node('undo-change').disabled,true,'the native select path also applies once');
});

test('artwork arrows follow all enabled choices, skip unavailable Custom and preserve flow framing through undo', async () => {
  const initial={...core.defaults,nameLine1:'Jordan',design:'signal',portraitData:localPortrait,artworkPlacement:'motif',artworkScale:129,artworkPositionX:14,artworkPositionY:87};
  const expected=['cutpaper','colorfield','chromatic','counterform','overprint','gesture','neural','latent','tokenweave','resonance','dots','orbit','studio','contour','prism','editorial','signal','galaxy','starlight','moonlight','frost','none','auto'];
  const app=harness({initialDraft:initial});
  for(const pattern of expected) {
    await app.click('next-pattern');
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern},pattern+' changes only artwork');
  }
  assert.equal(app.node('custom-pattern-option').disabled,true);assert.equal(app.artworkOpened,0,'browsing does not open the empty custom editor');
  await app.click('previous-pattern');assert.equal(app.node('pattern').value,'none','first wraps backwards');
  await app.click('previous-pattern');assert.equal(app.node('pattern').value,'frost','unavailable Custom is skipped backwards');
  const flowInitial={...initial,pattern:'gesture',artworkPlacement:'flow'}, flow=harness({initialDraft:flowInitial});
  await flow.click('next-pattern');
  assert.deepEqual(JSON.parse(flow.storage.get(storageKey)),{...flowInitial,pattern:'neural',artworkPlacement:'auto'});
  await flow.click('undo-change');assert.deepEqual(JSON.parse(flow.storage.get(storageKey)),flowInitial);
  assert.equal(flow.node('undo-change').disabled,true,'the placement fallback is part of the same undo action');
});

test('existing custom layout and artwork remain in the arrow sequence and keep exact recipes', async () => {
  const initial={...core.defaults,design:'custom',customLayout:JSON.stringify({composition:'editorial',font:'serif',align:'center'}),
    pattern:'custom',customPattern:JSON.stringify({palette:['#2348c7','#dd6146'],rows:['00..','00..','....','..11','..11','....','....','....']}),artworkPlacement:'motif'};
  const app=harness({initialDraft:initial});
  assert.equal(app.node('custom-design-option').disabled,false);assert.equal(app.node('custom-pattern-option').disabled,false);
  await app.click('next-design');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,design:'original'});
  await app.click('previous-design');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  await app.click('next-pattern');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern:'none'});
  await app.click('previous-pattern');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern:'none'});
  await app.click('redo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.artworkOpened,0);
});

test('Horizontal and Vertical change only orientation and synchronize selection through undo and redo',async()=>{
  const initial={...core.defaults,nameLine1:'Jordan',nameLine2:'River',title:'Designer',email:'jordan@example.com',design:'signal',pattern:'overprint',
    width:400,height:300,portraitData:localPortrait,portraitSize:80,portraitShape:'rounded',artworkPlacement:'flow',artworkScale:125,
    artworkPositionX:34,artworkPositionY:68,motifScale:77,motifPositionX:20,motifPositionY:40,frontBackground:'#f0edfa',backBackground:'#231c32',accent:'#ab4971'};
  const app=harness({initialDraft:initial});
  assert.equal(app.node('layout').hidden,true,'the select is retained for state rather than a duplicate visible control');
  const selected=value=>{for(const button of app.arrangementButtons) assert.equal(button.getAttribute('aria-pressed'),String(button.dataset.arrangement===value));};
  selected('paired');await app.arrange('stacked');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,layout:'stacked'});selected('stacked');
  assert.equal(app.node('layout').value,'stacked');assert.equal(app.node('dimension-label').textContent,'400 × 620 px');
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);selected('paired');
  assert.equal(app.node('undo-change').disabled,true);
  await app.arrange('paired');assert.equal(app.node('undo-change').disabled,true,'reselecting the active arrangement is not an edit');
  await app.click('redo-change');selected('stacked');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,layout:'stacked'});
  await app.arrange('paired');selected('paired');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
});

test('Layout exposes primary orientation and template cards while secondary settings stay collapsed',async()=>{
  const app=harness();await app.click('layout-tab');
  assert.equal(app.node('editor-heading').textContent,'Layout');
  assert.equal(app.node('editor-description').textContent,'Arrange your signature.');
  assert.equal(app.node('editor-description').hidden,false);
  assert.equal(Boolean(app.node('size-disclosure').open),false);
  assert.deepEqual(app.arrangementButtons.map(button=>button.getAttribute('aria-label')),['Horizontal','Vertical']);
  for(const id of ['orientation-horizontal','orientation-vertical','change-template']) {
    const button=app.node(id);
    assert.equal(button.closest('details'),null,id+' is available without opening secondary settings');
    assert.equal(button.closest('[data-editor-panel]')?.id,'layout-panel');
    for(let parent=button.parentElement;parent;parent=parent.parentElement)assert.equal(Boolean(parent.hidden),false);
  }
  assert.equal(app.node('change-template').dataset.openLibrary,'layouts');
  const templateSelect=app.node('design');
  assert.equal(templateSelect.closest('details')?.getAttribute('class'),'advanced-settings');
  assert.equal(templateSelect.closest('details')?.parentElement.parentElement.id,'size-disclosure','custom template controls remain accessible in secondary settings');
  for(const tab of ['design','details','photo']) {
    await app.click(tab+'-tab');
    assert.equal(app.node('editor-heading').textContent,tab==='details'?'Details':tab==='photo'?'Photo':'Edit signature');
    assert.equal(app.node('editor-description').hidden,tab==='design');
    if(tab==='details')assert.equal(app.node('editor-description').textContent,'Your name and contact information.');
    if(tab==='photo')assert.equal(app.node('editor-description').textContent,'Make your signature feel personal.');
  }
});

test('live layout thumbnails retain custom templates and current portrait details colors and artwork without interactive contents',async()=>{
  const initial={...core.defaults,nameLine1:'Jordan',title:'Designer',email:'jordan@example.com',width:400,height:300,
    design:'custom',customLayout:JSON.stringify({composition:'editorial',font:'serif',align:'center'}),portraitData:localPortrait,
    pattern:'overprint',artworkPlacement:'flow',accent:'#ab4971',frontBackground:'#f0edfa',backBackground:'#231c32'};
  const app=harness({initialDraft:initial});
  const check=firstName=>{
    for(const [prefix,artwork] of [['orientation-horizontal','wide'],['orientation-vertical','tall'],['current-template',app.node('layout').value==='stacked'?'tall':'wide']]) {
      const frame=app.node(prefix+'-frame'),preview=app.node(prefix+'-preview'),html=preview.innerHTML;
      assert.equal(frame.getAttribute('aria-hidden'),'true');assert.equal(frame.getAttribute('inert'),'');
      assert.ok(html.includes(firstName));assert.ok(html.includes('jordan@example.com'));assert.ok(html.includes(localPortrait));
      for(const color of ['#ab4971','#f0edfa','#231c32'])assert.ok(html.includes(color),prefix+' reflects current colors');
      assert.ok(html.includes('Georgia'),prefix+' preserves the custom serif recipe');
      assert.ok(html.includes('pattern-overprint-'+artwork+'.png'),prefix+' reflects candidate orientation');
      assert.doesNotMatch(html,/<(?:a|button|input|select|textarea)\b|\b(?:href|tabindex)=/i);
      assert.match(preview.style.transform,/^scale\([\d.]+\)$/);
      assert.ok(Number.isFinite(parseFloat(preview.style.left))&&Number.isFinite(parseFloat(preview.style.top)));
    }
    assert.equal(app.node('current-template-name').textContent,'Custom layout');
    const active=app.node('layout').value==='stacked'?'orientation-vertical-preview':'orientation-horizontal-preview';
    assert.equal(app.node('current-template-preview').innerHTML,app.node(active).innerHTML);
  };
  check('Jordan');await app.input('nameLine1','Taylor');check('Taylor');
  await app.arrange('stacked');check('Taylor');
  await app.click('choose-design-orbit');
  assert.equal(app.node('current-template-name').textContent,'Orbit');
  assert.equal(app.imageSettings.getDraft().portraitData,localPortrait);
  assert.equal(app.imageSettings.getDraft().customLayout,initial.customLayout,'the custom recipe remains available');
});

test('an orientation that cannot fit is disabled without clearing working previews and recovers after resizing',async()=>{
  const initial={...core.defaults,design:'orbit',width:280,height:180,nameLine1:'Alexanderthegreat'};
  const app=harness({initialDraft:initial}),saved=app.storage.get(storageKey);
  assert.equal(app.node('orientation-horizontal').disabled,false);
  assert.equal(app.node('orientation-vertical').disabled,true);
  assert.ok(app.node('orientation-horizontal-preview').innerHTML.includes('<table'));
  assert.equal(app.node('orientation-vertical-preview').innerHTML,'');
  assert.ok(app.node('current-template-preview').innerHTML.includes('<table'));
  assert.equal(app.node('orientation-note').hidden,false);assert.match(app.node('orientation-note').textContent,/Vertical.*more room/);
  await app.arrange('stacked');assert.equal(app.storage.get(storageKey),saved,'disabled orientation cannot replace a valid draft');
  await app.input('width-range',420);
  assert.equal(app.node('orientation-vertical').disabled,false);assert.equal(app.node('orientation-note').hidden,true);
  assert.ok(app.node('orientation-vertical-preview').innerHTML.includes('<table'));
  await app.arrange('stacked');assert.equal(app.node('layout').value,'stacked');
});

test('a template change can enable an orientation that repairs the current invalid draft',async()=>{
  const initial={...core.defaults,design:'editorial',layout:'stacked',width:280,height:180,nameLine1:'Avery',
    title:'Software engineer and software developer expert',email:'avery@example.com'};
  const app=harness({initialDraft:initial}),saved=app.storage.get(storageKey),lastPreview=app.node('signature-preview').innerHTML;
  assert.equal(app.node('orientation-horizontal').disabled,true);
  assert.equal(app.node('orientation-vertical').disabled,false);
  await app.click('choose-design-orbit');
  assert.equal(app.node('current-template-name').textContent,'Orbit');
  assert.equal(app.node('title').getAttribute('aria-invalid'),'true');
  assert.equal(app.storage.get(storageKey),saved,'the invalid template change is not persisted');
  assert.equal(app.node('signature-preview').innerHTML,lastPreview,'the canvas retains the last valid preview');
  assert.equal(app.node('orientation-horizontal').disabled,false,'availability must use Orbit instead of the last valid Editorial draft');
  assert.equal(app.node('orientation-vertical').disabled,true);
  assert.ok(app.node('orientation-horizontal-preview').innerHTML.includes('expert'));
  assert.equal(app.node('orientation-vertical-preview').innerHTML,'');
  assert.equal(app.node('current-template-preview').innerHTML,'','the selected invalid orientation must not show an obsolete template thumbnail');
  await app.arrange('paired');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,design:'orbit',layout:'paired'});
  assert.equal(app.node('title').getAttribute('aria-invalid'),'false');
  assert.equal(app.node('orientation-horizontal').getAttribute('aria-pressed'),'true');
  assert.ok(app.node('current-template-preview').innerHTML.includes('expert'));
});

test('direct invalid text edits refresh orientation availability and allow repair without losing the edit',async()=>{
  const initial={...core.defaults,design:'orbit',layout:'stacked',width:280,height:180};
  const app=harness({initialDraft:initial}),lastPreview=app.node('signature-preview').innerHTML;
  assert.equal(app.node('orientation-vertical').disabled,false);
  const title='Software engineer and software developer expert';
  await app.input('title',title);
  assert.equal(app.node('title').getAttribute('aria-invalid'),'true');
  assert.equal(app.node('orientation-vertical').disabled,true,'direct inputs must update candidate availability even when the current layout fails validation');
  assert.equal(app.node('orientation-vertical-preview').innerHTML,'');
  assert.equal(app.node('current-template-preview').innerHTML,'');
  assert.equal(app.node('orientation-horizontal').disabled,false);
  assert.ok(app.node('orientation-horizontal-preview').innerHTML.includes('expert'));
  assert.equal(app.node('signature-preview').innerHTML,lastPreview);
  await app.arrange('paired');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,title,layout:'paired'});
  await app.input('website','javascript:invalid');
  for(const orientation of ['horizontal','vertical']) {
    assert.equal(app.node('orientation-'+orientation).disabled,true);
    assert.equal(app.node('orientation-'+orientation+'-preview').innerHTML,'');
  }
  assert.match(app.node('orientation-note').textContent,/highlighted fields/);
  await app.input('website',initial.website);
  assert.equal(app.node('orientation-horizontal').disabled,false);
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,title,layout:'paired',websiteLabel:''});
});

test('Details keeps full name and primary contacts visible while footer and manual line controls are secondary',async()=>{
  const app=harness();await app.click('details-tab');
  assert.equal(app.node('editor-heading').textContent,'Details');
  assert.equal(app.node('editor-description').textContent,'Your name and contact information.');
  assert.equal(app.node('editor-description').hidden,false);
  const full=app.node('full-name');assert.equal(full.name,'fullName');assert.equal(full.closest('details'),null);
  const contacts=['website','email','phone','linkedin','location'];
  const section=app.node('website').parentElement.parentElement;
  assert.equal(section.tagName,'FIELDSET');
  for(const key of contacts) {
    const field=app.node(key);assert.equal(field.closest('details'),null);
    assert.equal(field.parentElement.parentElement,section,key+' occupies its own primary contact row');
  }
  assert.deepEqual(section.children.filter(child=>child.children.some(field=>contacts.includes(field.id))).map(child=>child.children.find(field=>contacts.includes(field.id)).id),contacts);
  assert.equal(Boolean(app.node('icons-disclosure').open),false);
  assert.match(pageSource,/<details\b[^>]*id="icons-disclosure"[^>]*>\s*<summary>Footer &amp; icons<\/summary>/);
  for(const key of ['websiteLabel','tags'])assert.equal(app.node(key).closest('details')?.id,'icons-disclosure');
  for(const key of ['nameLine1','nameLine2'])assert.equal(app.node(key).closest('details')?.id,'name-lines-disclosure');
  assert.equal(app.node('name-lines-disclosure').parentElement.closest('details')?.id,'icons-disclosure');
});

test('viewing or restyling a saved full name never rewrites its intentional line break',async()=>{
  const initial={...core.defaults,width:420,height:300,nameLine1:'Zoë María',nameLine2:'de la Cruz'};
  const app=harness({initialDraft:initial}),saved=app.storage.get(storageKey);
  assert.equal(app.node('full-name').value,'Zoë María de la Cruz');
  for(const tab of ['details','photo','layout','design','details'])await app.click(tab+'-tab');
  await app.input('full-name','Zoë María de la Cruz');
  assert.equal(app.storage.get(storageKey),saved);assert.equal(app.node('undo-change').disabled,true);
  await app.click('choose-palette-cobalt');
  for(const key of ['nameLine1','nameLine2'])assert.equal(app.imageSettings.getDraft()[key],initial[key]);
  const reloaded=harness({initialDraft:JSON.parse(app.storage.get(storageKey))});
  assert.equal(reloaded.node('full-name').value,'Zoë María de la Cruz');
  for(const key of ['nameLine1','nameLine2'])assert.equal(reloaded.imageSettings.getDraft()[key],initial[key]);
});

test('full-name edits preserve Unicode words and update both stored lines in one undo group',async()=>{
  const initial={...core.defaults,width:420,height:300,nameLine1:'Avery Morgan',nameLine2:'',portraitData:localPortrait};
  const app=harness({initialDraft:initial}),name='María José 李 O’Connor';
  for(const value of ['María','María José',name])await app.input('full-name',value);
  const edited=JSON.parse(app.storage.get(storageKey)),lines=[edited.nameLine1,edited.nameLine2].filter(Boolean);
  assert.equal(lines.join(' '),name);assert.deepEqual(lines.flatMap(line=>line.split(' ')),name.split(' '));
  assert.equal(Object.keys(core.validate(edited)).length,0);
  assert.deepEqual({...edited,nameLine1:initial.nameLine1,nameLine2:initial.nameLine2},initial,'editing the full name changes no other draft field');
  assert.equal(app.node('full-name').getAttribute('aria-invalid'),'false');
  assert.equal(app.node('nameLine1').value,edited.nameLine1);assert.equal(app.node('nameLine2').value,edited.nameLine2);
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('undo-change').disabled,true,'all keystrokes and both name lines undo together');
  assert.equal(app.node('full-name').value,'Avery Morgan');
  await app.click('redo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),edited);
  assert.equal(app.node('full-name').value,name);
});

test('an unfinished email does not prevent a fitting name split or silently replace the invalid email',async()=>{
  const initial={...core.defaults,design:'original',width:280,portraitData:localPortrait,portraitSize:40};
  const app=harness({initialDraft:initial}),saved=app.storage.get(storageKey),email='avery@';
  await app.input('email',email);
  await app.input('full-name','William Maximilian Wilhelm');
  const split={nameLine1:'William Maximilian',nameLine2:'Wilhelm'};
  assert.deepEqual(JSON.parse(JSON.stringify(app.imageSettings.getDraft())),{...initial,...split,email},'measurement must choose a fitting word boundary without altering any unrelated edit');
  assert.equal(app.node('email').value,email);assert.equal(app.node('email').getAttribute('aria-invalid'),'true');
  assert.equal(app.node('error-email').hidden,false);assert.ok(app.node('error-email').textContent.length>0);
  assert.equal(app.storage.get(storageKey),saved,'an unfinished email remains unsaved');
  await app.input('email',initial.email);
  const repaired=JSON.parse(app.storage.get(storageKey));
  assert.deepEqual(repaired,{...initial,...split});assert.equal(Object.keys(core.validate(repaired)).length,0);
  assert.equal(app.node('full-name').value,'William Maximilian Wilhelm');
  assert.equal(app.node('full-name').getAttribute('aria-invalid'),'false');
  assert.equal(app.node('email').getAttribute('aria-invalid'),'false');assert.equal(app.node('error-email').hidden,true);
  assert.ok(app.node('signature-preview').innerHTML.includes(localPortrait),'repair retains the selected photo');
});

test('an overlong single-word name stays intact and reports its error on the visible full-name field',async()=>{
  const app=harness(),saved=app.storage.get(storageKey),name='Alexanderthegreat'.repeat(4);
  await app.input('full-name',name);
  const draft=app.imageSettings.getDraft();
  assert.equal([draft.nameLine1,draft.nameLine2].filter(Boolean).join(' '),name);
  assert.equal(app.node('full-name').value,name,'validation must not truncate the entered word');
  assert.equal(app.storage.get(storageKey),saved);
  assert.equal(app.node('full-name').getAttribute('aria-invalid'),'true');
  assert.equal(app.node('error-full-name').hidden,false);assert.match(app.node('error-full-name').textContent,/36 characters|shorten/i);
  await app.click('layout-tab');await app.click('copy-signature');
  assert.equal(app.node('details-tab').getAttribute('aria-selected'),'true');assert.equal(app.activeElement.id,'full-name');
  assert.equal(app.node('full-name').closest('details'),null);
  assert.equal(app.attempts.modern,0);assert.equal(Boolean(app.node('name-lines-disclosure').open),false);
});

test('re-entering an unchanged full name repairs an invalid manual or saved line split',async()=>{
  const initial={...freshDraft,portraitData:localPortrait},invalid={...initial,nameLine1:''};
  for(const source of ['manual','saved']) {
    const app=harness({initialDraft:source==='saved'?invalid:initial,expectPreview:source!=='saved'});
    if(source==='manual'){await app.input('nameLine1','');await app.finishEdit();}
    assert.equal(app.node('full-name').value,'Morgan');
    assert.equal(app.node('full-name').getAttribute('aria-invalid'),'true');
    assert.equal(app.node('error-full-name').hidden,false);
    assert.match(app.node('error-full-name').textContent,/Re-enter your name.*Name line breaks/);
    const storedBefore=app.storage.get(storageKey);
    await app.click('photo-tab');await app.click('details-tab');
    assert.equal(app.storage.get(storageKey),storedBefore,'viewing the invalid name must not rewrite its lines');
    assert.equal(app.imageSettings.getDraft().nameLine1,'');
    await app.input('full-name','Morgan');
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,nameLine1:'Morgan',nameLine2:''},source+' split is repaired without changing other fields');
    assert.equal(app.node('nameLine1').value,'Morgan');assert.equal(app.node('nameLine2').value,'');
    assert.equal(app.node('full-name').getAttribute('aria-invalid'),'false');
    assert.equal(app.node('error-full-name').hidden,true);
    assert.ok(app.node('signature-preview').innerHTML.includes('Morgan'));
  }
});

test('hash imports session restores and manual line edits synchronize full name without resplitting',async()=>{
  const app=harness(),imported={...core.defaults,width:420,height:300,nameLine1:'María José',nameLine2:'O’Connor'};
  await app.navigateHash(draftHash(imported));assert.equal(app.node('full-name').value,'María José O’Connor');
  for(const key of ['nameLine1','nameLine2'])assert.equal(app.imageSettings.getDraft()[key],imported[key]);
  const restored={...imported,nameLine1:'Zoë',nameLine2:'李 de la Cruz'};
  await app.click('import-data');await app.pasteSession(JSON.stringify(restored));await app.click('session-restore');
  assert.equal(app.node('full-name').value,'Zoë 李 de la Cruz');
  for(const key of ['nameLine1','nameLine2'])assert.equal(app.imageSettings.getDraft()[key],restored[key]);
  app.node('icons-disclosure').open=true;app.node('name-lines-disclosure').open=true;
  await app.input('nameLine1','Zoë María');await app.finishEdit();await app.input('nameLine2','李');
  assert.equal(app.node('full-name').value,'Zoë María 李');
  assert.equal(app.imageSettings.getDraft().nameLine1,'Zoë María');assert.equal(app.imageSettings.getDraft().nameLine2,'李');
  await app.click('undo-change');assert.equal(app.node('full-name').value,'Zoë María 李 de la Cruz');
});

test('website edits replace only the exact example label and preserve all custom link text',async()=>{
  const website='https://rivera.example/work';
  for(const [initial,label] of [[{...freshDraft},''],[{...freshDraft,websiteLabel:'Portfolio'},'Portfolio'],
    [{...freshDraft,website:'https://different.example'},core.defaults.websiteLabel]]) {
    const app=harness({initialDraft:initial});await app.input('website',website);
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,website,websiteLabel:label});
    assert.equal(app.node('websiteLabel').value,label);
    const html=app.node('signature-preview').innerHTML;assert.ok(html.includes('href="'+website+'"'));
    if(!label){assert.ok(html.includes('rivera.example/work'));assert.doesNotMatch(html,/>example\.com<\/a>/);}
    else assert.ok(html.includes('>'+label+'</a>'));
    await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  }
});

test('Layout and legacy Colors or Icons sessions restore visible sections and re-export canonical tabs',async()=>{
  for(const [legacyTab,currentTab,disclosure] of [['layout','layout',null],['colors','design',null],['icons','details','icons-disclosure']]) {
    const initial={...core.defaults,nameLine1:'Jordan',design:'signal',pattern:'overprint'};
    const app=harness(), incoming=JSON.stringify({format:'signature-editor-session',version:1,exportedAt:'2026-09-09T12:00:00.000Z',draft:initial,themes:[],ui:{editorTab:legacyTab}});
    await app.click('import-data');await app.pasteSession(incoming);
    assert.equal(app.node('session-restore').disabled,false,legacyTab+' remains an accepted backup value');
    await app.click('session-restore');
    assert.equal(app.node(currentTab+'-tab').getAttribute('aria-selected'),'true');
    if(disclosure) assert.equal(app.node(disclosure).open,true);
    assert.equal(app.node(currentTab+'-panel').hidden,false);
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
    await app.click('export-data');assert.equal(JSON.parse(app.node('session-json').value).ui.editorTab,currentTab);
    await app.click('close-session');await app.click('design-tab');
    await app.click('import-data');await app.pasteSession(incoming);await app.importParts(true,false);await app.click('session-restore');
    assert.equal(app.node('design-tab').getAttribute('aria-selected'),'true','information-only import preserves the current editor section');
  }
});

test('copy validation reveals moved size fields and every nested disclosure before focusing the error',async()=>{
  for(const [key,invalid] of [['width','999'],['imageBase','javascript:invalid']]) {
    const app=harness();await app.input(key,invalid);await app.click('design-tab');
    const field=app.node(key),disclosures=[];
    for(let parent=field.parentElement;parent;parent=parent.parentElement) if(parent.tagName==='DETAILS'){disclosures.push(parent);parent.removeAttribute('open');}
    assert.ok(disclosures.length>=1,key+' is actually inside a disclosure in the real page');
    await app.click('copy-signature');
    assert.equal(app.node('layout-tab').getAttribute('aria-selected'),'true');
    assert.equal(app.activeElement,field,key+' receives focus');
    assert.equal(field.getAttribute('aria-invalid'),'true');
    for(let parent=field.parentElement;parent;parent=parent.parentElement) {
      assert.equal(Boolean(parent.hidden),false,key+' has no hidden ancestor');
      if(parent.tagName==='DETAILS') assert.equal(parent.open,true,key+' has no closed disclosure ancestor');
    }
    assert.equal(app.attempts.modern,0,'invalid fields prevent copying');
  }
});

test('invalid colors select Design and focus the visible inline hex input', async () => {
  for(const key of ['frontBackground','backBackground','accent']) {
    const app=harness(), field=app.node(key+'-hex');
    assert.equal(field.closest('details'),null,'hex values are directly visible');
    assert.equal(app.node(key).parentElement,field.parentElement,'native color and hex values remain inline together');
    assert.match(field.parentElement.getAttribute('class'),/\bcolor-control\b/);
    await app.input(key+'-hex','invalid');
    await app.click('photo-tab');await app.click('copy-signature');
    assert.equal(app.node('design-tab').getAttribute('aria-selected'),'true');
    assert.equal(app.activeElement,field);
    assert.equal(field.getAttribute('aria-invalid'),'true');
    for(let parent=field.parentElement;parent;parent=parent.parentElement) {
      assert.equal(Boolean(parent.hidden),false);
      if(parent.tagName==='DETAILS') assert.equal(parent.open,true);
    }
    assert.equal(app.attempts.modern,0);
  }
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
  assert.match(app.node('dimension-label').textContent,/860 × 208/);
  await app.input('height-range',320); await app.finishEdit();
  assert.equal(Number(app.node('height').value),320); assert.match(app.node('dimension-label').textContent,/860 × 320/);
  await app.input('width',280); await app.finishEdit(); assert.equal(Number(app.node('width-range').value),280);
  await app.click('undo-change'); assert.equal(Number(app.node('width-range').value),420);
  await app.click('redo-change'); assert.equal(Number(app.node('width-range').value),280);
  await app.input('layout','stacked'); assert.match(app.node('dimension-label').textContent,/280 × 660/);
  const before=app.node('signature-preview').innerHTML;
  await app.input('width',''); assert.equal(app.node('width').getAttribute('aria-invalid'),'true');
  assert.equal(app.node('signature-preview').innerHTML,before,'invalid empty numeric input never replaces the last valid preview');
  await app.input('width',400); await app.input('height',300);
  await app.click('export-data'); const text=app.node('session-json').value;
  await app.click('close-session'); await app.click('reset-draft');
  await app.click('import-data'); await app.pasteSession(text); await app.click('session-restore');
  assert.equal(Number(app.node('width-range').value),400); assert.equal(Number(app.node('height-range').value),300);
  assert.match(app.node('dimension-label').textContent,/400 × 620/);
});

test('Card gap joins Original panels in both orientations while preserving the photo and all other content',async()=>{
  for(const layout of ['paired','stacked']) {
    const initial={...core.defaults,width:400,height:300,layout,design:'original',cardGap:20,
      nameLine1:'Jordan',email:'jordan@example.com',portraitData:localPortrait,pattern:'contour',
      frontBackground:'#faf6ef',backBackground:'#263830',accent:'#d47745'};
    const app=harness({initialDraft:initial,viewportWidth:1200,screenWidth:1280});
    const sources=markup=>[...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
    const beforeSources=sources(app.node('signature-preview').innerHTML);
    assert.ok(beforeSources.includes(localPortrait));
    for(const [id,type] of [['cardGap','number'],['cardGap-range','range']]) {
      const field=app.node(id);
      assert.equal(field.type,type);assert.equal(field.getAttribute('min'),'0');assert.equal(field.getAttribute('max'),'60');
      assert.equal(field.closest('details')?.id,'size-disclosure');
      assert.equal(field.closest('[data-editor-panel]')?.id,'layout-panel');
    }
    await app.input('cardGap-range',0);await app.finishEdit();
    assert.equal(Number(app.node('cardGap').value),0);assert.equal(Number(app.node('cardGap-range').value),0);
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,cardGap:0});
    const [width,height]=layout==='paired'?[800,300]:[400,600];
    assert.equal(app.node('dimension-label').textContent,`${width} × ${height} px`);
    assert.equal(app.node('signature-preview').style.width,width+'px');
    assert.equal(app.node('preview-sizer').style.height,height+'px');
    assert.equal(Number(app.node('signature-preview').innerHTML.match(/<table\b[^>]*\bwidth="(\d+)"/)[1]),width);
    assert.deepEqual(sources(app.node('signature-preview').innerHTML),beforeSources,'Gap redraw retains every photo and artwork source');
    assert.equal(app.node('orientation-horizontal-preview').style.width,'800px');
    assert.equal(app.node('orientation-vertical-preview').style.width,'400px');
    assert.equal(app.node('current-template-preview').style.width,width+'px');
    const original=app.node('choose-design-original').children[0].children[0];
    assert.equal(original.style.width,'800px','The Original library thumbnail uses the same chosen gap');
  }
});

test('Card gap slider gestures and number edits synchronize through grouped undo redo and reset',async()=>{
  const initial={...core.defaults,portraitData:localPortrait},app=harness({initialDraft:initial});
  for(const value of [16,8,0])await app.input('cardGap-range',value);
  await app.finishEdit();
  assert.equal(Number(app.node('cardGap').value),0);
  await app.click('undo-change');
  assert.equal(Number(app.node('cardGap').value),20);assert.equal(Number(app.node('cardGap-range').value),20);
  assert.equal(app.node('undo-change').disabled,true,'One slider gesture creates one undo step');
  await app.click('redo-change');assert.equal(Number(app.node('cardGap-range').value),0);
  await app.input('cardGap',60);await app.finishEdit();
  assert.equal(Number(app.node('cardGap-range').value),60);
  assert.equal(app.node('dimension-label').textContent,'702 × 208 px');
  await app.click('undo-change');assert.equal(Number(app.node('cardGap').value),0);
  await app.click('redo-change');assert.equal(Number(app.node('cardGap').value),60);
  assert.equal(app.node('portraitData').value,localPortrait);
  await app.click('reset-draft');assert.equal(Number(app.node('cardGap').value),20);
  await app.click('undo-change');assert.equal(Number(app.node('cardGap').value),60);
  assert.equal(app.node('portraitData').value,localPortrait);
});

test('zero Card gap survives reload links HTML copy download and session restoration while old drafts retain 20 pixels',async()=>{
  const older={...core.defaults};delete older.cardGap;
  const legacy=harness({initialDraft:older});
  assert.equal(Number(legacy.node('cardGap').value),20);
  assert.equal(legacy.node('dimension-label').textContent,'662 × 208 px');
  const initial={...core.defaults,width:400,height:300,portraitUrl:'https://example.com/portrait.jpg'};
  const app=harness({initialDraft:initial,clipboardSucceeds:true});
  await app.input('cardGap',0);await app.finishEdit();
  const saved=JSON.parse(app.storage.get(storageKey)),reloaded=harness({initialDraft:saved});
  assert.equal(Number(reloaded.node('cardGap-range').value),0);
  assert.equal(reloaded.node('dimension-label').textContent,'800 × 300 px');
  assert.equal(reloaded.node('portraitUrl').value,initial.portraitUrl);
  await app.click('share-link');
  const shared=new URL(app.clipboardTexts.at(-1)),sharedDraft=JSON.parse(Buffer.from(shared.hash.slice(3),'base64url').toString('utf8'));
  assert.equal(sharedDraft.cardGap,0);assert.equal(sharedDraft.portraitUrl,initial.portraitUrl);
  const linked=harness({initialHash:shared.hash});assert.equal(Number(linked.node('cardGap').value),0);
  await app.click('copy-signature');
  const copied=await app.clipboardItems.at(-1).parts['text/html'].text();
  assert.equal(Number(copied.match(/<table\b[^>]*\bwidth="(\d+)"/)[1]),800);assert.ok(copied.includes(initial.portraitUrl));
  await app.click('download-html');
  const downloaded=await app.objectURLs.get(app.downloads.at(-1).href).text();
  assert.ok(downloaded.includes(copied),'Download and rich copy use identical zero-gap signature HTML');
  await app.click('export-data');const backup=app.node('session-json').value;assert.equal(JSON.parse(backup).draft.cardGap,0);
  await app.click('close-session');await app.click('reset-draft');
  await app.click('import-data');await app.pasteSession(backup);await app.click('session-restore');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),saved);
  assert.equal(Number(app.node('cardGap-range').value),0);
});

test('invalid Card gap keeps the last valid preview and reveals the Layout number field for repair',async()=>{
  for(const invalid of ['-1','61','1.5','']) {
    const app=harness({initialDraft:{...core.defaults,portraitData:localPortrait}});
    const preview=app.node('signature-preview').innerHTML,dimensions=app.node('dimension-label').textContent;
    await app.input('cardGap',invalid);await app.finishEdit();
    assert.equal(app.node('cardGap').getAttribute('aria-invalid'),'true',JSON.stringify(invalid)+' is rejected');
    assert.equal(app.node('signature-preview').innerHTML,preview,'Invalid gap never replaces the last valid preview');
    assert.equal(app.node('dimension-label').textContent,dimensions);
    assert.equal(app.node('cardGap').disabled,false,'The invalid number remains available to repair');
    await app.click('photo-tab');app.node('size-disclosure').removeAttribute('open');
    await app.click('copy-signature');
    assert.equal(app.node('layout-tab').getAttribute('aria-selected'),'true');
    assert.equal(app.node('size-disclosure').open,true);
    assert.equal(app.activeElement?.id,'cardGap');
    assert.equal(app.attempts.modern,0);
    await app.input('cardGap',0);
    assert.notEqual(app.node('cardGap').getAttribute('aria-invalid'),'true');
    assert.equal(app.node('dimension-label').textContent,'642 × 208 px');
    assert.equal(app.node('portraitData').value,localPortrait);
  }
});

test('already joined templates preserve the chosen Card gap and restore it when returning to Original',async()=>{
  const initial={...core.defaults,width:400,height:300,cardGap:0,portraitData:localPortrait,pattern:'contour'};
  const app=harness({initialDraft:initial});
  await app.click('choose-design-orbit');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,design:'orbit'});
  assert.equal(app.node('cardGap').disabled,true);assert.equal(app.node('cardGap-range').disabled,true);
  assert.match(app.node('cardGap-note').textContent,/already joins the cards/);
  assert.equal(app.node('dimension-label').textContent,'820 × 300 px');
  assert.equal(app.node('current-template-preview').style.width,'820px');
  assert.equal(app.node('choose-design-orbit').children[0].children[0].style.width,'820px');
  assert.equal(app.node('choose-design-original').children[0].children[0].style.width,'800px');
  await app.click('choose-design-original');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('cardGap').disabled,false);assert.equal(app.node('cardGap-range').disabled,false);
  assert.equal(Number(app.node('cardGap').value),0);
  assert.equal(app.node('dimension-label').textContent,'800 × 300 px');
});

test('switching to a joined named or custom template keeps an invalid gap editable until repaired',async()=>{
  for(const template of [{design:'orbit'},{design:'custom',customLayout:JSON.stringify({composition:'editorial',font:'serif',align:'center'})}]) {
    const initial={...core.defaults,width:400,height:300,portraitData:localPortrait,customLayout:template.customLayout||''};
    const app=harness({initialDraft:initial});
    await app.input('cardGap',61);await app.finishEdit();
    await app.input('design',template.design);
    assert.equal(app.node('cardGap').getAttribute('aria-invalid'),'true');
    assert.equal(app.node('cardGap').disabled,false);assert.equal(app.node('cardGap-range').disabled,false);
    await app.click('copy-signature');assert.equal(app.activeElement?.id,'cardGap');
    await app.input('cardGap',0);await app.finishEdit();
    assert.equal(app.node('cardGap').disabled,true);assert.equal(app.node('cardGap-range').disabled,true);
    assert.notEqual(app.node('cardGap').getAttribute('aria-invalid'),'true');
    assert.equal(app.node('dimension-label').textContent,'820 × 300 px');
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,...template,cardGap:0});
  }
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

test('Studio Tall Grid exposes side-artwork controls and every slider changes rendered geometry with gesture undo and persistence',async()=>{
  const initial={...core.defaults,design:'studio',layout:'stacked',pattern:'signal'},app=harness({initialDraft:initial});
  assert.equal(app.node('artwork-flow-settings').hidden,true);assert.equal(app.node('artwork-motif-settings').hidden,false);
  for(const key of ['motifScale','motifPositionX','motifPositionY']) {
    const field=app.node(key);
    assert.equal(field.closest('details')?.id || null,key==='motifScale'?null:'motif-position-disclosure',key+' is grouped under the appropriate adjustment');
    for(let parent=field.parentElement;parent;parent=parent.parentElement)assert.equal(Boolean(parent.hidden),false,key+' starts visible');
  }
  assert.equal(Boolean(app.node('motif-position-disclosure').open),false,'fine positioning starts collapsed while artwork size stays visible');
  assert.equal(app.node('motifPositionY').disabled,true,'the fitted vertical edge does not offer a dead motion control');
  assert.equal(app.node('motif-position-note').hidden,false);
  const baseline=app.node('signature-preview').innerHTML;
  await app.input('motifScale',90);await app.input('motifScale',75);await app.finishEdit();
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,motifScale:75});
  assert.notEqual(app.node('signature-preview').innerHTML,baseline,'the slider changes the artwork, not just its saved number');
  assert.match(app.node('signature-preview').innerHTML,/<img[^>]*pattern-signal\.png" width="51" height="123"/);
  assert.equal(app.node('motifScale-value').textContent,'75%');
  assert.equal(app.node('motifPositionX').disabled,false);assert.equal(app.node('motifPositionY').disabled,false);
  assert.equal(app.node('motif-position-note').hidden,true);
  await app.click('undo-change');assert.deepEqual(JSON.parse(app.storage.get(storageKey)),initial);
  assert.equal(app.node('undo-change').disabled,true,'one native slider gesture is one undo action');
  await app.click('redo-change');
  app.node('motif-position-disclosure').setAttribute('open','');
  for(const [key,value] of [['motifPositionX',100],['motifPositionY',100]]) {
    const before=app.node('signature-preview').innerHTML;await app.input(key,value);await app.finishEdit();
    assert.notEqual(app.node('signature-preview').innerHTML,before,key+' moves the actual artwork');
    assert.equal(app.node(key+'-value').textContent,value+'%');
  }
  const positioned={...initial,motifScale:75,motifPositionX:100,motifPositionY:100};
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),positioned);
  assert.match(app.node('signature-preview').innerHTML,/padding:42px 0px 0px 25px/);
  const reloaded=harness({initialDraft:JSON.parse(app.storage.get(storageKey))});
  assert.equal(reloaded.node('signature-preview').innerHTML,app.node('signature-preview').innerHTML);
  await app.click('export-data');const backup=app.node('session-json').value;
  await app.click('close-session');await app.click('reset-draft');await app.click('import-data');await app.pasteSession(backup);await app.click('session-restore');
  assert.deepEqual(JSON.parse(app.storage.get(storageKey)),positioned);
  assert.equal(app.node('artwork-motif-settings').hidden,false);
});

test('side, flowing, custom and absent artwork show only useful controls while preserving both sets of adjustments',async()=>{
  const initial={...core.defaults,design:'studio',layout:'stacked',pattern:'signal',motifScale:65,motifPositionX:13,motifPositionY:87,artworkScale:125,artworkPositionX:20,artworkPositionY:90};
  const app=harness({initialDraft:initial});
  for(const pattern of ['dots','orbit','studio','contour','prism','editorial','signal','neural','latent','tokenweave','resonance','galaxy','starlight','moonlight','frost','auto']) {
    await app.input('pattern',pattern);
    assert.equal(app.node('artwork-motif-settings').hidden,false,pattern+' exposes side-artwork adjustments');
    assert.equal(app.node('artwork-flow-settings').hidden,true);assert.equal(app.node('artwork-placement-field').hidden,true);
    assert.deepEqual(JSON.parse(app.storage.get(storageKey)),{...initial,pattern});
  }
  await app.input('pattern','gesture');
  assert.equal(app.node('artwork-motif-settings').hidden,true);assert.equal(app.node('artwork-flow-settings').hidden,false);
  assert.equal(app.node('artwork-placement-field').hidden,false);
  await app.input('artworkPlacement','motif');
  assert.equal(app.node('artwork-motif-settings').hidden,false);assert.equal(app.node('artwork-flow-settings').hidden,true);
  const recipe=JSON.stringify({palette:['#2348c7'],rows:['00..','00..','....','....']});
  app.artworkSettings.applyChanges({customPattern:recipe});
  assert.equal(app.node('artwork-motif-settings').hidden,false,'drawn artwork can also be resized and moved');
  assert.equal(Number(app.node('motifScale').value),65);assert.equal(Number(app.node('artworkScale').value),125);
  await app.input('pattern','none');
  assert.equal(app.node('artwork-motif-settings').hidden,true);assert.equal(app.node('artwork-flow-settings').hidden,true);
  await app.click('undo-change');assert.equal(app.node('pattern').value,'custom');assert.equal(app.node('artwork-motif-settings').hidden,false);
  const filled=harness({initialDraft:{...core.defaults,design:'contour',layout:'paired',pattern:'signal',width:280,height:180,portraitSize:96,portraitUrl:'https://example.com/photo.png'}});
  assert.equal(filled.node('artwork-motif-settings').hidden,true,'a photo-occupied slot has no working artwork controls');
  assert.match(filled.node('pattern-note').textContent,/photo.*fills|photo.*space/i);
});

test('editor appearance defaults to red and persists independently of draft colors, exports and undo',async()=>{
  const app=harness(),before=app.storage.get(storageKey),html=app.node('signature-preview').innerHTML;
  assert.equal(app.editorSkin,'red');assert.equal(app.node('skin-red').getAttribute('aria-pressed'),'true');
  assert.equal(app.node('accent').value,'#583da6','red editor skin does not turn the starting Plum signature red');
  await app.click('skin-plum');
  assert.equal(app.editorSkin,'plum');assert.equal(app.node('skin-plum').getAttribute('aria-pressed'),'true');
  assert.equal(app.node('skin-red').getAttribute('aria-pressed'),'false');
  assert.equal(app.storage.get('signature-studio:appearance:v1'),'plum');
  assert.equal(app.storage.get(storageKey),before);assert.equal(app.node('signature-preview').innerHTML,html);
  assert.equal(app.node('undo-change').disabled,true);
  await app.click('export-data');const session=JSON.parse(app.node('session-json').value);
  assert.deepEqual(session.draft,freshDraft);assert.equal('editorSkin' in session.ui,false,'appearance is not part of a shared signature session');
  await app.click('close-session');await app.click('choose-palette-forest');assert.equal(app.editorSkin,'plum');
  await app.click('skin-red');assert.equal(app.editorSkin,'red');assert.equal(app.node('accent').value,'#a64435');
  const restored=harness({initialDraft:JSON.parse(app.storage.get(storageKey)),initialAppearance:'plum'});
  assert.equal(restored.editorSkin,'plum');assert.equal(restored.node('accent').value,'#a64435');
  const unavailable=harness({storageFails:true});await unavailable.click('skin-plum');
  assert.equal(unavailable.editorSkin,'plum');assert.equal(unavailable.node('appearance-notice').hidden,false);
  assert.match(unavailable.node('appearance-notice').textContent,/visit|storage/i);
  assert.equal(harness({initialAppearance:'unknown'}).editorSkin,'red','unknown old preferences have a stable visual fallback');
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
  assert.deepEqual(app.portraitReveals,['true'],'Copy selects Photo before revealing its hosted URL controls');
  assert.match(app.node('status').textContent,/photo|portrait|hosted/i);
  await app.click('details-tab');
  await app.click('download-html'); assert.equal(app.downloads.length,0);
  assert.deepEqual(app.portraitReveals,['true','true'],'HTML export also selects Photo and reveals the URL field');
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
  const expected = core.render({ ...freshDraft, nameLine1: 'Zoë' });
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
  assert.ok(html.includes(core.render({ ...freshDraft, nameLine1: 'Zoë' })));
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

test('resizing a stale tab cannot erase another tab’s hosted or uploaded photo', async () => {
  for (const photo of [{portraitUrl:'https://example.com/portrait.jpg'}, {portraitData:localPortrait}]) {
    const sharedStorage = new Map(), latest = harness({sharedStorage}), stale = harness({sharedStorage});
    await latest.navigateHash(draftHash({...freshDraft,...photo}));
    const saved = sharedStorage.get(storageKey);
    await stale.input('motifScale',75);
    await stale.input('width-range',350);
    await stale.input('height-range',220);
    assert.equal(sharedStorage.get(storageKey),saved,'size edits in the older tab never replace the saved photo');
    assert.equal(stale.imageSettings.getDraft().motifScale,75,'the older tab remains editable');
    assert.equal(stale.imageSettings.getDraft().width,350);
    assert.match(stale.node('save-status').textContent,/Not saved.*another tab/);
    assert.match(stale.footer.textContent,/Export data.*reload.*latest saved draft/);
    assert.equal(stale.footer.hidden,false);
    await stale.click('export-data');
    assert.equal(JSON.parse(stale.node('session-json').value).draft.width,350,'local work remains available for backup');
    const reloaded = harness({sharedStorage});
    for (const [key,value] of Object.entries(photo)) assert.equal(reloaded.imageSettings.getDraft()[key],value);
    await reloaded.input('width-range',360);
    assert.equal(JSON.parse(sharedStorage.get(storageKey)).width,360,'reloading establishes the current storage baseline');
    for (const [key,value] of Object.entries(photo)) assert.equal(JSON.parse(sharedStorage.get(storageKey))[key],value);
    assert.match(reloaded.node('save-status').textContent,/Saved in this browser/);
  }
});

test('an explicit session restore in a stale tab establishes the baseline for later edits', async () => {
  const sharedStorage = new Map(), latest = harness({sharedStorage}), stale = harness({sharedStorage});
  await latest.navigateHash(draftHash({...freshDraft,portraitUrl:'https://example.com/latest.jpg'}));
  await stale.input('motifScale',75);
  assert.match(stale.node('save-status').textContent,/another tab/);
  const imported = {...freshDraft,nameLine1:'Restored',portraitUrl:'https://example.com/imported.jpg'};
  await stale.click('import-data'); await stale.pasteSession(JSON.stringify(imported)); await stale.click('session-restore');
  assert.equal(JSON.parse(sharedStorage.get(storageKey)).portraitUrl,imported.portraitUrl);
  await stale.input('width-range',370);
  assert.equal(JSON.parse(sharedStorage.get(storageKey)).width,370);
  assert.equal(JSON.parse(sharedStorage.get(storageKey)).portraitUrl,imported.portraitUrl);
  assert.match(stale.node('save-status').textContent,/Saved in this browser/);
});

test('a failed stale-tab restore preserves the saved draft and can retry after storage recovers', async () => {
  const sharedStorage = new Map(), latest = harness({sharedStorage}), stale = harness({sharedStorage});
  await latest.navigateHash(draftHash({...freshDraft,portraitUrl:'https://example.com/latest.jpg'}));
  const saved = sharedStorage.get(storageKey);
  const imported = {...freshDraft,nameLine1:'Restored',portraitData:localPortrait};
  stale.failNextWrite(storageKey);
  await stale.click('import-data'); await stale.pasteSession(JSON.stringify(imported)); await stale.click('session-restore');
  assert.equal(sharedStorage.get(storageKey),saved,'failed explicit replacement rolls back without losing the newer photo');
  assert.match(stale.node('status').textContent,/this tab/);
  await stale.input('width-range',370);
  assert.equal(JSON.parse(sharedStorage.get(storageKey)).width,370);
  assert.equal(JSON.parse(sharedStorage.get(storageKey)).portraitData,localPortrait);
  assert.match(stale.node('save-status').textContent,/Saved in this browser/);
});

test('a failed ordinary save keeps its storage baseline until a successful retry', async () => {
  const app = harness();
  const saved = app.storage.get(storageKey);
  app.failNextWrite(storageKey);
  await app.input('motifScale',75);
  assert.equal(app.storage.get(storageKey),saved);
  assert.match(app.node('save-status').textContent,/Storage unavailable/);
  await app.input('width-range',350);
  assert.equal(JSON.parse(app.storage.get(storageKey)).motifScale,75);
  assert.equal(JSON.parse(app.storage.get(storageKey)).width,350);
  assert.match(app.node('save-status').textContent,/Saved in this browser/);
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
  await app.click('undo-change'); assert.equal(app.node('frontBackground').value,'#ffffff');
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
  await app.click('design-tab');
  await app.click('export-data');
  const exported = app.node('session-json').value;
  const session = JSON.parse(exported);
  assert.equal(session.draft.nameLine1,'Zoë'); assert.equal(session.themes[0].name,'My colors');
  assert.equal(session.ui.editorTab,'design');
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
  assert.equal(app.node('design-tab').getAttribute('aria-selected'),'true');
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
