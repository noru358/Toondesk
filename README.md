## Web Live

Primary development/use path: **https://noru358.github.io/Toondesk/**

The hosted editor deploys automatically from `main`. Refreshing the same URL gets the newest editor, so normal development no longer requires downloading a new Windows executable for every change.

On Chromium browsers such as Chrome/Edge, ToonDesk uses the browser File System Access API for native project open/save and Ctrl/Cmd+S in-place save. The Electron build remains an optional fallback for OS file association and offline/native workflows.

# ToonDesk

Profile-driven direct-manipulation editor for editable comic/carousel scene JSON.

## Architecture

ToonDesk is an **engine**, not a project authority. It provides capabilities such as:

- page add/delete/duplicate
- select/drag/resize/rotate
- text editing
- groups and z-order
- artwork crop
- explicit unlock + frame transform
- deterministic SVG/PNG export

Project-specific layout decisions are supplied by a **profile/presentation shell**. A profile defines defaults, not the editor's capability ceiling.

For example, a JIPBAP profile may start with one COVER + six BODY pages and locked artwork frames. A user can explicitly unlock a frame, resize it, move it, add pages, or change page structure. Such deviation is a `CUSTOM_OVERRIDE`, not scene corruption.

## Authority boundary

ToonDesk transport/session wrappers are non-canonical:

- `TOONDESK_PACKAGE_V1`: transport only
- `TOONDESK_PROJECT_V1`: local editor-session persistence only

The project repository decides its own canonical scene artifact. For JIPBAP that remains `composition/*.layout.json` (`EDITABLE_COMPOSITION_PACKAGE_V1` / `EDITOR_SCENE_MODEL_V1`).

## JIPBAP integration

The authoritative JIPBAP profile should live in `noru358/jipbap/templates/`. The file under `profiles/` here is an example/development mirror only.

Current JIPBAP example profile:

- COVER = full-canvas artwork + editable menu/title/decor overlays
- BODY = full-canvas artwork + freeform speech/thought/narration/SFX overlays
- no mandatory lower META band
- focal/avoid metadata may guide lettering placement without becoming a hard frame
- 1080×1350 default canvas
- artwork frames start locked but can be explicitly overridden in the editor
- page structure starts at COVER 1 + BODY 6 but editor capabilities remain available
- preferred real fonts plus fallbacks are supported; missing preferred fonts surface as QC warnings rather than silently changing appearance
- BODY/COVER accepted-artwork provenance survives routine same-page reconstruction
- manual lettering edits are preserved at property scope rather than by locking the whole object

## Run

### Recommended: desktop app

ToonDesk now has an Electron desktop shell while keeping the same browser engine.

Development / local run:

```bash
npm install
npm start
```

The desktop build adds:
- native open/save dialogs
- `.toondesk` file association support
- double-click / OS-open handoff into the editor
- `Ctrl+S` / `Cmd+S` in-place save for an opened project
- the same scene/rendering engine as browser mode

Build installers/portable apps:

```bash
npm run dist
```

A GitHub Actions `Desktop Build` workflow is also provided for Windows, macOS and Linux build artifacts.

### Browser fallback

Opening `index.html` directly remains supported. Drop layout JSON, artwork images, `.toondesk` session files, and optionally a presentation-shell/profile JSON into the window.

## Export

- PNG / SVG are derivatives.
- Package ZIP/JSON is transport only.
- Project-specific scene JSON remains authoritative according to that project's repository contract.

## Custom override reporting

ToonDesk does not treat profile deviation as corruption. On export it computes whether the document has diverged from the loaded profile defaults (for example page-count changes, unlocked artwork frames, or frame geometry changes) and records:

- `custom_override: true|false`
- `custom_override_reasons: [...]`

Crop-only edits do not count as a structural override. The profile remains a default; the scene JSON remains the project-owned authority.

## Non-destructive reconstruction

ToonDesk 0.3.3 records user edits in optional `manual_overrides` on each scene object. These are property-level preservation markers, not object locks.

Examples:
- moving a bubble marks `position`
- changing only explicit line breaks marks `line_breaks`
- dragging a speech-tail tip marks `tail_tip`
- changing typography marks `typography`
- crop edits mark `crop`
- a manually added object may carry `object_presence`

When a same-ID layout is imported again, only marked properties are retained; unmarked properties may accept the incoming reconstruction. If upstream literal copy changes after a manual line-break edit, ToonDesk keeps the new copy and emits `LINE_BREAK_REVIEW_REQUIRED` instead of silently shrinking text or discarding the user's geometry.

`artwork_provenance` and presentation-target metadata remain sticky during routine same-page reconstruction. Explicit artwork replacement is still allowed, but it is marked and reported rather than being confused with the accepted source.

## Font behavior

Generated lettering in an image preview is not automatically a real font family. ToonDesk therefore separates:
- semantic font intent
- preferred real font family
- fallback chain
- runtime-resolved family

The built-in webfont set includes Jua, Do Hyeon, Gowun Dodum, Gaegu, Nanum Pen Script, Black Han Sans, Nanum Gothic, Hi Melody and Noto Sans KR. If the preferred family cannot be loaded, ToonDesk reports the substitution in the inspector and export manifest. Preview and export use the same resolver.


## Editing ergonomics

ToonDesk 0.3 adds the minimum direct-manipulation set needed for JIPBAP-style production:
- full-art COVER/BODY with optional soft guide visualization (`G` or the Guide button)
- snapping to canvas/profile guides, page placement guides and avoid-region edges
- focal/avoid-region QC warnings for lettering that covers primary face/food/hand regions
- speech-tail direct manipulation: tail tip handle, attachment handle, base width, curvature and side controls
- horizontal/vertical alignment and equal-spacing tools for multi-selection
- deterministic "빈곳 배치" helper that scores available positions against avoid regions
- font picker updates the real preferred family, not merely semantic intent
- requested fonts are loaded before preview/export; fallback resolution is recorded in the export manifest
- accepted artwork provenance can be recorded for COVER and BODY and is checked so presentation-only edits do not silently substitute another source
- explicit text padding is stored in scene data and interpreted by the shared text layout used for preview and PNG export
- manual override markers are visible in the contextual toolbar; re-running `빈곳 배치` clears only the selected position override after an explicit scope prompt

## Build / release policy

The hosted web editor is the normal rapid-update path.
- relevant pushes to `main` run JS/JSON checks plus scene-state tests, then sync the exact `main` tree to `gh-pages`
- desktop installers are **not** rebuilt on every `main` push
- the `Desktop Build` workflow is tag/manual driven and runs the same scene-state tests before packaging
- stable desktop releases are tag-driven: pushing `vX.Y.Z` builds the Windows executables and attaches them to a GitHub Release
- auto-update is intentionally deferred until signing/release cadence is stable

### Rendering limits

Editor preview and PNG export share ToonDesk's Canvas scene renderer and text layout. SVG is generated from the same scene geometry/text data, but a different SVG rasterizer can produce different font metrics or antialiasing. ToonDesk therefore guarantees preservation of scene values, source identity and explicit text/layout intent—not pixel-perfect equality across unrelated rendering environments.

Real-device mobile touch and browser visual parity must be tested on the target device/browser; static/unit tests do not substitute for that check.
