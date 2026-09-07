# AI extensions

Signature Studio can turn a JSON response from an AI you choose into a previewed signature edit. It does not connect to a model, ask for an API key, train a model, or automatically send a request. The same workflow accepts JSON you write yourself. The proposal is limited to the selected section and the editor's supported fields.

## Use the helper

1. Open the small AI link for **Design**, **Artwork**, **Layout**, **Colors**, **Details**, **Icons**, or **Photo format** in the relevant editor section. Existing layouts, themes, and patterns are available separately through **Browse designs**.
2. Describe the change or select a request idea. Read the generated prompt; it includes the allowed fields, their current style values or fictional wording, and the response format.
3. Click **Copy prompt** and paste it into your chosen AI. If clipboard access is blocked, use **Select prompt** and your keyboard or selection menu.
4. Paste the JSON reply into **Paste your AI's JSON reply**. You can edit it directly, or start with **Try an editable example** without using an AI service.
5. Click **Preview changes**. Validation checks the response, the complete candidate signature, text fit, and HTML size. Review the preview and list of changed fields. The working draft is still unchanged.
6. Click **Apply changes**. One **Undo** returns to the previous signature. If the draft changes after preview, preview the proposal again before applying.

![AI helper with proposal preview](ai-extensions.png)

Changing the request, Details opt-in, or response invalidates an existing preview. Closing the dialog discards the pending proposal. The generated prompt is readable/selectable; edit the request to regenerate it. The response is an editable text field.

## What the prompt includes

By default, generated prompts omit names, contacts, URLs, and photo data. Style sections include only their allowed style fields. Details uses fictional example title/subtitle/tags until **Include my current text and contact details in the prompt** is checked. That option resets to off each time the helper opens.

Your typed request is always included, up to 2,000 characters. Read the prompt before copying if you have added personal information to the request yourself. Choosing to paste the prompt into another service shares that text with that service; nothing is sent automatically by this editor.

With the Details option on, current identity, wording, and contact fields may appear in the prompt and may be changed by its response. The photo is never included. The Photo format section controls shape and size only; it does not edit the image pixels, crop, brightness, or public photo URL.

## Response envelope

Return one JSON object with these five fields and no extra keys:

| Field | Required value |
| --- | --- |
| `format` | The string `signature-ai` |
| `version` | The number `1` |
| `section` | The exact open section: `design`, `artwork`, `layout`, `colors`, `details`, `icons`, or `photo` |
| `name` | A nonempty plain-text proposal name, at most 80 characters, without markup or control characters |
| `changes` | A nonempty object containing only allowed fields that should change |

The response must be no larger than 65,536 UTF-8 bytes. A single enclosing Markdown JSON code fence is accepted, but prose, multiple objects, comments, and trailing commas are not JSON. Responses with unknown fields, unsupported property names, or nesting deeper than eight levels are rejected. The proposal name labels the preview; it does not save a new library preset.

Omit unchanged fields. A response never accepts raw HTML, CSS, JavaScript, SVG, image data, or a generated image URL as a new artwork/layout type. The Details section may contain its normal contact URL fields when the explicit Details option is enabled.

## Allowed changes by section

| Section | Allowed fields |
| --- | --- |
| `design` | `design`, `customLayout`, `layout`, `width`, `height`, `pattern`, `customPattern`, `frontBackground`, `backBackground`, `accent`, all five icon fields, `portraitShape`, `portraitSize` |
| `artwork` | `pattern`, `customPattern`, `frontBackground`, `backBackground`, `accent` |
| `layout` | `design`, `customLayout`, `layout`, `width`, `height` |
| `colors` | `frontBackground`, `backBackground`, `accent` |
| `details`, option off | `title`, `subtitle`, `tags` |
| `details`, option on | `nameLine1`, `nameLine2`, `title`, `subtitle`, `website`, `websiteLabel`, `email`, `phone`, `linkedin`, `location`, `tags` |
| `icons` | `websiteIcon`, `emailIcon`, `phoneIcon`, `linkedinIcon`, `locationIcon` |
| `photo` | `portraitShape`, `portraitSize` |

