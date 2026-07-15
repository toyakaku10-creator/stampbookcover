// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricLib = any;

import type { Tool } from './types';

const GOLD = '#C9A84C';

// ── 角丸ポリゴンパス生成 ────────────────────────────────────
export function roundedPolygonPath(points: { x: number; y: number }[], radius: number): string {
  if (radius <= 0) {
    return 'M' + points.map(p => `${p.x},${p.y}`).join('L') + 'Z';
  }
  const n = points.length;
  let path = '';
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenPrev = Math.sqrt(toPrev.x ** 2 + toPrev.y ** 2);
    const lenNext = Math.sqrt(toNext.x ** 2 + toNext.y ** 2);
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);
    const p1 = { x: curr.x + (toPrev.x / lenPrev) * r, y: curr.y + (toPrev.y / lenPrev) * r };
    const p2 = { x: curr.x + (toNext.x / lenNext) * r, y: curr.y + (toNext.y / lenNext) * r };
    if (i === 0) {
      path += `M${p1.x},${p1.y}`;
    } else {
      path += `L${p1.x},${p1.y}`;
    }
    path += `Q${curr.x},${curr.y} ${p2.x},${p2.y}`;
  }
  path += 'Z';
  return path;
}

// ── 円弧パス生成ヘルパー ────────────────────────────────────
export function buildArcPath(r: number, startDeg: number, endDeg: number): string {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg   * Math.PI) / 180;
  const x1 = r * Math.cos(s), y1 = r * Math.sin(s);
  const x2 = r * Math.cos(e), y2 = r * Math.sin(e);
  const diff = ((endDeg - startDeg) % 360 + 360) % 360;
  const largeArc = diff > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// ── マルチセグメントGroup生成（辺ごとに独立したLine＋角弧） ──
