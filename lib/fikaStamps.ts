import { saveStamp, deleteStamp } from './stampStorage';
import type { Stamp } from './types';

const FIKA_VERSION = '1';

const STROKE = '#C9A84C';
const SW = 1.5;
const FILL = 'transparent';
const SIZE = 200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricLib = any;

const opts = { stroke: STROKE, strokeWidth: SW, fill: FILL, strokeUniform: true };

const STAMP_DEFS: Array<{
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (fabric: FabricLib, fc: any) => void;
}> = [
  {
    id: 'fika-sofa',
    name: 'ソファー',
    build(fabric, fc) {
      // 座面
      fc.add(new fabric.Rect({ ...opts, left: 30, top: 100, width: 140, height: 50, rx: 6, ry: 6 }));
      // 背もたれ
      fc.add(new fabric.Rect({ ...opts, left: 30, top: 70, width: 140, height: 35, rx: 8, ry: 8 }));
      // 左肘掛け
      fc.add(new fabric.Rect({ ...opts, left: 20, top: 80, width: 20, height: 70, rx: 6, ry: 6 }));
      // 右肘掛け
      fc.add(new fabric.Rect({ ...opts, left: 160, top: 80, width: 20, height: 70, rx: 6, ry: 6 }));
      // 左前脚
      fc.add(new fabric.Line([45, 150, 45, 165], opts));
      // 右前脚
      fc.add(new fabric.Line([155, 150, 155, 165], opts));
    },
  },
  {
    id: 'fika-plant',
    name: '観葉植物',
    build(fabric, fc) {
      // 鉢（台形）
      fc.add(new fabric.Polygon([
        { x: 75, y: 140 }, { x: 125, y: 140 }, { x: 115, y: 170 }, { x: 85, y: 170 },
      ], opts));
      // 鉢の縁
      fc.add(new fabric.Rect({ ...opts, left: 72, top: 133, width: 56, height: 10, rx: 2, ry: 2 }));
      // 茎
      fc.add(new fabric.Line([100, 60, 100, 140], opts));
      // 左葉
      fc.add(new fabric.Path('M 100 90 Q 60 75 50 50 Q 75 70 100 90', opts));
      // 右葉
      fc.add(new fabric.Path('M 100 90 Q 140 75 150 50 Q 125 70 100 90', opts));
      // 上葉
      fc.add(new fabric.Path('M 100 65 Q 80 40 100 30 Q 120 40 100 65', opts));
    },
  },
  {
    id: 'fika-cinnamon-roll',
    name: 'シナモンロール',
    build(fabric, fc) {
      // 外側の渦（外形円）
      fc.add(new fabric.Circle({ ...opts, left: 30, top: 30, radius: 68, originX: 'left', originY: 'top' }));
      // 中間リング（半円弧でスパイラル感）
      fc.add(new fabric.Path('M 100 45 A 55 55 0 1 1 45 100', opts));
      // 内側リング
      fc.add(new fabric.Path('M 100 60 A 40 40 0 1 1 60 100', opts));
      // 最内部の小円
      fc.add(new fabric.Circle({ ...opts, left: 77, top: 77, radius: 22, originX: 'left', originY: 'top' }));
      // 中心点
      fc.add(new fabric.Circle({ ...opts, left: 94, top: 94, radius: 6, originX: 'left', originY: 'top' }));
    },
  },
  {
    id: 'fika-coffee-cup',
    name: 'コーヒーカップ',
    build(fabric, fc) {
      // カップ本体
      fc.add(new fabric.Rect({ ...opts, left: 45, top: 75, width: 90, height: 75, rx: 8, ry: 8 }));
      // 皿
      fc.add(new fabric.Ellipse({ ...opts, left: 30, top: 148, rx: 70, ry: 10, originX: 'left', originY: 'top' }));
      // 持ち手
      fc.add(new fabric.Path('M 135 90 Q 165 90 165 118 Q 165 145 135 145', opts));
      // 湯気1
      fc.add(new fabric.Path('M 70 65 Q 65 50 70 38', opts));
      // 湯気2
      fc.add(new fabric.Path('M 90 60 Q 85 45 90 32', opts));
      // 湯気3
      fc.add(new fabric.Path('M 110 65 Q 105 50 110 38', opts));
    },
  },
  {
    id: 'fika-books',
    name: '本（積み重ね）',
    build(fabric, fc) {
      // 一番下の本（横長）
      fc.add(new fabric.Rect({ ...opts, left: 30, top: 140, width: 140, height: 22, rx: 2, ry: 2 }));
      // 二冊目
      fc.add(new fabric.Rect({ ...opts, left: 38, top: 116, width: 120, height: 26, rx: 2, ry: 2 }));
      // 三冊目（少し回転）
      const book3 = new fabric.Rect({ ...opts, left: 100, top: 93, width: 110, height: 24, rx: 2, ry: 2, originX: 'center', originY: 'center', angle: -5 });
      fc.add(book3);
      // 背表紙線（下の本）
      fc.add(new fabric.Line([48, 140, 48, 162], opts));
      // 背表紙線（中の本）
      fc.add(new fabric.Line([55, 116, 55, 142], opts));
    },
  },
  {
    id: 'fika-candle',
    name: 'キャンドル',
    build(fabric, fc) {
      // ロウソク本体
      fc.add(new fabric.Rect({ ...opts, left: 75, top: 90, width: 50, height: 85, rx: 4, ry: 4 }));
      // 芯
      fc.add(new fabric.Line([100, 78, 100, 92], opts));
      // 炎（雫型）
      fc.add(new fabric.Path('M 100 42 Q 115 58 108 72 Q 100 78 92 72 Q 85 58 100 42', opts));
      // ロウのたれ
      fc.add(new fabric.Path('M 80 90 Q 78 100 80 108', opts));
      fc.add(new fabric.Path('M 118 90 Q 120 102 118 110', opts));
      // 皿
      fc.add(new fabric.Ellipse({ ...opts, left: 62, top: 170, rx: 38, ry: 8, originX: 'left', originY: 'top' }));
    },
  },
  {
    id: 'fika-cushion',
    name: 'クッション',
    build(fabric, fc) {
      // クッション本体（角丸正方形）
      fc.add(new fabric.Rect({ ...opts, left: 25, top: 25, width: 150, height: 150, rx: 30, ry: 30 }));
      // 中央の縫い目（縦）
      fc.add(new fabric.Line([100, 45, 100, 155], opts));
      // 中央の縫い目（横）
      fc.add(new fabric.Line([45, 100, 155, 100], opts));
      // 四隅のボタン（小円）
      fc.add(new fabric.Circle({ ...opts, left: 56, top: 56, radius: 8, originX: 'center', originY: 'center' }));
      fc.add(new fabric.Circle({ ...opts, left: 144, top: 56, radius: 8, originX: 'center', originY: 'center' }));
      fc.add(new fabric.Circle({ ...opts, left: 56, top: 144, radius: 8, originX: 'center', originY: 'center' }));
      fc.add(new fabric.Circle({ ...opts, left: 144, top: 144, radius: 8, originX: 'center', originY: 'center' }));
    },
  },
  {
    id: 'fika-teapot',
    name: 'ティーポット',
    build(fabric, fc) {
      // 本体（楕円）
      fc.add(new fabric.Ellipse({ ...opts, left: 38, top: 65, rx: 62, ry: 58, originX: 'left', originY: 'top' }));
      // 蓋
      fc.add(new fabric.Ellipse({ ...opts, left: 60, top: 58, rx: 40, ry: 10, originX: 'left', originY: 'top' }));
      // 蓋のつまみ
      fc.add(new fabric.Circle({ ...opts, left: 100, top: 42, radius: 8, originX: 'center', originY: 'center' }));
      // 注ぎ口
      fc.add(new fabric.Path('M 162 90 Q 185 80 188 100 Q 188 118 168 118', opts));
      // 持ち手
      fc.add(new fabric.Path('M 38 85 Q 10 85 10 118 Q 10 148 38 145', opts));
    },
  },
  {
    id: 'fika-window',
    name: '窓辺の光',
    build(fabric, fc) {
      // 窓枠外側
      fc.add(new fabric.Rect({ ...opts, left: 30, top: 25, width: 140, height: 140, rx: 4, ry: 4 }));
      // 窓枠内側（小さめ）
      fc.add(new fabric.Rect({ ...opts, left: 38, top: 33, width: 124, height: 124, rx: 2, ry: 2 }));
      // 縦の桟
      fc.add(new fabric.Line([100, 33, 100, 157], opts));
      // 横の桟
      fc.add(new fabric.Line([38, 95, 162, 95], opts));
      // 光の筋（左上から右下）
      fc.add(new fabric.Line([45, 40, 95, 88], { ...opts, strokeDashArray: [4, 3] }));
      fc.add(new fabric.Line([55, 40, 92, 75], { ...opts, strokeDashArray: [4, 3] }));
      // 窓台
      fc.add(new fabric.Rect({ ...opts, left: 20, top: 162, width: 160, height: 12, rx: 3, ry: 3 }));
    },
  },
  {
    id: 'fika-blanket',
    name: 'ブランケット',
    build(fabric, fc) {
      // ブランケット本体（角丸四角）
      fc.add(new fabric.Rect({ ...opts, left: 25, top: 45, width: 150, height: 110, rx: 18, ry: 18 }));
      // 内側の波線1
      fc.add(new fabric.Path('M 45 90 Q 58 80 72 90 Q 86 100 100 90 Q 114 80 128 90 Q 142 100 155 90', opts));
      // 内側の波線2
      fc.add(new fabric.Path('M 45 108 Q 58 98 72 108 Q 86 118 100 108 Q 114 98 128 108 Q 142 118 155 108', opts));
      // 上端フリンジ
      for (let i = 0; i < 7; i++) {
        const x = 45 + i * 18;
        fc.add(new fabric.Line([x, 45, x - 4, 30], opts));
      }
      // 下端フリンジ
      for (let i = 0; i < 7; i++) {
        const x = 45 + i * 18;
        fc.add(new fabric.Line([x, 155, x - 4, 170], opts));
      }
    },
  },
];

export async function ensureFikaStamps(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('fika-version') === FIKA_VERSION) return;

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

    const objects = fc.getObjects();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cloned: any[] = await Promise.all(objects.map((o: any) => o.clone()));
    const thumbEl = document.createElement('canvas');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  localStorage.setItem('fika-version', FIKA_VERSION);
}
