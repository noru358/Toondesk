# JIPBAP layout generation — V2 full-art default profile

Generate `EDITABLE_COMPOSITION_PACKAGE_V1` / `EDITOR_SCENE_MODEL_V1` page JSON. This is the project presentation authority consumed by Chat rendering and ToonDesk.

## Default, not capability limit

Use `JIPBAP_PRESENTATION_SHELL_V2` revision `2026-09-09_FULL_ART_OVERLAY` as the production default. ToonDesk may later explicitly override page count or artwork-frame geometry; that does not create a new scene format.

## Canvas

1080×1350 (4:5).

## COVER default

- full-canvas artwork frame: x=0 y=0 w=1080 h=1350
- soft title-safe hint: x=48 y=36 w=984 h≈330
- default grammar: full-canvas artwork + menu tag + dominant title + optional decorative vectors
- title/menu/decor remain independent editable lettering/overlay objects
- do not squeeze/stretch artwork for copy
- the title-safe region is a placement hint, not a separate hero frame

## BODY default

- full-canvas artwork frame: x=0 y=0 w=1080 h=1350
- no mandatory lower meta band and no structural top-art/bottom-copy split
- `speech`, `inner_thought`, `narration`, and `sfx` are freeform editable overlays
- use a soft 48px safe inset as a starting hint
- prefer naturally empty areas and avoid primary face / food / hand-action regions when optional `avoid_regions` metadata is present
- artwork source is an accepted BOARD crop and must not be stretched
- artwork starts `locked:true`; explicit editor unlock may later transform the frame and is treated as `CUSTOM_OVERRIDE`
- moving lettering alone is normal presentation editing and does not constitute a structural custom override

## BOARD extraction

- the generated board is nominally 2 columns × 3 rows
- never infer crop boundaries only by dividing raster dimensions into exact equal pixel blocks
- detect/confirm actual panel borders and store/use the resulting crop coordinates
- any adjacent-panel contamination in an extracted BODY artwork asset must be repaired before publish

## Layers

Keep the shared four top-level groups:

1. background z=0
2. artwork z=1..9
3. lettering z=10..99
4. overlay z=100..199

Meaning-bearing text belongs in lettering. Speech/thought geometry and text are separate objects within one semantic instance group.

## Semantic groups

BODY may contain zero or more:
- `sNN.speech.NN`
- `sNN.thought.NN`
- `sNN.narration.NN`
- `sNN.sfx.NN`

COVER keeps:
- `cover.menu_tag`
- `cover.title`

## Typography defaults

Preserve semantic typography role plus the profile's preferred real font and fallback chain.
For the current JIPBAP example:
- cover title/menu: prefer `Jua`
- body speech: prefer `Jua`
- body thought/narration: prefer `Gowun Dodum`
- SFX: prefer `Gaegu`

If the preferred font cannot load, surface the substitution and ensure preview/export resolve the same fallback. Do not silently approve one font and hand off another.

## Approval identity

The FINAL_PUBLISH_GATE preview must be rendered from the exact same composition package that will be handed off. Do not separately generate a visually similar cover/body preview after BOARD acceptance.

## Automatic production rule

For normal Chat-mode episode assembly, use the V2 full-art default without inventing per-episode artwork-frame changes. Lettering placement remains fluid and focal-aware. Custom artwork-frame geometry is for explicit human/editor override, not routine automatic variation.
