'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Tool } from '@/lib/types';
import { saveStamp, getStamps, deleteStamp } from '@/lib/stampStorage';
import type { Stamp } from '@/lib/types';

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'];
const CANVAS_SIZE = 400;

export default function StampEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentObj, setCurrentObj] = useState<any>(null);
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [vertical, setVertical] = useState(false);
  const [stampName, setStampName] = useState('');
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);

  useEffect(() => {
    setStamps(getStamps());
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fabric: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('fabric').then((mod: any) => {
      fabric = mod.fabric ?? mod.default ?? mod;
      canvas = new fabric.Canvas(canvasRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: '#ffffff',
      });
      fabricRef.current = canvas;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:down', (opt: any) => {
        if (fabricRef.current.toolMode === 'select') return;
        const pointer = canvas.getPointer(opt.e);
        setStartPoint({ x: pointer.x, y: pointer.y });
        setIsDrawing(true);

        const mode = fabricRef.current.toolMode;
        if (mode === 'text') {
          const text = new fabric.IText(fabricRef.current.textOptions.vertical ? '縦\n書\nき' : 'テキスト', {
            left: pointer.x,
            top: pointer.y,
            fontSize: fabricRef.current.textOptions.fontSize,
            fontFamily: fabricRef.current.textOptions.fontFamily,
            fill: fabricRef.current.drawColor,
            fontWeight: fabricRef.current.textOptions.bold ? 'bold' : 'normal',
            fontStyle: fabricRef.current.textOptions.italic ? 'italic' : 'normal',
            underline: fabricRef.current.textOptions.underline,
            charSpacing: 0,
            lineHeight: fabricRef.current.textOptions.vertical ? 1.0 : 1.16,
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          setIsDrawing(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let obj: any = null;
        const opts = {
          left: pointer.x,
          top: pointer.y,
          stroke: fabricRef.current.drawColor,
          strokeWidth: fabricRef.current.strokeW,
          fill: fabricRef.current.fillC,
          selectable: false,
          evented: false,
        };

        if (mode === 'rect') {
          obj = new fabric.Rect({ ...opts, width: 1, height: 1 });
        } else if (mode === 'circle') {
          obj = new fabric.Ellipse({ ...opts, rx: 1, ry: 1, originX: 'center', originY: 'center' });
        } else if (mode === 'triangle') {
          obj = new fabric.Triangle({ ...opts, width: 1, height: 1 });
        } else if (mode === 'line') {
          obj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: fabricRef.current.drawColor,
            strokeWidth: fabricRef.current.strokeW,
            selectable: false,
            evented: false,
          });
        } else if (mode === 'arrow') {
          obj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: fabricRef.current.drawColor,
            strokeWidth: fabricRef.current.strokeW,
            selectable: false,
            evented: false,
          });
        }

        if (obj) {
          canvas.add(obj);
          setCurrentObj(obj);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on('mouse:move', (opt: any) => {
        if (!fabricRef.current.isDrawingMode2) return;
        const pointer = canvas.getPointer(opt.e);
        const obj = fabricRef.current.currentDrawObj;
        if (!obj) return;
        const mode = fabricRef.current.toolMode;

        if (mode === 'rect' || mode === 'triangle') {
          const w = pointer.x - fabricRef.current.startPt.x;
          const h = pointer.y - fabricRef.current.startPt.y;
          obj.set({
            left: w > 0 ? fabricRef.current.startPt.x : pointer.x,
            top: h > 0 ? fabricRef.current.startPt.y : pointer.y,
            width: Math.abs(w),
            height: Math.abs(h),
          });
        } else if (mode === 'circle') {
          const rx = Math.abs(pointer.x - fabricRef.current.startPt.x) / 2;
          const ry = Math.abs(pointer.y - fabricRef.current.startPt.y) / 2;
          obj.set({
            rx,
            ry,
            left: (pointer.x + fabricRef.current.startPt.x) / 2,
            top: (pointer.y + fabricRef.current.startPt.y) / 2,
          });
        } else if (mode === 'line' || mode === 'arrow') {
          obj.set({ x2: pointer.x, y2: pointer.y });
        }
        canvas.renderAll();
      });

      canvas.on('mouse:up', () => {
        const obj = fabricRef.current.currentDrawObj;
        if (obj) {
          obj.set({ selectable: true, evented: true });
          canvas.setActiveObject(obj);
          fabricRef.current.currentDrawObj = null;
        }
        fabricRef.current.isDrawingMode2 = false;
      });
    });

    return () => {
      if (canvas) canvas.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.toolMode = tool;
    fabricRef.current.drawColor = color;
    fabricRef.current.fillC = fillColor === 'transparent' ? 'transparent' : fillColor;
    fabricRef.current.strokeW = strokeWidth;
    fabricRef.current.textOptions = { fontSize, fontFamily, bold, italic, underline, vertical };
    fabricRef.current.selection = tool === 'select';
    fabricRef.current.isDrawingMode = false;

    const canvas = fabricRef.current;
    if (tool === 'select') {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    } else {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    }
  }, [tool, color, fillColor, strokeWidth, fontSize, fontFamily, bold, italic, underline, vertical]);

  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.isDrawingMode2 = isDrawing;
    fabricRef.current.startPt = startPoint;
  }, [isDrawing, startPoint]);

  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.currentDrawObj = currentObj;
  }, [currentObj]);

  const clearCanvas = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = '#ffffff';
    fabricRef.current.renderAll();
  }, []);

  const saveAsStamp = useCallback(() => {
    if (!fabricRef.current) return;
    const name = stampName.trim() || `スタンプ ${new Date().toLocaleTimeString()}`;
    const thumbnail = fabricRef.current.toDataURL({ format: 'png', multiplier: 0.5 });
    const fabricJSON = fabricRef.current.toJSON();
    const stamp: Stamp = {
      id: Date.now().toString(),
      name,
      thumbnail,
      fabricJSON,
      createdAt: new Date().toISOString(),
    };
    saveStamp(stamp);
    setStamps(getStamps());
    setStampName('');
  }, [stampName]);

  const loadStamp = useCallback((stamp: Stamp) => {
    if (!fabricRef.current) return;
    fabricRef.current.loadFromJSON(stamp.fabricJSON, () => {
      fabricRef.current.renderAll();
    });
    setSelectedStampId(stamp.id);
  }, []);

  const removeStamp = useCallback((id: string) => {
    deleteStamp(id);
    setStamps(getStamps());
  }, []);

  const tools: { id: Tool; label: string }[] = [
    { id: 'select', label: '選択' },
    { id: 'line', label: '直線' },
    { id: 'rect', label: '矩形' },
    { id: 'circle', label: '円' },
    { id: 'triangle', label: '三角' },
    { id: 'arrow', label: '矢印' },
    { id: 'text', label: 'テキスト' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 p-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-white">← ホーム</Link>
        <h1 className="text-xl font-bold">スタンプエディタ</h1>
        <Link href="/cover-designer" className="ml-auto text-green-400 hover:text-green-300">カバーデザイナー →</Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tools */}
        <div className="w-52 bg-gray-800 p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-400 uppercase">ツール</div>
          <div className="grid grid-cols-2 gap-1">
            {tools.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`px-2 py-2 rounded text-sm font-medium transition ${tool === t.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-700 pt-3">
            <div className="text-sm font-semibold text-gray-400 mb-2">線の色</div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-8 cursor-pointer rounded" />
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-400 mb-2">塗りつぶし</div>
            <div className="flex items-center gap-2 mb-1">
              <input type="checkbox" id="noFill" checked={fillColor === 'transparent'} onChange={e => setFillColor(e.target.checked ? 'transparent' : '#ffffff')} />
              <label htmlFor="noFill" className="text-sm">なし</label>
            </div>
            {fillColor !== 'transparent' && (
              <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} className="w-full h-8 cursor-pointer rounded" />
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-400 mb-1">線幅: {strokeWidth}px</div>
            <input type="range" min="1" max="20" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="w-full" />
          </div>

          {tool === 'text' && (
            <div className="border-t border-gray-700 pt-3 flex flex-col gap-2">
              <div className="text-sm font-semibold text-gray-400">テキスト設定</div>
              <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full bg-gray-700 rounded px-2 py-1 text-sm">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <div className="text-xs text-gray-400">サイズ: {fontSize}px</div>
              <input type="range" min="8" max="120" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full" />
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setBold(!bold)} className={`px-2 py-1 rounded text-sm font-bold ${bold ? 'bg-blue-600' : 'bg-gray-700'}`}>B</button>
                <button onClick={() => setItalic(!italic)} className={`px-2 py-1 rounded text-sm italic ${italic ? 'bg-blue-600' : 'bg-gray-700'}`}>I</button>
                <button onClick={() => setUnderline(!underline)} className={`px-2 py-1 rounded text-sm underline ${underline ? 'bg-blue-600' : 'bg-gray-700'}`}>U</button>
                <button onClick={() => setVertical(!vertical)} className={`px-2 py-1 rounded text-sm ${vertical ? 'bg-blue-600' : 'bg-gray-700'}`}>縦</button>
              </div>
            </div>
          )}

          <div className="border-t border-gray-700 pt-3">
            <button onClick={clearCanvas} className="w-full px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm">クリア</button>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-700 p-8">
          <div className="shadow-2xl">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Right: Stamp list */}
        <div className="w-64 bg-gray-800 p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-400 uppercase">スタンプ登録</div>
          <input
            type="text"
            value={stampName}
            onChange={e => setStampName(e.target.value)}
            placeholder="スタンプ名"
            className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
          />
          <button onClick={saveAsStamp} className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold">
            スタンプとして登録
          </button>

          <div className="border-t border-gray-700 pt-3">
            <div className="text-sm font-semibold text-gray-400 mb-2">登録済み ({stamps.length})</div>
            <div className="flex flex-col gap-2">
              {stamps.map(stamp => (
                <div key={stamp.id} className={`bg-gray-700 rounded p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-600 ${selectedStampId === stamp.id ? 'ring-2 ring-blue-500' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stamp.thumbnail} alt={stamp.name} className="w-12 h-12 object-contain bg-white rounded" onClick={() => loadStamp(stamp)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" onClick={() => loadStamp(stamp)}>{stamp.name}</div>
                    <div className="text-xs text-gray-400">{new Date(stamp.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => removeStamp(stamp.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
