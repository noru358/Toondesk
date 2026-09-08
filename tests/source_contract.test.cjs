const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('editor preview and PNG rasterization share renderPage', () => {
  const interaction = read('src/interaction.js');
  const render = read('src/render.js');
  assert.match(interaction, /renderPage\(ctx, p,/);
  assert.match(render, /function rasterize\(page,[\s\S]*?renderPage\(ctx, page\)/);
});

test('SVG derives text and bubble geometry from shared scene helpers', () => {
  const render = read('src/render.js');
  assert.match(render, /function pageToSVG\(page\)/);
  assert.match(render, /const L = layoutText\(o\), A = textAnchors\(o, L\)/);
  assert.match(render, /pBubble\(r\.x, r\.y, r\.w, r\.h,[\s\S]*?bubbleTailData\(o\)/);
});

test('project save and reopen preserve complete page scene arrays', () => {
  const io = read('src/io.js');
  assert.match(io, /function projectJSON\(\)[\s\S]*?pages: doc\.pages/);
  assert.match(io, /async function loadProject\(d\)[\s\S]*?doc\.pages = d\.pages \|\| \[\]/);
});

test('same-ID editable layout import uses non-destructive page merge', () => {
  const io = read('src/io.js');
  assert.match(io, /doc\.pages\[ex\] = SceneState\.mergePage\(doc\.pages\[ex\], page\)/);
  assert.match(io, /layout_meta/);
});

test('undo and redo restore document pages then refresh the screen', () => {
  const interaction = read('src/interaction.js');
  assert.match(interaction, /function snapshot\(\) \{ return JSON\.stringify\(\{ pages: doc\.pages, cur: doc\.cur \}\); \}/);
  assert.match(interaction, /function undo\(\)[\s\S]*?restore\(history\.pop\(\)\);[\s\S]*?fullRefresh\(\)/);
  assert.match(interaction, /function redo\(\)[\s\S]*?restore\(future\.pop\(\)\);[\s\S]*?fullRefresh\(\)/);
});

test('font resolution is persisted and substitution remains inspectable', () => {
  const core = read('src/core.js');
  const panels = read('src/panels.js');
  const io = read('src/io.js');
  assert.match(core, /function recordFontResolutionReceipts\(\)/);
  assert.match(core, /resolved_family = r\.resolved/);
  assert.match(core, /substituted = r\.resolved !== r\.preferred/);
  assert.match(panels, /선호 폰트 미사용/);
  assert.match(io, /font_resolution:/);
});
