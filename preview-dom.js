/* Keep image requests and decoded photos alive while the editor redraws. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SignaturePreview = api;
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  function update(target, markup) {
    const images = [...target.querySelectorAll('img')];
    if (!images.length) { target.innerHTML = markup; return; }
    // A template keeps new image requests inert until their nodes are mounted.
    const template = target.ownerDocument.createElement('template');
    template.innerHTML = markup;
    // Reuse nodes only inside their current document, not the template's inert
    // document: cross-document adoption can restart an active image request.
    const fragment = target.ownerDocument.importNode(template.content, true);
    const available = new Map();
    for (const image of images) {
      // Retry failed loads; preserve both loaded and still-pending requests.
      if (image.complete && !image.naturalWidth) continue;
      const src = image.getAttribute('src');
      if (!available.has(src)) available.set(src, []);
      available.get(src).push(image);
    }
    for (const replacement of fragment.querySelectorAll('img')) {
      const previous = available.get(replacement.getAttribute('src'))?.shift();
      if (!previous) continue;
      for (const attribute of [...previous.attributes]) {
        if (!replacement.hasAttribute(attribute.name)) previous.removeAttribute(attribute.name);
      }
      for (const { name, value } of replacement.attributes) {
        if (previous.getAttribute(name) !== value) previous.setAttribute(name, value);
      }
      replacement.replaceWith(previous);
    }
    target.replaceChildren(fragment);
  }
  return Object.freeze({ update });
}));
