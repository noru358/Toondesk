# JIPBAP layout generation — V2 default profile

Generate `EDITABLE_COMPOSITION_PACKAGE_V1` / `EDITOR_SCENE_MODEL_V1` page JSON. This is the project presentation authority consumed by Chat rendering and ToonDesk.

## Default, not capability limit

Use `JIPBAP_PRESENTATION_SHELL_V2` as the production default. These coordinates are the automatic first-pass layout. ToonDesk may later explicitly override page count, frame transforms, or geometry; that does not create a new scene format.

## Canvas

1080×1350 (4:5).

## COVER default

- title/header region: x=60 y=40 w=960 h=240
- hero artwork frame: x=40 y=310 w=1000 h=1000
- default grammar: menu tag + dominant title + hero
- do not squeeze/stretch artwork for copy

## BODY default

- artwork frame: x=40 y=40 w=1000 h=1000
- lower meta region: x=60 y=1080 w=960 h=230
- `speech` / speech bubble / `sfx`: place inside the artwork region by default
- `inner_thought` / `narration`: place inside the meta region by default
- artwork source is accepted BOARD crop and must not be stretched
- artwork starts `locked:true`; explicit editor unlock may later transform the frame and is treated as `CUSTOM_OVERRIDE`

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

Keep the project's semantic typography roles. Font family is intent, not binary authority.

## Automatic production rule

For normal Chat-mode episode assembly, use the V2 default layout without inventing per-episode frame changes. Custom geometry is for explicit human/editor override, not routine automatic variation.
