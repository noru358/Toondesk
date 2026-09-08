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

Target default layout:

- COVER = HEADER/TITLE + HERO
- BODY = ARTWORK (speech/SFX inside) + lower META region (inner thought/narration)
- 1080×1350 default canvas
- artwork frames start locked but can be explicitly overridden in the editor
- page structure starts at COVER 1 + BODY 6 but editor capabilities remain available

## Run

Open `index.html` in a browser. Drop layout JSON, artwork images, and optionally a presentation-shell/profile JSON into the window.

## Export

- PNG / SVG are derivatives.
- Package ZIP/JSON is transport only.
- Project-specific scene JSON remains authoritative according to that project's repository contract.

## Custom override reporting

ToonDesk does not treat profile deviation as corruption. On export it computes whether the document has diverged from the loaded profile defaults (for example page-count changes, unlocked artwork frames, or frame geometry changes) and records:

- `custom_override: true|false`
- `custom_override_reasons: [...]`

Crop-only edits do not count as a structural override. The profile remains a default; the scene JSON remains the project-owned authority.
