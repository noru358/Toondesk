/* ============================================================
   Deterministic renderer — one path/text model, three sinks:
   editor canvas, export canvas, interchange SVG.
   ============================================================ */

const MEAS = document.createElement('canvas').getContext('2d');

/* ---------- path command lists ---------- */
function pRoundRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return [['M', x + r, y], ['L', x + w - r, y], ['Q', x + w, y, x + w, y + r],
          ['L', x + w, y + h - r], ['Q', x + w, y + h, x + w - r, y + h],
          ['L', x + r, y + h], ['Q', x, y + h, x, y + h - r],
          ['L', x, y + r], ['Q', x, y, x + r, y], ['Z']];
}
function pEllipse(x, y, w, h) {
  const k = 0.5522847498, rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
  return [['M', cx, y],
    ['C', cx + rx * k, y, x + w, cy - ry * k, x + w, cy],
    ['C', x + w, cy + ry * k, cx + rx * k, y + h, cx, y + h],
    ['C', cx - rx * k, y + h, x, cy + ry * k, x, cy],
    ['C', x, cy - ry * k, cx - rx * k, y, cx, y], ['Z']];
}
/* rounded rect whose outline absorbs the speech tail, so fill and stroke stay one shape */
function pBubble(x, y, w, h, r, tail) {
  if (!tail || tail.enabled === false) return pRoundRect(x, y, w, h, r);
  r = Math.max(0, Math.min(r, w / 2, h / 2));

  const edges = {
    top:    [[x + r, y], [x + w - r, y]],
    right:  [[x + w, y + r], [x + w, y + h - r]],
    bottom: [[x + w - r, y + h], [x + r, y + h]],
    left:   [[x, y + h - r], [x, y + r]]
  };
  const side = tail.attach_side || 'bottom';
  const [A, B] = edges[side] || edges.bottom;
  const vx = B[0]-A[0], vy=B[1]-A[1], len=Math.hypot(vx,vy)||1;
  const ux=vx/len, uy=vy/len;
  const attach=clamp(Number.isFinite(tail.attach)?tail.attach:.55,0,1);
  const px=A[0]+vx*attach, py=A[1]+vy*attach;
  const half=Math.max(4,Math.min((tail.base_width||56)/2,len*.42));
  const b1=[px-ux*half,py-uy*half], b2=[px+ux*half,py+uy*half];
  const tip=[Number.isFinite(tail.tip_x)?tail.tip_x:px,Number.isFinite(tail.tip_y)?tail.tip_y:py+95];
  const curve=clamp(Number.isFinite(tail.curve)?tail.curve:.58,0,1);

  const seq=['top','right','bottom','left'];
  const cmds=[['M',x+r,y]];
  for(const s of seq){
    const [a,b]=edges[s];
    if(s===side){
      cmds.push(['L',b1[0],b1[1]]);
      if((tail.style||'soft_curved')==='triangle'){
        cmds.push(['L',tip[0],tip[1]],['L',b2[0],b2[1]]);
      }else{
        const reach=Math.max(10,Math.hypot(tip[0]-px,tip[1]-py));
        const cbase=Math.min(half*.95,reach*.22)*(0.35+curve*.65);
        const v1x=tip[0]-b1[0], v1y=tip[1]-b1[1], l1=Math.hypot(v1x,v1y)||1;
        const v2x=b2[0]-tip[0], v2y=b2[1]-tip[1], l2=Math.hypot(v2x,v2y)||1;
        const c1=[b1[0]+ux*cbase,b1[1]+uy*cbase];
        const c2=[tip[0]-v1x/l1*reach*(.14+.18*curve),tip[1]-v1y/l1*reach*(.14+.18*curve)];
        const c3=[tip[0]+v2x/l2*reach*(.14+.18*curve),tip[1]+v2y/l2*reach*(.14+.18*curve)];
        const c4=[b2[0]-ux*cbase,b2[1]-uy*cbase];
        cmds.push(['C',c1[0],c1[1],c2[0],c2[1],tip[0],tip[1]]);
        cmds.push(['C',c3[0],c3[1],c4[0],c4[1],b2[0],b2[1]]);
      }
    }
    cmds.push(['L',b[0],b[1]]);
    const corner={top:[x+w,y,x+w,y+r],right:[x+w,y+h,x+w-r,y+h],
      bottom:[x,y+h,x,y+h-r],left:[x,y,x+r,y]}[s];
    cmds.push(['Q',corner[0],corner[1],corner[2],corner[3]]);
  }
  cmds.push(['Z']);
  return cmds;
}
function execPath(ctx, cmds) {
  ctx.beginPath();
  for (const c of cmds) {
    if (c[0] === 'M') ctx.moveTo(c[1], c[2]);
    else if (c[0] === 'L') ctx.lineTo(c[1], c[2]);
    else if (c[0] === 'Q') ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (c[0] === 'C') ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
    else ctx.closePath();
  }
}
const svgD = cmds => cmds.map(c => c[0] + c.slice(1).map(n => round2(n)).join(' ')).join(' ');

