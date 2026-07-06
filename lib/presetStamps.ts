import { saveStamp, deleteStamp } from './stampStorage';
import type { Stamp } from './types';

const PRESET_VERSION = '4';

const GOLD = '#C9A84C';
const SW = 1.5;
const FILL = 'transparent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricLib = any;

/** In-memory fabric canvas helper */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFabricCanvas(fabric: FabricLib, w: number, h: number): any {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  return new fabric.Canvas(el, { width: w, height: h, backgroundColor: '#ffffff' });
}

/** 200×200・白背景・中央フィットのサムネイルを生成 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function makeThumb(fabric: FabricLib, fc: any): Promise<string> {
  const objects = fc.getObjects();
  const cloned = await Promise.all(objects.map((o: any) => o.clone()));
  const thumbEl = document.createElement('canvas');
  const thumbCanvas = new fabric.Canvas(thumbEl, { width: 200, height: 200, backgroundColor: '#ffffff' });
  if (cloned.length > 0) {
    const group = new fabric.Group(cloned);
    const maxDim = Math.max(group.width ?? 1, group.height ?? 1);
    const scale = 160 / maxDim;
    group.set({ scaleX: scale, scaleY: scale, left: 100, top: 100, originX: 'center', originY: 'center' });
    thumbCanvas.add(group);
  }
  thumbCanvas.backgroundColor = '#ffffff';
  thumbCanvas.renderAll();
  const url = thumbCanvas.toDataURL({ format: 'png', multiplier: 1 });
  thumbCanvas.dispose();
  return url;
}

async function buildStamp(
  fabric: FabricLib,
  id: string,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildFn: (fc: any, fabric: FabricLib) => void,
  w = 100,
  h = 100,
): Promise<Stamp> {
  const fc = makeFabricCanvas(fabric, w, h);
  buildFn(fc, fabric);
  fc.backgroundColor = '#ffffff';
  fc.renderAll();
  const thumbnail = await makeThumb(fabric, fc);
  const fabricJSON = fc.toJSON();
  fabricJSON.backgroundColor = '#ffffff';
  fc.dispose();
  return {
    id,
    name,
    thumbnail,
    fabricJSON,
    createdAt: new Date().toISOString(),
  };
}

const baseOpts = { stroke: GOLD, strokeWidth: SW, fill: FILL, strokeUniform: true };

// 1. 菱形
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDiamond(fc: any, fabric: FabricLib) {
  const poly = new fabric.Polygon(
    [{ x: 50, y: 20 }, { x: 70, y: 50 }, { x: 50, y: 80 }, { x: 30, y: 50 }],
    { ...baseOpts, left: 50, top: 50, originX: 'center', originY: 'center' },
  );
  fc.add(poly);
}

// 2. 砂時計型（上下三角連結）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDoubleTriangle(fc: any, fabric: FabricLib) {
  // 上三角: (20,10)(80,10)(50,50)、下三角: (50,50)(20,90)(80,90)
  // 6点ポリゴン（自己交差により砂時計形）
  const poly = new fabric.Polygon(
    [
      { x: 20, y: 10 },
      { x: 80, y: 10 },
      { x: 50, y: 50 },
      { x: 80, y: 90 },
      { x: 20, y: 90 },
      { x: 50, y: 50 },
    ],
    { ...baseOpts, left: 50, top: 50, originX: 'center', originY: 'center' },
  );
  fc.add(poly);
}

// 3. 六芒星（菱形3つを60度ずつ回転して重ねた形）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStar(fc: any, fabric: FabricLib) {
  const cx = 50, cy = 50;
  const R = 38, r = 17; // 外径・内径
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const deg = (i * 30 - 90) * Math.PI / 180;
    const radius = i % 2 === 0 ? R : r;
    const x = (cx + radius * Math.cos(deg)).toFixed(2);
    const y = (cy + radius * Math.sin(deg)).toFixed(2);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  const path = new fabric.Path(pts.join(' ') + ' Z', {
    ...baseOpts, left: 50, top: 50, originX: 'center', originY: 'center',
  });
  fc.add(path);
}

// 4. ヒンメリユニット（外側菱形＋内部対角線2本）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUnit(fc: any, fabric: FabricLib) {
  // 外側の菱形
  const diamond = new fabric.Polygon(
    [{ x: 50, y: 8 }, { x: 78, y: 50 }, { x: 50, y: 92 }, { x: 22, y: 50 }],
    { ...baseOpts },
  );
  // 横対角線: 左(22,50) → 右(78,50)
  const hLine = new fabric.Line([22, 50, 78, 50], { stroke: GOLD, strokeWidth: SW, strokeUniform: true });
  // 縦対角線: 上(50,8) → 下(50,92)
  const vLine = new fabric.Line([50, 8, 50, 92], { stroke: GOLD, strokeWidth: SW, strokeUniform: true });
  const group = new fabric.Group([diamond, hLine, vLine], {
    left: 50, top: 50, originX: 'center', originY: 'center',
  });
  fc.add(group);
}

// 5. 連続菱形チェーン（菱形3つを縦に連結した一筆書きパス）
// canvas 100×130
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildChain(fc: any, fabric: FabricLib) {
  // 菱形1: top(50,5) right(65,30) bottom(50,55) left(35,30)
  // 菱形2: top(50,55) right(65,80) bottom(50,105) left(35,80)
  // 菱形3: top(50,105) right(65,130) bottom(50,155) left(35,130)
  // 一筆書き外形パス
  const d = 'M 50 5 L 65 30 L 50 55 L 65 80 L 50 105 L 65 130 L 50 155 L 35 130 L 50 105 L 35 80 L 50 55 L 35 30 Z';
  const path = new fabric.Path(d, {
    ...baseOpts, left: 50, top: 78, originX: 'center', originY: 'center',
  });
  fc.add(path);
}

const PRESET_IDS = [
  'preset-himmeli-diamond',
  'preset-himmeli-double-triangle',
  'preset-himmeli-star',
  'preset-himmeli-unit',
  'preset-himmeli-chain',
];

export async function ensurePresetStamps(): Promise<void> {
  if (typeof window === 'undefined') return;

  // バージョンが一致していれば何もしない
  if (localStorage.getItem('preset-stamps-version') === PRESET_VERSION) return;

  // 既存のプリセットスタンプを削除して再生成
  PRESET_IDS.forEach(id => deleteStamp(id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('fabric');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabric: FabricLib = mod.fabric ?? mod.default ?? mod;

  const defs: Array<{
    id: string;
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (fc: any, fabric: FabricLib) => void;
    w?: number;
    h?: number;
  }> = [
    { id: 'preset-himmeli-diamond',         name: 'ヒンメリ菱形',     fn: buildDiamond },
    { id: 'preset-himmeli-double-triangle', name: 'ヒンメリ砂時計',   fn: buildDoubleTriangle },
    { id: 'preset-himmeli-star',            name: 'ヒンメリ星',       fn: buildStar },
    { id: 'preset-himmeli-unit',            name: 'ヒンメリユニット', fn: buildUnit },
    { id: 'preset-himmeli-chain',           name: 'ヒンメリチェーン', fn: buildChain, w: 100, h: 160 },
  ];

  for (const def of defs) {
    const stamp = await buildStamp(fabric, def.id, def.name, def.fn, def.w ?? 100, def.h ?? 100);
    saveStamp(stamp);
  }

  localStorage.setItem('preset-stamps-version', PRESET_VERSION);
}
