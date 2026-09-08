# ToonDesk editable reconstruction bridge

Status: ACTIVE DOWNSTREAM BRIDGE
Updated: 2026-09-09

This prompt is **not** JIPBAP creative/planning authority.
For JIPBAP, story/copy/style/approval rules live in `noru358/jipbap`; ToonDesk receives an approved presentation target plus accepted artwork/copy and reconstructs them into the shared scene model.

Use the project-supplied profile/presentation shell. The local `profiles/jipbap_v2.example.json` is a development mirror, not canonical project authority.

## Input contract

For each page, consume only the information needed for editable reconstruction:

- accepted artwork source identity
- existing BODY extraction metadata reference + extraction box index when applicable
- final artwork FIT/crop transform
- approved literal copy
- approved presentation-target provenance/hash when supplied
- presentation intent: bubble silhouette, tail geometry, explicit line breaks, typography character, relative placement, rotation and z-order
- optional placement guides / avoid regions
- existing scene object IDs and any `manual_overrides`

Do not invent a new reference image, approval gate, story state, or duplicate crop manifest.

## Output contract

Generate `EDITABLE_COMPOSITION_PACKAGE_V1` / `EDITOR_SCENE_MODEL_V1` page JSON.

Keep:

- canvas/page data
- stable `groups[]`
- flat editable `objects[]`
- accepted artwork provenance
- presentation-target metadata/provenance already present at layout level
- exact literal copy
- explicit line breaks
- preferred/fallback/resolved font information when available
- bubble body and rich curved-tail geometry
- crop transform on the artwork object
- property-level `manual_overrides`
- non-destructive `layout_attention` issues

Do not flatten a whole page and call it editable.

## Artwork provenance and FIT

BODY source identity is not re-owned here.
Reference the existing board-extraction record and its box index through page `artwork_provenance`.
The final 4:5 FIT transform remains the artwork object's `crop` metadata.

COVER uses its approved distinct source by default. Never silently substitute a BODY cell for an accepted COVER source.

Changing lettering/layout does not authorize artwork replacement or BOARD regeneration.

## Text and font behavior

Literal approved copy is authority.
A presentation master may guide visual lettering style, but image-model glyphs or misspellings do not override approved text.

Preserve explicit `\n` line breaks.
Preview and PNG export use the same ToonDesk text/layout calculation.
Persist the runtime-resolved font family/weight and surface substitution instead of silently pretending the requested font loaded.

External SVG rasterizers may differ in font metrics or antialiasing; do not claim pixel identity across rendering environments.

## Manual-edit merge policy

When updating an existing scene by stable object ID:

- preserve only the properties named in that object's `manual_overrides`
- keep other properties eligible for the incoming reconstruction/update
- `line_breaks` and literal `text` are separate override classes
- if only line breaks were manually edited and upstream literal copy changes, keep the new literal copy and surface `LINE_BREAK_REVIEW_REQUIRED`
- do not silently shrink type or discard manual geometry to hide overflow
- a user-added object marked `object_presence` survives routine same-page reconstruction
- accepted artwork provenance and existing presentation-target metadata remain sticky unless an explicit artwork/presentation authority change is supplied by the project

Reapplying automatic placement is an explicit editor action. Clear only the requested override scope and leave unrelated manual edits intact.

## Bubble behavior

Speech bubble body and text remain separate objects.

Use the existing rich `tail` representation:

- `enabled`
- `style`
- `tip_x`, `tip_y`
- `attach_side`, `attach`
- `base_width`
- `curve`

Horizontal bubble flip mirrors tail/body presentation only; text orientation remains unchanged.

Do not introduce random geometry variation on every render.

## JIPBAP default surface

When the active supplied profile is JIPBAP V2:

- automatic default remains COVER 1 + BODY 6
- 1080×1350 pages
- full-art overlay
- accepted BODY cells originate from the text-free 2×3 board
- no mandatory top text strip or lower meta band
- lettering is focal-aware and freeform
- page add/delete/duplicate, frame adjustment and other generic ToonDesk capabilities remain available as explicit editor actions

These are project defaults, not ToonDesk capability limits.

## Parity QC boundary

The approved quality-first presentation master is the upstream visual target.
Editable reconstruction must use exact accepted artwork and approved literal copy while reproducing presentation intent as closely as the scene model allows.

If parity fails because ToonDesk cannot express the approved design, extend/revise scene capability or surface a manual-adjustment need. Do not quietly simplify the approved presentation to a generic box/font preset.
