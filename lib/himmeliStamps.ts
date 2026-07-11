import { saveStamp, deleteStamp } from './stampStorage';

const HIMMELI_VERSION = '4';
import type { Stamp } from './types';

const STROKE = '#C9A84C';
const SW = 1.8;
const FILL = 'transparent';
const CX = 100, CY = 100;
const SIZE = 200;

type Pt = { x: number; y: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricLib = any;

function parsePoints(str: string): Pt[] {
  return str.trim().split(/\s+/).map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

function rotate(pts: Pt[], deg: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return pts.map(p => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

function shift(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

const opts = { stroke: STROKE, strokeWidth: SW, fill: FILL, strokeUniform: true };

const STAMP_DEFS: Array<{
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (fabric: FabricLib, fc: any) => void;
}> = [
  {
    id: 'himmeli-sample-1',
    name: '六連菱形',
    build(fabric, fc) {
      const base = parsePoints('0,-58 17,-29 0,0 -17,-29');
      [0, 60, 120, 180, 240, 300].forEach(deg => {
        fc.add(new fabric.Polygon(shift(rotate(base, deg), CX, CY), opts));
      });
    },
  },
  {
    id: 'himmeli-sample-2',
    name: '六連三角',
    build(fabric, fc) {
      const base = parsePoints('0,-62 22,-18 -22,-18');
      [0, 60, 120, 180, 240, 300].forEach(deg => {
        fc.add(new fabric.Polygon(shift(rotate(base, deg), CX, CY), opts));
      });
    },
  },
  {
    id: 'himmeli-sample-3',
    name: '四連菱形',
    build(fabric, fc) {
      const base = parsePoints('0,-65 20,-32 0,0 -20,-32');
      [0, 90, 180, 270].forEach(deg => {
        fc.add(new fabric.Polygon(shift(rotate(base, deg), CX, CY), opts));
      });
    },
  },
  {
    id: 'himmeli-sample-4',
    name: '六連二重菱形',
    build(fabric, fc) {
      const outer = parsePoints('0,-58 17,-29 0,0 -17,-29');
      const inner = parsePoints('0,-30 9,-15 0,0 -9,-15');
      [0, 60, 120, 180, 240, 300].forEach(deg => {
        fc.add(new fabric.Polygon(shift(rotate(outer, deg), CX, CY), opts));
        fc.add(new fabric.Polygon(shift(rotate(inner, deg), CX, CY), opts));
      });
    },
  },
];

export async function ensureHimmeliStamps(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('himmeli-version') === HIMMELI_VERSION) return;

  // 既存のヒンメリスタンプを削除して再生成
  STAMP_DEFS.forEach(d => deleteStamp(d.id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('fabric');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabric: FabricLib = mod.fabric ?? mod.default ?? mod;

  for (const def of STAMP_DEFS) {
    const el = document.createElement('canvas');
    el.width = SIZE;
    el.height = SIZE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc: any = new fabric.Canvas(el, { width: SIZE, height: SIZE, backgroundColor: '#ffffff' });
    def.build(fabric, fc);
    fc.backgroundColor = '#ffffff';
    fc.renderAll();
    // 200×200・白背景・中央フィットのサムネイルを生成
    const objects = fc.getObjects();
    const cloned: any[] = await Promise.all(objects.map((o: any) => o.clone()));
    const thumbEl = document.createElement('canvas');
    const thumbCanvas: any = new fabric.Canvas(thumbEl, { width: 200, height: 200, backgroundColor: '#ffffff' });
    if (cloned.length > 0) {
      const group = new fabric.Group(cloned);
      const maxDim = Math.max(group.width ?? 1, group.height ?? 1);
      const scale = 160 / maxDim;
      group.set({ scaleX: scale, scaleY: scale, left: 100, top: 100, originX: 'center', originY: 'center' });
      thumbCanvas.add(group);
    }
    thumbCanvas.backgroundColor = '#ffffff';
    thumbCanvas.renderAll();
    const thumbnail = thumbCanvas.toDataURL({ format: 'png', multiplier: 1 });
    thumbCanvas.dispose();
    const fabricJSON = fc.toJSON();
    fabricJSON.backgroundColor = '#ffffff';
    fc.dispose();
    const stamp: Stamp = {
      id: def.id, name: def.name, thumbnail, fabricJSON,
      createdAt: new Date().toISOString(),
    };
    saveStamp(stamp);
  }

  localStorage.setItem('himmeli-version', HIMMELI_VERSION);
}
