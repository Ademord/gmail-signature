(function () {
  'use strict';
  window.PortraitControls = Object.freeze({ attach(settings) {
    const container = document.getElementById('portrait-panel-content');
    if (!container) return;
    container.innerHTML = `<div class="portrait-intro"><h3>Your photo</h3><p>Upload a photo for automatic face cropping, then adjust it yourself. The photo stays on this device.</p></div>
      <div class="portrait-upload"><label class="button button-secondary" for="portrait-file">Choose a photo</label><input id="portrait-file" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · up to 12 MB</small></div>
      <p id="portrait-notice" role="status" aria-live="polite">A photo is optional. Your signature works without one.</p>
      <div id="portrait-editor" hidden><div class="portrait-stage"><canvas id="portrait-canvas" width="384" height="384" tabindex="0" role="img" aria-label="Photo crop preview. Drag to reposition or use the position controls below."></canvas></div>
      <div class="portrait-tools"><button type="button" class="button button-secondary" id="portrait-smart">Smart crop</button><button type="button" class="text-button" id="portrait-center">Center</button></div>
      <div class="field" id="portrait-face-field" hidden><label for="portrait-face">Choose a face</label><select id="portrait-face"></select></div>
      <div class="field"><label for="portrait-zoom">Zoom <output id="portrait-zoom-value">1×</output></label><input id="portrait-zoom" type="range" min="1" max="6" step="0.01" value="1"></div>
      <div class="portrait-position"><div class="field"><label for="portrait-x">Horizontal position</label><input id="portrait-x" type="range" min="0" max="100" step="0.1" value="50"></div><div class="field"><label for="portrait-y">Vertical position</label><input id="portrait-y" type="range" min="0" max="100" step="0.1" value="50"></div></div>
      <div class="field"><label for="portrait-brightness">Brightness</label><input id="portrait-brightness" type="range" min="60" max="140" value="100"></div>
      <div class="portrait-toggles"><label><input type="checkbox" id="portrait-mirror"> Mirror</label><label><input type="checkbox" id="portrait-mono"> Black & white</label></div>
      <button type="button" class="button button-primary portrait-apply" id="portrait-apply">Use this crop</button></div>
      <div class="portrait-current" id="portrait-current" hidden><img id="portrait-current-image" width="64" height="64" alt="Current signature photo"><span>Current photo</span><button type="button" class="text-button" id="portrait-edit">Adjust</button><button type="button" class="text-button" id="portrait-remove">Remove</button></div>
      <div class="portrait-format"><div class="field"><label for="portrait-shape-control">Shape</label><select id="portrait-shape-control"><option value="circle">Circle</option><option value="rounded">Rounded square</option><option value="square">Square</option></select></div><div class="field"><label for="portrait-size-control">Size <output id="portrait-size-value">64 px</output></label><input id="portrait-size-control" type="range" min="40" max="96" step="1" value="64"></div></div>
      <details class="portrait-hosting"><summary>Use your photo in email</summary><p>Your upload is ready for PNG export. For a clickable email signature, download the square crop, host it on your website or an image host, then paste its direct HTTPS image URL here.</p><button type="button" class="button button-secondary" id="portrait-download" disabled>Download cropped photo</button><div class="field"><label for="portrait-public-url">Hosted cropped photo URL</label><input id="portrait-public-url" type="url" placeholder="https://example.com/my-photo.jpg" autocomplete="off"></div><button type="button" class="button button-secondary" id="portrait-use-url">Use photo URL</button><small>The hosted image must be square. Your image host must allow cross-origin reads for PNG export. The editor never uploads your photo.</small></details>`;
    const $ = id => document.getElementById(id), core = window.PortraitCore;
    let source = null, faces = [], request = 0, edited = 0, pointer = null, committedPhoto = '';
    const notice = (text, error = false) => { $('portrait-notice').textContent = text; $('portrait-notice').dataset.error = String(error); };
    const options = () => ({ zoom: Number($('portrait-zoom').value), x: Number($('portrait-x').value), y: Number($('portrait-y').value) });
    const adjustments = () => ({ brightness: Number($('portrait-brightness').value), monochrome: $('portrait-mono').checked, mirror: $('portrait-mirror').checked });
    function apply(patch) {
      const errors = window.SignatureCore.validate({ ...settings.getDraft(), ...patch });
      const first = Object.keys(errors)[0];
      if (first) throw new Error(errors[first]);
      if (Object.hasOwn(patch, 'portraitData') || Object.hasOwn(patch, 'portraitUrl')) ++request;
      settings.setPortrait(patch);
    }
    function paint() {
      if (!source) return;
      core.draw(source, $('portrait-canvas'), options(), adjustments());
      $('portrait-zoom-value').textContent = Number($('portrait-zoom').value).toFixed(2) + '×';
    }
    function position(values) { for (const key of ['zoom','x','y']) $('portrait-' + key).value = values[key]; paint(); }
    function smart() {
      if (!source) return;
      const face = faces[Number($('portrait-face').value) || 0];
      position(core.frame(source.width, source.height, face));
      notice(face ? 'Face framed with room for your head and shoulders. Adjust it until it feels right.' : 'No clear face found. Start from the center and adjust the crop.');
    }
    async function openPhoto(file, autoFrame = true) {
      const revision = ++request;
      notice('Opening your photo…');
      try {
        const loaded = await core.load(file); if (revision !== request) return;
        source = loaded; faces = []; edited = autoFrame ? 0 : 1;
        $('portrait-editor').hidden = false; $('portrait-face-field').hidden = true;
        $('portrait-brightness').value = 100; $('portrait-mono').checked = false; $('portrait-mirror').checked = false;
        position({ zoom: 1, x: 50, y: 50 });
        notice('Looking for faces on this device…');
        try {
          const result = await core.detect(source); if (revision !== request) return;
          faces = result;
          $('portrait-face').replaceChildren(...faces.map((face, index) => { const option = document.createElement('option'); option.value = index; option.textContent = 'Face ' + (index + 1) + (index === 0 ? ' · largest' : ''); return option; }));
          $('portrait-face-field').hidden = faces.length < 2;
          if (!edited) smart(); else notice(!autoFrame ? 'Adjusting your saved crop. Upload the original photo if you want a wider crop.' : faces.length ? 'Face detection finished. Use Smart crop to try it, or keep your adjustments.' : 'No clear face found. Your manual crop is ready.');
        } catch { if (revision === request) notice('Face detection is unavailable. Use the crop controls to position your photo.'); }
      } catch (error) { if (revision === request) notice(error.message, true); }
      finally { if (revision === request) $('portrait-file').value = ''; }
    }
    $('portrait-file').addEventListener('change', () => { const file = $('portrait-file').files[0]; if (file) return openPhoto(file); });
    $('portrait-edit').addEventListener('click', () => {
      const data = settings.getDraft().portraitData; if (!data) return;
      try {
        const [prefix,encoded] = data.split(','), bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
        return openPhoto(new Blob([bytes], {type:prefix.slice(5, prefix.indexOf(';'))}), false);
      } catch { notice('This saved crop could not be opened. Upload the original photo to adjust it.', true); }
    });
    for (const id of ['portrait-zoom','portrait-x','portrait-y','portrait-brightness','portrait-mono','portrait-mirror']) $(id).addEventListener('input', () => { edited++; paint(); });
    $('portrait-smart').addEventListener('click', () => { edited++; smart(); });
    $('portrait-face').addEventListener('change', () => { edited++; smart(); });
    $('portrait-center').addEventListener('click', () => { edited++; position({ zoom: 1, x: 50, y: 50 }); });
    const canvas = $('portrait-canvas');
    canvas.addEventListener('pointerdown', event => { if (!source) return; pointer = { x: event.clientX, y: event.clientY, values: options() }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!pointer || !source) return;
      const area = core.crop(source.width, source.height, pointer.values), bounds = canvas.getBoundingClientRect();
      const mirror = $('portrait-mirror').checked ? -1 : 1;
      position({ zoom: pointer.values.zoom,
        x: pointer.values.x - mirror * (event.clientX - pointer.x) / bounds.width * area.size / Math.max(1, source.width - area.size) * 100,
        y: pointer.values.y - (event.clientY - pointer.y) / bounds.height * area.size / Math.max(1, source.height - area.size) * 100 });
      edited++;
    });
    canvas.addEventListener('pointerup', () => { pointer = null; });
    canvas.addEventListener('pointercancel', () => { pointer = null; });
    canvas.addEventListener('keydown', event => {
      if (!source || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const values = options();
      values.x += event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0;
      values.y += event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0;
      position(values); edited++;
    });
    $('portrait-apply').addEventListener('click', () => {
      if (!source) return;
      try {
        apply({ portraitData: core.encode(source, options(), adjustments()), portraitUrl: '' });
        notice('Photo added. PNG exports and session backups include this crop.');
      } catch (error) { notice(error.message, true); }
    });
    $('portrait-remove').addEventListener('click', () => {
      ++request; source = null; faces = []; $('portrait-editor').hidden = true;
      settings.setPortrait({ portraitData: '', portraitUrl: '' }); notice('Photo removed. Undo brings it back.');
    });
    $('portrait-shape-control').addEventListener('change', () => { try { apply({ portraitShape: $('portrait-shape-control').value }); } catch(error) { notice(error.message, true); sync(); } });
    $('portrait-size-control').addEventListener('change', () => { try { apply({ portraitSize: Number($('portrait-size-control').value) }); } catch(error) { notice(error.message, true); sync(); } });
    $('portrait-size-control').addEventListener('input', () => { $('portrait-size-value').textContent = $('portrait-size-control').value + ' px'; });
    $('portrait-use-url').addEventListener('click', async () => {
      const url = $('portrait-public-url').value.trim(), revision = ++request;
      const candidate = { ...settings.getDraft(), portraitUrl: url, portraitData: '' };
      if (!url) { notice('Paste the direct HTTPS URL of your square photo.', true); return; }
      const errors = window.SignatureCore.validate(candidate);
      if (errors.portraitUrl) { notice(errors.portraitUrl, true); return; }
      notice('Checking the hosted photo…');
      try {
        const image = await new Promise((resolve, reject) => {
          const value = new Image(), timer = setTimeout(() => { value.src = ''; reject(new Error('The hosted photo took too long to load.')); }, 10000);
          value.onload = () => { clearTimeout(timer); resolve(value); };
          value.onerror = () => { clearTimeout(timer); reject(new Error('Could not load this photo. Use a direct, publicly readable image URL.')); };
          value.referrerPolicy = 'no-referrer'; value.src = url;
        });
        if (revision !== request) return;
        if (image.naturalWidth !== image.naturalHeight) throw new Error('Use a square image so the email photo matches the preview. Download and host your cropped photo first.');
        apply({ portraitUrl: url, portraitData: '' });
        notice('Hosted photo added. It will be included in your copied email signature.');
      } catch (error) { if (revision === request) notice(error.message, true); }
    });
    $('portrait-download').addEventListener('click', () => {
      const draft = settings.getDraft(); if (!draft.portraitData) return;
      const link = document.createElement('a'); link.href = draft.portraitData; link.download = 'signature-portrait.jpg'; link.click();
      notice('Cropped photo download requested. Host this square image to use it in email.');
    });
    function sync() {
      const draft = settings.getDraft(), url = draft.portraitData || draft.portraitUrl;
      const identity = JSON.stringify([draft.portraitData, draft.portraitUrl]);
      if (identity !== committedPhoto) { ++request; committedPhoto = identity; }
      $('portrait-current').hidden = !url;
      if (url) $('portrait-current-image').src = url; else $('portrait-current-image').removeAttribute('src');
      $('portrait-download').disabled = !draft.portraitData;
      $('portrait-edit').hidden = !draft.portraitData;
      $('portrait-shape-control').value = draft.portraitShape;
      $('portrait-size-control').value = draft.portraitSize;
      $('portrait-size-value').textContent = draft.portraitSize + ' px';
      if (document.activeElement !== $('portrait-public-url')) $('portrait-public-url').value = draft.portraitUrl;
      const radius = draft.portraitShape === 'circle' ? '50%' : draft.portraitShape === 'rounded' ? '18%' : '0';
      $('portrait-current-image').style.borderRadius = radius; canvas.style.borderRadius = radius;
    }
    sync(); return { sync };
  }});
}());
