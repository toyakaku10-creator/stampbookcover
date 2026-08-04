// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricLib = any;

export type Point = { x: number; y: number };

// ── Catmull-Rom → cubic bezier（制御点にジッターを加算） ───────
// jitterAmt=0 ならば完全にスムーズなスプライン、>0 で手描き風の揺れが生まれる
export function jitteredBezierPathStr(points: Point[], jitterAmt: number): string {
  if (points.length < 2) return '';
  const rng = () => (Math.random() - 0.5) * 2 * jitterAmt;
  // 先頭と末尾に同じ点を複製して端点でもスプラインが通るようにする
  const pts = [points[0], ...points, points[points.length - 1]];
  let d = `M ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    // Catmull-Rom の制御点をジッターで揺らす（アンカー点自体は動かさない）
    const cp1x = p1.x + (p2.x - p0.x) / 6 + rng();
    const cp1y = p1.y + (p2.y - p0.y) / 6 + rng();
    const cp2x = p2.x - (p3.x - p1.x) / 6 + rng();
    const cp2y = p2.y - (p3.y - p1.y) / 6 + rng();
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// ── ポリライン上の i 番目の頂点における単位法線ベクトル ──────
function normalAt(pts: Point[], i: number): Point {
  const prev = pts[Math.max(0, i - 1)];
  const next = pts[Math.min(pts.length - 1, i + 1)];
  const dx = next.x - prev.x, dy = next.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: -dy / len, y: dx / len };
}

// ── 全点をローカル法線方向に dist px オフセット ──────────────
export function offsetPoints(pts: Point[], dist: number): Point[] {
  return pts.map((p, i) => {
    const n = normalAt(pts, i);
    return { x: p.x + n.x * dist, y: p.y + n.y * dist };
  });
}

// ── 道路 ─────────────────────────────────────────────────────
export type RoadOpts = {
  color: string;
  strokeWidth: number;
  jitter: number;
  doubleStroke: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRoadObjects(fabric: FabricLib, points: Point[], opts: RoadOpts): any[] {
  const { color, strokeWidth, jitter, doubleStroke } = opts;
  const base = {
    fill: 'transparent',
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true,
    selectable: true,
  };

  if (doubleStroke) {
    // 2本の細線を少しずらして重ね書き感を演出
    const gap = Math.max(2, strokeWidth * 0.35);
    const hw  = strokeWidth / 2 + gap / 2;
    const sw  = strokeWidth * 0.42;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p1: any = new fabric.Path(
      jitteredBezierPathStr(offsetPoints(points, -hw), jitter),
      { ...base, stroke: color, strokeWidth: sw },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p2: any = new fabric.Path(
      jitteredBezierPathStr(offsetPoints(points,  hw), jitter),
      { ...base, stroke: color, strokeWidth: sw },
    );
    p1._mapLineType = 'road';
    p2._mapLineType = 'road';
    return [p1, p2];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = new fabric.Path(
      jitteredBezierPathStr(points, jitter),
      { ...base, stroke: color, strokeWidth },
    );
    p._mapLineType = 'road';
    return [p];
  }
}

// ── Bezier 評価ヘルパー（枕木のアーク長サンプリング用） ────────
function evalCubicBezier(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*p1.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*p1.y,
  };
}

function evalCubicBezierTangent(p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  const dx = 3*(mt*mt*(cp1.x-p0.x) + 2*mt*t*(cp2.x-cp1.x) + t*t*(p1.x-cp2.x));
  const dy = 3*(mt*mt*(cp1.y-p0.y) + 2*mt*t*(cp2.y-cp1.y) + t*t*(p1.y-cp2.y));
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  return { x: dx/len, y: dy/len };
}

/**
 * Catmull-Rom スプライン（jitter なし）を等アーク長でサンプリングし、
 * 枕木配置用の { 位置, 接線 } を返す。
 * こうすることで、Bezier 曲線で描かれるレールと枕木の方向が一致する。
 */
function sampleSplineForSleepers(
  points: Point[],
  spacing: number,
): { pos: Point; tangent: Point }[] {
  if (points.length < 2) return [];
  const pts = [points[0], ...points, points[points.length - 1]];
  const result: { pos: Point; tangent: Point }[] = [];
  let nextDist = spacing * 0.5; // 先頭オフセット（最初の枕木を少し中に入れる）
  let totalDist = 0;

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const cp1: Point = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const cp2: Point = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };

    const STEPS = 60; // セグメントあたりの分割数（精度と速度のバランス）
    let prevPt = p1;

    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const curPt = evalCubicBezier(p1, cp1, cp2, p2, t);
      const segLen = Math.sqrt((curPt.x - prevPt.x) ** 2 + (curPt.y - prevPt.y) ** 2);
      const prevTotal = totalDist;
      totalDist += segLen;

      while (nextDist <= totalDist) {
        const frac = segLen > 0.001 ? (nextDist - prevTotal) / segLen : 0;
        const exactT = ((s - 1) + frac) / STEPS;
        const pos = evalCubicBezier(p1, cp1, cp2, p2, exactT);
        const tangent = evalCubicBezierTangent(p1, cp1, cp2, p2, exactT);
        result.push({ pos, tangent });
        nextDist += spacing;
      }
      prevPt = curPt;
    }
  }
  return result;
}

// ── 線路 ─────────────────────────────────────────────────────
export type RailwayOpts = {
  color: string;
  railWidth: number;
  jitter: number;
  railGap: number;    // 2本のレール間の距離 (px)
  sleeperGap: number; // 枕木の間隔 (px)
};

export function buildRailwayObjects(
  fabric: FabricLib,
  points: Point[],
  opts: RailwayOpts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { color, railWidth, railGap, sleeperGap } = opts;
  const railOpts = {
    fill: 'transparent',
    stroke: color,
    strokeWidth: railWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true,
    selectable: false,
    evented: false,
  };

  const hw = railGap / 2;
  // jitter=0 固定：2本のレールを同じ形状にすることで枕木との整合を保つ
  // （jitterを独立して適用すると各レールが別方向に揺れ、枕木がズレる）
  const rail1 = new fabric.Path(jitteredBezierPathStr(offsetPoints(points, -hw), 0), railOpts);
  const rail2 = new fabric.Path(jitteredBezierPathStr(offsetPoints(points,  hw), 0), railOpts);

  // 枕木：Bezierスプライン上の等アーク長位置に、曲線の接線方向に垂直配置
  // レール外端より railWidth 分はみ出す長さにして視覚的に分かりやすくする
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sleepers: any[] = [];
  const sleeperLen = railGap + railWidth * 3; // レール外端からさらにrailWidthだけはみ出す

  for (const { pos, tangent } of sampleSplineForSleepers(points, sleeperGap)) {
    const nx = -tangent.y, ny = tangent.x; // 接線に垂直な法線
    const sl = new fabric.Line(
      [pos.x - nx * sleeperLen / 2, pos.y - ny * sleeperLen / 2,
       pos.x + nx * sleeperLen / 2, pos.y + ny * sleeperLen / 2],
      { stroke: color, strokeWidth: railWidth * 1.2, strokeUniform: true,
        selectable: false, evented: false },
    );
    sleepers.push(sl);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group: any = new fabric.Group([rail1, rail2, ...sleepers], { selectable: true });
  group._mapLineType = 'railway';
  return group;
}

// ── 川 ───────────────────────────────────────────────────────
export type RiverOpts = {
  color: string;       // 線の色（淡い水色）
  strokeWidth: number; // 線幅 (px)
  jitter: number;
};

export function buildRiverObjects(
  fabric: FabricLib,
  points: Point[],
  opts: RiverOpts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { color, strokeWidth, jitter } = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path: any = new fabric.Path(jitteredBezierPathStr(points, jitter), {
    fill: 'transparent',
    stroke: color,
    strokeWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true,
    selectable: true,
  });
  path._mapLineType = 'river';
  return path;
}

// ── 橋 ───────────────────────────────────────────────────────
export type BridgeOpts = {
  color: string;
  hatchLength: number; // 橋の幅 (px) ─ 2本の側壁間距離
  hatchGap: number;    // 予約（現在未使用・後方互換のため残す）
  strokeWidth: number; // 側壁線幅 (px)
};

export function buildBridgeObjects(
  fabric: FabricLib,
  points: Point[],
  opts: BridgeOpts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  if (points.length < 2) return null;
  const { color, hatchLength, strokeWidth } = opts;

  const hw  = hatchLength / 2;    // 中心線から各側壁までの距離
  const ext = hw * 0.4;           // 取り付け部の側壁からのはみ出し量

  // 壁の offset 点列
  const w1pts = offsetPoints(points, -hw);
  const w2pts = offsetPoints(points,  hw);

  const wallPathOpts = {
    fill: 'transparent', stroke: color, strokeWidth,
    strokeLineCap: 'round' as const, strokeLineJoin: 'round' as const,
    strokeUniform: true, selectable: false, evented: false,
  };

  // 1. 橋の側壁（2本の平行線）── jitter=0 で正確な平行を保つ
  const wall1 = new fabric.Path(jitteredBezierPathStr(w1pts, 0), wallPathOpts);
  const wall2 = new fabric.Path(jitteredBezierPathStr(w2pts, 0), wallPathOpts);

  // 2. 橋の床（2本の側壁に囲まれた半透明塗りつぶし）
  // wall1 を正方向 → wall2 を逆方向でつなぎ closed path を作る
  const w2rev      = [...w2pts].reverse();
  const w1pathStr  = jitteredBezierPathStr(w1pts,  0);            // "M x y C ..."
  const w2revStr   = jitteredBezierPathStr(w2rev,  0).replace(/^M/, 'L'); // "L x y C ..."
  const floorPathStr = `${w1pathStr} ${w2revStr} Z`;

  // color (#rrggbb) → rgba with 25% opacity
  const cr = parseInt(color.slice(1, 3), 16);
  const cg = parseInt(color.slice(3, 5), 16);
  const cb = parseInt(color.slice(5, 7), 16);
  const floorFill = `rgba(${cr},${cg},${cb},0.25)`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const floorPath: any = new fabric.Path(floorPathStr, {
    fill: floorFill, stroke: 'transparent', strokeWidth: 0,
    selectable: false, evented: false,
  });

  // 3. 橋の取り付け部（両端の太い垂直線 ─ 岸への接続を表現）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeAbutment = (pt: Point, tx: number, ty: number): any => {
    const nx = -ty, ny = tx;
    const halfLen = hw + ext;
    return new fabric.Line(
      [pt.x - nx * halfLen, pt.y - ny * halfLen,
       pt.x + nx * halfLen, pt.y + ny * halfLen],
      { stroke: color, strokeWidth: strokeWidth * 2, strokeUniform: true,
        selectable: false, evented: false },
    );
  };

  // 始点の接線方向（最初のセグメントから計算）
  const s0dx = points[1].x - points[0].x, s0dy = points[1].y - points[0].y;
  const s0l  = Math.sqrt(s0dx * s0dx + s0dy * s0dy) || 1;
  const startAbutment = makeAbutment(points[0], s0dx / s0l, s0dy / s0l);

  // 終点の接線方向（最後のセグメントから計算）
  const n = points.length;
  const s1dx = points[n - 1].x - points[n - 2].x, s1dy = points[n - 1].y - points[n - 2].y;
  const s1l  = Math.sqrt(s1dx * s1dx + s1dy * s1dy) || 1;
  const endAbutment = makeAbutment(points[n - 1], s1dx / s1l, s1dy / s1l);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group: any = new fabric.Group(
    [floorPath, wall1, wall2, startAbutment, endAbutment], // floorPath を最背面に
    { selectable: true },
  );
  group._mapLineType = 'bridge';
  return group;
}

// ── 広場・オープンスペース ────────────────────────────────────
export type PlazaOpts = {
  color: string;
  strokeWidth: number;
  dashLen: number;
  dashGap: number;
};

export function buildPlazaObjects(
  fabric: FabricLib,
  pt1: Point,
  pt2: Point,
  opts: PlazaOpts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  const { color, strokeWidth, dashLen, dashGap } = opts;
  const left   = Math.min(pt1.x, pt2.x);
  const top    = Math.min(pt1.y, pt2.y);
  const width  = Math.abs(pt2.x - pt1.x);
  const height = Math.abs(pt2.y - pt1.y);
  if (width < 2 || height < 2) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rect: any = new fabric.Rect({
    left, top, width, height,
    fill: 'transparent',
    stroke: color,
    strokeWidth,
    strokeDashArray: [dashLen, dashGap],
    strokeUniform: true,
    selectable: true,
  });
  rect._mapLineType = 'plaza';
  return rect;
}

// ── 閉じた Catmull-Rom スプライン（緑地・閉じた多角形用） ────
// 先頭と末尾が繋がるように周回インデックスで制御点を計算する
export function jitteredBezierClosedPathStr(points: Point[], jitterAmt: number): string {
  const n = points.length;
  if (n < 3) return '';
  const rng = () => (Math.random() - 0.5) * 2 * jitterAmt;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6 + rng();
    const cp1y = p1.y + (p2.y - p0.y) / 6 + rng();
    const cp2x = p2.x - (p3.x - p1.x) / 6 + rng();
    const cp2y = p2.y - (p3.y - p1.y) / 6 + rng();
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + ' Z';
}

// ── 緑地（公園・森） ─────────────────────────────────────────
export type GreenAreaOpts = {
  fillColor: string;   // rgba 文字列（半透明可）
  strokeColor: string;
  strokeWidth: number;
  jitter: number;
};

export function buildGreenAreaObjects(
  fabric: FabricLib,
  points: Point[],
  opts: GreenAreaOpts,
): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (points.length < 3) return null;
  const { fillColor, strokeColor, strokeWidth, jitter } = opts;
  const d = jitteredBezierClosedPathStr(points, jitter);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const path: any = new fabric.Path(d, {
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true,
    selectable: true,
  });
  path._mapLineType = 'greenarea';
  return path;
}
