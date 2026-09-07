# Local face detector

The portrait worker bundles Pico so uploaded photos never need to be sent to a recognition service. It detects face regions, not identities. The largest detected face is selected initially; users can choose another or adjust manually. Obscured or side-on faces may not be found.

Files retrieved from the authors' official repositories on 2026-09-07:

- `pico.js`: https://github.com/nenadmarkus/picojs/blob/master/pico.js — SHA256 `785B981CC79E5FA3F7557DC3FA7773629D7529994D7627DE41B77D8687649309`.
- `facefinder.bin`: https://github.com/nenadmarkus/pico/blob/master/rnt/cascades/facefinder — SHA256 `D8014993E7298C7B1865D1F8B855D6DBF4EC5C808BF879E2091AB6837ABF90CD`.
- `PICO-LICENSE.txt`: full MIT license from https://github.com/nenadmarkus/pico/blob/master/LICENSE. The JavaScript source also declares the MIT license in its header.

The bundled source and cascade are unmodified. Publication includes their license. There are no CDN requests during face detection. The worker loads its model from this site's own static files, receives grayscale downsampled pixels, and is terminated after returning results or timing out.

Algorithm reference: N. Markus, M. Frljak, I. S. Pandzic, J. Ahlberg and R. Forchheimer, [Object Detection with Pixel Intensity Comparisons Organized in Decision Trees](https://arxiv.org/abs/1305.4537).
