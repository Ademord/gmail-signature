import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import core from '../signature-core.js';
import portrait from '../portrait-core.js';

const script = readFileSync(new URL('../portrait-controls.js', import.meta.url), 'utf8');
const photo = 'data:image/png;base64,' + readFileSync(new URL('../sig/icon-web.png', import.meta.url)).toString('base64');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function harness(overrides = {}, initial = {portraitData:photo}) {
  const nodes = new Map(), opened = [], detections = [], probes = [], patches = [], draws = [];
  let draft = {...core.defaults, ...initial}, api;
  const makeNode = id => ({
    id, value:'', files:[], checked:false, hidden:false, open:false, style:{}, dataset:{}, events:{}, attributes:{}, srcAssignments:[],
    complete:false, naturalWidth:0, naturalHeight:0,
    get src() { return this.attributes.src || ''; },
    set src(value) {
      this.attributes.src = String(value); this.srcAssignments.push(String(value));
      this.complete = false; this.naturalWidth = this.naturalHeight = 0;
    },
    getAttribute(key) { return this.attributes[key] ?? null; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    addEventListener(type, handler) { this.events[type] = handler; },
    replaceChildren() {}, removeAttribute(key) { delete this.attributes[key]; }, setPointerCapture() {},
    focus() { context.document.activeElement = this; }
  });
  nodes.set('portrait-panel-content', {
    set innerHTML(markup) {
      this.markup = markup;
      for (const [,id] of markup.matchAll(/id="([^"]+)"/g)) nodes.set(id,makeNode(id));
    },
    get innerHTML() { return this.markup; }
  });
  const $ = id => nodes.get(id);
  const context = {
    window:{SignatureCore:core, PortraitCore:{...portrait,
      load:async file => { opened.push(file); return {width:512,height:512}; },
      detect:() => { const task = deferred(); detections.push(task); return task.promise; },
      draw(...args) { draws.push(args); }, encode:() => photo, ...overrides
    }},
    document:{getElementById:$, createElement:() => ({})}, Blob, Uint8Array, atob,
    Image:class { constructor() { probes.push(this); } },
    setTimeout:() => 1, clearTimeout() {}
  };
  vm.runInNewContext(script, context);
  api = context.window.PortraitControls.attach({getDraft:() => draft,
    setPortrait:patch => { patches.push({...patch}); draft = {...draft,...patch}; api?.sync(); }
  });
  return {node:$, opened, detections, probes, patches, draws, draft:() => draft,
    active:() => context.document.activeElement, revealLink:() => api.revealLink(),
    click:id => $(id).events.click(),
    change(id, value) { $(id).value = value; return $(id).events.change(); },
    input(id, value) { $(id).value = value; return $(id).events.input(); },
    imageEvent(type, width = 0, height = width) {
      const image = $('portrait-current-image');
      image.complete = true; image.naturalWidth = width; image.naturalHeight = height;
      return image.events[type]();
    },
    restore(patch) { draft = {...draft,...patch}; api.sync(); },
    select(file) {
      const input = $('portrait-file'), path = 'C:\\fakepath\\' + file.name;
      // A picker selecting the unchanged file does not emit another change.
      if (input.value === path) return {changed:false,pending:Promise.resolve()};
      input.files = [file]; input.value = path;
      return {changed:true,pending:input.events.change()};
    }
  };
}
const file = {name:'same-photo.png',type:'image/png',size:100};

test('portrait formatting preserves the image source while replacing a photo updates it once', () => {
  const h = harness(), image = h.node('portrait-current-image');
  const initial = {...h.draft()};
  const images = [image, ...['circle','rounded','square'].map(shape => h.node('portrait-shape-'+shape+'-image'))];
  assert.deepEqual(image.srcAssignments,[photo]);
  for (const size of [40,64,96]) h.change('portrait-size-control',String(size));
  for (const shape of ['square','rounded','circle']) {
    h.click('portrait-shape-'+shape);
    assert.equal(h.node('portrait-shape-control').value,shape);
    for (const candidate of ['circle','rounded','square']) {
      assert.equal(h.node('portrait-shape-'+candidate).getAttribute('aria-pressed'),String(candidate===shape));
    }
  }
  assert.equal(h.draft().portraitSize,96);
  assert.equal(h.draft().portraitShape,'circle');
  assert.deepEqual(h.draft(),{...initial,portraitSize:96,portraitShape:'circle'});
  assert.equal(image.style.borderRadius,'50%');
  for (const current of images) assert.deepEqual(current.srcAssignments,[photo],'Formatting must not reload the photo or its shape previews');

  const url = 'https://example.com/replacement-photo.jpg';
  h.restore({portraitData:'',portraitUrl:url});
  assert.equal(image.getAttribute('src'),url);
  assert.deepEqual(image.srcAssignments,[photo,url],'A changed photo source must reach the current image');
  h.change('portrait-size-control','80');
  h.change('portrait-shape-control','square');
  assert.equal(h.node('portrait-shape-square').getAttribute('aria-pressed'),'true','The compatible select keeps visual choices synchronized');
  for (const current of images) assert.deepEqual(current.srcAssignments,[photo,url],'Hosted photos must also survive formatting without reload');
  h.click('portrait-remove');
  for (const current of images) assert.equal(current.getAttribute('src'),null);
  assert.equal(h.node('portrait-current').hidden,true);
});

test('readiness distinguishes no photo, local crop, checked hosted photo, and failed or non-square hosted images', () => {
  const h = harness({},{}), state = () => h.node('portrait-readiness').dataset.state;
  assert.equal(state(),'empty');
  assert.equal(h.node('portrait-upload-label').textContent,'Choose a photo');
  assert.equal(h.node('portrait-remove').hidden,true);
  assert.equal(h.node('portrait-current').hidden,true);
  const url = 'https://example.com/portrait.jpg';
  h.restore({portraitUrl:url});
  assert.equal(state(),'checking');
  assert.doesNotMatch(h.node('portrait-hosting-status').textContent,/ready for.*email/);
  assert.equal(h.node('portrait-upload-label').textContent,'Change photo');
  assert.equal(h.node('portrait-download').disabled,true);
  h.imageEvent('load',512);
  assert.equal(state(),'ready');
  assert.equal(h.node('portrait-readiness-title').textContent,'Ready for email');
  h.restore({portraitUrl:'https://example.com/non-square.jpg'});
  assert.equal(state(),'checking','A replacement must be checked independently');
  h.imageEvent('load',400,600);
  assert.equal(state(),'unavailable');
  assert.match(h.node('portrait-readiness-text').textContent,/square/);
  h.restore({portraitUrl:'https://example.com/missing.jpg'});
  h.imageEvent('error');
  assert.equal(state(),'unavailable');
  assert.match(h.node('portrait-readiness-text').textContent,/could not load/);
  h.restore({portraitData:photo,portraitUrl:url});
  h.imageEvent('load',512);
  assert.equal(state(),'local','Local data overrides a URL and still needs its own hosted crop for email');
  assert.equal(h.node('portrait-current-image').src,photo);
  assert.equal(h.node('portrait-download').disabled,false);
  assert.equal(h.node('portrait-edit').hidden,false);
  assert.match(h.node('portrait-readiness-text').textContent,/Photo link/);
  h.click('portrait-remove');
  assert.equal(state(),'empty');
  h.imageEvent('load',512);
  assert.equal(state(),'empty','A late image event cannot revive a removed photo');
  h.restore({portraitData:photo,portraitUrl:url});
  assert.equal(state(),'local','Undo or session restoration restores the local crop state');
  assert.equal(h.node('portrait-current').hidden,false);
});

test('pending crop survives shape and size edits and cancel restores the committed hosted photo without another edit', async () => {
  const url = 'https://example.com/committed.jpg';
  const h = harness({},{portraitUrl:url});
  h.imageEvent('load',512);
  const selection = h.select(file);
  assert.equal(h.node('portrait-readiness').dataset.state,'pending');
  await new Promise(setImmediate);
  h.input('portrait-zoom','2');
  h.input('portrait-x','67');
  h.input('portrait-brightness','115');
  h.click('portrait-shape-rounded');
  h.input('portrait-size-control','81');
  assert.equal(h.node('portrait-size-value').textContent,'81 px');
  h.change('portrait-size-control','81');
  assert.equal(h.node('portrait-editor').hidden,false);
  assert.equal(h.node('portrait-workflow').hidden,false);
  assert.equal(h.node('portrait-readiness').dataset.state,'pending');
  assert.equal(h.node('portrait-zoom').value,'2');
  assert.equal(h.node('portrait-x').value,'67');
  assert.equal(h.node('portrait-brightness').value,'115');
  assert.equal(h.draft().portraitUrl,url);
  assert.equal(h.draft().portraitData,'');
  assert.equal(h.opened.length,1);
  assert.deepEqual(h.node('portrait-current-image').srcAssignments,[url]);
  const beforeCancel = {...h.draft()}, editCount = h.patches.length;
  h.click('portrait-cancel');
  assert.deepEqual(h.draft(),beforeCancel);
  assert.equal(h.patches.length,editCount,'Cancel does not add a history edit');
  assert.equal(h.node('portrait-editor').hidden,true);
  assert.equal(h.node('portrait-workflow').hidden,true);
  assert.equal(h.node('portrait-current').hidden,false);
  assert.equal(h.node('portrait-apply').disabled,true);
  assert.equal(h.node('portrait-readiness').dataset.state,'ready');
  assert.equal(h.active()?.id,'portrait-file');
  h.detections[0].resolve([]); await selection.pending;
  assert.equal(h.node('portrait-readiness').dataset.state,'ready');
  assert.equal(h.node('portrait-editor').hidden,true);
  assert.match(h.node('portrait-notice').textContent,/canceled/);
});

test('applying a crop replaces the hosted photo and exposes honest local readiness and the crop download', async () => {
  const h = harness({},{portraitUrl:'https://example.com/committed.jpg'});
  const selection = h.select(file);
  await new Promise(setImmediate);
  h.detections[0].resolve([]); await selection.pending;
  assert.equal(h.node('portrait-download').disabled,true);
  h.click('portrait-apply');
  assert.equal(h.draft().portraitData,photo);
  assert.equal(h.draft().portraitUrl,'');
  assert.equal(h.node('portrait-readiness').dataset.state,'local');
  assert.equal(h.node('portrait-current').hidden,false);
  assert.equal(h.node('portrait-workflow').hidden,true);
  assert.equal(h.node('portrait-download').disabled,false);
  assert.equal(h.node('portrait-link-disclosure').open,false);
  h.revealLink();
  assert.equal(h.node('portrait-link-disclosure').open,true);
  assert.equal(h.active()?.id,'portrait-public-url','Email export guidance reveals and focuses the URL field');
  const editing = h.click('portrait-edit');
  await new Promise(setImmediate);
  assert.equal(h.node('portrait-editor').hidden,false,'Saved local crops remain adjustable');
  assert.equal(h.node('portrait-download').disabled,true,'A pending replacement must not download the prior crop');
  h.click('portrait-cancel');
  h.detections[1].resolve([]); await editing;
  assert.equal(h.draft().portraitData,photo);
  assert.equal(h.node('portrait-readiness').dataset.state,'local');
  assert.equal(h.node('portrait-download').disabled,false);
});

for (const action of ['cancel','remove','restore']) test(`${action} invalidates an unfinished crop load without allowing it to replace the committed view`, async () => {
  const loading = deferred(), h = harness({load:() => loading.promise});
  const selection = h.select(file);
  assert.equal(h.node('portrait-workflow').hidden,false);
  if (action==='restore') h.restore({portraitData:'',portraitUrl:'https://example.com/restored.jpg'});
  else h.click('portrait-'+action);
  const expected = {...h.draft()}, editCount = h.patches.length;
  loading.resolve({width:512,height:512}); await selection.pending;
  assert.deepEqual(h.draft(),expected);
  assert.equal(h.patches.length,editCount);
  assert.equal(h.detections.length,0,'A stale load must not start face detection');
  assert.equal(h.node('portrait-editor').hidden,true);
  assert.equal(h.node('portrait-workflow').hidden,true);
  assert.equal(h.node('portrait-apply').disabled,true);
  assert.equal(h.node('portrait-readiness').dataset.state,action==='cancel'?'local':action==='remove'?'empty':'checking');
});

test('canceling a hosted link probe keeps the current crop and ignores a late square result', async () => {
  const h = harness(), before = {...h.draft()};
  h.node('portrait-public-url').value = 'https://example.com/candidate.jpg';
  const importing = h.click('portrait-use-url');
  assert.equal(h.node('portrait-readiness').dataset.state,'pending');
  assert.equal(h.node('portrait-workflow').hidden,false);
  assert.equal(h.node('portrait-apply').disabled,true);
  h.click('portrait-cancel');
  const probe = h.probes[0]; probe.naturalWidth = probe.naturalHeight = 512; probe.onload();
  await importing;
  assert.deepEqual(h.draft(),before);
  assert.equal(h.patches.length,0);
  assert.equal(h.node('portrait-readiness').dataset.state,'local');
  assert.equal(h.node('portrait-workflow').hidden,true);
});

test('canceling the fetch of a non-square hosted photo prevents a late fetch from opening the crop editor', async () => {
  const fetching = deferred(), h = harness({fetchHosted:() => fetching.promise});
  h.node('portrait-public-url').value = 'https://example.com/portrait.jpg';
  const importing = h.click('portrait-use-url'), probe = h.probes[0];
  probe.naturalWidth = 400; probe.naturalHeight = 600; probe.onload();
  await new Promise(setImmediate);
  assert.equal(h.node('portrait-readiness').dataset.state,'pending');
  h.click('portrait-cancel');
  fetching.resolve(file); await importing;
  assert.equal(h.opened.length,0);
  assert.equal(h.draft().portraitData,photo);
  assert.equal(h.node('portrait-readiness').dataset.state,'local');
  assert.equal(h.node('portrait-workflow').hidden,true);
});

test('reapplying the connected square URL finishes checking without reloading or leaving pending crop controls', async () => {
  const url = 'https://example.com/connected.jpg', h = harness({},{portraitUrl:url});
  h.imageEvent('load',512);
  h.node('portrait-public-url').value = url;
  const importing = h.click('portrait-use-url'), probe = h.probes[0];
  probe.naturalWidth = probe.naturalHeight = 512; probe.onload(); await importing;
  assert.equal(h.node('portrait-readiness').dataset.state,'ready');
  assert.equal(h.node('portrait-workflow').hidden,true);
  assert.equal(h.node('portrait-editor').hidden,true);
  assert.deepEqual(h.node('portrait-current-image').srcAssignments,[url]);
});

test('retrying the same failed hosted URL reloads its current image and can recover email readiness', async () => {
  const url = 'https://example.com/recovering.jpg', h = harness({},{portraitUrl:url});
  h.imageEvent('error');
  assert.equal(h.node('portrait-readiness').dataset.state,'unavailable');
  h.click('portrait-shape-square');
  assert.deepEqual(h.node('portrait-current-image').srcAssignments,[url],'Ordinary formatting must not retry a failed source');
  h.node('portrait-public-url').value = url;
  const importing = h.click('portrait-use-url'), probe = h.probes[0];
  probe.naturalWidth = probe.naturalHeight = 512; probe.onload(); await importing;
  assert.deepEqual(h.node('portrait-current-image').srcAssignments,[url,url],'An explicit successful retry must refresh the broken current image');
  assert.equal(h.node('portrait-readiness').dataset.state,'checking');
  assert.equal(h.node('portrait-workflow').hidden,true);
  h.imageEvent('load',512);
  assert.equal(h.node('portrait-readiness').dataset.state,'ready');
  assert.equal(h.draft().portraitUrl,url);
  assert.equal(h.draft().portraitShape,'square');
});

for (const action of ['portrait-remove','portrait-apply']) test(`same photo can be selected after ${action} cancels pending detection`, async () => {
  const h = harness(), first = h.select(file);
  assert.equal(first.changed,true);
  assert.equal(h.node('portrait-file').value,'','Captured file must release the picker before asynchronous work');
  await new Promise(setImmediate);
  h.click(action);
  h.detections[0].resolve([]); await first.pending;
  assert.equal(h.draft().portraitData,action === 'portrait-remove' ? '' : photo);
  const second = h.select(file);
  assert.equal(second.changed,true,'Choosing the same photo must start a new load');
  await new Promise(setImmediate);
  assert.equal(h.opened.length,2);
  h.detections[1].resolve([]); await second.pending;
  assert.equal(h.node('portrait-editor').hidden,false);
});

test('a failed photo load permits retrying the same file', async () => {
  let calls = 0;
  const h = harness({load:async () => { ++calls; throw new Error('Temporary image read failure'); }});
  await h.select(file).pending;
  assert.equal(h.node('portrait-notice').dataset.error,'true');
  const retry = h.select(file);
  assert.equal(retry.changed,true); await retry.pending;
  assert.equal(calls,2); assert.equal(h.draft().portraitData,photo);
});

test('older detection completion cannot stop a newer selection or clear its file', async () => {
  const h = harness(), first = h.select(file);
  await new Promise(setImmediate);
  const second = h.select({...file,name:'new-photo.png'});
  await new Promise(setImmediate);
  h.detections[0].resolve([]); await first.pending;
  assert.equal(h.node('portrait-file').value,'');
  h.detections[1].resolve([]); await second.pending;
  assert.deepEqual(h.opened.map(value => value.name),['same-photo.png','new-photo.png']);
  assert.equal(h.node('portrait-editor').hidden,false);
  assert.match(h.node('portrait-notice').textContent,/No clear face found/);
});
