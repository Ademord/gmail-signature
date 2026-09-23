(function () {
  'use strict';
  window.PortraitControls = Object.freeze({ attach(settings) {
    const container = document.getElementById('portrait-panel-content');
    if (!container) return;
    container.innerHTML = `<div class="portrait-current" id="portrait-current" hidden><img id="portrait-current-image" width="152" height="152" alt="Current signature photo" referrerpolicy="no-referrer"></div>
      <div class="portrait-upload"><label id="portrait-upload-label" class="button button-secondary" for="portrait-file">Choose a photo</label><input id="portrait-file" type="file" accept="image/jpeg,image/png,image/webp"><small id="portrait-upload-note">JPG, PNG or WebP · up to 12 MB. Photos stay on this device.</small></div>
      <div class="portrait-actions"><button type="button" class="text-button" id="portrait-edit" hidden>Adjust crop</button><button type="button" class="text-button" id="portrait-remove" hidden>Remove</button></div>
      <p id="portrait-notice" role="status" aria-live="polite"></p>
      <div id="portrait-workflow" hidden><div id="portrait-editor" hidden><div class="portrait-stage"><canvas id="portrait-canvas" width="384" height="384" tabindex="0" role="img" aria-label="Photo crop preview. Drag to reposition or use the position controls below."></canvas></div>
      <div class="portrait-tools"><button type="button" class="button button-secondary" id="portrait-smart">Smart crop</button><button type="button" class="text-button" id="portrait-center">Center</button></div>
      <div class="field" id="portrait-face-field" hidden><label for="portrait-face">Choose a face</label><select id="portrait-face"></select></div>
      <div class="field"><label for="portrait-zoom">Zoom <output id="portrait-zoom-value">1×</output></label><input id="portrait-zoom" type="range" min="1" max="6" step="0.01" value="1"></div>
      <div class="portrait-position"><div class="field"><label for="portrait-x">Horizontal position</label><input id="portrait-x" type="range" min="0" max="100" step="0.1" value="50"></div><div class="field"><label for="portrait-y">Vertical position</label><input id="portrait-y" type="range" min="0" max="100" step="0.1" value="50"></div></div>
      <div class="field"><label for="portrait-brightness">Brightness</label><input id="portrait-brightness" type="range" min="60" max="140" value="100"></div>
      <div class="portrait-toggles"><label><input type="checkbox" id="portrait-mirror"> Mirror</label><label><input type="checkbox" id="portrait-mono"> Black & white</label></div>
      </div><div class="portrait-crop-actions"><button type="button" class="button button-primary portrait-apply" id="portrait-apply" disabled>Use this crop</button><button type="button" class="button button-secondary" id="portrait-cancel">Cancel</button></div></div>
      <fieldset class="portrait-shapes"><legend>Shape</legend><select id="portrait-shape-control" aria-label="Photo shape" hidden><option value="circle">Circle</option><option value="rounded">Rounded</option><option value="square">Square</option></select>
        <div class="portrait-shape-choices" role="group" aria-label="Photo shape">
          <button type="button" id="portrait-shape-circle" class="design-choice portrait-shape-choice" aria-label="Circle" aria-pressed="true"><span class="portrait-shape-thumbnail" aria-hidden="true"><img id="portrait-shape-circle-image" width="48" height="48" alt="" referrerpolicy="no-referrer" hidden><span id="portrait-shape-circle-placeholder" class="portrait-shape-placeholder"><svg viewBox="0 0 24 24" width="32" height="32" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2" stroke="currentColor" stroke-width="1.4"/></svg></span></span><span class="portrait-shape-check" aria-hidden="true">✓</span><span class="design-caption"><strong>Circle</strong></span></button>
          <button type="button" id="portrait-shape-rounded" class="design-choice portrait-shape-choice" aria-label="Rounded" aria-pressed="false"><span class="portrait-shape-thumbnail" aria-hidden="true"><img id="portrait-shape-rounded-image" width="48" height="48" alt="" referrerpolicy="no-referrer" hidden><span id="portrait-shape-rounded-placeholder" class="portrait-shape-placeholder"><svg viewBox="0 0 24 24" width="32" height="32" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2" stroke="currentColor" stroke-width="1.4"/></svg></span></span><span class="portrait-shape-check" aria-hidden="true">✓</span><span class="design-caption"><strong>Rounded</strong></span></button>
          <button type="button" id="portrait-shape-square" class="design-choice portrait-shape-choice" aria-label="Square" aria-pressed="false"><span class="portrait-shape-thumbnail" aria-hidden="true"><img id="portrait-shape-square-image" width="48" height="48" alt="" referrerpolicy="no-referrer" hidden><span id="portrait-shape-square-placeholder" class="portrait-shape-placeholder"><svg viewBox="0 0 24 24" width="32" height="32" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2" stroke="currentColor" stroke-width="1.4"/></svg></span></span><span class="portrait-shape-check" aria-hidden="true">✓</span><span class="design-caption"><strong>Square</strong></span></button>
        </div>
      </fieldset>
      <div class="portrait-format"><div class="field"><label for="portrait-size-control">Photo size <output id="portrait-size-value">64 px</output></label><input id="portrait-size-control" type="range" min="40" max="96" step="1" value="64"><p class="field-note">Size changes keep your photo.</p></div></div>
      <section id="portrait-readiness" class="portrait-readiness" role="status" data-state="empty"><span id="portrait-readiness-icon" aria-hidden="true">○</span><div><strong id="portrait-readiness-title">No photo added</strong><p id="portrait-readiness-text">Your signature works without a photo.</p></div></section>
      <details id="portrait-link-disclosure" class="portrait-hosting editor-disclosure"><summary>Photo link</summary><div class="disclosure-content"><p id="portrait-hosting-status"></p><button type="button" class="button button-secondary" id="portrait-download" disabled>Download cropped photo</button><div class="field"><label for="portrait-public-url">Hosted photo URL</label><input id="portrait-public-url" type="url" placeholder="https://example.com/my-photo.jpg" autocomplete="off"></div><button type="button" class="button button-secondary" id="portrait-use-url">Use photo URL</button><small>Use a public HTTPS link to a square photo. For a local crop, download it and host it first. Your host must allow cross-origin reads for cropping and PNG export. The editor never uploads your photo.</small></div></details>`;
    const $ = id => document.getElementById(id), core = window.PortraitCore;
    let source = null, faces = [], request = 0, edited = 0, pointer = null, committedPhoto = '', pendingCrop = '', imageState = 'empty';
    const notice = (text, error = false) => { $('portrait-notice').textContent = text; $('portrait-notice').dataset.error = String(error); };
    const options = () => ({ zoom: Number($('portrait-zoom').value), x: Number($('portrait-x').value), y: Number($('portrait-y').value) });
    const adjustments = () => ({ brightness: Number($('portrait-brightness').value), monochrome: $('portrait-mono').checked, mirror: $('portrait-mirror').checked });
    function hostingStatus() {
      const draft = settings.getDraft();
      const url = draft.portraitData || draft.portraitUrl;
      $('portrait-current').hidden = !url || Boolean(pendingCrop && pendingCrop !== 'link');
      $('portrait-upload-label').textContent = url ? 'Change photo' : 'Choose a photo';
      $('portrait-upload-note').hidden = Boolean(url);
      $('portrait-remove').hidden = !url;
      $('portrait-edit').hidden = !draft.portraitData || Boolean(pendingCrop);
      $('portrait-workflow').hidden = !pendingCrop;
      $('portrait-download').disabled = Boolean(pendingCrop) || !draft.portraitData;
      $('portrait-hosting-status').textContent = pendingCrop === 'link' ? 'Checking your photo link. Your current signature photo stays unchanged.' : pendingCrop
        ? (pendingCrop === 'hosted' ? 'The original hosted photo is not square. ' : '') + (source ? 'Adjust it, then choose Use this crop. Download and host the finished square crop to use it in email.' : 'Opening your photo for cropping. Your current signature photo stays unchanged until you choose Use this crop.')
        : draft.portraitData ? 'Your saved crop is ready for PNG export. For a clickable email signature, download this crop, host it on your website or an image host, then paste its direct HTTPS URL here.'
        : draft.portraitUrl ? 'Your hosted square photo is ready for your copied email signature. PNG export also requires your image host to allow cross-origin reads.'
        : 'Paste a public HTTPS photo URL or choose a photo above. If the hosted photo is not square, you can crop it here before downloading and hosting the finished crop.';
      const status = pendingCrop
        ? ['pending', pendingCrop === 'link' ? 'Checking photo link' : 'Photo changes pending', 'Your current photo stays unchanged until you apply the replacement.']
        : !url ? ['empty', 'No photo added', 'Your signature works without a photo.']
        : imageState === 'failed' || imageState === 'non-square' ? ['unavailable', 'Photo needs attention', imageState === 'non-square' ? 'Open Photo link to crop this image square.' : 'This photo could not load. Change it or check Photo link.']
        : draft.portraitData ? ['local', 'Photo link needed', 'Your crop is saved here. Open Photo link to use it in email.']
        : imageState === 'loaded' ? ['ready', 'Ready for email', 'Your hosted photo is connected.']
        : ['checking', 'Checking photo', 'Checking that your hosted photo is available.'];
      $('portrait-readiness').dataset.state = status[0];
      $('portrait-readiness-title').textContent = status[1];
      $('portrait-readiness-text').textContent = status[2];
      $('portrait-readiness-icon').textContent = status[0] === 'ready' ? '✓' : status[0] === 'unavailable' ? '!' : '○';
      if (!pendingCrop && !draft.portraitData && draft.portraitUrl && imageState !== 'loaded') {
        $('portrait-hosting-status').textContent = status[2];
      }
    }
    function clearSource() {
      source = null; faces = []; pointer = null; pendingCrop = '';
      $('portrait-editor').hidden = true; $('portrait-face-field').hidden = true; $('portrait-apply').disabled = true;
      hostingStatus();
    }
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
    async function openPhoto(file, autoFrame = true, hosted = false) {
      const revision = ++request;
      clearSource(); pendingCrop = hosted ? 'hosted' : 'local'; hostingStatus();
      notice('Opening your photo…');
      try {
        const loaded = await core.load(file); if (revision !== request) return;
        source = loaded; faces = []; edited = autoFrame ? 0 : 1;
        $('portrait-editor').hidden = false; $('portrait-face-field').hidden = true; $('portrait-apply').disabled = false; hostingStatus();
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
      } catch (error) { if (revision === request) { clearSource(); notice(error.message, true); } }
    }
    $('portrait-file').addEventListener('change', () => {
      const file = $('portrait-file').files[0];
      $('portrait-file').value = '';
      if (file) return openPhoto(file);
    });
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
        clearSource();
        notice('Photo added. PNG exports and session backups include this crop.');
        $('portrait-file').focus();
      } catch (error) { notice(error.message, true); }
    });
    $('portrait-remove').addEventListener('click', () => {
      ++request; clearSource();
      settings.setPortrait({ portraitData: '', portraitUrl: '' }); notice('Photo removed. Undo brings it back.');
      $('portrait-file').focus();
    });
    $('portrait-cancel').addEventListener('click', () => {
      ++request; clearSource(); sync(); notice('Photo change canceled. Your previous photo is kept.');
      $('portrait-file').focus();
    });
    for (const shape of ['circle', 'rounded', 'square']) $('portrait-shape-' + shape).addEventListener('click', () => {
      try { apply({ portraitShape: shape }); } catch (error) { notice(error.message, true); sync(); }
    });
    $('portrait-shape-control').addEventListener('change', () => { try { apply({ portraitShape: $('portrait-shape-control').value }); } catch(error) { notice(error.message, true); sync(); } });
    $('portrait-size-control').addEventListener('change', () => { try { apply({ portraitSize: Number($('portrait-size-control').value) }); } catch(error) { notice(error.message, true); sync(); } });
    $('portrait-size-control').addEventListener('input', () => { $('portrait-size-value').textContent = $('portrait-size-control').value + ' px'; });
    $('portrait-use-url').addEventListener('click', async () => {
      const url = $('portrait-public-url').value.trim(), revision = ++request;
      clearSource();
      const candidate = { ...settings.getDraft(), portraitUrl: url, portraitData: '' };
      if (!url) { notice('Paste the direct HTTPS URL of your photo.', true); return; }
      const errors = window.SignatureCore.validate(candidate);
      if (errors.portraitUrl) { notice(errors.portraitUrl, true); return; }
      pendingCrop = 'link'; hostingStatus();
      notice('Checking the hosted photo…');
      try {
        const image = await new Promise((resolve, reject) => {
          const value = new Image(), timer = setTimeout(() => { value.src = ''; reject(new Error('The hosted photo took too long to load.')); }, 10000);
          value.onload = () => { clearTimeout(timer); resolve(value); };
          value.onerror = () => { clearTimeout(timer); reject(new Error('Could not load this photo. Use a direct, publicly readable image URL.')); };
          value.referrerPolicy = 'no-referrer'; value.src = url;
        });
        if (revision !== request) return;
        if (!(image.naturalWidth > 0 && image.naturalHeight > 0) || image.naturalWidth * image.naturalHeight > 60000000) throw new Error('Use a photo with valid dimensions below 60 megapixels.');
        if (image.naturalWidth !== image.naturalHeight) {
          pendingCrop = 'hosted'; hostingStatus();
          notice('Opening the hosted photo so you can make a square crop…');
          const file = await core.fetchHosted(url);
          if (revision !== request) return;
          await openPhoto(file, true, true);
          return;
        }
        const retryCurrent = settings.getDraft().portraitUrl === url && !settings.getDraft().portraitData;
        apply({ portraitUrl: url, portraitData: '' });
        // An explicit link retry may recover a failed request. Ordinary size,
        // shape and session syncs must still leave unchanged image sources alone.
        if (retryCurrent) {
          if (imageState !== 'loaded') {
            imageState = 'loading';
            $('portrait-current-image').src = url;
            for (const shape of ['circle', 'rounded', 'square']) $('portrait-shape-' + shape + '-image').src = url;
          }
          settings.refreshPortrait?.();
        }
        clearSource();
        notice('Hosted photo added. It will be included in your copied email signature.');
      } catch (error) { if (revision === request) { clearSource(); notice(error.message, true); } }
    });
    $('portrait-download').addEventListener('click', () => {
      const draft = settings.getDraft(); if (!draft.portraitData) return;
      const link = document.createElement('a'); link.href = draft.portraitData; link.download = 'signature-portrait.jpg'; link.click();
      notice('Cropped photo download requested. Host this square image to use it in email.');
    });
    function sync() {
      const draft = settings.getDraft(), url = draft.portraitData || draft.portraitUrl;
      const identity = JSON.stringify([draft.portraitData, draft.portraitUrl]);
      const changed = identity !== committedPhoto;
      if (changed) { ++request; committedPhoto = identity; imageState = url ? 'loading' : 'empty'; clearSource(); notice(''); }
      $('portrait-current').hidden = !url;
      if (url) {
        if ($('portrait-current-image').getAttribute('src') !== url) $('portrait-current-image').src = url;
      } else $('portrait-current-image').removeAttribute('src');
      for (const shape of ['circle', 'rounded', 'square']) {
        const image = $('portrait-shape-' + shape + '-image');
        image.hidden = !url;
        $('portrait-shape-' + shape + '-placeholder').hidden = Boolean(url);
        if (url) { if (image.getAttribute('src') !== url) image.src = url; }
        else image.removeAttribute('src');
        const radius = shape === 'circle' ? '50%' : shape === 'rounded' ? (12 / draft.portraitSize * 100) + '%' : '0';
        image.style.borderRadius = radius;
        $('portrait-shape-' + shape + '-placeholder').style.borderRadius = radius;
        $('portrait-shape-' + shape).setAttribute('aria-pressed', String(shape === draft.portraitShape));
      }
      $('portrait-download').disabled = !draft.portraitData;
      $('portrait-edit').hidden = !draft.portraitData;
      $('portrait-shape-control').value = draft.portraitShape;
      $('portrait-size-control').value = draft.portraitSize;
      $('portrait-size-value').textContent = draft.portraitSize + ' px';
      if (changed && document.activeElement !== $('portrait-public-url')) $('portrait-public-url').value = draft.portraitUrl;
      hostingStatus();
      const radius = draft.portraitShape === 'circle' ? '50%' : draft.portraitShape === 'rounded' ? (12 / draft.portraitSize * 100) + '%' : '0';
      $('portrait-current-image').style.borderRadius = radius; canvas.style.borderRadius = radius;
    }
    $('portrait-current-image').addEventListener('load', () => {
      const image = $('portrait-current-image');
      if (!(settings.getDraft().portraitData || settings.getDraft().portraitUrl)) return;
      imageState = image.naturalWidth > 0 && image.naturalWidth === image.naturalHeight ? 'loaded' : 'non-square';
      hostingStatus();
    });
    $('portrait-current-image').addEventListener('error', () => {
      if (!(settings.getDraft().portraitData || settings.getDraft().portraitUrl)) return;
      imageState = 'failed'; hostingStatus();
    });
    function revealLink() { $('portrait-link-disclosure').open = true; $('portrait-public-url').focus(); }
    sync(); return { sync, revealLink };
  }});
}());