The broad Design section changes visual settings only. It cannot change personal details, the uploaded photo, its public URL, the image base, stored themes, or application settings. Artwork can change its palette and card colors; Icons selects from the bundled icons rather than uploading new artwork.

## Values and limits

| Field | Accepted values |
| --- | --- |
| Surface/accent colors | Six-digit hex strings such as `#18283e` |
| `design` | `original`, `orbit`, `studio`, `contour`, `prism`, `editorial`, `signal`, or `custom` |
| `pattern` | `auto`, `dots`, `orbit`, `studio`, `contour`, `prism`, `editorial`, `signal`, `galaxy`, `starlight`, `moonlight`, `frost`, `custom`, `none` |
| `layout` | `paired` for Wide; `stacked` for Tall |
| `width` | JSON integer 280–420 |
| `height` | JSON integer 180–320 |
| Icon fields | `web`, `mail`, `phone`, `linkedin`, `pin`, or `none` |
| `portraitShape` | `circle`, `rounded`, or `square` |
| `portraitSize` | JSON integer 40–96 |

Wide output is `(width × 2 + 20) × height`; Tall output is `width × (height × 2 + 20)`. Values must be numbers, not numeric strings. Do not assume that every combination fits the current name and contacts: the full candidate passes the signature's existing validation before a preview can appear.

Detail text is a single line, without control characters or markup. Normal URL, email, and required-field validation also applies. Maximum lengths:

| Detail | Characters |
| --- | ---: |
| `nameLine1`, `nameLine2` | 36 each |
| `title`, `subtitle` | 64 each |
| `website` | 1,024 |
| `websiteLabel` | 40 |
| `email` | 80 |
| `phone` | 32 |
| `linkedin` | 512 |
| `location` | 48 |
| `tags` | 60 |

An empty string clears an optional text field. Do not use `null`, booleans, arrays, or objects for ordinary text values. The full editor validation determines whether the resulting signature still has its required content and fits.

## Custom layout recipe

Set `design` to `custom` and include `customLayout` as a JSON object, not a JSON-encoded string. The recipe has exactly three required fields:

| Field | Choices | Effect |
| --- | --- | --- |
| `composition` | `orbit`, `studio`, `contour`, `prism`, `editorial`, `signal` | Uses that measured composition as the base |
| `font` | `sans`, `serif`, `mono` | Changes the display name's font family; the role retains its regular monospace typography |
| `align` | `left`, `center` | Aligns identity text |

These are 36 combinations of six compositions, three font choices, and two alignments, before other design settings. They are not arbitrary layouts, font uploads, drag-and-drop placement, or unrestricted CSS. A recipe serializes to at most 512 characters internally. No additional properties are accepted.

A proposal containing a `customLayout` must also set `design` to `custom`. Selecting `custom` without including a recipe is valid only if the current draft already contains a valid custom layout. Applied recipes stay with the current draft and session; they do not create a separate named preset library.

## Custom pixel-art recipe

Set `pattern` to `custom` and include `customPattern` as an object with exactly `palette` and `rows`:

- `palette`: 1–8 six-digit hex color strings.
- `rows`: 4–32 equal-length strings, each 4–16 characters wide.
- At most **384 cells** across the whole grid, including transparent cells.
- A `.` means transparent. Digits `0`–`7` select an existing palette entry; `0` is the first color.

The recipe serializes to at most 2,048 characters internally. Include `pattern: "custom"` whenever a response includes `customPattern`. A response may select an existing custom pattern without supplying a new recipe only when the draft already has a valid one.

The renderer fits the grid into its decorative rail and emits native email table cells. The custom artwork itself needs no new image URL or hosting service. Bundled PNG icons, other PNG patterns, and photos retain their existing hosting requirements.

