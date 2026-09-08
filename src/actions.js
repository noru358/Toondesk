/* ============================================================
   Actions, direct manipulation, IO
   ============================================================ */

function act(name) {
  const p = curPage(), list = selObjs(), o = list[0];
  const H_ = () => pushHistory();
  if (name === 'del') {
    if (!list.length) return;
    H_(); p.objects = p.objects.filter(x => !sel.ids.has(x.id)); sel.ids.clear(); return fullRefresh();
  }
  if (name === 'dup') {
    if (!list.length) return;
    H_();
    const add = list.map(x => { const c = clone(x); c.id = uid(x.type.slice(0, 3)); c.x += 24; c.y += 24; if (c.tail_to) { c.tail_to.x += 24; c.tail_to.y += 24; } return c; });
    p.objects.push(...add); sel.ids.clear(); add.forEach(a => sel.ids.add(a.id)); return fullRefresh();
  }
  if (name === 'front' || name === 'back') {
    if (!list.length) return;
    H_();
    for (const x of list) {
      const band = bandFor(p, x);
      const peers = p.objects.filter(q => q.z >= band[0] && q.z <= band[1] && q !== x).map(q => q.z);
      x.z = clamp(name === 'front' ? (peers.length ? Math.max(...peers) + 1 : band[0]) : (peers.length ? Math.min(...peers) - 1 : band[0]), band[0], band[1]);
    }
    return fullRefresh();
  }
  if (name.startsWith('al-')) { H_(); list.forEach(t => t.align = name.slice(3)); return fullRefresh(); }
  if (name === 'outline') {
    H_(); const on = o.stroke && o.stroke !== 'none';
    list.forEach(t => { if (on) { t.stroke = 'none'; t.stroke_width = 0; } else { t.stroke = '#ffffff'; t.stroke_width = Math.max(4, Math.round(((t.font || {}).size || 40) / 8)); } });
    return fullRefresh();
  }
  if (name === 'fit') {
    H_();
    for (const t of list) {
      const R = roleOf(t); let lo = 8, hi = Math.max(R.max, (t.font.size || R.nominal));
      for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; t.font.size = mid; layoutText(t).overflow ? hi = mid : lo = mid; }
      t.font.size = Math.floor(lo);
    }
    return fullRefresh();
  }
  if (name === 'tail') {
    H_();
    if (o.tail_to) delete o.tail_to;
    else o.tail_to = { x: o.x + o.width * .55, y: o.y + o.height + 95 };
    return fullRefresh();
  }
  if (name === 'crop') { sel.crop = o.id; return fullRefresh(); }
  if (name === 'cropDone') { sel.crop = null; return fullRefresh(); }
  if (name === 'cropReset') {
    const t = sel.crop ? byId(p, sel.crop) : o; if (!t) return;
    H_(); t.crop = { mode: 'frame_crop', scale: 1, offset_x: 0, offset_y: 0, anchor_x: .5, anchor_y: .5, allow_stretch: false, allow_rotation: false, clamp_to_frame: true, editable: true };
    return fullRefresh();
  }
  if (name === 'lock') { H_(); o.locked = !o.locked; return fullRefresh(); }
  if (name === 'replace') { pendingReplace = o.id; $('#filePick').click(); return; }
  if (name === 'alignL' || name === 'alignC' || name === 'alignR') {
    H_();
    const b = aabb(list);
    for (const x of list) {
      if (!movable(x)) continue;
      const t = name === 'alignL' ? b.x : name === 'alignR' ? b.x + b.w - x.width : b.x + (b.w - x.width) / 2;
      const d = t - x.x; x.x = round2(t); if (x.tail_to) x.tail_to.x = round2(x.tail_to.x + d);
    }
    return fullRefresh();
  }
}
let pendingReplace = null;

function padFor(o) {
  const L = layoutText(o);
  return Math.max(0, (o.height - L.total) / 2);
}
function startEdit(o) {
  pushHistory();
  sel.editing = o.id;
  const ta = $('#editor'), L = layoutText(o);
  ta.style.display = 'block';
  ta.style.left = o.x + 'px'; ta.style.top = o.y + 'px';
  ta.style.width = o.width + 'px'; ta.style.height = o.height + 'px';
  ta.style.font = L.css; ta.style.lineHeight = L.lh + 'px';
  ta.style.textAlign = o.align || 'center'; ta.style.color = o.fill || '#221f1d';
  ta.style.paddingTop = padFor(o) + 'px';
  ta.value = o.text || '';
  draw();
  requestAnimationFrame(() => { ta.focus(); ta.select(); });
}
function stopEdit() {
  if (!sel.editing) return;
  sel.editing = null; $('#editor').style.display = 'none'; fullRefresh();
}

