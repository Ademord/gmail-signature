/* The bundled detector sees only downsampled pixels, on this device. */
const assetVersion = self.location?.search || '';
importScripts('vendor/pico.js' + assetVersion);
let classifier;
self.onmessage = async function (event) {
  const { pixels, width, height } = event.data;
  try {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 640 || height > 640 || pixels.length !== width * height) throw new Error('Invalid detection image.');
    if (!classifier) {
      const response = await fetch('vendor/facefinder.bin' + assetVersion, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Detector model unavailable.');
      const bytes = new Int8Array(await response.arrayBuffer());
      if (bytes.length !== 239632) throw new Error('Detector model is incomplete.');
      classifier = pico.unpack_cascade(bytes);
    }
    const detections = pico.run_cascade({ pixels, nrows: height, ncols: width, ldim: width }, classifier,
      { shiftfactor: 0.1, minsize: 32, maxsize: Math.min(width, height), scalefactor: 1.15 });
    const faces = pico.cluster_detections(detections, 0.2).filter(face => face[3] >= 5).map(face => ({
      x: face[1] - face[2] / 2, y: face[0] - face[2] / 2, width: face[2], height: face[2], score: face[3]
    })).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 12);
    self.postMessage({ faces });
  } catch (error) { self.postMessage({ error: error.message }); }
};
