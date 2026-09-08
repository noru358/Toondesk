(function (root) {
  'use strict';

  const VALID = new Set([
    'position','size','rotation','z_order','visibility','line_breaks','text',
    'typography','tail_tip','tail_attachment','tail_shape','bubble_style',
    'crop','artwork_source','object_presence'
  ]);
  const deepClone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const uniq = list => [...new Set((list || []).filter(x => VALID.has(x)))];
  const stripLineBreaks = text => String(text ?? '').replace(/\r?\n/g, '');

  function manualOverrideList(o) { return uniq(o?.manual_overrides); }
  function hasManualOverride(o, key) { return manualOverrideList(o).includes(key); }
  function markManual(o, ...keys) {
    if (!o) return;
    o.manual_overrides = uniq([...manualOverrideList(o), ...keys.flat()]);
    if (!o.manual_overrides.length) delete o.manual_overrides;
  }
  function clearManual(o, ...keys) {
    if (!o) return;
    const drop = new Set(keys.flat());
    const next = manualOverrideList(o).filter(k => !drop.has(k));
    if (next.length) o.manual_overrides = next; else delete o.manual_overrides;
  }
  function addAttention(o, type, detail) {
    if (!o) return;
    const list = Array.isArray(o.layout_attention) ? o.layout_attention.filter(x => x?.type !== type) : [];
    list.push({ type, ...(detail || {}) });
    o.layout_attention = list;
  }
  function clearAttention(o, type) {
    if (!Array.isArray(o?.layout_attention)) return;
    const next = o.layout_attention.filter(x => x?.type !== type);
    if (next.length) o.layout_attention = next; else delete o.layout_attention;
  }
  function copyTailFields(dst, src, fields) {
    if (!src?.tail) return;
    dst.tail = { ...(dst.tail || {}) };
    for (const k of fields) if (Object.prototype.hasOwnProperty.call(src.tail, k)) dst.tail[k] = deepClone(src.tail[k]);
  }
  function mergeObject(current, incoming) {
    if (!current) return deepClone(incoming);
    const out = deepClone(incoming);
    const marks = manualOverrideList(current);
    if (marks.length) out.manual_overrides = marks;

    if (marks.includes('position')) { out.x = current.x; out.y = current.y; }
    if (marks.includes('size')) { out.width = current.width; out.height = current.height; }
    if (marks.includes('rotation')) out.rotation = current.rotation;
    if (marks.includes('z_order')) out.z = current.z;
    if (marks.includes('visibility')) out.visible = current.visible;
    if (marks.includes('crop')) out.crop = deepClone(current.crop);
    if (marks.includes('artwork_source')) out.source = current.source;
    if (marks.includes('typography')) {
      out.font = deepClone(current.font);
      for (const k of ['align','fill','stroke','stroke_width','padding'])
        if (Object.prototype.hasOwnProperty.call(current,k)) out[k] = deepClone(current[k]);
    }
    if (marks.includes('bubble_style'))
      for (const k of ['fill','stroke','stroke_width','radius','body_style'])
        if (Object.prototype.hasOwnProperty.call(current,k)) out[k] = deepClone(current[k]);
    if (marks.includes('tail_tip')) copyTailFields(out,current,['tip_x','tip_y']);
    if (marks.includes('tail_attachment')) copyTailFields(out,current,['attach_side','attach']);
    if (marks.includes('tail_shape')) copyTailFields(out,current,['enabled','style','base_width','curve']);

    if (marks.includes('text')) {
      out.text = current.text;
      clearAttention(out,'LINE_BREAK_REVIEW_REQUIRED');
    } else if (marks.includes('line_breaks')) {
      if (stripLineBreaks(current.text) === stripLineBreaks(incoming.text)) {
        out.text = current.text;
        clearAttention(out,'LINE_BREAK_REVIEW_REQUIRED');
      } else {
        addAttention(out,'LINE_BREAK_REVIEW_REQUIRED',{
          reason:'literal_copy_changed',
          message:'문구가 바뀌어 기존 수동 줄바꿈을 자동 재사용하지 않았습니다. 재배치 또는 수동 줄바꿈을 확인하세요.'
        });
      }
    }
    return out;
  }
  function mergePage(current, incoming) {
    if (!current) return deepClone(incoming);
    const out = deepClone(incoming);
    out.layout_meta = { ...(deepClone(current.layout_meta) || {}), ...(deepClone(incoming.layout_meta) || {}) };
    out.page = { ...(deepClone(current.page) || {}), ...(deepClone(incoming.page) || {}) };
    if (current.page?.artwork_provenance) out.page.artwork_provenance = deepClone(current.page.artwork_provenance);
    if (current.page?.cover_artwork_provenance) out.page.cover_artwork_provenance = deepClone(current.page.cover_artwork_provenance);
    const currentById = new Map((current.objects || []).map(o => [o.id,o]));
    const incomingIds = new Set((out.objects || []).map(o => o.id));
    out.objects = (out.objects || []).map(o => mergeObject(currentById.get(o.id), o));
    for (const o of (current.objects || []))
      if (!incomingIds.has(o.id) && hasManualOverride(o,'object_presence')) out.objects.push(deepClone(o));
    return out;
  }
  function mirrorBubbleTailX(o) {
    if (!o?.tail) return o;
    const cx = (Number(o.x) || 0) + (Number(o.width) || 0) / 2;
    o.tail.tip_x = Math.round((cx * 2 - Number(o.tail.tip_x || cx)) * 100) / 100;
    o.tail.attach = Math.round((1 - Number(o.tail.attach ?? .5)) * 100) / 100;
    if (o.tail.attach_side === 'left') o.tail.attach_side = 'right';
    else if (o.tail.attach_side === 'right') o.tail.attach_side = 'left';
    return o;
  }

  const api = {
    manualOverrideList, hasManualOverride, markManual, clearManual,
    stripLineBreaks, addAttention, clearAttention, mergeObject, mergePage, mirrorBubbleTailX
  };
  root.ToonDeskSceneState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
