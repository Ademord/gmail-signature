(function () {
  'use strict';
  window.SignatureLibraryControls = Object.freeze({attach(settings = {}) {
    const dialog = document.getElementById('design-library-dialog');
    if (!dialog) return;
    const tabs = Array.from(dialog.querySelectorAll('[data-library-tab]'));
    const panels = Array.from(dialog.querySelectorAll('[data-library-panel]'));
    const content = dialog.querySelector('.library-content');
    let opener = null, active = 'layouts', frame = 0;

    function notifyVisible() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (dialog.open && typeof settings.onOpen === 'function') settings.onOpen(active);
      });
    }
    function select(name, focus = false) {
      if (!tabs.some(tab => tab.dataset.libraryTab === name)) name = 'layouts';
      active = name;
      for (const tab of tabs) {
        const selected = tab.dataset.libraryTab === active;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
      }
      for (const panel of panels) panel.hidden = panel.dataset.libraryPanel !== active;
      content.scrollTop = 0;
      notifyVisible();
    }
    function open(name = 'layouts') {
      opener = document.activeElement;
      if (!dialog.open) dialog.showModal();
      select(name, true);
    }
    function close() { if (dialog.open) dialog.close(); }
    function launch(event) {
      const button = event.target.closest('[data-open-library]');
      if (!button) return;
      event.preventDefault();
      open(button.dataset.openLibrary);
    }
    function click(event) {
      const tab = event.target.closest('[data-library-tab]');
      if (tab) { select(tab.dataset.libraryTab, true); return; }
      // Existing app handlers run on the selected button before this bubbles.
      if (event.target.closest('.design-choice,.pattern-choice,[data-ai-section]')) close();
    }
    function keydown(event) {
      const tab = event.target.closest('[data-library-tab]');
      if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[next].dataset.libraryTab, true);
    }
    function closed() {
      cancelAnimationFrame(frame);
      // A Custom artwork selection can open the AI dialog before this closes.
      if (!document.querySelector('dialog[open]') && opener?.isConnected) opener.focus();
    }
    document.addEventListener('click', launch);
    dialog.addEventListener('click', click);
    dialog.addEventListener('keydown', keydown);
    dialog.addEventListener('close', closed);
    document.getElementById('close-design-library').addEventListener('click', close);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (dialog.open) notifyVisible();
    }) : null;
    if (observer) observer.observe(dialog);
    return Object.freeze({open, close, destroy() {
      cancelAnimationFrame(frame); document.removeEventListener('click', launch);
      dialog.removeEventListener('click', click); dialog.removeEventListener('keydown', keydown);
      dialog.removeEventListener('close', closed);
      document.getElementById('close-design-library').removeEventListener('click', close);
      if (observer) observer.disconnect();
    }});
  }});
}());
