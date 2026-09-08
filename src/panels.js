/* ============================================================
   Panels
   ============================================================ */

/* ---------- pages ---------- */
function renderPages() {
  const host = $('#pageList');
  host.innerHTML = '';
  doc.pages.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'pageitem'; b.setAttribute('aria-current', i === doc.cur ? 'true' : 'false');
    const c = document.createElement('canvas'); c.width = 88; c.height = 110;
    const cx = c.getContext('2d'); cx.setTransform(88 / W, 0, 0, 110 / H, 0, 0);
    try { renderPage(cx, p); } catch (e) { }
    const info = document.createElement('div');
    const missing = p.objects.some(o => o.type === 'artwork' && !doc.images.get(baseName(o.source)));
    info.innerHTML = `<div class="nm">${esc(p.id)}</div><div class="sub">${p.page.page_type} · ${p.objects.length}개</div>`;
    const flag = document.createElement('div');
    flag.className = 'flag'; flag.textContent = missing ? '⬥' : '';
    flag.title = missing ? '아트워크 미연결' : '';
    b.append(c, info, flag);
    b.onclick = () => { doc.cur = i; sel.ids.clear(); sel.enter = null; sel.crop = null; fullRefresh(); };
    host.appendChild(b);
  });
  $('#docMeta').textContent = `${doc.pages.length} 페이지`;
}

/* ---------- assets ---------- */
function renderAssets() {
  const host = $('#assetGrid'); host.innerHTML = '';
  const used = new Set();
  doc.pages.forEach(p => p.objects.forEach(o => o.source && used.add(baseName(o.source))));
  if (!doc.images.size) {
    host.innerHTML = '<div class="empty" style="grid-column:1/-1">아직 아트워크가 없습니다. 위 영역에 PNG를 끌어다 놓으세요.</div>';
    return;
  }
  for (const [name, rec] of doc.images) {
    const b = document.createElement('button');
    b.className = 'asset' + (used.has(name) ? ' used' : '');
    b.innerHTML = `<img src="${rec.url}" alt=""><div class="nm">${esc(name)}</div>`;
    b.title = `${rec.w}×${rec.h}\n클릭: 선택된 아트워크에 연결`;
    b.onclick = () => {
      const o = selObjs().find(x => x.type === 'artwork');
      if (!o) return toast('먼저 캔버스에서 아트워크를 선택하세요');
      pushHistory(); o.source = '../artwork/' + name; fullRefresh(); toast(`${o.id} ← ${name}`);
    };
    host.appendChild(b);
  }
}

/* ---------- layers ---------- */
function renderLayers() {
  const p = curPage(), host = $('#layerList'); host.innerHTML = '';
  const tops = ['background', 'artwork', 'lettering', 'overlay'];
  const byRole = { background: [], artwork: [], lettering: [], overlay: [] };
  for (const o of zsort(p.objects).slice().reverse()) {
    const role = o.type === 'artwork' ? 'artwork' : roleOfGroup(p, o.group_id);
    (byRole[role] || byRole.lettering).push(o);
  }
  for (const role of tops.slice().reverse()) {
    const list = byRole[role];
    const g = document.createElement('div'); g.className = 'lgroup';
    const band = ZBAND[role];
    g.innerHTML = `<div class="lhead">${role}<span style="flex:1"></span><span class="mono" style="opacity:.7">z ${band[0]}–${band[1]}</span></div>`;
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'empty'; e.style.padding = '2px 6px 6px 16px'; e.style.fontSize = '11px';
      e.textContent = '비어 있음'; g.appendChild(e);
    }
    for (const o of list) {
      const row = document.createElement('div');
      row.className = 'lrow'; row.setAttribute('aria-selected', sel.ids.has(o.id) ? 'true' : 'false');
      const label = o.type === 'text' || o.type === 'sfx'
        ? (String(o.text || '').replace(/\n/g, ' ').slice(0, 22) || '(빈 텍스트)')
        : (o.type === 'artwork' ? baseName(o.source) || 'artwork' : (o.role || o.shape || o.type));
      row.innerHTML = `<span class="ty">${esc((o.role || o.type).slice(0, 8))}</span><span class="nm">${esc(label)}</span><span class="z mono">${o.z}</span>`;
      const vis = document.createElement('button');
      vis.className = 'tg' + (o.visible === false ? ' off' : ''); vis.innerHTML = o.visible === false ? ICON.eyeOff : ICON.eye;
      vis.title = '표시/숨김';
      vis.onclick = e => { e.stopPropagation(); pushHistory(); o.visible = o.visible === false; fullRefresh(); };
      const lk = document.createElement('button');
      lk.className = 'tg' + (o.locked ? '' : ' off'); lk.innerHTML = o.locked ? ICON.lock : ICON.unlock;
      lk.title = o.type === 'artwork' ? '프레임 기본 잠금 · 해제 시 CUSTOM_OVERRIDE' : '잠금';
      lk.onclick = e => { e.stopPropagation(); pushHistory(); o.locked = !o.locked; fullRefresh(); };
      row.append(vis, lk);
      row.onclick = e => { selectObject(o, e.shiftKey); sel.enter = groupOf(p, o.group_id)?.parent_id ? o.group_id : null; fullRefresh(); };
      g.appendChild(row);
    }
    host.appendChild(g);
  }
  $('#layerCount').textContent = p.objects.length + '개';
}

