/* ToonDesk UI wiring + boot */

$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  ['pages','assets','add'].forEach(k => $('#tab' + k[0].toUpperCase() + k.slice(1)).hidden = k !== t.dataset.tab);
}));

$$('[data-add]').forEach(b => b.addEventListener('click', () => {
  const p = curPage(); if (!p) return;
  pushHistory();
  const mk = makeParts(p, b.dataset.add);
  if (!mk?.add) return;
  p.objects.push(...mk.add); sel.ids.clear(); mk.sel.forEach(i => sel.ids.add(i));
  fullRefresh();
}));

function genericPage(id, type='body') {
  const pre = id.toLowerCase();
  const frame = type === 'cover' ? SHELL.cover_hero_frame : SHELL.body_artwork_frame;
  return {
    id,
    page:{width:W,height:H,background:'#fff9f0',page_type:type},
    groups:['background','artwork','lettering','overlay'].map(r => ({
      id:`${pre}.${r}`, parent_id:null, role:r, z_band:ZBAND[r],
      visible:true, locked:r === 'background' || r === 'artwork'
    })),
    objects:[{
      id:`${pre}_art`, type:'artwork', source:`../artwork/${id}.png`,
      x:frame.x,y:frame.y,width:frame.width,height:frame.height,
      fit:'frame_crop',allow_stretch:false,z:1,visible:true,rotation:0,
      group_id:`${pre}.artwork`,locked:SHELL.default_artwork_locked !== false,
      crop:{mode:'frame_crop',scale:1,offset_x:0,offset_y:0,anchor_x:.5,anchor_y:.5,
        allow_stretch:false,allow_rotation:false,clamp_to_frame:true,editable:true}
    }]
  };
}

$('#btnDupPage').onclick = () => {
  if (!curPage()) return;
  pushHistory();
  const src=curPage(), c=clone(src);
  let n=1, nid;
  do { nid='P'+String(n++).padStart(2,'0'); } while(doc.pages.some(p=>p.id===nid));
  const old=src.id.toLowerCase(), neu=nid.toLowerCase();
  c.id=nid;
  c.groups=(c.groups||[]).map(g=>({...g,id:g.id.replace(old,neu),parent_id:g.parent_id?g.parent_id.replace(old,neu):null}));
  c.objects=c.objects.map(o=>({...o,id:uid(o.type.slice(0,3)),group_id:(o.group_id||'').replace(old,neu)}));
  doc.pages.splice(doc.cur+1,0,c); doc.cur++; sel.ids.clear(); fullRefresh();
};

$('#btnNewPage').onclick = () => {
  pushHistory();
  let n=1,id; do{id='P'+String(n++).padStart(2,'0')}while(doc.pages.some(p=>p.id===id));
  doc.pages.splice(doc.cur+1,0,genericPage(id,'body')); doc.cur++; sel.ids.clear(); fullRefresh();
};

