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
  const { color, railWidth, jitter, railGap, sleeperGap } = opts;
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

  const hw   = railGap / 2;
  const rail1 = new fabric.Path(jitteredBezierPathStr(offsetPoints(points, -hw), jitter), railOpts);
  const rail2 = new fabric.Path(jitteredBezierPathStr(offsetPoints(points,  hw), jitter), railOpts);

  // 枕木：ポリライン各セグメントに沿って等間隔に配置
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sleepers: any[] = [];
  const sleeperLen = railGap + railWidth * 2.5;
  let remaining = sleeperGap * 0.5; // 最初のセグメントのオフセット

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i];
    const dx = curr.x - prev.x, dy = curr.y - prev.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 0.001) continue;
    const ux = dx / segLen, uy = dy / segLen; // 接線
    const nx = -uy,         ny =  ux;         // 法線

    let t = remaining;
    while (t <= segLen) {
      const mx = prev.x + ux * t, my = prev.y + uy * t;
      const sl = new fabric.Line(
        [mx - nx * sleeperLen / 2, my - ny * sleeperLen / 2,
         mx + nx * sleeperLen / 2, my + ny * sleeperLen / 2],
        { stroke: color, strokeWidth: railWidth * 1.1, strokeUniform: true,
          selectable: false, evented: false },
      );
      sleepers.push(sl);
      t += sleeperGap;
    }
    remaining = t - segLen;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group: any = new fabric.Group([rail1, rail2, ...sleepers], { selectable: true });
  group._mapLineType = 'railway';
  return group;
}

// ── 川 ───────────────────────────────────────────────────────
export type RiverOpts = {
  fillColor: string;
  strokeColor: string;
  width: number;    // 川幅 (px)
  jitter: number;
};

export function buildRiverObjects(
  fabric: FabricLib,
  points: Point[],
  opts: RiverOpts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { fillColor, strokeColor, width, jitter } = opts;

  // 太いストロークで水面を表現（round cap で自然な端を作る）
  const body = new fabric.Path(jitteredBezierPathStr(points, jitter), {
    fill: 'transparent',
    stroke: fillColor,
    strokeWidth: width,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true,
    selectable: false,
    evented: false,
  });

  // 両岸の輪郭線（少し控えめなジッターで独立した揺れを加える）
  const hw = width / 2 - 1;
  const bankOpts = {
    fill: 'transparent',
    stroke: strokeColor,
    strokeWidth: 1.5,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    strokeUniform: true,
    selectable: false,
    evented: false,
  };
  const bank1 = new fabric.Path(jitteredBezierPathStr(offsetPoints(points, -hw), jitter * 0.7), bankOpts);
  const bank2 = new fabric.Path(jitteredBezierPathStr(offsetPoints(points,  hw), jitter * 0.7), bankOpts);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group: any = new fabric.Group([body, bank1, bank2], { selectable: true });
  group._mapLineType = 'river';
  return group;
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