/* ---------- text ---------- */
function fontString(o) {
  const f = o.font || {};
  const size = f.size || 40, weight = f.weight || 400;
  const resolved = fontCssFor(f);
  return { css: `${weight} ${size}px ${resolved.css}`, size, weight, lh: (f.line_height || 1.15), font_resolution: resolved };
}
function wrapPara(text, maxW) {
  const out = [], chars = [...text];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (line && MEAS.measureText(test).width > maxW) {
      const sp = line.lastIndexOf(' ');
      if (sp > 0) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
      else { out.push(line); line = ch; }
    } else line = test;
  }
  out.push(line);
  return out;
}
function layoutText(o) {
  const fs = fontString(o);
  MEAS.font = fs.css;
  const maxW = Math.max(8, o.width || 200);
  const lines = [];
  for (const para of String(o.text ?? '').split('\n')) lines.push(...wrapPara(para, maxW));
  const lh = fs.size * fs.lh;
  const total = lines.length * lh;
  const widest = Math.max(0, ...lines.map(l => MEAS.measureText(l).width));
  return { ...fs, lines, lh, total, widest, overflow: total > (o.height || 0) + fs.size * 0.3 || widest > maxW + 1 };
}
function textAnchors(o, L) {
  const align = o.align || 'center';
  const x = align === 'left' ? o.x : align === 'right' ? o.x + o.width : o.x + o.width / 2;
  const top = o.y + ((o.height || L.total) - L.total) / 2;
  return { align, x, top };
}

/* ---------- artwork placement ---------- */
function artPlace(o) {
  const rec = doc.images.get(baseName(o.source));
  const f = rectOf(o), c = o.crop || {};
  if (!rec) return { rec: null, f };
  const base = Math.max(f.w / rec.w, f.h / rec.h);
  const s = base * (c.scale || 1);
  const dw = rec.w * s, dh = rec.h * s;
  const ax = c.anchor_x ?? .5, ay = c.anchor_y ?? .5;
  let dx = f.x + f.w / 2 + (c.offset_x || 0) - ax * dw;
  let dy = f.y + f.h / 2 + (c.offset_y || 0) - ay * dh;
  if (c.clamp_to_frame !== false) {
    dx = clamp(dx, f.x + f.w - dw, f.x);
    dy = clamp(dy, f.y + f.h - dh, f.y);
  }
  return { rec, f, dx, dy, dw, dh };
}

/* ---------- object painters ---------- */
function paintObject(ctx, o) {
  ctx.save();
  const r = rectOf(o);
  if (o.rotation) {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(o.rotation * Math.PI / 180);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  }
  if (o.opacity != null) ctx.globalAlpha = o.opacity;

  if (o.type === 'artwork') {
    const P = artPlace(o);
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    if (P.rec) ctx.drawImage(P.rec.img, P.dx, P.dy, P.dw, P.dh);
    else {
      ctx.fillStyle = '#efe5d6'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#cbbba3'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]);
      ctx.strokeRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16); ctx.setLineDash([]);
      ctx.fillStyle = '#9c8b74'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 34px "IBM Plex Mono", monospace';
      ctx.fillText(baseName(o.source) || 'ARTWORK', r.x + r.w / 2, r.y + r.h / 2 - 16);
      ctx.font = '400 22px "IBM Plex Sans KR", sans-serif';
      ctx.fillText('아트워크 미연결', r.x + r.w / 2, r.y + r.h / 2 + 26);
    }
    ctx.restore();
  } else if (o.type === 'bubble' || o.type === 'thought_box' || o.type === 'shape') {
    let cmds;
    if (o.type === 'bubble') cmds = pBubble(r.x, r.y, r.w, r.h, o.radius ?? Math.min(46, r.h / 2), bubbleTailData(o));
    else if (o.shape === 'ellipse') cmds = pEllipse(r.x, r.y, r.w, r.h);
    else cmds = pRoundRect(r.x, r.y, r.w, r.h, o.radius ?? (o.type === 'thought_box' ? 18 : 0));
    execPath(ctx, cmds);
    if (o.fill && o.fill !== 'none') { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke && o.stroke !== 'none' && (o.stroke_width || 0) > 0) {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.stroke_width; ctx.lineJoin = 'round'; ctx.stroke();
    }
  } else if (o.type === 'text' || o.type === 'sfx') {
    const L = layoutText(o), A = textAnchors(o, L);
    ctx.font = L.css; ctx.textAlign = A.align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    L.lines.forEach((ln, i) => {
      const y = A.top + (i + .5) * L.lh;
      if (o.stroke && o.stroke !== 'none' && (o.stroke_width || 0) > 0) {
        ctx.strokeStyle = o.stroke; ctx.lineWidth = o.stroke_width; ctx.strokeText(ln, A.x, y);
      }
      ctx.fillStyle = o.fill || '#221f1d'; ctx.fillText(ln, A.x, y);
    });
  }
  ctx.restore();
}