$('#docName').onchange=e=>{doc.name=e.target.value.trim()||doc.name;persist();};
$('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
$('#btnZoomIn').onclick=()=>zoomAt(view.z*1.2);
$('#btnZoomOut').onclick=()=>zoomAt(view.z/1.2);
$('#btnZoomFit').onclick=fitView;
$('#tgLeft').onclick=()=>$('#panelLeft').hidden=!$('#panelLeft').hidden;
$('#tgRight').onclick=()=>$('#panelRight').hidden=!$('#panelRight').hidden;
$('#btnTheme').onclick=()=>{
  const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='dark'?'light':cur==='light'?'':'dark';
  next?document.documentElement.setAttribute('data-theme',next):document.documentElement.removeAttribute('data-theme');
  try{localStorage.setItem('toondesk.theme',next)}catch{}
};
$('#filePick').onchange=e=>{handleFiles(e.target.files);e.target.value='';};
$('#dirPick').onchange=e=>{handleFiles(e.target.files);e.target.value='';};

$('#btnOpen').onclick=()=>modal('프로젝트 열기',
  '<p>layout JSON, artwork 이미지, presentation-shell/profile JSON 또는 프로젝트 폴더를 불러올 수 있습니다.</p>'+
  '<div style="display:grid;gap:8px"><button class="btn" id="oDir">폴더 열기</button>'+
  '<button class="btn" id="oFiles">파일 선택</button><button class="btn" id="oBlank">새 빈 문서</button></div>',
  '<button class="btn" id="oCancel">닫기</button>',()=>{
    $('#oDir').onclick=()=>{closeModal();$('#dirPick').click();};
    $('#oFiles').onclick=()=>{closeModal();$('#filePick').click();};
    $('#oBlank').onclick=()=>{closeModal();loadBlank();fitView();fullRefresh();};
    $('#oCancel').onclick=closeModal;
  });

$('#btnPaste').onclick=()=>modal('레이아웃 JSON 붙여넣기',
  '<p>EDITABLE_COMPOSITION_PACKAGE_V1 페이지 또는 페이지 묶음을 붙여넣으세요.</p>'+
  '<textarea id="pasteBox" placeholder="{&quot;schema&quot;:&quot;EDITABLE_COMPOSITION_PACKAGE_V1&quot;,...}"></textarea>',
  '<button class="btn" id="pCancel">취소</button><button class="btn primary" id="pOk">불러오기</button>',()=>{
    $('#pCancel').onclick=closeModal;
    $('#pOk').onclick=()=>{
      let d; try{d=JSON.parse($('#pasteBox').value)}catch(e){return toast('JSON 파싱 실패: '+e.message,3000)}
      pushHistory(); let n=0;
      const take=(name,obj)=>{if(obj?.schema==='EDITABLE_COMPOSITION_PACKAGE_V1'&&obj.objects){addLayout(name,obj);n++;}};
      if(d.schema==='EDITABLE_COMPOSITION_PACKAGE_V1') take(d.page_id||'PAGE.layout.json',d);
      else if(d.layouts) Object.entries(d.layouts).forEach(([k,v])=>take(k,v));
      else Object.entries(d).forEach(([k,v])=>take(k,v));
      if(!n)return toast('레이아웃을 찾지 못했습니다');
      sortPages();doc.cur=0;sel.ids.clear();closeModal();fitView();fullRefresh();
    };
  });

$('#btnExport').onclick=()=>{
  const issues=collectIssues(), bad=issues.filter(i=>i.lvl==='bad').length, ov=customOverrideState();
  modal('내보내기',
    `<p>${bad?'<b>검사 오류 '+bad+'건</b>':ov.active?'<b>CUSTOM_OVERRIDE</b> · 프로필 기본값에서 명시적으로 수정된 상태':'검사 통과'}</p>
    <div style="display:grid;gap:8px">
      <button class="btn" id="e1">현재 PNG</button><button class="btn" id="e2">현재 SVG</button>
      <button class="btn" id="e3">전체 PNG ZIP</button><button class="btn primary" id="e4">패키지 ZIP</button>
      <button class="btn" id="e5">ToonDesk 세션 파일</button><button class="btn" id="e6">현재 layout.json 복사</button>
    </div>`,
    '<button class="btn" id="eClose">닫기</button>',()=>{
      $('#eClose').onclick=closeModal;
      $('#e1').onclick=async()=>{closeModal();await exportPNG(1)};
      $('#e2').onclick=async()=>{closeModal();await saveText(pageToSVG(curPage()),doc.name+'_'+curPage().id+'.svg','image/svg+xml')};
      $('#e3').onclick=async()=>{closeModal();await exportPackage('png')};
      $('#e4').onclick=async()=>{closeModal();await exportPackage('all')};
      $('#e5').onclick=()=>{closeModal();saveText(JSON.stringify(projectJSON()),doc.name+'.toondesk.json')};
      $('#e6').onclick=async()=>{const s=JSON.stringify(layoutJSON(curPage()),null,2);try{await navigator.clipboard.writeText(s);toast('복사됨')}catch{await saveText(s,curPage().id+'.layout.json')}closeModal();};
    });
};

addEventListener('resize',applyView);

function loadBlank(){
  doc.pages=[];doc.images.clear();doc.manifest=null;doc.name='UNTITLED';doc.template_id=SHELL.template_id;
  doc.pages.push(genericPage('P01','body'));doc.cur=0;$('#docName').value=doc.name;
  history.length=0;future.length=0;syncUndo();
}

(async function boot(){
  try{const th=localStorage.getItem('toondesk.theme');if(th)document.documentElement.setAttribute('data-theme',th)}catch{}
  const saved=await loadPersisted();
  if(saved?.pages?.length) await loadProject(saved); else loadBlank();
  fitView();fullRefresh();syncUndo();
  document.fonts?.ready?.then(()=>fullRefresh());
})();
