/* ============================================================
   Viewport, selection, direct manipulation
   ============================================================ */

const view = { z: 0.5, px: 0, py: 0 };
const sel = { ids: new Set(), enter: null, crop: null, editing: null };
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MINSZ = 24;

let history = [], future = [];
function snapshot() { return JSON.stringify({ pages: doc.pages, cur: doc.cur }); }
function pushHistory() { history.push(snapshot()); if (history.length > 80) history.shift(); future.length = 0; syncUndo(); }
function restore(s) { const d = JSON.parse(s); doc.pages = d.pages; doc.cur = clamp(d.cur, 0, d.pages.length - 1); sel.ids.clear(); sel.enter = null; sel.crop = null; }
function undo() { if (!history.length) return; future.push(snapshot()); restore(history.pop()); syncUndo(); fullRefresh(); }
function redo() { if (!future.length) return; history.push(snapshot()); restore(future.pop()); syncUndo(); fullRefresh(); }
function syncUndo() { $('#btnUndo').disabled = !history.length; $('#btnRedo').disabled = !future.length; }

/* ---------- coordinate transforms ---------- */
const board = $('#board');
function toPage(ev) {
  const r = board.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / view.z, y: (ev.clientY - r.top) / view.z };
}
function toScreen(x, y) {
  const r = board.getBoundingClientRect();
  return { x: r.left + x * view.z, y: r.top + y * view.z };
}
function fitView() {
  const vp = $('#viewport').getBoundingClientRect();
  view.z = Math.min((vp.width - 56) / W, (vp.height - 56) / H);
  view.px = (vp.width - W * view.z) / 2;
  view.py = (vp.height - H * view.z) / 2;
  applyView();
}
function zoomAt(nz, cx, cy) {
  const vp = $('#viewport').getBoundingClientRect();
  const ax = cx == null ? vp.width / 2 : cx - vp.left;
  const ay = cy == null ? vp.height / 2 : cy - vp.top;
  const nzc = clamp(nz, 0.08, 4);
  view.px = ax - (ax - view.px) * (nzc / view.z);
  view.py = ay - (ay - view.py) * (nzc / view.z);
  view.z = nzc;
  applyView();
}
function applyView() {
  const cssW = W * view.z, cssH = H * view.z;
  board.style.width = cssW + 'px'; board.style.height = cssH + 'px';
  board.style.left = Math.round(view.px) + 'px'; board.style.top = Math.round(view.py) + 'px';
  const S = clamp(view.z * (window.devicePixelRatio || 1), 1, 3);
  const bw = Math.round(W * S), bh = Math.round(H * S);
  if (board.width !== bw) { board.width = bw; board.height = bh; }
  const wrap = $('#edwrap');
  wrap.style.left = Math.round(view.px) + 'px'; wrap.style.top = Math.round(view.py) + 'px';
  wrap.style.transform = `scale(${view.z})`;
  $('#stZoom').textContent = Math.round(view.z * 100) + '%';
  draw();
}

/* ---------- selection helpers ---------- */
const selObjs = () => objs().filter(o => sel.ids.has(o.id));
function selectableAt(px, py) {
  const p = curPage();
  const list = zsort(p.objects).filter(o => o.visible !== false).reverse();
  for (const o of list) {
    const g = groupOf(p, o.group_id);
    if (g && g.visible === false) continue;
    if (hitObj(o, px, py)) return o;
  }
  return null;
}
function selectObject(o, additive) {
  if (!o) { if (!additive) { sel.ids.clear(); sel.enter = null; } return; }
  const p = curPage();
  const g = groupOf(p, o.group_id);
  const leaf = g && g.parent_id;
  const ids = (leaf && sel.enter !== g.id)
    ? objs(p).filter(x => x.group_id === g.id).map(x => x.id)
    : [o.id];
  if (!additive) sel.ids.clear();
  ids.forEach(i => sel.ids.add(i));
}
function selBox() {
  const list = selObjs();
  if (!list.length) return null;
  if (list.length === 1 && list[0].rotation) {
    const o = list[0], r = rectOf(o);
    return { ...r, rot: o.rotation, single: o };
  }
  const b = aabb(list);
  return { x: b.x, y: b.y, w: b.w, h: b.h, rot: 0, single: list.length === 1 ? list[0] : null };
}
function boxCorners(b) {
  const a = (b.rot || 0) * Math.PI / 180, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rot = (px, py) => { const dx = px - cx, dy = py - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; };
  return {
    nw: rot(b.x, b.y), n: rot(b.x + b.w / 2, b.y), ne: rot(b.x + b.w, b.y),
    e: rot(b.x + b.w, b.y + b.h / 2), se: rot(b.x + b.w, b.y + b.h),
    s: rot(b.x + b.w / 2, b.y + b.h), sw: rot(b.x, b.y + b.h), w: rot(b.x, b.y + b.h / 2),
    rot: (b.y - 34 / view.z < 6) ? rot(b.x + b.w / 2, b.y + b.h + 34 / view.z) : rot(b.x + b.w / 2, b.y - 34 / view.z)
  };
}
function handleAt(px, py) {
  const b = selBox(); if (!b) return null;
  if (sel.crop) return null;
  const C = boxCorners(b), tol = 9 / view.z;
  for (const k of ['rot', ...HANDLES]) {
    const p = C[k];
    if (Math.abs(px - p[0]) <= tol && Math.abs(py - p[1]) <= tol) return k;
  }
  return null;
}