const vp = $('#viewport');
let drag = null, spaceDown = false;

vp.addEventListener('pointerdown', ev => {
  if (ev.target.id === 'editor') return;
  if (sel.editing) stopEdit();
  vp.setPointerCapture(ev.pointerId);
  const P = toPage(ev), p = curPage();
  if (ev.button === 1 || spaceDown || ev.altKey) { drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, ox: view.px, oy: view.py }; return; }
  if (sel.crop) {
    const t = byId(p, sel.crop);
    drag = { mode: 'crop', o: t, sx: P.x, sy: P.y, c0: { ...(t.crop || {}) } };
    pushHistory(); return;
  }
  const one = selObjs().length === 1 ? selObjs()[0] : null;
  if (one && one.tail_to && !one.locked && Math.hypot(P.x - one.tail_to.x, P.y - one.tail_to.y) < 12 / view.z) {
    pushHistory(); drag = { mode: 'tail', o: one }; return;
  }
  const h = handleAt(P.x, P.y);
  if (h) {
    pushHistory();
    const b = selBox();
    drag = { mode: h === 'rot' ? 'rotate' : 'resize', handle: h, box: b, start: P, snap: clone(selObjs().map(x => ({ id: x.id, o: clone(x) }))) };
    return;
  }
  const hit = selectableAt(P.x, P.y);
  if (hit) {
    if (!sel.ids.has(hit.id)) { selectObject(hit, ev.shiftKey); fullRefresh(); }
    else if (ev.shiftKey) { sel.ids.delete(hit.id); fullRefresh(); return; }
    pushHistory(); drag = { mode: 'move', start: P, moved: false }; return;
  }
  sel.ids.clear(); sel.enter = null; fullRefresh(); drag = { mode: 'marquee', start: P, cur: P };
});

vp.addEventListener('pointermove', ev => {
  const P = toPage(ev);
  if (!drag) {
    const h = handleAt(P.x, P.y);
    vp.style.cursor = sel.crop ? 'grab' : h === 'rot' ? 'grab' : h ? ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }[h] + '-resize') : selectableAt(P.x, P.y) ? 'move' : 'default';
    return;
  }
  if (drag.mode === 'pan') { view.px = drag.ox + (ev.clientX - drag.sx); view.py = drag.oy + (ev.clientY - drag.sy); applyView(); return; }
  if (drag.mode === 'crop') { const t = drag.o; t.crop = t.crop || {}; t.crop.offset_x = round2((drag.c0.offset_x || 0) + (P.x - drag.sx)); t.crop.offset_y = round2((drag.c0.offset_y || 0) + (P.y - drag.sy)); draw(); return; }
  if (drag.mode === 'tail') { drag.o.tail_to = { x: round2(P.x), y: round2(P.y) }; draw(); return; }
  if (drag.mode === 'move') {
    let dx = P.x - drag.start.x, dy = P.y - drag.start.y;
    const b = selBox();
    if (!ev.shiftKey && b) { const s = snapDelta({ x: b.x, y: b.y, w: b.w, h: b.h }, dx, dy); dx = s.dx; dy = s.dy; }
    else liveGuides = [];
    moveSel(dx, dy); drag.start = { x: drag.start.x + dx, y: drag.start.y + dy }; drag.moved = true; draw(); syncProps(); return;
  }
  if (drag.mode === 'resize') {
    const list = selObjs();
    if (list.length === 1) {
      const o = list[0]; if (!movable(o)) return;
      const src = drag.snap[0].o; Object.assign(o, clone(src));
      resizeSingle(o, drag.handle, P.x, P.y, ev.shiftKey, o.type === 'text' || o.type === 'sfx');
    } else {
      const b = drag.box; let nw = b.w, nh = b.h;
      if (drag.handle.includes('e')) nw = Math.max(MINSZ, P.x - b.x);
      if (drag.handle.includes('w')) nw = Math.max(MINSZ, b.x + b.w - P.x);
      if (drag.handle.includes('s')) nh = Math.max(MINSZ, P.y - b.y);
      if (drag.handle.includes('n')) nh = Math.max(MINSZ, b.y + b.h - P.y);
      const sx = nw / b.w, sy = nh / b.h;
      const anchorX = drag.handle.includes('w') ? b.x + b.w : b.x;
      const anchorY = drag.handle.includes('n') ? b.y + b.h : b.y;
      for (const s of drag.snap) { const o = byId(curPage(), s.id); if (!o || !movable(o)) continue; Object.assign(o, clone(s.o)); scaleObj(o, sx, sy, anchorX, anchorY, true); }
    }
    draw(); syncProps(); return;
  }
  if (drag.mode === 'rotate') {
    const b = drag.box, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let a = Math.atan2(P.y - cy, P.x - cx) * 180 / Math.PI + 90;
    if (ev.shiftKey) a = Math.round(a / 15) * 15;
    for (const s of drag.snap) { const o = byId(curPage(), s.id); if (o && movable(o)) o.rotation = round2(a); }
    draw(); syncProps(); return;
  }
  if (drag.mode === 'marquee') { drag.cur = P; drawMarquee(drag); }
});

