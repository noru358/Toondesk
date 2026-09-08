const DEMO_PACKAGE = null;
/* ============================================================
   툰데스크 — EDITOR_SCENE_MODEL_V1 direct-manipulation editor
   Contract source: noru358/jipbap  JIPBAP_V1_SPEC.md §1.4 / §1.4.1
   ============================================================ */
'use strict';

let W = 1080, H = 1350;

/*
 * Engine capability and project defaults are intentionally separate.
 * SHELL is a loaded/default profile, not a hard capability boundary.
 * Project profiles may start objects locked, but explicit user unlock permits
 * frame move/resize/rotation. Profile deviation is a custom override, not corruption.
 */
let SHELL = {
  template_id: 'TOONDESK_GENERIC_DEFAULT',
  profile_id: 'TOONDESK_GENERIC_DEFAULT',
  allow_custom_override: true,
  body_artwork_frame: { x: 0, y: 0, width: 1080, height: 1350 },
  cover_hero_frame:   { x: 0, y: 0, width: 1080, height: 1350 },
  cover_title_safe:   { x: 48, y: 36, width: 984, height: 330, kind: 'soft_hint' },
  body_safe_inset: { left: 48, top: 48, right: 48, bottom: 48, kind: 'soft_hint' },
  body_bands: [],
  semantic_regions: {
    speech: 'freeform_overlay',
    sfx: 'freeform_overlay',
    inner_thought: 'freeform_overlay',
    narration: 'freeform_overlay'
  },
  typography_roles: {},
  default_page_structure: null,
  default_artwork_locked: true
};

function applyShellProfile(data) {
  const canvas = data.canvas || {};
  if (Number.isFinite(canvas.width) && Number.isFinite(canvas.height)) {
    W = canvas.width; H = canvas.height;
  }
  const body = data.body || {};
  const cover = data.cover || {};
  const title = cover.title_region || cover.title_safe_region;
  const meta = body.meta_region;
  const semantics = data.profile_semantics || data.editor_policy || {};
  const pageStructure = data.page_structure?.automatic_default || data.editor_policy?.default_page_structure || null;
  const bodyFrame = body.artwork_frame || SHELL.body_artwork_frame;
  const coverFrame = cover.hero_frame || cover.artwork_frame || SHELL.cover_hero_frame;
  SHELL = {
    template_id: data.template_id || data.schema || SHELL.template_id,
    profile_id: data.profile_id || data.template_id || data.schema || 'CUSTOM_PROFILE',
    allow_custom_override: semantics.allow_custom_override !== false,
    body_artwork_frame: bodyFrame,
    cover_hero_frame: coverFrame,
    cover_title_safe: title || SHELL.cover_title_safe,
    body_safe_inset: body.safe_inset || SHELL.body_safe_inset,
    body_bands: meta ? [{ name: 'meta_region', ...meta }] : (body.preferred_regions || []),
    semantic_regions: body.semantic_placement || SHELL.semantic_regions,
    typography_roles: data.typography_roles || {},
    default_page_structure: pageStructure,
    default_artwork_locked: bodyFrame.default_locked !== false
  };
  doc.template_id = SHELL.template_id;
  const st = $('#stCoord'); if (st) st.textContent = `${W} × ${H}`;
  toast(`프로필 적용: ${SHELL.profile_id}`);
}

const ZBAND = {
  background: [0, 0],
  artwork:    [1, 9],
  lettering:  [10, 99],
  overlay:    [100, 199]
};

/* Typography role presets — implementation defaults, not font locks (§1.4.1) */
const ROLE = {
  title:         { key: 'cover_title',    nominal: 92, min: 72, max: 112, weight: 700, intent: 'friendly_handdrawn_display' },
  menu_tag:      { key: 'cover_menu_tag', nominal: 30, min: 26, max: 34,  weight: 700, intent: 'friendly_round_display' },
  speech:        { key: 'body_speech',    nominal: 42, min: 36, max: 46,  weight: 700, intent: 'friendly_round_body' },
  inner_thought: { key: 'body_thought',   nominal: 38, min: 34, max: 42,  weight: 400, intent: 'friendly_round_body' },
  narration:     { key: 'body_narration', nominal: 36, min: 32, max: 40,  weight: 500, intent: 'friendly_round_body' },
  sfx:           { key: 'body_sfx',       nominal: 64, min: 44, max: 84,  weight: 700, intent: 'handdrawn_display' }
};
const roleOf = o => {
  const r = o.role || '';
  if (ROLE[r]) return ROLE[r];
  if (o.type === 'sfx') return ROLE.sfx;
  return ROLE.narration;
};