function ctlNum(id, label, val, step = 1) {
  return `<div class="ctl"><label for="${id}">${label}</label><input class="f n" id="${id}" type="number" step="${step}" value="${val}"></div>`;
}
let ctxKey = '';
function renderCtx(force) {
  const list = selObjs();
  const key = list.map(o => o.id).sort().join('|') + '/' + (sel.crop || '') + '/' + doc.cur;
  if (key === ctxKey && !force) return;
  ctxKey = key;
  const bar = $('#ctxbar'), p = curPage();
  const common = `<span class="sep"></span><div class="seg"><button class="btn" data-act="front">앞으로</button><button class="btn" data-act="back">뒤로</button></div><button class="btn" data-act="dup">복제</button><button class="btn" data-act="del">삭제</button>`;

  if (!list.length) {
    bar.innerHTML = `<span class="lbl">${esc(p.id)} · ${p.page.page_type}</span><span class="sep"></span><div class="ctl"><label>배경</label><input class="f" type="color" id="cBg" value="${p.page.background || '#ffffff'}"></div><span class="sep"></span><span class="hint">개체 클릭 · 더블클릭 텍스트 편집 / 아트워크 크롭</span>`;
  } else if (sel.crop) {
    const o = byId(p, sel.crop);
    bar.innerHTML = `<span class="lbl">크롭 모드</span><div class="ctl"><label>배율</label><input type="range" id="cScale" min="1" max="4" step="0.01" value="${(o.crop?.scale) || 1}"><span class="mono" id="cScaleV">${((o.crop?.scale) || 1).toFixed(2)}×</span></div><button class="btn" data-act="cropReset">초기화</button><button class="btn primary" data-act="cropDone">완료</button>`;
  } else if (list.length === 1 && list[0].type === 'artwork') {
    const o = list[0], has = !!doc.images.get(baseName(o.source));
    bar.innerHTML = `<span class="lbl">아트워크</span><span class="mono hint">${esc(baseName(o.source) || '미지정')}</span><span class="sep"></span><button class="btn" data-act="crop" ${has ? '' : 'disabled'}>크롭</button><button class="btn" data-act="replace">교체</button><button class="btn" data-act="cropReset">크롭 초기화</button><span class="sep"></span><button class="btn ${o.locked ? 'on' : ''}" data-act="lock">${o.locked ? '기본 잠금' : 'CUSTOM OVERRIDE'}</button>`;
  } else if (list.some(x => x.type === 'text' || x.type === 'sfx')) {
    const o = list.find(x => x.type === 'text' || x.type === 'sfx'), f = o.font || {}, R = roleOf(o);
    const opts = FONTS.map(x => `<option value="${x.id}" ${fontCssFor(f.family_intent).id === x.id ? 'selected' : ''}>${x.label}</option>`).join('');
    bar.innerHTML = `<span class="lbl">${esc(o.role || o.type)}</span><select class="f" id="tFam">${opts}</select>${ctlNum('tSize','크기',f.size||R.nominal)}<div class="ctl"><label>굵기</label><select class="f" id="tWeight">${[400,500,700,800].map(w=>`<option ${(f.weight||400)==w?'selected':''}>${w}</option>`).join('')}</select></div><input class="f" type="color" id="tFill" value="${o.fill || '#221f1d'}"><span class="sep"></span><div class="seg">${['left','center','right'].map(a=>`<button class="btn ${(o.align||'center')===a?'on':''}" data-act="al-${a}">${a}</button>`).join('')}</div>${ctlNum('tLh','행간',f.line_height||1.15,.02)}<button class="btn" data-act="fit">자동맞춤</button>${common}`;
  } else if (list.length === 1 && (list[0].type === 'bubble' || list[0].type === 'thought_box' || list[0].type === 'shape')) {
    const o = list[0];
    bar.innerHTML = `<span class="lbl">${esc(o.role || o.type)}</span><div class="ctl"><label>채움</label><input class="f" type="color" id="bFill" value="${o.fill && o.fill !== 'none' ? o.fill : '#ffffff'}"></div><div class="ctl"><label>선</label><input class="f" type="color" id="bStroke" value="${o.stroke && o.stroke !== 'none' ? o.stroke : '#221f1d'}"></div>${ctlNum('bSw','선굵기',o.stroke_width||0)}${ctlNum('bR','라운드',o.radius??18)}${o.type==='bubble'?'<button class="btn" data-act="tail">꼬리</button>':''}${common}`;
  } else {
    bar.innerHTML = `<span class="lbl">${list.length}개 선택</span><button class="btn" data-act="alignL">왼쪽</button><button class="btn" data-act="alignC">가운데</button><button class="btn" data-act="alignR">오른쪽</button>${common}`;
  }
  wireCtx();
}

