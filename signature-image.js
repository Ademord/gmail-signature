/* High-resolution image export from the same table markup used by email. */
(function (root, factory) {
  'use strict';
  var api = factory(root && root.SignatureCore);
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./signature-core.js'));
  if (root) root.SignatureImage = api;
}(typeof window !== 'undefined' ? window : null, function (core) {
  'use strict';
  function dimensions(values, scale) {
    if (![2, 4, 6].includes(scale)) throw new TypeError('Choose 2×, 4× or 6× resolution.');
    var errors = core.validate(values);
    if (Object.keys(errors).length) { var error = new TypeError('Check the highlighted signature field.'); error.errors = errors; throw error; }
    var v = core.normalize(values);
    var width = v.layout === 'stacked' ? v.width : v.width * 2 + 20;
    var height = v.layout === 'stacked' ? v.height * 2 + 20 : v.height;
    return { width: width * scale, height: height * scale, logicalWidth: width, logicalHeight: height };
  }
  function dataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('The image could not be read. Please try again.')); };
      reader.readAsDataURL(blob);
    });
  }
  function loadImage(url, signal) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), timer;
      function done(error) {
        clearTimeout(timer); img.onload = null; img.onerror = null;
        if (signal) signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(img);
      }
      function abort() { done(new DOMException('Image export cancelled.', 'AbortError')); }
      if (signal && signal.aborted) { abort(); return; }
      if (signal) signal.addEventListener('abort', abort, { once: true });
      img.onload = function () { done(); };
      img.onerror = function () { done(new Error('This browser could not render the image. Try Chrome or Edge.')); };
      timer = setTimeout(function () { done(new Error('Image rendering timed out. Please try again.')); }, 15000);
      img.src = url;
    });
  }
  async function render(values, options) {
    options = options || {};
    var scale = options.scale === undefined ? 4 : options.scale;
    var background = options.background || 'transparent';
    if (!['transparent', 'white'].includes(background)) throw new TypeError('Choose a transparent or white background.');
    var size = dimensions(values, scale), v = core.normalize(values);
    var element = document.createElement('div');
    element.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    element.setAttribute('style', 'margin:0;padding:0;font-style:normal;font-variant:normal;letter-spacing:normal;text-align:left;direction:ltr;');
    element.innerHTML = core.render(v, v.imageBase === core.defaults.imageBase ? { assetBase: './sig', allowPortraitData: true } : { allowPortraitData: true });
    // SVG images cannot fetch external resources. Embed each original PNG first.
    var assets = new Map();
    await Promise.all(Array.from(element.querySelectorAll('img')).map(async function (img) {
      var source = img.src;
      if (!assets.has(source)) assets.set(source, (async function () {
        var controller = new AbortController();
        var abort = function () { controller.abort(); };
        var timer = setTimeout(abort, 15000);
        if (options.signal) {
          if (options.signal.aborted) abort();
          else options.signal.addEventListener('abort', abort, { once: true });
        }
        try {
          var response = await fetch(source, { signal: controller.signal, credentials: 'omit', mode: 'cors' });
          if (!response.ok) throw new Error('Image not available');
          var blob = await response.blob();
          if (!/^image\/(png|jpeg|webp|gif)$/i.test(blob.type)) throw new Error('Unsupported image');
          if (blob.size > 5 * 1024 * 1024) throw new Error('Image is too large');
          var embedded = await dataURL(blob);
          await loadImage(embedded, options.signal);
          return embedded;
        } catch (error) {
          if (options.signal && options.signal.aborted) throw new DOMException('Image export cancelled.', 'AbortError');
          var assetName = source.indexOf('data:') === 0 ? 'the uploaded photo' : new URL(source).pathname.split('/').pop();
          throw new Error('Could not load ' + assetName + '. Check the image and that its host allows image export.');
        } finally {
          clearTimeout(timer);
          if (options.signal) options.signal.removeEventListener('abort', abort);
        }
      }()));
      img.setAttribute('src', await assets.get(source));
    }));
    if (document.fonts) await document.fonts.ready;
    var markup = new XMLSerializer().serializeToString(element);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size.width + '" height="' + size.height + '" viewBox="0 0 ' + size.logicalWidth + ' ' + size.logicalHeight + '"><foreignObject width="100%" height="100%">' + markup + '</foreignObject></svg>';
    var img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), options.signal);
    var canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    var context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas export is unavailable in this browser.');
    if (background === 'white') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, size.width, size.height); }
    context.drawImage(img, 0, 0, size.width, size.height);
    var png = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('The PNG could not be created. Try a lower resolution.')); }, 'image/png');
    });
    return { blob: png, dataURL: await dataURL(png), width: size.width, height: size.height };
  }
  function attach(settings) {
    var $ = function (id) { return document.getElementById(id); };
    var dialog = $('image-dialog'), current = null, snapshot = null, revision = 0, controller = null;
    async function refresh() {
      var request = ++revision;
      if (controller) controller.abort();
      controller = new AbortController(); current = null;
      $('image-download').disabled = true; $('image-result').hidden = true;
      $('image-status').textContent = 'Preparing image…'; $('image-status').dataset.error = 'false';
      var scale = Number($('image-scale').value), size = dimensions(snapshot, scale);
      $('image-dimensions').textContent = size.width + ' × ' + size.height + ' px';
      try {
        var result = await render(snapshot, { scale: scale, background: $('image-background').value, signal: controller.signal });
        if (request !== revision || !dialog.open) return;
        current = result; $('image-result').src = result.dataURL; $('image-result').hidden = false;
        $('image-status').textContent = 'PNG · ' + Math.max(1, Math.round(result.blob.size / 1024)) + ' KB';
        $('image-download').disabled = false;
      } catch (error) {
        if (request !== revision || !dialog.open) return;
        $('image-status').textContent = error.message || 'Image export failed. Please try again.';
        $('image-status').dataset.error = 'true';
      }
    }
    $('export-image').addEventListener('click', function () {
      if (!settings.validate()) return;
      snapshot = core.normalize(settings.getDraft()); dialog.showModal(); refresh();
    });
    $('image-scale').addEventListener('change', refresh);
    $('image-background').addEventListener('change', refresh);
    $('image-retry').addEventListener('click', refresh);
    $('close-image').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { ++revision; if (controller) controller.abort(); current = null; $('image-result').removeAttribute('src'); });
    $('image-download').addEventListener('click', function () {
      if (!current) return;
      var url = URL.createObjectURL(current.blob), link = document.createElement('a');
      link.href = url; link.download = 'signature-' + current.width + 'x' + current.height + '.png';
      document.body.append(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      $('image-status').textContent = 'PNG download requested. You can also right-click the preview to save it.';
    });
  }
  return Object.freeze({ dimensions: dimensions, render: render, attach: attach });
}));