/* ---------- snapping ---------- */
function snapTargets() {
  const p = curPage(), vs = [0, W / 2, W], hs = [0, H / 2, H];
  const fr = p.page.page_type === 'cover' ? SHELL.cover_hero_frame : SHELL.body_artwork_frame;
  vs.push(fr.x, fr.x + fr.width / 2, fr.x + fr.width);
  hs.push(fr.y, fr.y + fr.height / 2, fr.y + fr.height);
  if (p.page.page_type === 'cover') {
    const t = SHELL.cover_title_safe;
    vs.push(t.x, t.x + t.width); hs.push(t.y, t.y + t.height);
  } else SHELL.body_bands.forEach(b => { hs.push(b.y, b.y + b.height); vs.push(b.x, b.x + b.width); });
  for (const o of objs(p)) {
    if (sel.ids.has(o.id) || o.visible === false) continue;
    const r = rectOf(o);
    vs.push(r.x, r.x + r.w / 2, r.x + r.w); hs.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { vs, hs };
}
let liveGuides = [];
function snapDelta(b, dx, dy) {
  const T = snapTargets(), tol = 7 / view.z;
  const cand = { x: [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], y: [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy] };
  let bx = null, by = null;
  liveGuides = [];
  for (const c of cand.x) for (const t of T.vs) if (Math.abs(c - t) < tol && (bx === null || Math.abs(c - t) < Math.abs(bx.d))) bx = { d: t - c, t };
  for (const c of cand.y) for (const t of T.hs) if (Math.abs(c - t) < tol && (by === null || Math.abs(c - t) < Math.abs(by.d))) by = { d: t - c, t };
  if (bx) { dx += bx.d; liveGuides.push(['v', bx.t]); }
  if (by) { dy += by.d; liveGuides.push(['h', by.t]); }
  return { dx, dy };
}

/* ---------- mutations ---------- */
const movable = o => !o.locked;
function moveSel(dx, dy) {
  for (const o of selObjs()) {
    if (!movable(o)) continue;
    o.x = round2(o.x + dx); o.y = round2(o.y + dy);
    if (o.tail_to) { o.tail_to.x = round2(o.tail_to.x + dx); o.tail_to.y = round2(o.tail_to.y + dy); }
  }
}
function scaleObj(o, sx, sy, ox, oy, scaleFont) {
  o.x = round2(ox + (o.x - ox) * sx); o.y = round2(oy + (o.y - oy) * sy);
  o.width = round2(Math.max(MINSZ, o.width * sx)); o.height = round2(Math.max(MINSZ, o.height * sy));
  if (o.tail_to) { o.tail_to.x = round2(ox + (o.tail_to.x - ox) * sx); o.tail_to.y = round2(oy + (o.tail_to.y - oy) * sy); }
  if (scaleFont && o.font) o.font.size = Math.max(8, Math.round(o.font.size * (sx + sy) / 2));
  if (o.radius) o.radius = round2(o.radius * (sx + sy) / 2);
}
function resizeSingle(o, handle, pw, ph, keepRatio, scaleFont) {
  const r = rectOf(o), a = (o.rotation || 0) * Math.PI / 180;
  const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const L = toLocal(o, pw, ph);
  let nx = r.x, ny = r.y, nw = r.w, nh = r.h;
  if (handle.includes('e')) nw = Math.max(MINSZ, L.x - r.x);
  if (handle.includes('w')) { nw = Math.max(MINSZ, r.x + r.w - L.x); nx = r.x + r.w - nw; }
  if (handle.includes('s')) nh = Math.max(MINSZ, L.y - r.y);
  if (handle.includes('n')) { nh = Math.max(MINSZ, r.y + r.h - L.y); ny = r.y + r.h - nh; }
  if (keepRatio && handle.length === 2) {
    const k = Math.max(nw / r.w, nh / r.h);
    nw = Math.max(MINSZ, r.w * k); nh = Math.max(MINSZ, r.h * k);
    if (handle.includes('w')) nx = r.x + r.w - nw;
    if (handle.includes('n')) ny = r.y + r.h - nh;
  }
  const anchor = { x: handle.includes('w') ? r.x + r.w : r.x, y: handle.includes('n') ? r.y + r.h : r.y };
  const rot = (p, cc) => { const dx = p.x - cc.x, dy = p.y - cc.y; return { x: cc.x + dx * Math.cos(a) - dy * Math.sin(a), y: cc.y + dx * Math.sin(a) + dy * Math.cos(a) }; };
  const nc = { x: nx + nw / 2, y: ny + nh / 2 };
  const wOld = rot(anchor, c), wNew = rot(anchor, nc);
  nx += wOld.x - wNew.x; ny += wOld.y - wNew.y;

  const sx = nw / r.w, sy = nh / r.h;
  const tail = o.tail_to ? { x: o.tail_to.x, y: o.tail_to.y } : null;
  o.x = round2(nx); o.y = round2(ny); o.width = round2(nw); o.height = round2(nh);
  if (tail) { o.tail_to.x = round2(nx + (tail.x - r.x) * sx); o.tail_to.y = round2(ny + (tail.y - r.y) * sy); }
  if (scaleFont && o.font && handle.length === 2) o.font.size = Math.max(8, Math.round(o.font.size * (sx + sy) / 2));
  if (o.radius) o.radius = round2(o.radius * (sx + sy) / 2);
}

/* ---------- overlay drawing ---------- */
function drawOverlay(ctx) {
  const p = curPage(), z = view.z, px = 1 / z;
  ctx.save();
  const fr = p.page.page_type === 'cover' ? SHELL.cover_hero_frame : SHELL.body_artwork_frame;
  ctx.setLineDash([7 * px, 6 * px]); ctx.lineWidth = px;
  ctx.strokeStyle = 'rgba(220,85,43,.45)';
  ctx.strokeRect(fr.x, fr.y, fr.width, fr.height);
  ctx.strokeStyle = 'rgba(27,127,209,.32)';
  if (p.page.page_type === 'cover') {
    const t = SHELL.cover_title_safe; ctx.strokeRect(t.x, t.y, t.width, t.height);
  } else SHELL.body_bands.forEach(b => ctx.strokeRect(b.x, b.y, b.width, b.height));
  ctx.setLineDash([]);

  if (liveGuides.length) {
    ctx.strokeStyle = '#E0562B'; ctx.lineWidth = px;
    for (const [d, v] of liveGuides) {
      ctx.beginPath();
      if (d === 'v') { ctx.moveTo(v, 0); ctx.lineTo(v, H); } else { ctx.moveTo(0, v); ctx.lineTo(W, v); }
      ctx.stroke();
    }
  }

  if (sel.crop) {
    const o = byId(p, sel.crop);
    if (o) {
      const P = artPlace(o), r = rectOf(o);
      ctx.fillStyle = 'rgba(20,16,14,.55)';
      ctx.fillRect(0, 0, W, r.y); ctx.fillRect(0, r.y + r.h, W, H - r.y - r.h);
      ctx.fillRect(0, r.y, r.x, r.h); ctx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h);
      if (P.rec) { ctx.globalAlpha = .35; ctx.drawImage(P.rec.img, P.dx, P.dy, P.dw, P.dh); ctx.globalAlpha = 1; }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * px; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = px;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(r.x + r.w * i / 3, r.y); ctx.lineTo(r.x + r.w * i / 3, r.y + r.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * i / 3); ctx.lineTo(r.x + r.w, r.y + r.h * i / 3); ctx.stroke();
      }
    }
    ctx.restore(); return;
  }

  const b = selBox();
  if (b) {
    const C = boxCorners(b);
    ctx.strokeStyle = '#1B7FD1'; ctx.lineWidth = 1.4 * px;
    ctx.beginPath();
    ctx.moveTo(C.nw[0], C.nw[1]); ctx.lineTo(C.ne[0], C.ne[1]); ctx.lineTo(C.se[0], C.se[1]); ctx.lineTo(C.sw[0], C.sw[1]); ctx.closePath(); ctx.stroke();
    const one = b.single;
    const locked = one && one.locked;
    if (!locked) {
      const anch = (b.y - 34 / view.z < 6) ? C.s : C.n;
      ctx.beginPath(); ctx.moveTo(anch[0], anch[1]); ctx.lineTo(C.rot[0], C.rot[1]); ctx.stroke();
      const hs = 4.5 * px;
      ctx.fillStyle = '#fff';
      for (const k of [...HANDLES, 'rot']) {
        const q = C[k];
        ctx.beginPath();
        if (k === 'rot') ctx.arc(q[0], q[1], hs, 0, 7);
        else ctx.rect(q[0] - hs, q[1] - hs, hs * 2, hs * 2);
        ctx.fill(); ctx.stroke();
      }
    } else {
      ctx.setLineDash([5 * px, 4 * px]); ctx.strokeStyle = '#DC552B';
      ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
    }
    if (one && one.tail_to && !one.locked) {
      ctx.fillStyle = '#DC552B';
      ctx.beginPath(); ctx.arc(one.tail_to.x, one.tail_to.y, 6 * px, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

let rafPending = false;
function draw() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const p = curPage(); if (!p) return;
    const ctx = board.getContext('2d');
    const S = board.width / W;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    renderPage(ctx, p, { hide: sel.editing ? new Set([sel.editing]) : null });
    drawOverlay(ctx);
  });
}
