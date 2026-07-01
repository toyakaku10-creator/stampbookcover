'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Stamp } from '@/lib/types';
import { getStamps } from '@/lib/stampStorage';

// Real dimensions: 152x385mm at 350dpi
// 152mm = 152/25.4*350 = 2094px, 385mm = 385/25.4*350 = 5307px
const REAL_W = 2094;
const REAL_H = 5307;
const SCALE = 0.18; // display scale
const DISP_W = Math.round(REAL_W * SCALE);
const DISP_H = Math.round(REAL_H * SCALE);

type ArrangementType = 'grid' | 'circular' | 'random' | 'border';
type BgType = 'solid' | 'gradient';
type GradDir = 'vertical' | 'horizontal' | 'diagonal';

export default function CoverDesignerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedStampForPlace, setSelectedStampForPlace] = useState<Stamp | null>(null);
  const [arrangement, setArrangement] = useState<ArrangementType>('grid');
  const [arrangementCount, setArrangementCount] = useState(9);
  const [bgType, setBgType] = useState<BgType>('solid');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgColor2, setBgColor2] = useState('#cccccc');
  const [gradDir, setGradDir] = useState<GradDir>('vertical');
  const [stampScale, setStampScale] = useState(0.5);

  useEffect(() => {
    setStamps(getStamps());
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('fabric').then((mod: any) => {
      const fabric = mod.fabric ?? mod.default ?? mod;
      canvas = new fabric.Canvas(canvasRef.current, {
        width: DISP_W,
        height: DISP_H,
        backgroundColor: '#ffffff',
      });
      fabricRef.current = canvas;
      fabricRef.current._fabric = fabric;
    });

    return () => {
      if (canvas) canvas.dispose();
    };
  }, []);

  const applyBackground = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    if (!fabric) return;

    // Remove existing background rect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = canvas.getObjects().filter((o: any) => o._isBg);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existing.forEach((o: any) => canvas.remove(o));

    if (bgType === 'solid') {
      canvas.backgroundColor = bgColor;
      canvas.renderAll();
    } else {
      canvas.backgroundColor = '#ffffff';
      let coords: { x1: number; y1: number; x2: number; y2: number };
      if (gradDir === 'vertical') {
        coords = { x1: 0, y1: 0, x2: 0, y2: DISP_H };
      } else if (gradDir === 'horizontal') {
        coords = { x1: 0, y1: 0, x2: DISP_W, y2: 0 };
      } else {
        coords = { x1: 0, y1: 0, x2: DISP_W, y2: DISP_H };
      }
      const grad = new fabric.Gradient({
        type: 'linear',
        coords,
        colorStops: [{ offset: 0, color: bgColor }, { offset: 1, color: bgColor2 }],
      });
      const rect = new fabric.Rect({
        left: 0, top: 0,
        width: DISP_W, height: DISP_H,
        fill: grad,
        selectable: false,
        evented: false,
      });
      // Store flag on object
      rect._isBg = true;
      canvas.add(rect);
      canvas.sendToBack(rect);
      canvas.renderAll();
    }
  }, [bgType, bgColor, bgColor2, gradDir]);

  useEffect(() => {
    applyBackground();
  }, [applyBackground]);

  const placeStamp = useCallback((stamp: Stamp, x: number, y: number, scale: number = stampScale) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    if (!fabric) return;

    const json = stamp.fabricJSON as { objects?: object[] };
    const objects = json.objects || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fabric.util.enlivenObjects([...objects], (enlivenedObjects: any[]) => {
      if (enlivenedObjects.length === 0) return;
      const group = new fabric.Group(enlivenedObjects, {
        left: x,
        top: y,
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
      });
      group._stampId = stamp.id;
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
    });
  }, [stampScale]);

  const arrangeStamps = useCallback(() => {
    if (!selectedStampForPlace || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    if (!fabric) return;

    const stamp = selectedStampForPlace;
    const n = arrangementCount;
    const json = stamp.fabricJSON as { objects?: object[] };
    const objects = json.objects || [];

    const placeAt = (positions: {x: number, y: number}[], scale: number) => {
      let placed = 0;
      const placeNext = () => {
        if (placed >= positions.length) {
          canvas.renderAll();
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fabric.util.enlivenObjects([...objects], (enlivenedObjects: any[]) => {
          if (enlivenedObjects.length === 0) { placed++; placeNext(); return; }
          const group = new fabric.Group(enlivenedObjects, {
            left: positions[placed].x,
            top: positions[placed].y,
            scaleX: scale,
            scaleY: scale,
            originX: 'center',
            originY: 'center',
          });
          group._stampId = stamp.id;
          canvas.add(group);
          placed++;
          placeNext();
        });
      };
      placeNext();
    };

    const scale = stampScale;

    if (arrangement === 'grid') {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cellW = DISP_W / cols;
      const cellH = DISP_H / rows;
      const positions = [];
      for (let r = 0; r < rows && positions.length < n; r++) {
        for (let c = 0; c < cols && positions.length < n; c++) {
          positions.push({ x: cellW * c + cellW / 2, y: cellH * r + cellH / 2 });
        }
      }
      placeAt(positions, scale);
    } else if (arrangement === 'circular') {
      const cx = DISP_W / 2;
      const cy = DISP_H / 2;
      const rx = DISP_W * 0.38;
      const ry = DISP_H * 0.38;
      const positions = Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
      });
      placeAt(positions, scale);
    } else if (arrangement === 'random') {
      const margin = 40;
      const positions = Array.from({ length: n }, () => ({
        x: margin + Math.random() * (DISP_W - margin * 2),
        y: margin + Math.random() * (DISP_H - margin * 2),
      }));
      placeAt(positions, scale);
    } else if (arrangement === 'border') {
      const margin = 30;
      const topLen = DISP_W - 2 * margin;
      const rightLen = DISP_H - 2 * margin;
      const perimeter = 2 * (topLen + rightLen);
      const positions: {x: number, y: number}[] = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * perimeter;
        if (t < topLen) {
          positions.push({ x: margin + t, y: margin });
        } else if (t < topLen + rightLen) {
          positions.push({ x: DISP_W - margin, y: margin + (t - topLen) });
        } else if (t < topLen * 2 + rightLen) {
          positions.push({ x: DISP_W - margin - (t - topLen - rightLen), y: DISP_H - margin });
        } else {
          positions.push({ x: margin, y: DISP_H - margin - (t - topLen * 2 - rightLen) });
        }
      }
      placeAt(positions, scale);
    }
  }, [selectedStampForPlace, arrangement, arrangementCount, stampScale]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fabric.Image.fromURL(dataUrl, (img: any) => {
        const scale = Math.min(DISP_W / (img.width ?? 1), DISP_H / (img.height ?? 1));
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale });
        canvas.add(img);
        canvas.sendToBack(img);
        canvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  };

  const exportJPEG = async () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const dataUrl = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.95,
      multiplier: 1 / SCALE,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'bookcover.jpg';
    a.click();
  };

  const exportPDF = async () => {
    if (!fabricRef.current) return;
    const { jsPDF } = await import('jspdf');
    const canvas = fabricRef.current;
    const dataUrl = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.95,
      multiplier: 1 / SCALE,
    });
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [152, 385],
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, 152, 385);
    pdf.save('bookcover.pdf');
  };

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active) {
      fabricRef.current.remove(active);
      fabricRef.current.renderAll();
    }
  };

  const duplicateSelected = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const active = canvas.getActiveObject();
    if (!active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    active.clone((cloned: any) => {
      cloned.set({ left: active.left + 20, top: active.top + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 p-3 flex items-center gap-4 flex-wrap">
        <Link href="/" className="text-gray-400 hover:text-white text-sm">← ホーム</Link>
        <h1 className="text-lg font-bold">カバーデザイナー</h1>
        <span className="text-gray-500 text-xs">152×385mm / 350dpi</span>
        <Link href="/stamp-editor" className="text-blue-400 hover:text-blue-300 text-sm">スタンプエディタ →</Link>
        <div className="ml-auto flex gap-2">
          <button onClick={exportJPEG} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm font-semibold">JPEG書き出し</button>
          <button onClick={exportPDF} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold">PDF書き出し</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-56 bg-gray-800 p-3 flex flex-col gap-3 overflow-y-auto text-sm">
          {/* Background */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">背景</div>
            <div className="flex gap-1 mb-2">
              <button onClick={() => setBgType('solid')} className={`flex-1 py-1 rounded text-xs ${bgType === 'solid' ? 'bg-blue-600' : 'bg-gray-700'}`}>単色</button>
              <button onClick={() => setBgType('gradient')} className={`flex-1 py-1 rounded text-xs ${bgType === 'gradient' ? 'bg-blue-600' : 'bg-gray-700'}`}>グラデ</button>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-gray-400">色1</label>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="flex-1 h-7 cursor-pointer rounded" />
            </div>
            {bgType === 'gradient' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs text-gray-400">色2</label>
                  <input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} className="flex-1 h-7 cursor-pointer rounded" />
                </div>
                <div className="flex gap-1">
                  {(['vertical', 'horizontal', 'diagonal'] as GradDir[]).map(d => (
                    <button key={d} onClick={() => setGradDir(d)} className={`flex-1 py-0.5 rounded text-xs ${gradDir === d ? 'bg-blue-600' : 'bg-gray-700'}`}>
                      {d === 'vertical' ? '縦' : d === 'horizontal' ? '横' : '斜め'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Image upload */}
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">画像</div>
            <label className="block w-full py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-center cursor-pointer text-xs">
              画像をアップロード
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          {/* Stamp placement */}
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">スタンプ配置</div>
            <div className="text-xs text-gray-400 mb-1">スタンプを選択:</div>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {stamps.length === 0 && <div className="text-xs text-gray-500">スタンプなし</div>}
              {stamps.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStampForPlace(s)}
                  className={`flex items-center gap-1 p-1 rounded cursor-pointer ${selectedStampForPlace?.id === s.id ? 'bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbnail} alt={s.name} className="w-8 h-8 object-contain bg-white rounded" />
                  <span className="text-xs truncate">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedStampForPlace && (
            <div>
              <div className="text-xs text-gray-400 mb-1">スタンプサイズ: {Math.round(stampScale * 100)}%</div>
              <input type="range" min="5" max="200" value={Math.round(stampScale * 100)} onChange={e => setStampScale(Number(e.target.value) / 100)} className="w-full" />
              <button
                onClick={() => {
                  if (!fabricRef.current || !selectedStampForPlace) return;
                  placeStamp(selectedStampForPlace, DISP_W / 2, DISP_H / 2);
                }}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs mt-1"
              >
                中央に配置
              </button>
            </div>
          )}

          {/* Arrangement */}
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">均等配置</div>
            <div className="grid grid-cols-2 gap-1 mb-2">
              {(['grid', 'circular', 'random', 'border'] as ArrangementType[]).map(a => (
                <button key={a} onClick={() => setArrangement(a)} className={`py-1 rounded text-xs ${arrangement === a ? 'bg-purple-600' : 'bg-gray-700'}`}>
                  {a === 'grid' ? 'グリッド' : a === 'circular' ? '円形' : a === 'random' ? 'ランダム' : 'ボーダー'}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mb-1">個数: {arrangementCount}</div>
            <input type="range" min="1" max="50" value={arrangementCount} onChange={e => setArrangementCount(Number(e.target.value))} className="w-full mb-1" />
            <button onClick={arrangeStamps} disabled={!selectedStampForPlace} className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded text-xs">
              均等配置を実行
            </button>
          </div>

          {/* Selected object actions */}
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">オブジェクト操作</div>
            <div className="flex flex-col gap-1">
              <button onClick={duplicateSelected} className="py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">複製</button>
              <button onClick={deleteSelected} className="py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs">削除</button>
            </div>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 bg-gray-700 overflow-auto flex items-start justify-center p-8">
          <div className="shadow-2xl" style={{ width: DISP_W, height: DISP_H, flexShrink: 0 }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
