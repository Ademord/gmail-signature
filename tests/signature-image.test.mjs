import test from 'node:test';
import assert from 'node:assert/strict';
import image from '../signature-image.js';
import core from '../signature-core.js';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('PNG resolutions use full signature dimensions, independent of preview scaling',()=>{
  for (const scale of [2,4,6]) {
    assert.deepEqual(image.dimensions(core.defaults,scale),{width:662*scale,height:208*scale,logicalWidth:662,logicalHeight:208});
    assert.deepEqual(image.dimensions({...core.defaults,layout:'stacked',width:340,height:280},scale),{width:340*scale,height:580*scale,logicalWidth:340,logicalHeight:580});
  }
});

test('invalid or unbounded PNG requests fail before touching browser rendering APIs',async()=>{
  for (const scale of [0,-1,1,3,100,Infinity,'4']) assert.throws(()=>image.dimensions(core.defaults,scale));
  await assert.rejects(image.render({...core.defaults,height:999}),/highlighted/);
  await assert.rejects(image.render({...core.defaults,website:'javascript:alert(1)'}),/highlighted/);
  await assert.rejects(image.render(core.defaults,{background:'red;anything'}),/background/);
});

test('corrupt PNG assets stop export before a missing icon can become a successful image',async()=>{
  let decodes=0, rasterizations=0;
  const context={window:{SignatureCore:core},URL,DOMException,AbortController,Blob,setTimeout,clearTimeout,
    document:{createElement(tag){
      assert.equal(tag,'div','Canvas must not be reached with a corrupt asset');
      return {setAttribute(){},set innerHTML(html){this.images=[...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m=>({src:new URL(m[1],'https://example.com/').href,setAttribute(){}}));},querySelectorAll(){return this.images;}};
    }},
    fetch:async()=>({ok:true,blob:async()=>new Blob(['broken PNG'],{type:'image/png'})}),
    FileReader:class {readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result='data:image/png;base64,'+Buffer.from(buffer).toString('base64');this.onload();});}},
    Image:class {set src(value){assert.match(value,/^data:image\/png;/);decodes++;queueMicrotask(()=>this.onerror?.());}},
    XMLSerializer:class {serializeToString(){rasterizations++;return '';}}
  };
  vm.runInNewContext(readFileSync(new URL('../signature-image.js',import.meta.url),'utf8'),context);
  await assert.rejects(context.window.SignatureImage.render(core.defaults),/Could not load .*\.png/);
  assert.ok(decodes>0);
  assert.equal(rasterizations,0);
});