/* Runtime font substitution is explicitly allowed; semantic role is authority. */
const FONTS = [
  { id: 'Jua',              label: '주아 · 둥근 친근',      css: '"Jua"' },
  { id: 'Do Hyeon',         label: '도현 · 둥근 굵은',      css: '"Do Hyeon"' },
  { id: 'Gowun Dodum',      label: '고운돋움 · 단정',       css: '"Gowun Dodum"' },
  { id: 'Nanum Gothic',     label: '나눔고딕 · 기본',       css: '"Nanum Gothic"' },
  { id: 'Noto Sans KR',     label: '노토 · 중립',           css: '"Noto Sans KR"' },
  { id: 'Gaegu',            label: '개구 · 손글씨',         css: '"Gaegu"' },
  { id: 'Hi Melody',        label: '하이멜로디 · 손글씨',   css: '"Hi Melody"' },
  { id: 'Nanum Pen Script', label: '나눔펜 · 붓손글씨',     css: '"Nanum Pen Script"' },
  { id: 'Black Han Sans',   label: '검은고딕 · 임팩트',     css: '"Black Han Sans"' }
];
const INTENT_MAP = {
  friendly_round_body: 'Jua',
  friendly_round_display: 'Jua',
  friendly_handdrawn_display: 'Jua',
  handdrawn_display: 'Gaegu',
  NanumSquareRound: 'Jua',
  NanumSquare: 'Do Hyeon'
};
const quoteFont = id => id === 'sans-serif' ? id : '"' + String(id).replace(/"/g, '') + '"';
const fontCssFor = spec => {
  const cfg = typeof spec === 'string' ? { family_intent: spec } : (spec || {});
  const intent = cfg.family_intent;
  const preferred = cfg.preferred_family || INTENT_MAP[intent] || (FONTS.some(f => f.id === intent) ? intent : 'Jua');
  const fallback = Array.isArray(cfg.fallback_families) ? cfg.fallback_families : [];
  const chain = [...new Set([preferred, ...fallback, 'Noto Sans KR', 'sans-serif'].filter(Boolean))];
  const isAvailable = id => id === 'sans-serif' || !document.fonts || document.fonts.check('16px ' + quoteFont(id));
  const resolved = chain.find(isAvailable) || preferred;
  return { id: preferred, preferred, resolved, available: isAvailable(preferred), chain, css: chain.map(quoteFont).join(', ') };
};
function fontDefaults(roleName, fallbackIntent) {
  const rp = ROLE[roleName] || ROLE.narration;
  const prof = SHELL.typography_roles?.[rp.key] || {};
  return {
    family_intent: prof.family_intent || fallbackIntent || rp.intent,
    preferred_family: prof.preferred_family,
    fallback_families: prof.fallback_families,
    weight: prof.weight ?? rp.weight,
    size: prof.nominal_size ?? rp.nominal
  };
}

const ICON = {
  eye:     '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.6 8S3.9 3.8 8 3.8 14.4 8 14.4 8 12.1 12.2 8 12.2 1.6 8 1.6 8Z"/><circle cx="8" cy="8" r="1.9"/></svg>',
  eyeOff:  '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.6 8S3.9 3.8 8 3.8 14.4 8 14.4 8 12.1 12.2 8 12.2 1.6 8 1.6 8Z"/><path d="M3 13 13 3"/></svg>',
  lock:    '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.3" y="7" width="9.4" height="6.4" rx="1.3"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7"/></svg>',
  unlock:  '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.3" y="7" width="9.4" height="6.4" rx="1.3"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.6-.7"/></svg>'
};

/* ---------- tiny utils ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const clone = o => JSON.parse(JSON.stringify(o));
const round2 = n => Math.round(n * 100) / 100;
const uid = p => p + '_' + Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseName = p => String(p || '').split('/').pop();

function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
let DL = null;            // claude.ai downloads capability, when the page runs as an Artifact
const hostMode = () => window.toondeskDesktop ? 'desktop' : DL ? 'artifact' : 'local';
async function saveBlob(blob, name) {
  if (window.toondeskDesktop?.saveFile) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const r = await window.toondeskDesktop.saveFile({ name, bytes });
      return !!r?.saved;
    } catch (e) {
      toast('데스크톱 저장 실패' + (e?.message ? ': ' + e.message : ''), 3000);
      return false;
    }
  }
  if (DL) {
    try { await DL.save({ filename: name, data: blob }); return true; }
    catch (e) {
      const c = e && e.code;
      if (c === 'declined') return false;
      toast('저장 실패' + (c ? ' (' + c + ')' : ''), 3000);
      return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
const saveText = (text, name, type = 'application/json') => saveBlob(new Blob([text], { type }), name);

/* ---------- store-only ZIP (PNG/JSON are already compact enough) ---------- */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) { // files: [{name, data:Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  const u16 = n => [n & 255, (n >> 8) & 255];
  const u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
    parts.push(lh, nm, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += lh.length + nm.length + sz;
  }
  const cs = central.reduce((a, b) => a + b.length, 0);
  central.push(new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cs), ...u32(off), ...u16(0)]));
  return new Blob([...parts, ...central], { type: 'application/zip' });
}
const enc8 = s => new TextEncoder().encode(s);
async function blobBytes(b) { return new Uint8Array(await b.arrayBuffer()); }

