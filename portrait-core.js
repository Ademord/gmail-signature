/* Pure crop geometry plus local image preparation. No upload endpoint. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PortraitCore = api;
}(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const MAX_FILE_BYTES = 12 * 1024 * 1024;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function dimensions(width, height) {
    if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new TypeError('The photo has invalid dimensions.');
  }
  function crop(width, height, options = {}) {
    dimensions(width, height);
    const zoom = clamp(Number.isFinite(options.zoom) ? options.zoom : 1, 1, 6);
    const size = Math.min(width, height) / zoom;
    return { x: (width - size) * clamp(Number.isFinite(options.x) ? options.x : 50, 0, 100) / 100,
      y: (height - size) * clamp(Number.isFinite(options.y) ? options.y : 50, 0, 100) / 100, size };
  }
  function frame(width, height, face) {
    dimensions(width, height);
    if (!face || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(face[key])) || face.width <= 0 || face.height <= 0) return { zoom: 1, x: 50, y: 50 };
    const size = clamp(Math.max(face.width, face.height) * 2.25, Math.min(width, height) / 6, Math.min(width, height));
    const left = clamp(face.x + face.width / 2 - size / 2, 0, width - size);
    const top = clamp(face.y + face.height * 0.6 - size / 2, 0, height - size);
    return { zoom: Math.min(width, height) / size, x: width === size ? 50 : left / (width - size) * 100,
      y: height === size ? 50 : top / (height - size) * 100 };
  }
  function checkFile(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new TypeError('Choose a JPG, PNG, or WebP photo.');
    if (!Number.isFinite(file.size) || file.size < 1 || file.size > MAX_FILE_BYTES) throw new TypeError('Choose a photo smaller than 12 MB.');
  }
  async function load(file) {
    checkFile(file);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const value = new Image();
        const timer = setTimeout(() => { value.src = ''; reject(new Error('The photo took too long to open. Try a smaller image.')); }, 12000);
        value.onload = () => { clearTimeout(timer); resolve(value); };
        value.onerror = () => { clearTimeout(timer); reject(new Error('This image could not be opened. Try a JPG or PNG.')); };
        value.src = url;
      });
      if (img.naturalWidth * img.naturalHeight > 60000000) throw new Error('This photo is too large. Resize it below 60 megapixels.');
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  }
  async function detect(source) {
    const scale = Math.min(1, 640 / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < pixels.length; i++) pixels[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
    return new Promise((resolve, reject) => {
      const worker = new Worker('portrait-worker.js');
      const finish = (error, faces) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(faces); };
      const timer = setTimeout(() => finish(new Error('Face detection timed out. You can adjust the crop yourself.')), 12000);
      worker.onerror = () => finish(new Error('Face detection is unavailable. You can adjust the crop yourself.'));
      worker.onmessage = event => event.data.error ? finish(new Error(event.data.error)) : finish(null, event.data.faces.map(face => ({
        x: face.x / scale, y: face.y / scale, width: face.width / scale, height: face.height / scale, score: face.score
      })));
      worker.postMessage({ pixels, width: canvas.width, height: canvas.height }, [pixels.buffer]);
    });
  }
  function draw(source, target, options, adjustments = {}) {
    const area = crop(source.width, source.height, options);
    const context = target.getContext('2d');
    context.clearRect(0, 0, target.width, target.height);
    context.save();
    context.filter = `brightness(${clamp(Number(adjustments.brightness) || 100, 60, 140)}%) grayscale(${adjustments.monochrome ? 1 : 0})`;
    if (adjustments.mirror) { context.translate(target.width, 0); context.scale(-1, 1); }
    context.drawImage(source, area.x, area.y, area.size, area.size, 0, 0, target.width, target.height);
    context.restore();
  }
  function encode(source, options, adjustments) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 384;
    draw(source, canvas, options, adjustments);
    // JPEG gives portable, bounded session files and strips original metadata.
    return canvas.toDataURL('image/jpeg', 0.88);
  }
  return Object.freeze({ crop, frame, checkFile, load, detect, draw, encode, MAX_FILE_BYTES });
}));
