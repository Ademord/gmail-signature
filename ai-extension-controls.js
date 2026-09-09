(function () {
  'use strict';
  window.SignatureAIControls = Object.freeze({attach(settings) {
    const api = window.SignatureAI, core = window.SignatureCore;
    const dialog = document.createElement('dialog');
    dialog.id = 'ai-extension-dialog'; dialog.className = 'ai-dialog'; dialog.setAttribute('aria-labelledby','ai-title');
    dialog.innerHTML = `<div class="ai-dialog-header"><div><p class="ai-eyebrow">Use any AI</p><h2 id="ai-title">Fine-tune with your AI</h2></div><button type="button" class="text-button" id="ai-close" aria-label="Close AI helper">Close</button></div>
      <p class="ai-intro">Describe what you want, copy the prompt to your AI, then bring its JSON reply back here. Preview it before changing your signature.</p>
      <div class="ai-workflow"><section class="ai-request-section" aria-labelledby="ai-request-heading"><h3 id="ai-request-heading"><span>1</span> Make a request</h3>
      <label for="ai-brief">What would you like to change?</label><textarea id="ai-brief" rows="2" maxlength="2000" placeholder="A midnight galaxy with tiny gold stars…"></textarea>
      <div class="ai-ideas" id="ai-ideas" aria-label="Request ideas"></div>
      <label class="ai-private-option" id="ai-details-option" hidden><input id="ai-include-details" type="checkbox"> Include my current text and contact details in the prompt</label>
      <p class="ai-privacy" id="ai-privacy">The prompt includes style settings and your request. Your name, contact details and photo stay here. Nothing is sent automatically.</p>
      <details class="ai-prompt-details" open><summary>Read or select the prompt</summary><label class="ai-visually-hidden" for="ai-prompt">Prompt to copy to your AI</label><textarea id="ai-prompt" readonly rows="7" spellcheck="false"></textarea></details>
      <div class="ai-actions"><button type="button" class="button button-primary" id="ai-copy-prompt">Copy prompt</button><button type="button" class="text-button" id="ai-select-prompt">Select prompt</button></div>
      </section><section class="ai-response-section" aria-labelledby="ai-response-heading"><h3 id="ai-response-heading"><span>2</span> Bring back the result</h3>
      <label for="ai-response">Paste your AI’s JSON reply</label><textarea id="ai-response" rows="7" spellcheck="false" placeholder='{"format":"signature-ai","version":1,…}'></textarea>
      <div class="ai-actions"><button type="button" class="button button-secondary" id="ai-preview-response">Preview changes</button><button type="button" class="text-button" id="ai-example-response">Try an editable example</button></div><p class="ai-manual-note">You can also write or edit the JSON yourself. No AI account is required.</p>
      <p id="ai-notice" class="ai-notice" role="status" aria-live="polite">Only the selected section can change. You can undo an applied result.</p>
      <div id="ai-proposal" class="ai-proposal" hidden><h3 id="ai-proposal-name"></h3><div class="ai-preview-stage" id="ai-preview-stage"><div id="ai-preview-art" class="ai-preview-art"></div></div><ul id="ai-change-list"></ul><button type="button" class="button button-primary" id="ai-apply-response" disabled>Apply changes</button></div>
      </section></div>`;
    document.body.append(dialog);
    const $ = id => dialog.querySelector('#' + id);
    let section = 'colors', proposal = null, opener = null, generation = 0;
    const fieldLabels = {frontBackground:'Name background',backBackground:'Contact background',accent:'Accent color',design:'Design',customLayout:'Layout recipe',layout:'Arrangement',width:'Panel width',height:'Panel height',pattern:'Artwork',customPattern:'Custom artwork',artworkPlacement:'Artwork placement',artworkScale:'Artwork zoom',artworkPositionX:'Artwork horizontal position',artworkPositionY:'Artwork vertical position',motifScale:'Side artwork size',motifPositionX:'Side artwork horizontal position',motifPositionY:'Side artwork vertical position',websiteIcon:'Website icon',emailIcon:'Email icon',phoneIcon:'Phone icon',linkedinIcon:'LinkedIn icon',locationIcon:'Location icon',portraitShape:'Photo shape',portraitSize:'Photo size',nameLine1:'First name line',nameLine2:'Second name line',title:'Role',subtitle:'Subtitle',website:'Website',websiteLabel:'Website label',email:'Email',phone:'Phone',linkedin:'LinkedIn',location:'Location',tags:'Tags'};
    function describeChange(key,value) {
      if (key === 'customPattern') return 'New pixel artwork';
      if (key === 'customLayout') { const recipe = JSON.parse(value); return recipe.composition + ' · ' + recipe.font + ' type · ' + recipe.align + ' aligned'; }
      if (key === 'layout') return value === 'paired' ? 'Wide' : 'Tall';
      if (key === 'design') return (core.designs.find(item => item.id === value) || core.customDesign)?.name || value;
      if (key === 'pattern') return core.patterns[value] || value;
      if (key.endsWith('Icon')) return core.icons[value] || value;
      if (['width','height','portraitSize'].includes(key)) return value + ' px';
      if (key === 'portraitShape') return value === 'rounded' ? 'Rounded square' : value.charAt(0).toUpperCase() + value.slice(1);
      return String(value);
    }
    const ideas = {
      design:['A midnight galaxy with tiny gold stars','A pastel moon with a magical girl feel','An icy throne with blue crystal accents'],
      artwork:['Neural bloom at 70% size, centered in the side area','An abstract token weave in cobalt and warm coral','A quiet latent field with generous negative space'],
      layout:['A centered editorial layout','A compact technical layout','A bold serif name in a wide layout'],
      colors:['Midnight blue and pale gold','Lilac, blush and moonlight','Icy blue and deep indigo'],
      details:['Make the example role sound clear and concise','Give the example a friendly creative tone','Simplify the example subtitle and tags'],
      icons:['Simple matching symbols for every contact','Keep only the website and email icons','Remove icons for a quiet text-only style'],
      photo:['A small round photo','A generous rounded square','A crisp 56 pixel square']
    };
    function notice(message, error = false) { $('ai-notice').textContent = message; $('ai-notice').dataset.error = String(error); }
    function invalidate() { proposal = null; $('ai-proposal').hidden = true; $('ai-apply-response').disabled = true; ++generation; }
    function prompt() {
      invalidate();
      $('ai-prompt').value = api.buildPrompt(section, settings.getDraft(), {brief:$('ai-brief').value, includeDetails:$('ai-include-details').checked});
      $('ai-privacy').textContent = section === 'details' ? ($('ai-include-details').checked ? 'This prompt includes your current text and contact details plus your request. Read it before copying. Your photo stays here; nothing is sent automatically.' : 'This prompt uses fictional example text plus your request. To rewrite your own text, choose to include it above. Your photo stays here; nothing is sent automatically.') : 'The prompt includes style settings and your request. Your name, contact details, URLs and photo stay here. Nothing is sent automatically.';
    }
    function fitPreview() {
      if (!proposal || $('ai-proposal').hidden) return;
      const draft = proposal.candidate;
      const width = draft.layout === 'paired' ? draft.width * 2 + 20 : draft.width;
      const height = draft.layout === 'paired' ? draft.height : draft.height * 2 + 20;
      const scale = Math.min(1, Math.max(1,$('ai-preview-stage').clientWidth) / width);
      $('ai-preview-art').style.width = width + 'px'; $('ai-preview-art').style.height = height + 'px';
      $('ai-preview-art').style.transform = 'scale(' + scale + ')'; $('ai-preview-stage').style.height = height * scale + 'px';
    }
    function open(nextSection) {
      if (!Object.hasOwn(api.sections,nextSection)) { settings.onError('Choose an available AI section.'); return; }
      section = nextSection; opener = document.activeElement; $('ai-title').textContent = api.sections[section] + ' with your AI';
      $('ai-details-option').hidden = section !== 'details'; $('ai-include-details').checked = false;
      $('ai-brief').value = ''; $('ai-response').value = '';
      $('ai-ideas').replaceChildren(...ideas[section].map(text => { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click',() => { $('ai-brief').value = text; prompt(); }); return button; }));
      prompt(); notice('Only the selected section can change. You can undo an applied result.');
      if (!dialog.open) dialog.showModal(); $('ai-brief').focus();
    }
    const launch = event => { const target = event.target.closest('[data-ai-section]'); if (target) { event.preventDefault(); open(target.dataset.aiSection); } };
    document.addEventListener('click',launch);
    $('ai-close').addEventListener('click',() => dialog.close());
    dialog.addEventListener('close',() => { invalidate(); if (opener && opener.isConnected) opener.focus(); });
    $('ai-brief').addEventListener('input',prompt); $('ai-include-details').addEventListener('change',prompt);
    $('ai-response').addEventListener('input',() => { invalidate(); notice('Ready to check this response.'); });
    $('ai-example-response').addEventListener('click',() => { invalidate(); $('ai-response').value = api.exampleResponse(section); notice('Example added. Edit the JSON if you like, then preview it.'); $('ai-response').focus(); });
    $('ai-select-prompt').addEventListener('click',() => { $('ai-prompt').focus(); $('ai-prompt').select(); notice('Prompt selected. Copy it with your keyboard or selection menu.'); });
    $('ai-copy-prompt').addEventListener('click',async () => {
      const revision = generation, value = $('ai-prompt').value;
      let copied = false; try { copied = await settings.copy(value); } catch { /* Manual selection remains available. */ }
      if (revision !== generation || !dialog.open) return;
      notice(copied ? 'Prompt copied. Paste it into your AI, then bring its JSON reply back here.' : 'Clipboard access was blocked. The prompt is selected so you can copy it yourself.');
      if (!copied) { $('ai-prompt').focus(); $('ai-prompt').select(); }
    });
    $('ai-preview-response').addEventListener('click',() => {
      invalidate();
      try {
        const next = api.createProposal($('ai-response').value,{section,draft:settings.getDraft(),includeDetails:$('ai-include-details').checked});
        const html = core.render(next.candidate,{preview:true,assetBase:'./sig'});
        proposal = next; $('ai-preview-art').innerHTML = html; $('ai-proposal-name').textContent = next.name;
        $('ai-change-list').replaceChildren(...Object.keys(next.changes).map(key => { const item = document.createElement('li'); item.textContent = (fieldLabels[key] || key) + ': ' + describeChange(key,next.changes[key]); return item; }));
        $('ai-proposal').hidden = false; $('ai-apply-response').disabled = false; fitPreview(); notice('Preview ready. Your signature has not changed.');
        $('ai-proposal').scrollIntoView({block:'nearest',behavior:'instant'});
      } catch (error) { invalidate(); notice(error.message || 'The response could not be previewed.',true); }
    });
    $('ai-apply-response').addEventListener('click',() => {
      if (!proposal) return;
      try { const patch = api.applyProposal(proposal,settings.getDraft()); settings.applyChanges(patch); dialog.close(); }
      catch (error) { invalidate(); notice(error.message || 'The response could not be applied.',true); }
    });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fitPreview) : null;
    if (observer) observer.observe($('ai-preview-stage'));
    return Object.freeze({open,destroy() { document.removeEventListener('click',launch); if (observer) observer.disconnect(); dialog.remove(); }});
  }});
}());
