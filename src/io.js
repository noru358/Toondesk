/* ---------- import ---------- */
function pageIdFrom(name, data) {
  const m = String(name).match(/([A-Za-z0-9_]+)\.layout\.json$/i);
  if (m) return m[1].toUpperCase() === 'COVER' ? 'COVER' : m[1].toUpperCase();
  const gid = (data.groups || [])[0]?.id || '';
  const pre = gid.split('.')[0];
  return pre ? pre.toUpperCase() : 'PAGE' + (doc.pages.length + 1);
}
function sortPages() {
  doc.pages.sort((a, b) => {
    const rank = x => x.page.page_type === 'cover' ? -1 : 0;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}
function addLayout(name, data) {
  const id = pageIdFrom(name, data);
  const page = {
    id,
    page: { width: W, height: H, background: '#ffffff', page_type: 'body', ...(data.page || {}) },
    objects: (data.objects || []).map(o => {
      const n = { visible: true, locked: false, rotation: 0, z: 10, ...o };
      if ((n.type === 'text' || n.type === 'sfx') && !n.align)
        n.align = (n.role === 'title' || n.role === 'menu_tag') ? 'left' : 'center';
      return n;
    }),
    groups: data.groups || []
  };
  const ex = doc.pages.findIndex(p => p.id === id);
  if (ex >= 0) doc.pages[ex] = page; else doc.pages.push(page);
}
async function addImageFile(file) {
  const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  const img = new Image(); img.src = url;
  await img.decode().catch(() => { });
  doc.images.set(file.name, { name: file.name, url, img, w: img.naturalWidth, h: img.naturalHeight });
}
async function handleFiles(files) {
  let layouts = 0, imgs = 0, project = false;
  const arr = [...files];
  for (const f of arr) {
    const nm = f.name.toLowerCase();
    if (/\.(png|jpe?g|webp)$/.test(nm)) { await addImageFile(f); imgs++; continue; }
    if (!/\.json$|\.toondesk$/.test(nm)) continue;
    let data; try { data = JSON.parse(await f.text()); } catch { continue; }
    if (data.schema === 'TOONDESK_PROJECT_V1') { await loadProject(data); project = true; continue; }
    if (typeof data.schema === 'string' && (data.schema.includes('PRESENTATION_SHELL') || data.profile_id || data.editor_policy?.profile)) {
      applyShellProfile(data); project = true; continue;
    }
    if (data.schema === 'EDITABLE_COMPOSITION_PACKAGE_V1' && data.objects) { if (!layouts) { doc.pages = []; } addLayout(f.name, data); layouts++; continue; }
    if (data.episode) { doc.manifest = data; doc.name = data.episode; $('#docName').value = data.episode; }
  }
  if (pendingReplace && imgs === 1) {
    const o = byId(curPage(), pendingReplace);
    if (o) { pushHistory(); o.source = '../artwork/' + arr.find(f => /\.(png|jpe?g|webp)$/i.test(f.name)).name; }
    pendingReplace = null;
  }
  if (layouts) { sortPages(); doc.cur = 0; sel.ids.clear(); }
  if (layouts || imgs || project) {
    history.length = 0; future.length = 0; syncUndo();
    fitView(); fullRefresh(); persist();
    toast(`${layouts ? '레이아웃 ' + layouts + '개 · ' : ''}${imgs ? '이미지 ' + imgs + '개 ' : ''}불러옴`);
  } else toast('읽을 수 있는 파일이 없습니다');
}

async function loadDesktopProject(payload) {
  if (!payload?.text) return false;
  try {
    const f = new File([payload.text], payload.name || 'project.toondesk', { type: 'application/json' });
    await handleFiles([f]);
    return true;
  } catch (e) {
    toast('프로젝트 열기 실패: ' + (e?.message || e), 3200);
    return false;
  }
}
async function readEntries(items) {
  const files = [];
  const walk = async entry => {
    if (!entry) return;
    if (entry.isFile) files.push(await new Promise(r => entry.file(r)));
    else if (entry.isDirectory) {
      const rd = entry.createReader();
      const batch = await new Promise(r => rd.readEntries(r));
      for (const e of batch) await walk(e);
    }
  };
  for (const it of items) { const e = it.webkitGetAsEntry && it.webkitGetAsEntry(); if (e) await walk(e); else if (it.getAsFile) files.push(it.getAsFile()); }
  return files;
}
['dragover', 'drop'].forEach(t => addEventListener(t, e => e.preventDefault()));
addEventListener('drop', async e => {
  e.preventDefault();
  const files = e.dataTransfer.items ? await readEntries(e.dataTransfer.items) : [...e.dataTransfer.files];
  if (files.length) handleFiles(files.filter(Boolean));
});

/* ---------- export ---------- */
function layoutJSON(p) {
  return {
    schema: 'EDITABLE_COMPOSITION_PACKAGE_V1',
    template_id: doc.template_id,
    page: p.page,
    objects: p.objects,
    scene_model: 'EDITOR_SCENE_MODEL_V1',
    groups: p.groups || []
  };
}
function customOverrideState() {
  const reasons = [];
  const eps = 0.01;
  const same = (a, b) => Math.abs((a || 0) - (b || 0)) <= eps;
  const expected = SHELL.default_page_structure;
  if (expected) {
    const actual = { cover: doc.pages.filter(p => p.page.page_type === 'cover').length, body: doc.pages.filter(p => p.page.page_type === 'body').length };
    for (const k of ['cover', 'body']) if (Number.isFinite(expected[k]) && actual[k] !== expected[k]) reasons.push(`page_structure:${k}:${actual[k]}!=${expected[k]}`);
  }
  for (const p of doc.pages) {
    const frame = p.page.page_type === 'cover' ? SHELL.cover_hero_frame : SHELL.body_artwork_frame;
    for (const o of p.objects.filter(x => x.type === 'artwork')) {
      if (!o.locked) reasons.push(`${p.id}:${o.id}:frame_unlocked`);
      if (!same(o.x, frame.x) || !same(o.y, frame.y) || !same(o.width, frame.width) || !same(o.height, frame.height) || !same(o.rotation || 0, 0))
        reasons.push(`${p.id}:${o.id}:frame_geometry`);
    }
  }
  return { active: reasons.length > 0, reasons: [...new Set(reasons)] };
}

function manifestJSON() {
  const override = customOverrideState();
  return {
    ...(doc.manifest || {}),
    schema: 'EDITABLE_COMPOSITION_PACKAGE_V1',
    episode: doc.name,
    template_id: doc.template_id,
    editor_profile: SHELL.profile_id,
    custom_override_allowed: SHELL.allow_custom_override,
    custom_override: override.active,
    custom_override_reasons: override.reasons,
    presentation_authority: `episodes/${doc.name}/composition/*.layout.json`,
    canvas: { width: W, height: H, ratio: '4:5' },
    body_artwork_frame: { ...SHELL.body_artwork_frame, allow_stretch: false },
    cover_hero_frame: { ...SHELL.cover_hero_frame, allow_stretch: false },
    scene_model: 'EDITOR_SCENE_MODEL_V1',
    layer_contract: 'FOUR_LAYER_SHARED_V1',
    artwork_frame_transform: override.active ? 'custom_override_possible' : 'profile_default_locked',
    artwork_crop: 'editable_metadata_only',
    pages: doc.pages.map(p => p.id),
    font_resolution: doc.pages.flatMap(p => p.objects)
      .filter(o => o.type === 'text' || o.type === 'sfx')
      .map(o => {
        const r = fontCssFor(o.font || {});
        return { object_id: o.id, preferred: r.preferred, resolved: r.resolved, substituted: !r.available };
      }),
    edited_with: 'TOONDESK/1.1'
  };
}
const pngBlob = (page, scale) => new Promise(r => rasterize(page, scale).toBlob(r, 'image/png'));

async function exportPNG(scale = 1) {
  const p = curPage();
  if (await saveBlob(await pngBlob(p, scale), `${doc.name}_${p.id}.png`)) toast(`${p.id}.png 저장`);
}
async function exportAllPNG() {
  let n = 0;
  for (const p of doc.pages) {
    toast(`${p.id} 저장 중… (${n + 1}/${doc.pages.length})`, 4000);
    if (!await saveBlob(await pngBlob(p, 1), `${doc.name}_${p.id}.png`)) break;
    n++;
  }
  toast(`${n}장 저장`);
}
function packageJSON() {
  return {
    schema: 'TOONDESK_PACKAGE_V1',
    episode: doc.name,
    manifest: manifestJSON(),
    composition: Object.fromEntries(doc.pages.map(p => [`${p.id}.layout.json`, layoutJSON(p)])),
    editable: Object.fromEntries(doc.pages.map(p => [`${p.id}.svg`, pageToSVG(p)]))
  };
}
async function exportPackage(kind) {
  const files = [];
  const put = (n, s) => files.push({ name: n, data: enc8(s) });
  if (kind !== 'png') {
    put(`${doc.name}/composition/manifest.json`, JSON.stringify(manifestJSON(), null, 2));
    for (const p of doc.pages) put(`${doc.name}/composition/${p.id}.layout.json`, JSON.stringify(layoutJSON(p), null, 2));
    for (const p of doc.pages) put(`${doc.name}/editable/${p.id}.svg`, pageToSVG(p));
  }
  for (const p of doc.pages) files.push({ name: `${doc.name}/export/${p.id}.png`, data: await blobBytes(await pngBlob(p, 1)) });
  await saveBlob(zip(files), `${doc.name}${kind === 'png' ? '_png' : '_package'}.zip`);
  toast('ZIP 저장 완료');
}
function projectJSON() {
  return {
    schema: 'TOONDESK_PROJECT_V1', name: doc.name, template_id: doc.template_id,
    profile: SHELL, manifest: doc.manifest, pages: doc.pages,
    images: [...doc.images.values()].map(r => ({ name: r.name, url: r.url }))
  };
}
async function loadProject(d) {
  doc.name = d.name || doc.name;
  if (d.profile) {
    SHELL = { ...SHELL, ...d.profile };
    W = d.pages?.[0]?.page?.width || W; H = d.pages?.[0]?.page?.height || H;
  }
  doc.template_id = d.template_id || SHELL.template_id;
  doc.manifest = d.manifest || null; doc.pages = d.pages || []; doc.images.clear();
  for (const r of (d.images || [])) {
    const img = new Image(); img.src = r.url; await img.decode().catch(() => { });
    doc.images.set(r.name, { name: r.name, url: r.url, img, w: img.naturalWidth, h: img.naturalHeight });
  }
  doc.cur = 0; $('#docName').value = doc.name;
}

let idb = null;
function openDB() {
  return new Promise(res => {
    const rq = indexedDB.open('toondesk', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null);
  });
}
let persistT = null;
function persist() {
  clearTimeout(persistT);
  persistT = setTimeout(async () => {
    try {
      idb = idb || await openDB(); if (!idb) return;
      idb.transaction('kv', 'readwrite').objectStore('kv').put(projectJSON(), 'current');
    } catch (e) { }
  }, 1200);
}
async function loadPersisted() {
  try {
    idb = idb || await openDB(); if (!idb) return null;
    return await new Promise(r => {
      const rq = idb.transaction('kv', 'readonly').objectStore('kv').get('current');
      rq.onsuccess = () => r(rq.result || null); rq.onerror = () => r(null);
    });
  } catch (e) { return null; }
}

function modal(title, bodyHTML, footHTML, wire) {
  $('#mTitle').textContent = title; $('#mBody').innerHTML = bodyHTML; $('#mFoot').innerHTML = footHTML;
  $('#modal').classList.add('show');
  if (wire) wire();
}
const closeModal = () => $('#modal').classList.remove('show');
$('#mClose').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
