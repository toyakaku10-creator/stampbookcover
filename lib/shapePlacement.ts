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
    return new fabric.Rect({ ...opts, ...pos, width: 60, height: 60 });
  }
  if (toolId === 'circle') {
    return new fabric.Ellipse({ ...opts, ...pos, rx: 30, ry: 30 });
  }
  if (toolId === 'triangle') {
    const SIDE = 80;
    const HEIGHT = Math.round(SIDE * (Math.sqrt(3) / 2));
    return new fabric.Triangle({ ...opts, ...pos, width: SIDE, height: HEIGHT });
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
    const diamondPts = [{ x: W / 2, y: 0 }, { x: W, y: H / 2 }, { x: W / 2, y: H }, { x: 0, y: H / 2 }];
    const poly = new fabric.Polygon(diamondPts, { ...opts, left: cx - W / 2, top: cy - H / 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._shapeType = 'h-diamond';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._diamondPoints = diamondPts;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._diamondRadius = 0;
    return poly;
  }
  if (toolId === 'trapezoid') {
    const topW = 60, botW = 90, h = 50;
    const half = (botW - topW) / 2;
    const poly = new fabric.Polygon(
      [{ x: half, y: 0 }, { x: half + topW, y: 0 }, { x: botW, y: h }, { x: 0, y: h }],
      { ...opts, left: cx - botW / 2, top: cy - h / 2 },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._shapeType = 'trapezoid';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._trapTop = topW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._trapBottom = botW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._trapHeight = h;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._trapPoints = [{ x: half, y: 0 }, { x: half + topW, y: 0 }, { x: botW, y: h }, { x: 0, y: h }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (poly as any)._trapRadius = 0;
    return poly;
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
