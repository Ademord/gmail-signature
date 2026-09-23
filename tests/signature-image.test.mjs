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

test('PNG dimensions include the selected Original gap at every resolution and orientation',()=>{
  for (const cardGap of [0,20,60]) for (const layout of ['paired','stacked']) for (const scale of [2,4,6]) {
    const v={...core.defaults,cardGap,layout,width:340,height:230};
    const width=layout==='paired'?680+cardGap:340,height=layout==='stacked'?460+cardGap:230;
    assert.deepEqual(image.dimensions(v,scale),{width:width*scale,height:height*scale,logicalWidth:width,logicalHeight:height});
  }
  for (const cardGap of [-1,61,1.5,NaN,Infinity,null,'']) assert.throws(()=>image.dimensions({...core.defaults,cardGap},4));
  const legacy={...core.defaults};delete legacy.cardGap;
  assert.deepEqual(image.dimensions(legacy,4),image.dimensions(core.defaults,4));
});

test('single PNG dimensions follow measured content height rather than legacy doubled-card height',()=>{
  for(const layout of ['paired','stacked'])for(const scale of [2,4,6]){
    const v={...core.defaults,cardFormat:'single',layout};
    const width=layout==='paired'?642:321,height=layout==='paired'?208:290;
    assert.deepEqual(image.dimensions(v,scale),{width:width*scale,height:height*scale,logicalWidth:width,logicalHeight:height});
    assert.deepEqual(image.dimensions({...v,cardGap:60},scale),image.dimensions(v,scale));
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

function paintedExportHarness({imageAlias=true,broken=false,backgroundImage}={}) {
  const requests=[], decoded=[], source='https://example.com/sig/pattern-counterform-wide.png';
  const originalBackground=backgroundImage===undefined?'url("'+source+'")':backgroundImage;
  const surface={style:{backgroundImage:originalBackground,backgroundSize:'662px 246px',backgroundPosition:'-341px -19px'}};
  const textMat={style:{backgroundImage:'initial',backgroundColor:'#f3f0ea'}};
  const icon={src:source,setAttribute(key,value){this[key]=value;}};
  let serialized=false;
  const fixtureCore={...core,validate:()=>({}),render:()=>'<table></table>'};
  const context={window:{SignatureCore:fixtureCore},URL,DOMException,AbortController,Blob,setTimeout,clearTimeout,
    document:{baseURI:'https://example.com/',createElement(tag){
      if(tag==='div')return {baseURI:'https://example.com/',setAttribute(){},set innerHTML(value){},querySelectorAll(selector){return selector==='img'?(imageAlias?[icon]:[]):selector==='[style]'?[surface,textMat]:[];}};
      assert.equal(tag,'canvas');return {getContext:()=>({drawImage(){},fillRect(){}}),toBlob(callback){callback(new Blob(['encoded PNG'],{type:'image/png'}));}};
    }},
    fetch:async url=>{requests.push(url);return {ok:!broken,blob:async()=>new Blob(['PNG fixture'],{type:'image/png'})};},
    FileReader:class {readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result='data:'+blob.type+';base64,'+Buffer.from(buffer).toString('base64');this.onload();});}},
    Image:class {set src(value){decoded.push(value);queueMicrotask(()=>this.onload?.());}},
    XMLSerializer:class {serializeToString(){serialized=true;if(originalBackground.includes('url('))assert.match(surface.style.backgroundImage,/url\("data:image\/png;base64,/);else assert.equal(surface.style.backgroundImage,originalBackground);assert.equal(surface.style.backgroundSize,'662px 246px');assert.equal(surface.style.backgroundPosition,'-341px -19px');if(imageAlias)assert.match(icon.src,/^data:image\/png;base64,/);return '<div xmlns="http://www.w3.org/1999/xhtml"></div>';}}
  };
  vm.runInNewContext(readFileSync(new URL('../signature-image.js',import.meta.url),'utf8'),context);
  return {render:()=>context.window.SignatureImage.render(core.defaults),requests,decoded,surface,serialized:()=>serialized};
}

test('PNG embeds painted backgrounds before rasterization and deduplicates shared image URLs',async()=>{
  const h=paintedExportHarness(); const result=await h.render();
  assert.equal(result.width,2648);assert.equal(result.height,832);
  assert.deepEqual(h.requests,['https://example.com/sig/pattern-counterform-wide.png']);
  assert.equal(h.decoded.filter(value=>value.startsWith('data:image/png')).length,1);
  assert.equal(h.serialized(),true);
});

test('a background-only artwork is embedded, and unavailable paint blocks rasterization',async()=>{
  const good=paintedExportHarness({imageAlias:false});await good.render();assert.equal(good.requests.length,1);assert.equal(good.serialized(),true);
  const bad=paintedExportHarness({imageAlias:false,broken:true});
  await assert.rejects(bad.render(),/Could not load pattern-counterform-wide.png/);
  assert.equal(bad.serialized(),false);
});

test('PNG retains an opacity wash and embeds every URL layer once without altering artwork geometry',async()=>{
  const source='https://example.com/sig/pattern-counterform-wide.png',second='https://example.com/sig/dots.png?palette=red,blue';
  const wash='linear-gradient(rgba(243, 240, 234, 0.65), rgba(243, 240, 234, 0.65))';
  const h=paintedExportHarness({backgroundImage: wash+', url("'+source+'"), url("'+second+'"), url("'+source+'")'});
  await h.render();
  assert.deepEqual(h.requests,[source,second]);
  assert.equal(h.decoded.filter(value=>value.startsWith('data:image/png')).length,2);
  assert.ok(h.surface.style.backgroundImage.startsWith(wash+', '));
  assert.equal([...h.surface.style.backgroundImage.matchAll(/url\("data:image\/png;base64,/g)].length,3);
  assert.doesNotMatch(h.surface.style.backgroundImage,/https:/);
  assert.equal(h.serialized(),true);
});

test('custom artwork gradients render without fetching new assets',async()=>{
  const backgroundImage='linear-gradient(#cc3322, #cc3322), linear-gradient(90deg, rgba(20, 30, 40, 0.4) 0%, transparent 100%)';
  const h=paintedExportHarness({imageAlias:false,backgroundImage});
  await h.render();
  assert.deepEqual(h.requests,[]);
  assert.equal(h.surface.style.backgroundImage,backgroundImage);
  assert.equal(h.serialized(),true);
});

test('unsupported or incomplete background layers fail instead of producing an incomplete PNG',async()=>{
  for(const backgroundImage of [
    'image-set(url("https://example.com/paint.png") 1x)',
    'radial-gradient(red, blue)',
    'linear-gradient(red, blue),',
    'linear-gradient(red, blue',
    'linear-gradient(url("https://example.com/paint.png"), blue)',
    'linear-gradient(red, blue), image-set(url("https://example.com/paint.png") 1x)',
    'url("https://example.com/paint.png)',
  ]) {
    const h=paintedExportHarness({imageAlias:false,backgroundImage});
    await assert.rejects(h.render(),/artwork background could not be embedded/,backgroundImage);
    assert.equal(h.serialized(),false,backgroundImage);
    assert.deepEqual(h.requests,[],backgroundImage);
  }
  const broken=paintedExportHarness({imageAlias:false,broken:true,backgroundImage:'linear-gradient(#ffffff, #ffffff), url("https://example.com/paint.png")'});
  await assert.rejects(broken.render(),/Could not load paint.png/);
  assert.equal(broken.serialized(),false);
});