const zsort = list => list.map((o, i) => [o, i]).sort((a, b) => (a[0].z || 0) - (b[0].z || 0) || a[1] - b[1]).map(p => p[0]);

function renderPage(ctx, page, opt = {}) {
  ctx.save();
  ctx.fillStyle = page.page.background || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  for (const o of zsort(page.objects)) {
    if (o.visible === false) continue;
    if (opt.hide && opt.hide.has(o.id)) continue;
    const g = groupOf(page, o.group_id);
    if (g && g.visible === false) continue;
    paintObject(ctx, o);
  }
  ctx.restore();
}

/* ---------- SVG interchange derivative ---------- */
function pageToSVG(page) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${page.page.background || '#fff'}"/>`];
  let clipN = 0;
  for (const o of zsort(page.objects)) {
    if (o.visible === false) continue;
    const r = rectOf(o);
    const rot = o.rotation ? ` transform="rotate(${round2(o.rotation)} ${round2(r.x + r.w / 2)} ${round2(r.y + r.h / 2)})"` : '';
    if (o.type === 'artwork') {
      const P = artPlace(o), id = 'cl' + (clipN++);
      parts.push(`<clipPath id="${id}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/></clipPath>`);
      if (P.rec) parts.push(`<image clip-path="url(#${id})" href="${P.rec.url}" x="${round2(P.dx)}" y="${round2(P.dy)}" width="${round2(P.dw)}" height="${round2(P.dh)}" preserveAspectRatio="none"${rot}/>`);
      else parts.push(`<rect clip-path="url(#${id})" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#efe5d6"/>`);
    } else if (o.type === 'bubble' || o.type === 'thought_box' || o.type === 'shape') {
      let cmds;
      if (o.type === 'bubble') cmds = pBubble(r.x, r.y, r.w, r.h, o.radius ?? Math.min(46, r.h / 2), bubbleTailData(o));
      else if (o.shape === 'ellipse') cmds = pEllipse(r.x, r.y, r.w, r.h);
      else cmds = pRoundRect(r.x, r.y, r.w, r.h, o.radius ?? (o.type === 'thought_box' ? 18 : 0));
      parts.push(`<path d="${svgD(cmds)}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.stroke_width || 0}" stroke-linejoin="round"${rot}/>`);
    } else if (o.type === 'text' || o.type === 'sfx') {
      const L = layoutText(o), A = textAnchors(o, L);
      const anch = A.align === 'left' ? 'start' : A.align === 'right' ? 'end' : 'middle';
      const fam = fontCssFor(o.font || {}).css.replace(/"/g, "'");
      const strokeAttr = o.stroke && o.stroke !== 'none' && o.stroke_width
        ? ` stroke="${o.stroke}" stroke-width="${o.stroke_width}" paint-order="stroke" stroke-linejoin="round"` : '';
      parts.push(`<g${rot} font-family="${fam}" font-size="${L.size}" font-weight="${L.weight}" fill="${o.fill || '#221f1d'}" text-anchor="${anch}"${strokeAttr}>`);
      L.lines.forEach((ln, i) => parts.push(`<text x="${round2(A.x)}" y="${round2(A.top + (i + .5) * L.lh)}" dominant-baseline="central">${esc(ln)}</text>`));
      parts.push('</g>');
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}

/* ---------- offscreen raster ---------- */
function rasterize(page, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const ctx = c.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  renderPage(ctx, page);
  return c;
}
