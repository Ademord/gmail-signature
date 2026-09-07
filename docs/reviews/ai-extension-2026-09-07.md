# Independent AI extension review — 7 September 2026

Reviewer: extension_critic (eighth agent), independent of the AI and renderer builders.

**Final scoped verdict: SHIP for the reviewed local AI extension, selective-import contract, and revised design-library UI. Overall release: not judged here.** The final follow-up below distinguishes this critic's direct browser work from the lead's later interaction evidence. This review does not claim an external AI conversation, Gmail delivery, hosted deployment, or CI success.

## Evidence

`node --test tests/ai-extension-integration.test.mjs` passes **7 tests, 0 failures, 0 skips**. These are independent Node contract and integration checks using synthetic details and a real square PNG fixture. The supported sections and four themed designs are explicitly listed in the tests rather than derived entirely from implementation metadata.

- Design, artwork, layout, colors, details, icons, and photo prompts omit stored identity, contact information, image host, photo URL, and embedded photo bytes by default. Details include current identity only with the explicit option. A details opt-in cannot disclose personal data through a different section. A person's own request text is intentionally included in the copied prompt.
- Every section's editable example validates and renders. A details response cannot change identity without opt-in and cannot change the photo with opt-in.
- Invalid JSON, surrounding prose, wrong versions/formats/sections, empty changes, unknown properties, prototype keys, markup, unsupported colors/icons, wrong numeric types, and out-of-range dimensions are rejected. Standard fenced JSON is accepted. No submitted code is evaluated.
- Custom artwork and layout preserve all existing identity, URL, and portrait fields through proposal creation, apply, undo, redo, and a session round trip. Email output uses inline tables and public HTTPS images, remains below 10,000 characters, and contains no script, style block, SVG, canvas, iframe, embedded photo data, positioned layer, transform, or object-fit dependency.
- Unsupported recipe keys, unequal rows, invalid palette indexes, excess cells, raw recipe strings, unsupported fonts/alignment, and a noisy checkerboard exceeding the email budget are rejected. Recipes must explicitly opt into their corresponding custom mode.
- Frozen proposals cannot be edited after preview; forged/serialized proposals cannot apply. Editing identity, photo, dimensions, or colors after preview makes that proposal stale. Reordering the draft's keys alone does not make it stale.
- Galaxy, Starlight, Moonlight, and Frost Crown independently match their expected compositions, preserve portrait bytes and public portrait URL in session data, and reference their own 304 × 728 PNG artwork in wide and tall email output.

Mutation evidence: an in-memory copy of the actual AI module with its stale-preview guard disabled fails the independent stale-proposal expectation. Production files were not changed by the mutation check.

## Actual Codex browser journeys

Reviewed `http://localhost:4196/` in an isolated Codex browser tab using fictional Avery Morgan data. The alternate local origin keeps this review's draft separate from the lead's `127.0.0.1` draft. No Edge interaction or AI service was used.

1. Opened Colors → Fine-tune with AI → editable example → Preview changes. The proposed colors appeared separately while the current draft remained unchanged. Applied the proposal; the real color field became `#E6EDF6`. Undo restored `#F3F0EA`; redo restored `#E6EDF6`.
2. Copied the artwork prompt through the real button. The dialog reported success and the browser clipboard contained a 1,971-character prompt. Manual selection remains a separate visible action.
3. Submitted a custom-artwork object containing an `html` property and script text. Preview rejected it with “Use only the required recipe fields: palette, rows.” Replaced it with the editable example, previewed successfully, and applied it.
4. Exported the real session, loaded the example, imported the exported JSON, and restored. The pattern selector again read `custom`, and the export retained the exact custom recipe.
5. Opened Details AI. The prompt did not contain Avery by default; checking “Include my current text and contact details” added Avery. Opening the layout section afterwards returned to the style-only prompt.
6. Opened Layout AI → editable example → Preview changes. The custom centered serif editorial composition rendered in the proposal with the existing custom artwork and contact details.

At a measured **390 × 844 viewport**, the dialog's `scrollWidth` and `clientWidth` both measured **349 px**, so there was no horizontal overflow. Its proposal artwork scaled to **315 px**, inside the preview's approximately **315.3 px** width. Desktop and mobile UI were visually inspected; this is not a blind comparison. The established HubSpot comparison is covered by the separate studio critic, not reinterpreted as an AI extension feature comparison.

