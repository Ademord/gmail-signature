# Interaction review — 9 September 2026

The user's reported problem was the effort of comparing designs and the repetition in the editor. The comparison baseline was the actual released editor, with six tabs, dropdown/gallery-only selection, two Copy buttons, and duplicated total dimensions. A locally supplied methodology guided the work: start with the observed task, remove unnecessary decisions, and independently challenge the result. No usage-frequency study was conducted.

## Scoped purpose verdict

The independent critic approved the desktop change after inspecting actual before/after captures at 1707 × 960. Four tabs give decisions one home: Design, Colors, Details, Photo. Previous/Next arrows allow immediate comparison while dropdowns and the visual gallery still support direct choices. Size & arrangement sits within Design; Contact icons sits within Details. Total dimensions appear beneath the canvas. One Copy button remains beside the result.

The first candidate left three separated secondary-action rows. Critic feedback consolidated them into one quiet two-row footer: Surprise me / Extend with AI, then Reset design / Load example. Backup & restore remains a separate closed disclosure. The [final actual screenshot](../interaction-studio.jpg) uses fictional Avery data.

On phones, the approved journey uses the existing Edit signature and View preview links. The full preview is above the controls rather than simultaneously visible during editing. A second preview widget was not added. Phone captures had compositor/viewport inconsistencies, so the independent image review establishes the arrangement of controls, not exact scrolled viewport position. Root's live DOM and keyboard observations establish the specific fit/focus/scroll results below.

## Executed evidence

- Real desktop Next clicks changed Original → Orbit → Studio, retained focus on Next, and preserved Plum colors. Undo returned to Orbit. Next artwork selected Cut paper.
- All four arrow buttons measured 44 × 44 px. DOM hit checks at their inner corners reached the intended buttons rather than a clipping ancestor. On the phone breakpoint, these targets and the four-tab row fit without horizontal document overflow.
- With Next already focused on the phone, native Return changed Studio → Contour while scroll stayed 736 → 736 and focus stayed on Next. The locator-driven initial click had scrolled the target into view; that automation movement is kept separate from application behavior.
- View preview revealed the selected Contour signature completely within the inspected viewport. Phone editing still requires returning to the preview to inspect the complete result.
- Tall and a keyboard width increment produced 322 × 436 px beneath the canvas; the duplicated total-size paragraph was absent.
- An invalid image base URL hidden in both Size & arrangement and Advanced settings was revealed by Download HTML validation: Design became active, both disclosures opened, and the invalid field received focus. The automation declined the aria-disabled Copy button, so this browser result is attributed to Download HTML. Independent source tests exercise Copy's shared validation path.
- Importing a fictional legacy session with `ui.editorTab: "icons"` selected Details and opened Contact icons. No personal hosted draft was used for this probe.

The independent test reviewer added seven journeys and improved the DOM harness to derive ancestry, options, and tab order from actual HTML. All 47 interaction tests pass. The old published baseline fails the seven new journeys. A candidate mutation restoring only the old nearest-disclosure validation logic fails specifically because the image base field retains a closed outer disclosure. This distinguishes a necessary fix from an unexercised assertion.

Integrated local result: **228 tests, 227 passed, zero failed, one expected Windows symlink skip**. Core rendering, session normalization, exported fields, and the 65-file public allowlist are unchanged. [PROGRESS.md](../../PROGRESS.md) records the release token, independent publication audit, exact CI, and live deployment checks. Actual received-email fidelity remains the previously unverified external check; this interaction change makes no new email-client claim.
