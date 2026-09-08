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
function harness(overrides = {}) {
  const nodes = new Map(), opened = [], detections = [];
  let draft = {...core.defaults, portraitData:photo}, api;
  for (const [,id] of script.matchAll(/id="([^"]+)"/g)) nodes.set(id, {
    value:'', files:[], checked:false, hidden:false, style:{}, dataset:{}, events:{},
    addEventListener(type, handler) { this.events[type] = handler; },
    replaceChildren() {}, removeAttribute(key) { delete this[key]; }, setPointerCapture() {}
  });
  nodes.set('portrait-panel-content', {});
  const $ = id => nodes.get(id);
  const context = {
    window:{SignatureCore:core, PortraitCore:{...portrait,
      load:async file => { opened.push(file); return {width:512,height:512}; },
      detect:() => { const task = deferred(); detections.push(task); return task.promise; },
      draw() {}, encode:() => photo, ...overrides
    }},
    document:{getElementById:$, createElement:() => ({})}, Blob, Uint8Array, atob
  };
  vm.runInNewContext(script, context);
  api = context.window.PortraitControls.attach({getDraft:() => draft,
    setPortrait:patch => { draft = {...draft,...patch}; api?.sync(); }
  });
  return {node:$, opened, detections, draft:() => draft,
    click:id => $(id).events.click(),
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
