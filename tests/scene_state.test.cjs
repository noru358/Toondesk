const test = require('node:test');
const assert = require('node:assert/strict');
const SceneState = require('../src/scene_state.js');

test('manual position survives reconstruction while unmarked size follows incoming layout', () => {
  const current = {
    id:'txt1', type:'text', x:120, y:240, width:300, height:100,
    text:'원문', manual_overrides:['position']
  };
  const incoming = {
    id:'txt1', type:'text', x:20, y:30, width:500, height:140,
    text:'원문'
  };
  const out = SceneState.mergeObject(current, incoming);
  assert.equal(out.x, 120);
  assert.equal(out.y, 240);
  assert.equal(out.width, 500);
  assert.equal(out.height, 140);
});

test('line-break-only override is preserved when literal copy is unchanged', () => {
  const current = {
    id:'txt1', type:'text', text:'양념 잔뜩\n묻은 떡',
    manual_overrides:['line_breaks']
  };
  const incoming = { id:'txt1', type:'text', text:'양념 잔뜩묻은 떡' };
  const out = SceneState.mergeObject(current, incoming);
  assert.equal(out.text, current.text);
  assert.equal(out.layout_attention, undefined);
});

test('changed literal copy keeps incoming text and surfaces line-break review', () => {
  const current = {
    id:'txt1', type:'text', x:88, y:99, text:'매워\n근데 또 먹음',
    manual_overrides:['position','line_breaks']
  };
  const incoming = {
    id:'txt1', type:'text', x:10, y:20, text:'맵지만 소세지는 먹어야지'
  };
  const out = SceneState.mergeObject(current, incoming);
  assert.equal(out.text, incoming.text);
  assert.equal(out.x, 88);
  assert.equal(out.y, 99);
  assert.ok(out.layout_attention.some(x => x.type === 'LINE_BREAK_REVIEW_REQUIRED'));
});

test('tail fields are preserved independently', () => {
  const current = {
    id:'b1', type:'bubble',
    tail:{tip_x:310,tip_y:520,attach_side:'bottom',attach:.7,base_width:62,curve:.35},
    manual_overrides:['tail_tip','tail_shape']
  };
  const incoming = {
    id:'b1', type:'bubble',
    tail:{tip_x:100,tip_y:200,attach_side:'left',attach:.2,base_width:30,curve:.9}
  };
  const out = SceneState.mergeObject(current, incoming);
  assert.equal(out.tail.tip_x, 310);
  assert.equal(out.tail.tip_y, 520);
  assert.equal(out.tail.base_width, 62);
  assert.equal(out.tail.curve, .35);
  assert.equal(out.tail.attach_side, 'left');
  assert.equal(out.tail.attach, .2);
});

test('horizontal bubble flip changes tail geometry but not text content', () => {
  const bubble = {
    x:100,width:200,text:'글자는 그대로',
    tail:{tip_x:130,tip_y:400,attach_side:'left',attach:.25}
  };
  SceneState.mirrorBubbleTailX(bubble);
  assert.equal(bubble.tail.tip_x, 270);
  assert.equal(bubble.tail.attach, .75);
  assert.equal(bubble.tail.attach_side, 'right');
  assert.equal(bubble.text, '글자는 그대로');
});

test('page merge keeps sticky artwork provenance, layout metadata, and manual object presence', () => {
  const current = {
    id:'S01',
    page:{
      page_type:'body',
      artwork_provenance:{
        source:'../artwork/S01.png',
        source_sha256:'abc',
        extraction_metadata_ref:'../artwork/board_extraction.json',
        extraction_box_index:0
      }
    },
    layout_meta:{presentation_target:{sha256:'target'}},
    objects:[
      {id:'art',type:'artwork',source:'../artwork/S01.png'},
      {id:'note',type:'shape',x:1,y:2,manual_overrides:['object_presence']}
    ]
  };
  const incoming = {
    id:'S01',
    page:{page_type:'body',background:'#fff'},
    layout_meta:{reconstruction_revision:2},
    objects:[{id:'art',type:'artwork',source:'../artwork/S01.png'}]
  };
  const out = SceneState.mergePage(current, incoming);
  assert.equal(out.page.artwork_provenance.source_sha256, 'abc');
  assert.equal(out.layout_meta.presentation_target.sha256, 'target');
  assert.equal(out.layout_meta.reconstruction_revision, 2);
  assert.ok(out.objects.some(o => o.id === 'note'));
});

test('manual metadata survives JSON round-trip', () => {
  const page = {
    objects:[{
      id:'b1',type:'bubble',z:12,
      manual_overrides:['position','tail_tip'],
      tail:{tip_x:320,tip_y:610,attach_side:'bottom',attach:.45,base_width:48,curve:.6}
    },{
      id:'t1',type:'text',text:'첫 줄\n둘째 줄',z:13,
      font:{preferred_family:'Gaegu',resolved_family:'Gaegu',weight:700},
      manual_overrides:['line_breaks']
    }]
  };
  const out = JSON.parse(JSON.stringify(page));
  assert.deepEqual(out, page);
});