/* ---------- document model ---------- */
const doc = {
  name: 'V1_E002',
  template_id: SHELL.template_id,
  manifest: null,
  pages: [],
  images: new Map(),   // basename -> {name, url, img, w, h}
  cur: 0
};

const curPage = () => doc.pages[doc.cur];
const objs = p => (p || curPage()).objects;
const byId = (p, id) => objs(p).find(o => o.id === id);
const groupOf = (p, gid) => (p.groups || []).find(g => g.id === gid);

function roleOfGroup(p, gid) {
  let g = groupOf(p, gid), guard = 0;
  while (g && guard++ < 8) {
    if (['background', 'artwork', 'lettering', 'overlay'].includes(g.role)) return g.role;
    if (!g.parent_id) break;
    g = groupOf(p, g.parent_id);
  }
  // fall back on id convention  sNN.lettering / cover.title …
  const gg = groupOf(p, gid);
  if (gg && /\.(speech|thought|narration|sfx|title|menu_tag)/.test(gg.id)) return 'lettering';
  return 'lettering';
}
function bandFor(p, o) {
  if (o.type === 'artwork') return ZBAND.artwork;
  return ZBAND[roleOfGroup(p, o.group_id)] || ZBAND.lettering;
}

/* geometry helpers */
const rectOf = o => ({ x: o.x || 0, y: o.y || 0, w: o.width || 0, h: o.height || 0 });
function corners(o) {
  const r = rectOf(o), a = (o.rotation || 0) * Math.PI / 180;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, c = Math.cos(a), s = Math.sin(a);
  return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]
    .map(([px, py]) => { const dx = px - cx, dy = py - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; });
}
function aabb(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of list) for (const [px, py] of corners(o)) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function toLocal(o, px, py) {
  const r = rectOf(o), a = -(o.rotation || 0) * Math.PI / 180;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = px - cx, dy = py - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}
const hitObj = (o, px, py) => { const l = toLocal(o, px, py), r = rectOf(o); return l.x >= r.x && l.x <= r.x + r.w && l.y >= r.y && l.y <= r.y + r.h; };

/* ---------- new-object factories ---------- */
function nextGroupIndex(p, kind) {
  const pre = p.page.page_type === 'cover' ? 'cover' : p.id.toLowerCase();
  let n = 1; while ((p.groups || []).some(g => g.id === `${pre}.${kind}.${String(n).padStart(2, '0')}`)) n++;
  return `${pre}.${kind}.${String(n).padStart(2, '0')}`;
}
function ensureGroup(p, id, role, parent) {
  if (!p.groups) p.groups = [];
  if (!groupOf(p, id)) p.groups.push({ id, parent_id: parent || null, role, z_band: ZBAND[role] || ZBAND.lettering, visible: true, locked: false });
  return id;
}
function topGroup(p, role) {
  const pre = p.page.page_type === 'cover' ? 'cover' : p.id.toLowerCase();
  const id = `${pre}.${role}`;
  if (!groupOf(p, id)) { if (!p.groups) p.groups = []; p.groups.push({ id, parent_id: null, role, z_band: ZBAND[role], visible: true, locked: role === 'background' || role === 'artwork' }); }
  return id;
}
function freeZ(p, band) {
  const used = objs(p).filter(o => o.z >= band[0] && o.z <= band[1]).map(o => o.z);
  return clamp((used.length ? Math.max(...used) : band[0] - 1) + 1, band[0], band[1]);
}

