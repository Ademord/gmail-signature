# Portrait detector fixture

`astronaut.png` is the 512 × 512 RGB photograph of astronaut Eileen Collins from NASA's Great Images database, distributed by scikit-image v0.24.0.

- Exact source: https://raw.githubusercontent.com/scikit-image/scikit-image/v0.24.0/skimage/data/astronaut.png
- Attribution and public-domain status: https://scikit-image.org/docs/0.24.x/api/skimage.data.html#skimage.data.astronaut
- NASA collection source linked by scikit-image: https://flic.kr/p/r9qvLn
- Downloaded 2026-09-07 for the local detector regression. No user photo is used.

The test checks this fixture's SHA-256, decodes its RGB pixels with Node built-ins, runs the actual bundled worker, cascade and model, then verifies that the detection and smart crop cover the known face near x=175–280, y=60–175. This is a narrow positive fixture, not a broad accuracy benchmark or demographic evaluation.
