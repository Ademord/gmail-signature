import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import preview from '../preview-dom.js';
import core from '../signature-core.js';

// A small DOM fixture tracks node identity and src assignments, not layout.
// Real browser checks cover painting and the editor's actual range controls.
function container(markup = '') {
  const root = { images: [], querySelectorAll: () => root.images,
    set innerHTML(value) {
      root.images = [...value.matchAll(/<img\b([^>]*)>/g)].map(([, attributes]) => {
        const values = new Map([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value]) => [key,value]));
        const node = { complete: true, naturalWidth: 384, srcWrites: 0,
          get attributes() { return [...values].map(([name,value]) => ({name,value})); },
          getAttribute: name => values.get(name) ?? null,
          hasAttribute: name => values.has(name),
          removeAttribute: name => values.delete(name),
          setAttribute(name,value) { if (name === 'src') this.srcWrites++; values.set(name,value); },
          replaceWith(previous) { root.images[root.images.indexOf(node)] = previous; }
        };
        return node;
      });
    },
    replaceChildren(fragment) { root.images = fragment.images; },
    ownerDocument: { importNode: fragment => fragment, createElement(tag) {
      assert.equal(tag, 'template');
      const content = container();
      return { content, set innerHTML(value) { content.innerHTML = value; } };
    } }
  };
  root.innerHTML = markup;
  return root;
}
const url = 'https://example.com/photo.jpg';
const render = changes => core.render({...core.defaults,portraitUrl:url,...changes},{preview:true});

test('artwork, canvas, orientation and photo resizing retain the existing portrait node', () => {
  const target = container(render({})), photo = target.images.find(i=>i.getAttribute('src')===url);
  for (const changes of [
    {motifScale:25}, {motifScale:99,motifPositionY:100}, {width:420,height:320},
    {artworkPlacement:'background',artworkScale:400,artworkOpacity:30},
    {artworkPlacement:'background',artworkScale:25,artworkPositionX:100,artworkPositionY:100},
    {cardGap:0}, {cardGap:60}, {layout:'stacked',cardGap:0},
    {layout:'stacked'}, {portraitSize:96,portraitShape:'square'}, {portraitSize:40,portraitShape:'rounded'}
  ]) {
    preview.update(target,render(changes));
    assert.equal(target.images.find(i=>i.getAttribute('src')===url),photo);
    assert.equal(photo.getAttribute('width'),String(changes.portraitSize || 64));
    assert.equal(photo.srcWrites,0,'resizing must never restart the same photo source');
  }
});

test('local crops remain loaded, but replacement and removal cannot resurrect an old photo', () => {
  const local = 'data:image/png;base64,AAAA';
  const target = container(`<img src="${local}" width="64" style="border-radius:50%" alt="Old name">`);
  const photo = target.images[0];
  preview.update(target,`<img src="${local}" width="80" alt="New name">`);
  assert.equal(target.images[0],photo);
  assert.equal(photo.getAttribute('style'),null);
  assert.equal(photo.getAttribute('alt'),'New name');
  preview.update(target,`<img src="${url}" width="80">`);
  assert.notEqual(target.images[0],photo);
  preview.update(target,'<p>No photo</p>');
  assert.equal(target.images.length,0);
});

test('pending images keep their requests while failed loads can retry', () => {
  const target = container(`<img src="${url}">`), pending = target.images[0];
  pending.complete = false; pending.naturalWidth = 0;
  preview.update(target,`<img src="${url}" width="80">`);
  assert.equal(target.images[0],pending);
  pending.complete = true;
  preview.update(target,`<img src="${url}" width="96">`);
  assert.notEqual(target.images[0],pending,'a failed load gets a new request');
});

test('repeated image URLs keep separate nodes and update each geometry', () => {
  const target = container(`<img src="${url}" width="64"><img src="${url}" width="20">`);
  const originals = [...target.images];
  preview.update(target,`<img src="${url}" width="80"><img src="${url}" width="30">`);
  assert.deepEqual(target.images,originals);
  assert.equal(target.images[0].getAttribute('width'),'80');
  assert.equal(target.images[1].getAttribute('width'),'30');
});

test('switching between explicit Single and front/back formats retains the actual portrait node', () => {
  // The inline source is distinct from every URL-backed icon or artwork source.
  const localPhoto='data:image/png;base64,'+readFileSync(new URL('../sig/icon-web.png',import.meta.url)).toString('base64');
  for(const portrait of [{portraitUrl:url},{portraitUrl:'',portraitData:localPhoto}]) {
    const source=portrait.portraitData||portrait.portraitUrl;
    const initial={width:400,height:300,pattern:'none',...portrait};
    const target=container(render(initial)),photo=target.images.find(image=>image.getAttribute('src')===source);
    assert.ok(photo,'The unique portrait source is present before switching format');
    photo.complete=false;photo.naturalWidth=0;
    for(const changes of [
      {cardFormat:'single'},
      {cardFormat:'single',layout:'stacked'},
      {cardFormat:'single',layout:'stacked',design:'editorial'},
      {cardFormat:'front-back',layout:'stacked',design:'editorial'},
      {cardFormat:'front-back',portraitSize:80,portraitShape:'rounded'},
      {cardFormat:'single',portraitSize:80,portraitShape:'rounded'}
    ]) {
      preview.update(target,render({...initial,...changes}));
      assert.equal(target.images.find(image=>image.getAttribute('src')===source),photo,'Format changes preserve the loaded or pending portrait node');
      assert.equal(photo.srcWrites,0,'Changing format does not restart its image request');
      photo.complete=true;photo.naturalWidth=384;
    }
  }
});