function wireCtx() {
  const p = curPage(), list = selObjs();
  const texts = list.filter(x => x.type === 'text' || x.type === 'sfx');
  const o = list.length === 1 ? list[0] : (list.find(x => x.type !== 'text' && x.type !== 'sfx') || list[0]);
  const on = (id, ev, fn) => { const e = $('#' + id); if (e) e.addEventListener(ev, fn); };
  $$('#ctxbar [data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
  on('cBg','input',e=>{p.page.background=e.target.value;draw();renderPages();});
  on('cScale','input',e=>{const v=+e.target.value;$('#cScaleV').textContent=v.toFixed(2)+'×';const t=byId(p,sel.crop);t.crop=t.crop||{};t.crop.scale=v;draw();});
  on('tFam','change',e=>{pushHistory();texts.forEach(t=>{t.font=t.font||{};t.font.family_intent=e.target.value;});fullRefresh();});
  on('tSize','input',e=>{texts.forEach(t=>t.font.size=Math.max(6,+e.target.value||6));draw();});
  on('tWeight','change',e=>{pushHistory();texts.forEach(t=>t.font.weight=+e.target.value);fullRefresh();});
  on('tFill','input',e=>{texts.forEach(t=>t.fill=e.target.value);draw();});
  on('tLh','input',e=>{texts.forEach(t=>t.font.line_height=Math.max(.7,+e.target.value||1.15));draw();});
  if (o) {
    on('bFill','input',e=>{o.fill=e.target.value;draw();});
    on('bStroke','input',e=>{o.stroke=e.target.value;draw();});
    on('bSw','input',e=>{o.stroke_width=Math.max(0,+e.target.value||0);draw();});
    on('bR','input',e=>{o.radius=Math.max(0,+e.target.value||0);draw();});
  }
}

function renderProps() {
  const host = $('#propBody'), list = selObjs();
  if (!list.length) { host.innerHTML = '<div class="empty">선택된 개체 없음</div>'; return; }
  const o = list[0], multi = list.length > 1, p = curPage(), band = bandFor(p,o);
  host.innerHTML = `<div class="grid2"><div class="field"><label>X</label><input id="pX" type="number" value="${round2(o.x)}" ${multi?'disabled':''}></div><div class="field"><label>Y</label><input id="pY" type="number" value="${round2(o.y)}" ${multi?'disabled':''}></div><div class="field"><label>W</label><input id="pW" type="number" value="${round2(o.width)}" ${multi?'disabled':''}></div><div class="field"><label>H</label><input id="pH" type="number" value="${round2(o.height)}" ${multi?'disabled':''}></div><div class="field"><label>회전</label><input id="pR" type="number" value="${round2(o.rotation||0)}" ${multi?'disabled':''}></div><div class="field"><label>Z ${band[0]}–${band[1]}</label><input id="pZ" type="number" value="${o.z}" ${multi?'disabled':''}></div></div><div class="hint" style="margin-top:9px">${esc(o.id)} · ${esc(o.group_id||'—')}</div>`;
  if (multi) return;
  const bind=(id,fn)=>$('#'+id).addEventListener('change',e=>{pushHistory();const v=+e.target.value;if(Number.isFinite(v))fn(v);fullRefresh();});
  bind('pX',v=>o.x=v);bind('pY',v=>o.y=v);bind('pW',v=>o.width=Math.max(MINSZ,v));bind('pH',v=>o.height=Math.max(MINSZ,v));bind('pR',v=>o.rotation=v);bind('pZ',v=>o.z=Math.round(clamp(v,band[0],band[1]));
}
function syncProps(){const l=selObjs();if(l.length!==1)return;const o=l[0];for(const [id,v] of [['pX',o.x],['pY',o.y],['pW',o.width],['pH',o.height],['pR',o.rotation||0],['pZ',o.z]]){const e=$('#'+id);if(e&&document.activeElement!==e)e.value=round2(v);}}

function renderPageProps() {
  const p=curPage();
  $('#pageProps').innerHTML=`<div class="grid2"><div class="field"><label>이름</label><input id="ppId" value="${esc(p.id)}"></div><div class="field"><label>종류</label><select id="ppType"><option value="body" ${p.page.page_type==='body'?'selected':''}>body</option><option value="cover" ${p.page.page_type==='cover'?'selected':''}>cover</option><option value="generic" ${p.page.page_type==='generic'?'selected':''}>generic</option></select></div></div><div style="margin-top:9px;display:flex;gap:7px"><input class="f" type="color" id="ppBg" value="${p.page.background||'#ffffff'}"><button class="btn" id="ppDel">삭제</button></div>`;
  $('#ppId').onchange=e=>{pushHistory();p.id=e.target.value.trim()||p.id;fullRefresh();};
  $('#ppType').onchange=e=>{pushHistory();p.page.page_type=e.target.value;fullRefresh();};
  $('#ppBg').oninput=e=>{p.page.background=e.target.value;draw();renderPages();};
  $('#ppDel').onclick=()=>{if(doc.pages.length<2)return toast('마지막 페이지는 삭제할 수 없습니다');pushHistory();doc.pages.splice(doc.cur,1);doc.cur=Math.max(0,doc.cur-1);sel.ids.clear();fullRefresh();};
}

function collectIssues() {
  const out=[];
  doc.pages.forEach((p,pi)=>{
    const push=(lvl,msg,id)=>out.push({lvl,msg,page:pi,id,where:p.id+(id?' · '+id:'')});
    for(const o of p.objects){
      if(o.type==='artwork'){
        if(!o.source)push('bad','아트워크 source가 비어 있음',o.id);
        else if(!doc.images.get(baseName(o.source)))push('warn',`아트워크 미연결 (${baseName(o.source)})`,o.id);
      }
      const band=bandFor(p,o);if(o.z<band[0]||o.z>band[1])push('bad',`z ${o.z}가 밴드 ${band[0]}–${band[1]} 밖`,o.id);
      const r=rectOf(o);if(r.x<-4||r.y<-4||r.x+r.w>W+4||r.y+r.h>H+4)push('warn','캔버스 밖으로 나감',o.id);
      if(o.type==='text'||o.type==='sfx'){const L=layoutText(o);if(L.overflow)push('bad','글자가 박스를 넘침',o.id);}
    }
  });
  return out;
}
function renderInspect(){const issues=collectIssues(),host=$('#inspectList'),bad=issues.filter(i=>i.lvl==='bad').length;const ov=typeof customOverrideState==='function'?customOverrideState():{active:false};$('#inspectPill').innerHTML=bad?`<span class="pill bad">${bad} 오류</span>`:ov.active?'<span class="pill warn">CUSTOM</span>':issues.length?`<span class="pill warn">${issues.length} 주의</span>`:'<span class="pill ok">통과</span>';host.innerHTML='';if(!issues.length){host.innerHTML=`<div class="empty">${ov.active?'프로필에서 의도적으로 override된 상태입니다.':'검사 통과.'}</div>`;return;}issues.forEach(i=>{const b=document.createElement('button');b.className='issue';b.innerHTML=`<span class="dot ${i.lvl}"></span><span>${esc(i.msg)}<br><span class="where">${esc(i.where)}</span></span>`;b.onclick=()=>{doc.cur=i.page;sel.ids.clear();if(i.id)sel.ids.add(i.id);fullRefresh();};host.appendChild(b);});}

function fullRefresh(){renderPages();renderAssets();renderLayers();renderCtx(true);renderProps();renderPageProps();renderInspect();const n=sel.ids.size;$('#stSel').textContent=n===0?'선택 없음':n===1?[...sel.ids][0]:n+'개 선택';draw();persist();}
