// Real session controls and codec, with deferred File.text() promises. These
// checks exercise event order without depending on filesystem or timer timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import core from '../signature-core.js';
import codec from '../session-data.js';

const controlsSource = readFileSync(new URL('../session-controls.js',import.meta.url),'utf8');
const pageSource = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(name,design,pattern) {
  const theme = {id:'theme-'+name.toLowerCase(),name:name+' palette',frontBackground:'#f5efe5',backBackground:'#26313c',accent:'#785c37'};
  return codec.parse(codec.serialize({draft:{...core.defaults,nameLine1:name,design,pattern,
    portraitUrl:'https://example.com/'+name.toLowerCase()+'.png'},themes:[theme],ui:{selectedThemeId:theme.id,themeName:theme.name}}));
}
const current = fixture('Current','original','auto');
const first = fixture('First','orbit','cutpaper');
const second = fixture('Second','studio','chromatic');
const third = fixture('Third','signal','gesture');
const backup = value => codec.serialize(value);
function deferredFile() {
  let resolve,reject,reads=0;
  const pending = new Promise((done,fail) => { resolve=done; reject=fail; });
  return {file:{name:'session.json',size:512,text(){reads++;return pending;}},resolve,reject,get reads(){return reads;}};
}
function harness() {
  const nodes = new Map(), restores = [], errors = [];
  let active = clone(current);
  class Element {
    constructor(id) { this.id=id; this.value=''; this.files=[]; this.dataset={}; this.disabled=false; this.checked=false; this.open=false; this.events=new Map(); }
    addEventListener(type,listener) { this.events.set(type,[...(this.events.get(type)||[]),listener]); }
    async dispatch(type) { for (const listener of this.events.get(type)||[]) await listener({target:this,preventDefault(){}}); }
    click() { return this.disabled ? Promise.resolve() : this.dispatch('click'); }
    showModal() { this.open=true; }
    close() { this.open=false; return this.dispatch('close'); }
    focus() {}
    select() {}
  }
  // IDs come from the actual editor: removing a required control must fail.
  for (const [,id] of pageSource.matchAll(/\bid="([^"]+)"/g)) nodes.set(id,new Element(id));
  const node = id => { assert.ok(nodes.has(id),'Required control #'+id); return nodes.get(id); };
  const context = {window:{SignatureSession:codec},document:{getElementById:node},URL,Blob,setTimeout};
  vm.runInNewContext(controlsSource,context,{filename:'session-controls.js'});
  context.window.SessionControls.attach({getSession:()=>clone(active),copy:async()=>true,onError:message=>errors.push(message),
    restore(value){restores.push(clone(value));active=clone(value);}});
  return {node,restores,errors,get current(){return clone(active);},click:id=>node(id).click(),
    async paste(text){node('session-json').value=text;await node('session-json').dispatch('input');},
    async parts(information,design){node('session-import-information').checked=information;node('session-import-design').checked=design;await node('session-import-information').dispatch('change');await node('session-import-design').dispatch('change');},
    choose(file){node('session-file').files=file?[file]:[];return node('session-file').dispatch('change');}};
}
async function primed() {
  const app=harness();await app.click('import-data');await app.paste(backup(first));
  assert.equal(app.node('session-restore').disabled,false,'First backup is initially ready');
  return app;
}

for (const [label,information,design] of [['information',true,false],['design',false,true],['both parts',true,true]]) {
  test('a pending replacement file cannot restore stale JSON after selecting '+label,async()=>{
    const app=await primed(), incoming=deferredFile(), read=app.choose(incoming.file);
    assert.equal(incoming.reads,1);assert.equal(app.node('session-restore').disabled,true);
    await app.parts(false,false);await app.parts(information,design);
    await app.click('session-restore');
    assert.deepEqual(app.restores.map(value=>({name:value.draft.nameLine1,design:value.draft.design})),[],'Import must not restore First while Second is still reading');
    assert.equal(app.node('session-restore').disabled,true,'Changing import parts cannot re-enable a pending file');
    assert.deepEqual(app.current,current);
    incoming.resolve(backup(second));await read;
    assert.equal(app.node('session-restore').disabled,false,'A completed valid file can be imported');
    await app.click('session-restore');
    assert.equal(app.restores.length,1);
    const restored=app.restores[0];
    assert.equal(restored.draft.nameLine1,information?'Second':'Current');
    assert.equal(restored.draft.portraitUrl,information?second.draft.portraitUrl:current.draft.portraitUrl);
    assert.equal(restored.draft.design,design?'studio':'original');
    assert.equal(restored.draft.pattern,design?'chromatic':'auto');
    assert.deepEqual(restored.themes,design?second.themes:current.themes);
    assert.deepEqual(restored.ui,design?second.ui:current.ui);
    assert.equal(app.node('session-dialog').open,false);
  });
}