function makeParts(p, kind) {
  const pre = p.page.page_type === 'cover' ? 'cover' : p.id.toLowerCase();
  const let_ = topGroup(p, 'lettering');
  const over = topGroup(p, 'overlay');
  const z = freeZ(p, ZBAND.lettering);
  const mk = {};
  if (kind === 'speech' || kind === 'thought') {
    const isS = kind === 'speech';
    const gid = ensureGroup(p, nextGroupIndex(p, isS ? 'speech' : 'thought'), isS ? 'speech' : 'inner_thought', let_);
    const inset = SHELL.body_safe_inset || { left: 48, top: 48, right: 48, bottom: 48 };
    const bx = p.page.page_type === 'cover' ? 70 : (inset.left || 48);
    const by = p.page.page_type === 'cover' ? 400 : (isS ? (inset.top || 48) + 40 : H - (inset.bottom || 48) - 190);
    const bw = p.page.page_type === 'cover' ? 900 : Math.min(760, W - (inset.left || 48) - (inset.right || 48));
    const bh = 140;
    const box = {
      id: uid(isS ? 'bub' : 'thg'), type: isS ? 'bubble' : 'thought_box', role: isS ? 'speech' : 'inner_thought',
      x: bx, y: by, width: bw, height: bh, radius: isS ? 44 : 18,
      fill: isS ? '#ffffff' : '#fff7e8', stroke: isS ? '#221f1d' : '#b7a995', stroke_width: isS ? 4 : 2,
      z, visible: true, rotation: 0, locked: false, group_id: gid
    };
    if (isS) box.tail_to = { x: bx + bw * .55, y: by + bh + 95 };
    const rp = ROLE[isS ? 'speech' : 'inner_thought'];
    const txt = {
      id: uid('txt'), type: 'text', role: isS ? 'speech' : 'inner_thought',
      text: isS ? '여기에 대사' : '여기에 속마음',
      x: bx + 28, y: by + 22, width: bw - 56, height: bh - 44,
      font: fontDefaults(isS ? 'speech' : 'inner_thought', 'friendly_round_body'), fill: '#221f1d',
      align: 'center', rotation: 0, z: z + 1, visible: true, locked: false, group_id: gid
    };
    mk.add = [box, txt]; mk.sel = [box.id, txt.id];
  } else if (kind === 'narration' || kind === 'title' || kind === 'sfx') {
    const isT = kind === 'title', isX = kind === 'sfx';
    const gid = isT ? ensureGroup(p, `${pre}.title`, 'title', let_) : ensureGroup(p, nextGroupIndex(p, kind), kind === 'narration' ? 'narration' : 'sfx', let_);
    const rp = isT ? ROLE.title : isX ? ROLE.sfx : ROLE.narration;
    const o = {
      id: uid('txt'), type: isX ? 'sfx' : 'text', role: isT ? 'title' : isX ? 'sfx' : 'narration',
      text: isT ? '타이틀' : isX ? '톡' : '나레이션 문장',
      x: isT ? 60 : isX ? 90 : (SHELL.body_safe_inset?.left || 48),
      y: isT ? 132 : isX ? 640 : (SHELL.body_safe_inset?.top || 48),
      width: isT ? 900 : isX ? 260 : Math.min(760, W - 2 * (SHELL.body_safe_inset?.left || 48)),
      height: isT ? 100 : isX ? 100 : 90,
      font: fontDefaults(isT ? 'title' : isX ? 'sfx' : 'narration', isX ? 'handdrawn_display' : isT ? 'friendly_handdrawn_display' : 'friendly_round_body'),
      fill: isT ? '#221f1d' : isX ? '#e0562b' : '#221f1d',
      align: isT ? 'left' : 'center', rotation: isX ? -8 : 0, z, visible: true, locked: false, group_id: gid
    };
    if (isX) { o.stroke = '#ffffff'; o.stroke_width = 8; }
    mk.add = [o]; mk.sel = [o.id];
  } else if (kind === 'shape') {
    const gid = ensureGroup(p, nextGroupIndex(p, 'deco'), 'deco', over);
    const o = {
      id: uid('shp'), type: 'shape', shape: 'rounded_rect', x: 420, y: 620, width: 240, height: 120, radius: 20,
      fill: '#e0562b', stroke: 'none', stroke_width: 0, z: freeZ(p, ZBAND.overlay), visible: true, rotation: 0, locked: false, group_id: gid
    };
    mk.add = [o]; mk.sel = [o.id];
  }
  return mk;
}