export function buildSegmentGroup(
  fabric: FabricLib,
  corners: { x: number; y: number }[],
  radius: number,
  sidesEnabled: boolean[],
  stroke: string,
  strokeWidth: number,
  fill: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupProps?: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const n = corners.length;

  // 各頂点の「入線タンジェント点」と「出線タンジェント点」を計算
  const entryPts: { x: number; y: number }[] = [];
  const exitPts:  { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];
    if (radius > 0) {
      const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
      const toNext = { x: next.x - curr.x, y: next.y - curr.y };
      const lenP = Math.sqrt(toPrev.x ** 2 + toPrev.y ** 2);
      const lenN = Math.sqrt(toNext.x ** 2 + toNext.y ** 2);
      const r = Math.min(radius, lenP / 2, lenN / 2);
      entryPts[i] = { x: curr.x + (toPrev.x / lenP) * r, y: curr.y + (toPrev.y / lenP) * r };
      exitPts[i]  = { x: curr.x + (toNext.x / lenN) * r, y: curr.y + (toNext.y / lenN) * r };
    } else {
      entryPts[i] = { ...curr };
      exitPts[i]  = { ...curr };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segs: any[] = [];
  const baseOpts = { stroke, strokeWidth, strokeUniform: true, fill: 'transparent' as const };

  // 塗りつぶし専用Polygon（index 0、辺の表示に影響しない）
  const fillPoly = new fabric.Polygon([...corners], {
    fill: fill || 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeUniform: true,
    selectable: false,
    evented: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fillPoly as any)._isFillShape = true;
  segs.push(fillPoly);

  // 辺セグメント（n本のLine）
  for (let i = 0; i < n; i++) {
    const s = exitPts[i], e = entryPts[(i + 1) % n];
    const line = new fabric.Line([s.x, s.y, e.x, e.y], {
      ...baseOpts, opacity: sidesEnabled[i] ? 1 : 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (line as any)._msegChild = true;
    segs.push(line);
  }

  // 角弧セグメント（radius > 0 のときのみ）
  if (radius > 0) {
    for (let i = 0; i < n; i++) {
      const p1 = entryPts[i], p2 = exitPts[i], cv = corners[i];
      const prevEdge = (i - 1 + n) % n;
      const vis = sidesEnabled[prevEdge] && sidesEnabled[i];
      const arc = new fabric.Path(
        `M ${p1.x} ${p1.y} Q ${cv.x} ${cv.y} ${p2.x} ${p2.y}`,
        { ...baseOpts, opacity: vis ? 1 : 0 },
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (arc as any)._msegChild = true;
      segs.push(arc);
    }
  }

  return new fabric.Group(segs, { fill: 'transparent', ...(groupProps ?? {}) });
}

// ── オブジェクト生成（全ツール共通） ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildObjectAt(fabric: FabricLib, canvas: any, toolId: Tool, cx: number, cy: number): any {
  const color = canvas.drawColor ?? GOLD;
  const fill  = canvas.fillC    ?? 'transparent';
  const sw    = canvas.strokeW  ?? 1.5;
  const opts  = { stroke: color, strokeWidth: sw, fill, strokeUniform: true };
  const pos   = { left: cx, top: cy, originX: 'center' as const, originY: 'center' as const };

  if (toolId === 'line') {
    return new fabric.Line([cx - 40, cy, cx + 40, cy], { stroke: color, strokeWidth: sw, strokeUniform: true });
  }
  if (toolId === 'rect') {
    const W = 60, H = 60;
    const rectCorners = [
      { x: -W / 2, y: -H / 2 }, { x: W / 2, y: -H / 2 },
      { x: W / 2, y:  H / 2 }, { x: -W / 2, y:  H / 2 },
    ];
    const sidesEnabled = [true, true, true, true];
    const group = buildSegmentGroup(fabric, rectCorners, 0, sidesEnabled, color, sw, fill, {
      left: cx, top: cy, originX: 'center' as const, originY: 'center' as const,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._shapeType = 'mseg';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegCorners = rectCorners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegRadius = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegSides = sidesEnabled;
    return group;
  }
  if (toolId === 'circle') {
    return new fabric.Ellipse({ ...opts, ...pos, rx: 30, ry: 30 });
  }
  if (toolId === 'triangle') {
    const SIDE = 80;
    const HEIGHT = Math.round(SIDE * (Math.sqrt(3) / 2));
    // 中心原点・頂点順: 上→左下→右下（辺0=左辺、辺1=底辺、辺2=右辺）
    const corners = [
      { x: 0, y: -HEIGHT / 2 },
      { x: -SIDE / 2, y: HEIGHT / 2 },
      { x:  SIDE / 2, y: HEIGHT / 2 },
    ];
    const sidesEnabled = [true, true, true];
    const group = buildSegmentGroup(fabric, corners, 0, sidesEnabled, color, sw, fill, {
      left: cx, top: cy, originX: 'center' as const, originY: 'center' as const,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._shapeType   = 'triangle';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegCorners = corners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegRadius  = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegSides   = sidesEnabled;
    return group;
  }

  if (toolId === 'polygon') {
    const sides = canvas.polygonSides ?? 5;
    const r = 40;
    const points = Array.from({ length: sides }, (_, i) => {
      const a = (2 * Math.PI * i / sides) - Math.PI / 2;
      return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
    });
    return new fabric.Polygon(points, { ...opts, ...pos });
  }
  if (toolId === 'text') {
    const t = canvas.textOptions ?? {};
    return new fabric.IText('テキスト', {
      ...pos,
      fontSize:   t.fontSize   ?? 24,
      fontFamily: t.fontFamily ?? 'Arial',
      fill:       color,
      fontWeight: t.bold      ? 'bold'   : 'normal',
      fontStyle:  t.italic    ? 'italic' : 'normal',
      underline:  t.underline ?? false,
    });
  }
  if (toolId === 'h-diamond') {
    const W = 60, H = Math.round(W * Math.sqrt(3));
    // 中心原点・頂点順: 上→右→下→左（辺0=右上、辺1=右下、辺2=左下、辺3=左上）
    const corners = [
      { x:     0, y: -H / 2 },
      { x:  W / 2, y:     0 },
      { x:     0, y:  H / 2 },
      { x: -W / 2, y:     0 },
    ];
    const sidesEnabled = [true, true, true, true];
    const group = buildSegmentGroup(fabric, corners, 0, sidesEnabled, color, sw, fill, {
      left: cx, top: cy, originX: 'center' as const, originY: 'center' as const,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._shapeType   = 'h-diamond';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegCorners = corners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegRadius  = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegSides   = sidesEnabled;
    return group;
  }
  if (toolId === 'trapezoid') {
    const topW = 60, botW = 90, h = 50;
    const corners = [
      { x: -topW / 2, y: -h / 2 }, { x: topW / 2, y: -h / 2 },
      { x: botW / 2, y:  h / 2 }, { x: -botW / 2, y:  h / 2 },
    ];
    const sidesEnabled = [true, true, true, true];
    const group = buildSegmentGroup(fabric, corners, 0, sidesEnabled, color, sw, fill, {
      left: cx, top: cy, originX: 'center' as const, originY: 'center' as const,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._shapeType   = 'trapezoid';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegCorners = corners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegRadius  = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._msegSides   = sidesEnabled;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._trapTop     = topW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._trapBottom  = botW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._trapHeight  = h;
    return group;
  }
  if (toolId === 'arc') {
    const r = 45, startDeg = 180, endDeg = 0;
    const p = new fabric.Path(buildArcPath(r, startDeg, endDeg), {
      ...opts, left: cx, top: cy, originX: 'center', originY: 'center',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._shapeType = 'arc';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._arcRadius = r;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._arcStartAngle = startDeg;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._arcEndAngle = endDeg;
    return p;
  }
  if (toolId === 'dot') {
    const r = 3;
    const c = new fabric.Circle({
      left: cx, top: cy, originX: 'center', originY: 'center',
      radius: r, fill: color, stroke: 'transparent', strokeWidth: 0, strokeUniform: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c as any)._shapeType = 'dot';
    return c;
  }
  return null;
}