function drawMarquee(d) {
  draw(); requestAnimationFrame(() => {
    const ctx = board.getContext('2d'), px = 1 / view.z;
    const x = Math.min(d.start.x, d.cur.x), y = Math.min(d.start.y, d.cur.y), w = Math.abs(d.cur.x - d.start.x), h = Math.abs(d.cur.y - d.start.y);
    ctx.save(); ctx.fillStyle = 'rgba(27,127,209,.12)'; ctx.strokeStyle = '#1B7FD1'; ctx.lineWidth = px; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.restore();
  });
}

vp.addEventListener('pointerup', () => {
  if (drag && drag.mode === 'marquee') {
    const d = drag, x0 = Math.min(d.start.x, d.cur.x), y0 = Math.min(d.start.y, d.cur.y), x1 = Math.max(d.start.x, d.cur.x), y1 = Math.max(d.start.y, d.cur.y);
    if (x1 - x0 > 6 || y1 - y0 > 6) for (const o of objs()) { const r = rectOf(o); if (o.visible !== false && r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) sel.ids.add(o.id); }
  }
  if (drag && drag.mode === 'move' && !drag.moved) history.pop();
  liveGuides = []; drag = null; vp.style.cursor = 'default'; fullRefresh();
});

vp.addEventListener('dblclick', ev => {
  const P = toPage(ev), p = curPage(), hit = selectableAt(P.x, P.y); if (!hit) return;
  if (hit.type === 'text' || hit.type === 'sfx') { sel.ids.clear(); sel.ids.add(hit.id); renderCtx(true); startEdit(hit); return; }
  if (hit.type === 'artwork') { sel.ids.clear(); sel.ids.add(hit.id); sel.crop = hit.id; fullRefresh(); return; }
  const g = groupOf(p, hit.group_id); if (g && g.parent_id) { sel.enter = g.id; sel.ids.clear(); sel.ids.add(hit.id); fullRefresh(); }
});
vp.addEventListener('wheel', ev => {
  ev.preventDefault();
  if (sel.crop && !ev.ctrlKey && !ev.metaKey) { const t = byId(curPage(), sel.crop); t.crop = t.crop || {}; t.crop.scale = clamp((t.crop.scale || 1) * (ev.deltaY > 0 ? .95 : 1.05), 1, 4); renderCtx(true); draw(); return; }
  if (ev.ctrlKey || ev.metaKey) { zoomAt(view.z * (ev.deltaY > 0 ? .9 : 1.1), ev.clientX, ev.clientY); return; }
  view.px -= ev.deltaX; view.py -= ev.deltaY; applyView();
}, { passive: false });

$('#editor').addEventListener('input', e => { const o = byId(curPage(), sel.editing); if (!o) return; o.text = e.target.value; e.target.style.paddingTop = padFor(o) + 'px'; draw(); });
$('#editor').addEventListener('blur', stopEdit);
$('#editor').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); stopEdit(); } e.stopPropagation(); });

addEventListener('keydown', e => {
  if (e.code === 'Space') spaceDown = true;
  const tag = (e.target.tagName || '').toLowerCase(); if (['input','textarea','select'].includes(tag)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); act('dup'); return; }
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); objs().forEach(o => sel.ids.add(o.id)); fullRefresh(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del'); return; }
  if (e.key === 'Escape') { if (sel.crop) sel.crop = null; else { sel.ids.clear(); sel.enter = null; } fullRefresh(); return; }
  if (e.key === 'Enter' && sel.ids.size === 1) { const o = selObjs()[0]; if (o.type === 'text' || o.type === 'sfx') { e.preventDefault(); startEdit(o); } return; }
  const step = e.shiftKey ? 10 : 1;
  const arrows = { ArrowLeft: [-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] };
  if (arrows[e.key] && sel.ids.size) { e.preventDefault(); pushHistory(); moveSel(...arrows[e.key]); draw(); syncProps(); }
});
addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