for (const outcome of ['resolve','reject']) {
  test('new pasted JSON supersedes a pending file even when that file later '+outcome+'s',async()=>{
    const app=await primed(),incoming=deferredFile(),read=app.choose(incoming.file);
    await app.paste(backup(third));await app.parts(true,false);
    assert.equal(app.node('session-restore').disabled,false,'A deliberate text edit becomes the active source');
    const text=app.node('session-json').value,notice=app.node('session-notice').textContent;
    if(outcome==='resolve')incoming.resolve(backup(second));else incoming.reject(new Error('Late file failure'));
    await read;
    assert.equal(app.node('session-json').value,text);assert.equal(app.node('session-notice').textContent,notice);
    await app.click('session-restore');
    assert.equal(app.restores.length,1);assert.equal(app.current.draft.nameLine1,'Third');
    assert.equal(app.current.draft.design,'original');assert.deepEqual(app.current.themes,current.themes);
  });
}

test('a rejected file stays unimportable after pending and subsequent selection changes',async()=>{
  const app=await primed(),incoming=deferredFile(),read=app.choose(incoming.file);
  await app.parts(false,true);
  incoming.reject(new Error('Disk read failed'));await read;
  assert.equal(app.node('session-restore').disabled,true,'File failure cannot leave the previous backup importable');
  assert.equal(app.node('session-notice').dataset.error,'true');assert.match(app.node('session-notice').textContent,/Disk read failed/);
  await app.parts(true,false);await app.click('session-restore');
  assert.equal(app.node('session-restore').disabled,true);assert.deepEqual(app.restores,[]);assert.deepEqual(app.current,current);
  await app.paste(backup(third));await app.click('session-restore');
  assert.equal(app.current.draft.nameLine1,'Third','A later valid paste recovers normally');
});

test('an oversized file fails before reading and cannot revive the prior pasted backup',async()=>{
  const app=await primed();let reads=0;
  await app.choose({size:1024*1024+1,text(){reads++;return Promise.resolve(backup(second));}});
  assert.equal(reads,0);assert.equal(app.node('session-restore').disabled,true);
  assert.match(app.node('session-notice').textContent,/smaller than 1 MB/);
  await app.parts(false,true);await app.click('session-restore');
  assert.equal(app.node('session-restore').disabled,true);assert.deepEqual(app.restores,[]);assert.deepEqual(app.current,current);
});

test('a newer file wins when file reads complete in the opposite order',async()=>{
  const app=await primed(),older=deferredFile(),latest=deferredFile();
  const olderRead=app.choose(older.file),latestRead=app.choose(latest.file);
  await app.parts(false,true);latest.resolve(backup(third));await latestRead;
  const ready=app.node('session-json').value;
  older.resolve(backup(second));await olderRead;
  assert.equal(app.node('session-json').value,ready);assert.equal(app.node('session-restore').disabled,false);
  await app.click('session-restore');
  assert.equal(app.restores.length,1);assert.equal(app.current.draft.nameLine1,'Current');assert.equal(app.current.draft.design,'signal');
});

for (const outcome of ['resolve','reject']) {
  test('closing and reopening import discards the former file '+outcome+' result',async()=>{
    const app=await primed(),incoming=deferredFile(),read=app.choose(incoming.file);
    await app.click('close-session');await app.click('import-data');
    assert.equal(app.node('session-json').value,'');assert.equal(app.node('session-restore').disabled,true);
    const text=backup(third);await app.paste(text);const notice=app.node('session-notice').textContent;
    if(outcome==='resolve')incoming.resolve(backup(second));else incoming.reject(new Error('Closed dialog read failure'));
    await read;
    assert.equal(app.node('session-json').value,text);assert.equal(app.node('session-notice').textContent,notice);
    await app.click('session-restore');
    assert.equal(app.restores.length,1);assert.equal(app.current.draft.nameLine1,'Third');assert.equal(app.current.draft.design,'signal');
  });
}