The complete signature must remain **below 10,000 HTML characters**. The grid limits are an upper bound on recipe complexity, not a guarantee that any grid fits. Adjacent same-color cells and repeated rows compact well; noisy checkerboards often do not. If a preview reports a budget error, reduce color changes/rows, simplify the shape, or shorten URLs, then preview again. This is pixel art, not general AI image generation.

## Recovery and state

| Message or situation | Next step |
| --- | --- |
| Response is for another section | Open that section, or ask for a response using the current prompt |
| Unsupported field/value | Remove it or choose a documented value; do not move unrelated changes into another field |
| Invalid recipe | Check exact keys, dimensions, equal row widths, palette indices, and required `custom` selector |
| Fit error | Increase usable dimensions or simplify the proposed content/layout |
| HTML is too long | Simplify pixel art and/or shorten URLs, then preview again |
| Signature changed since preview | Preview the same response against the current draft before applying |
| Clipboard blocked | Select the prompt and copy manually; JSON entry remains available |

Preview does not save the proposal. Apply changes the working draft through the same history and persistence flow as ordinary edits. It creates one undo step for the proposal. Closing without applying keeps the original draft. Local storage, session-file limits, and uploaded-photo restrictions continue to apply.

## Source contract and verification

The implementation exports `SignatureAI.sections`, `sectionKeys`, `buildPrompt`, `exampleResponse`, `parseResponse`, `createProposal`, and `applyProposal` from `ai-extension-core.js`. `SignatureCore.recipeSchemas`, `parseCustomLayout`, `parseCustomPattern`, and `limits` define the recipe and field rules in `signature-core.js`.

For code integrations, `createProposal(text, {section, draft, includeDetails})` returns the validated preview candidate. `applyProposal(proposal, currentDraft)` requires that same preview object and an unchanged draft, and returns the allowed patch. It does not mutate the draft itself. The app applies that patch as one history action. `parseResponse` alone does not authorize applying a forged proposal.

The examples below are generated from the source's `exampleResponse()` export. All seven have been passed through `createProposal()` and `SignatureCore.render()` with the default signature. That verifies these concrete examples, not every possible AI answer or email client. [PROGRESS.md](../PROGRESS.md) records current browser and release checks. Gmail paste/send testing still requires an authenticated send test.

## Ready-to-paste examples

Open the matching section before previewing an example. The Details example works with the personal-details option off. Each can be edited within the contract above.

### Design

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "design",
  "name": "Design example",
  "changes": {
    "design": "orbit",
    "pattern": "starlight",
    "frontBackground": "#e6edf6",
    "backBackground": "#17253f",
    "accent": "#cda762"
  }
}
```

### Artwork

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "artwork",
  "name": "Artwork example",
  "changes": {
    "pattern": "custom",
    "customPattern": {
      "palette": [
        "#dcc18a"
      ],
      "rows": [
        "....00..",
        "....00..",
        "........",
        "00......",
        "00......",
        "........",
        "......00",
        "......00"
      ]
    }
  }
}
```

### Layout

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "layout",
  "name": "Layout example",
  "changes": {
    "design": "custom",
    "customLayout": {
      "composition": "editorial",
      "font": "serif",
      "align": "center"
    }
  }
}
```

### Colors

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "colors",
  "name": "Colors example",
  "changes": {
    "frontBackground": "#e6edf6",
    "backBackground": "#17253f",
    "accent": "#cda762"
  }
}
```

### Details

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "details",
  "name": "Details example",
  "changes": {
    "title": "Creative Developer",
    "subtitle": "DESIGN & TECHNOLOGY",
    "tags": "DESIGN · BUILD · EXPLORE"
  }
}
```

### Icons

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "icons",
  "name": "Icons example",
  "changes": {
    "websiteIcon": "web",
    "emailIcon": "mail",
    "phoneIcon": "none",
    "linkedinIcon": "none",
    "locationIcon": "pin"
  }
}
```

### Photo format

```json
{
  "format": "signature-ai",
  "version": 1,
  "section": "photo",
  "name": "Photo format example",
  "changes": {
    "portraitShape": "rounded",
    "portraitSize": 56
  }
}
```