## Follow-up

The largest observed usability gap was that pressing Preview changes on mobile left the proposal below the visible viewport (top around 865 px); only the success text was visible. The builder fixed this by scrolling the proposal into view without animation and replaced internal changed-field keys with readable labels. A fresh browser reload confirmed the fix at 390 × 844: the proposal was fully visible from y≈538 to y≈831, its Apply changes button was visible from y≈791 to y≈831, and the change list read “Design: Custom layout” and “Layout recipe: editorial · serif type · center aligned.” This gap is closed.

The newly requested gallery simplification and selectable information/design imports are subsequent changes and are outside this initial verdict. Recheck the final dialog entry points and preview visibility after those changes. The pure AI schema remains bounded to structured layout variations and pixel artwork; it does not promise arbitrary executable layout extensions.

## Follow-up: selective imports and design library

The independently reviewed import contract passes. The extension test file now contains **9 passing tests**; running it together with the five selective-import tests gives **14 passes, 0 failures, 0 skips**.

The new independent fixture explicitly enumerates all 13 information fields and all 18 design fields. Every incoming field differs from its current counterpart, including embedded photo bytes, hosted photo URL, image host, custom recipes, icons, and photo shape/size. Information only, design only, and both copy exactly their selected fields and preserve every unselected field. Selecting neither group is rejected. Inputs are not mutated. Information only preserves current UI and themes. Design import uses incoming UI and merges with existing themes at restoration; a colliding theme ID is renamed and its selected-theme reference follows the imported entry, while the original palette remains.

A fictional copied session reproduces the reported formatting artifacts: an invalid escape before `@`, an identical Markdown wrapper around LinkedIn, and another around the image base. It produces exactly three repair notices and the expected values. Valid JSON reports no repairs. Unknown escapes, mismatched Markdown link destinations, JavaScript links, wrong field types, and prototype payloads still fail strict validation. The user's private pasted file was not opened, copied, or incorporated into test evidence by this reviewer.

Source inspection confirms both import choices reset to checked on opening, restore is disabled while nothing valid is selected, and the final action re-parses and recombines against the current session rather than applying an old merged snapshot. The library has an initially closed native dialog, three tab panels, arrow/Home/End navigation, deferred miniature fitting on visibility, and focus restoration that does not steal focus from an AI dialog opened by a custom-artwork action.

For the final browser follow-up, this critic's earlier Codex tab became unavailable; a fresh surface inventory returned no browsers. No Edge fallback was attempted. The lead then supplied actual Codex-browser interactions and screenshots. The attribution is deliberate: this critic independently inspected the images, source, and contracts, while the lead performed the following later interactions.

- Browse designs opened; ArrowRight moved from Layouts to Themes and changed panels. Choosing Galaxy applied Orbit plus Galaxy, closed the library, and returned focus to Browse designs. Choosing Custom artwork opened the AI dialog while closing the library, and its example rendered a valid proposal.
- Design-only import of fictional Jordan/Signal/Frost preserved Avery and the existing photo while applying Signal/Frost. Undo restored Orbit/Galaxy. Information-only import on mobile changed the name to Jordan and cleared the photo, as intended for an incoming information set without a photo, while retaining Galaxy. Undo restored Avery and the photo.
- At 390 × 844, the import dialog had matching 335 px client/scroll widths with two approximately 119.7 px selection cards. The library had matching 369 px client/scroll widths and approximately 318 px thumbnails.

Independently inspected actual images: [minimal workspace](../studio.jpg), [desktop library](../design-library.jpg), [AI proposal](../ai-extensions.jpg), [design-only import](../selective-import.jpg), [mobile information import](../gauntlet/import-mobile-final.jpg), and [mobile library](../gauntlet/library-mobile-final.jpg). The workspace is visibly quieter, the two selection states are legible, and the modal library provides readable previews without occupying the permanent workspace. The AI proposal and Apply action remain visible together. No remaining defect within this reviewed scope warrants a HOLD. The established reference comparison and final release evidence belong to their separate reviews.
