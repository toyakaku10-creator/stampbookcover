'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MousePointer2, Minus, Square, Circle, Triangle, ArrowRight,
  Type, Bold, Italic, Underline, AlignLeft,
  Trash2, Save, ChevronLeft, ChevronRight, X, Layout
} from 'lucide-react';
import { Tool } from '@/lib/types';
import { saveStamp, getStamps, deleteStamp } from '@/lib/stampStorage';
import type { Stamp } from '@/lib/types';

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact'];
const CANVAS_SIZE = 400;

const TOOLS: { id: Tool; icon: React.ReactNode; title: string }[] = [
  { id: 'select',   icon: <MousePointer2 size={18} />, title: '選択' },
  { id: 'line',     icon: <Minus size={18} />,         title: '直線' },
  { id: 'rect',     icon: <Square size={18} />,        title: '矩形' },
  { id: 'circle',   icon: <Circle size={18} />,        title: '円' },
  { id: 'triangle', icon: <Triangle size={18} />,      title: '三角' },
  { id: 'arrow',    icon: <ArrowRight size={18} />,    title: '矢印' },
  { id: 'text',     icon: <Type size={18} />,          title: 'テキスト' },
];

const S = {
  toolbar: {
    width: 48,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '8px 0',
    gap: 2,
  },
  toolBtn: (active: boolean): React.CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#1A1A1A' : 'var(--text)',
    transition: 'background 0.15s',
  }),
  divider: {
    width: 24,
    height: 1,
    background: 'var(--border)',
    margin: '4px 0',
  },
  panel: {
    width: 200,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    overflowY: 'auto' as const,
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    padding: '6px 8px',
    fontSize: 12,
    outline: 'none',
  },
  btn: (variant: 'accent' | 'danger' | 'ghost' = 'ghost'): React.CSSProperties => ({
    width: '100%',
    padding: '7px 0',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    background: variant === 'accent' ? 'var(--accent)' : variant === 'danger' ? 'var(--danger)' : 'var(--bg)',
    color: variant === 'accent' ? '#1A1A1A' : 'var(--text)',
    transition: 'opacity 0.15s',
  }),
  stampCard: (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 8,
    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
    background: selected ? 'rgba(232,197,71,0.08)' : 'var(--bg)',
    cursor: 'pointer',
  }),
};

export default function StampEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [tool, setTool] = useState<Tool>('select');
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

  useEffect(() => { setStamps(getStamps()); }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any;
    let disposed = false;

    import('fabric').then((mod: any) => {
      if (disposed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric: any = mod.fabric ?? mod.default ?? mod;
      canvas = new fabric.Canvas(canvasRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: '#ffffff',
      });
      fabricRef.current = canvas;

      canvas.on('mouse:down', (opt: any) => {
        if (fabricRef.current.toolMode === 'select') return;
        const pointer = canvas.getScenePoint(opt.e);
        fabricRef.current.startPt = { x: pointer.x, y: pointer.y };
        fabricRef.current.isDrawingMode2 = true;

        const mode = fabricRef.current.toolMode;
        if (mode === 'text') {
          const text = new fabric.IText(fabricRef.current.textOptions?.vertical ? '縦\n書\nき' : 'テキスト', {
            left: pointer.x,
            top: pointer.y,
            fontSize: fabricRef.current.textOptions?.fontSize ?? 24,
            fontFamily: fabricRef.current.textOptions?.fontFamily ?? 'Arial',
            fill: fabricRef.current.drawColor,
            fontWeight: fabricRef.current.textOptions?.bold ? 'bold' : 'normal',
            fontStyle: fabricRef.current.textOptions?.italic ? 'italic' : 'normal',
            underline: fabricRef.current.textOptions?.underline ?? false,
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          fabricRef.current.isDrawingMode2 = false;
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let obj: any = null;
        const opts = {
          left: pointer.x, top: pointer.y,
          stroke: fabricRef.current.drawColor,
          strokeWidth: fabricRef.current.strokeW,
          fill: fabricRef.current.fillC,
          selectable: false, evented: false,
        };
        if (mode === 'rect') obj = new fabric.Rect({ ...opts, width: 1, height: 1 });
        else if (mode === 'circle') obj = new fabric.Ellipse({ ...opts, rx: 1, ry: 1, originX: 'center', originY: 'center' });
        else if (mode === 'triangle') obj = new fabric.Triangle({ ...opts, width: 1, height: 1 });
        else if (mode === 'line' || mode === 'arrow') {
          obj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: fabricRef.current.drawColor,
            strokeWidth: fabricRef.current.strokeW,
            selectable: false, evented: false,
          });
        }
        if (obj) { canvas.add(obj); fabricRef.current.currentDrawObj = obj; }
      });

      canvas.on('mouse:move', (opt: any) => {
        if (!fabricRef.current.isDrawingMode2) return;
        const pointer = canvas.getScenePoint(opt.e);
        const obj = fabricRef.current.currentDrawObj;
        if (!obj) return;
        const mode = fabricRef.current.toolMode;
        if (mode === 'rect' || mode === 'triangle') {
          const w = pointer.x - fabricRef.current.startPt.x;
          const h = pointer.y - fabricRef.current.startPt.y;
          obj.set({
            left: w > 0 ? fabricRef.current.startPt.x : pointer.x,
            top: h > 0 ? fabricRef.current.startPt.y : pointer.y,
            width: Math.abs(w), height: Math.abs(h),
          });
        } else if (mode === 'circle') {
          obj.set({
            rx: Math.abs(pointer.x - fabricRef.current.startPt.x) / 2,
            ry: Math.abs(pointer.y - fabricRef.current.startPt.y) / 2,
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
      disposed = true;
      if (canvas) { canvas.dispose(); canvas = null; }
      fabricRef.current = null;
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
    fabricRef.current.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
    fabricRef.current.hoverCursor = tool === 'select' ? 'move' : 'crosshair';
  }, [tool, color, fillColor, strokeWidth, fontSize, fontFamily, bold, italic, underline, vertical]);

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
    const stamp: Stamp = { id: Date.now().toString(), name, thumbnail, fabricJSON, createdAt: new Date().toISOString() };
    saveStamp(stamp);
    setStamps(getStamps());
    setStampName('');
  }, [stampName]);

  const loadStamp = useCallback((stamp: Stamp) => {
    if (!fabricRef.current) return;
    fabricRef.current.loadFromJSON(stamp.fabricJSON, () => fabricRef.current.renderAll());
    setSelectedStampId(stamp.id);
  }, []);

  const removeStamp = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteStamp(id);
    setStamps(getStamps());
  }, []);

  const isText = tool === 'text';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ height: 44, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12 }}>
        <Link href="/" style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13 }}>
          <ChevronLeft size={14} /> ホーム
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>スタンプエディタ</span>
        <Link href="/cover-designer" style={{ marginLeft: 'auto', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13 }}>
          カバーデザイナー <ChevronRight size={14} />
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Icon toolbar */}
        <div style={S.toolbar}>
          {TOOLS.map((t, i) => (
            <div key={t.id}>
              {i === 1 && <div style={S.divider} />}
              <button
                title={t.title}
                onClick={() => setTool(t.id)}
                style={S.toolBtn(tool === t.id)}
              >
                {t.icon}
              </button>
            </div>
          ))}
          <div style={S.divider} />
          <button title="クリア" onClick={clearCanvas} style={{ ...S.toolBtn(false), color: 'var(--danger)' }}>
            <Trash2 size={18} />
          </button>
        </div>

        {/* Options panel */}
        <div style={S.panel}>
          {/* Stroke color */}
          <div>
            <div style={S.label}>線の色</div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: 32, borderRadius: 6 }} />
          </div>

          {/* Fill */}
          <div>
            <div style={S.label}>塗りつぶし</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={fillColor === 'transparent'}
                onChange={e => setFillColor(e.target.checked ? 'transparent' : '#ffffff')}
                style={{ accentColor: 'var(--accent)' }}
              />
              なし（透明）
            </label>
            {fillColor !== 'transparent' && (
              <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} style={{ width: '100%', height: 32, borderRadius: 6 }} />
            )}
          </div>

          {/* Stroke width */}
          <div>
            <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
              <span>線幅</span><span style={{ color: 'var(--accent)' }}>{strokeWidth}px</span>
            </div>
            <input type="range" min="1" max="20" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* Text options */}
          {isText && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div>
                <div style={S.label}>フォント</div>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} style={{ ...S.input, appearance: 'none' }}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                  <span>サイズ</span><span style={{ color: 'var(--accent)' }}>{fontSize}px</span>
                </div>
                <input type="range" min="8" max="120" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { icon: <Bold size={14} />, active: bold, toggle: () => setBold(!bold), title: '太字' },
                  { icon: <Italic size={14} />, active: italic, toggle: () => setItalic(!italic), title: '斜体' },
                  { icon: <Underline size={14} />, active: underline, toggle: () => setUnderline(!underline), title: '下線' },
                  { icon: <AlignLeft size={14} />, active: vertical, toggle: () => setVertical(!vertical), title: '縦書き' },
                ].map((item, i) => (
                  <button key={i} title={item.title} onClick={item.toggle}
                    style={{ flex: 1, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: item.active ? 'var(--accent)' : 'var(--bg)',
                      color: item.active ? '#1A1A1A' : 'var(--text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.icon}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', overflow: 'auto' }}>
          <div style={{ boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Stamp list panel */}
        <div style={{ width: 200, background: 'var(--surface)', borderLeft: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div style={S.label}>スタンプ登録</div>
          <input
            type="text"
            value={stampName}
            onChange={e => setStampName(e.target.value)}
            placeholder="スタンプ名"
            style={S.input}
          />
          <button onClick={saveAsStamp} style={S.btn('accent')}>
            <Save size={12} style={{ display: 'inline', marginRight: 4 }} />
            登録
          </button>

          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
            <span>登録済み</span><span style={{ color: 'var(--accent)' }}>{stamps.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stamps.map(stamp => (
              <div key={stamp.id} style={S.stampCard(selectedStampId === stamp.id)} onClick={() => loadStamp(stamp)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stamp.thumbnail} alt={stamp.name} style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stamp.name}</div>
                  <div style={{ fontSize: 10, color: '#666' }}>{new Date(stamp.createdAt).toLocaleDateString()}</div>
                </div>
                <button onClick={e => removeStamp(stamp.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />
          <Link href="/cover-designer" style={{ textDecoration: 'none' }}>
            <button style={{ ...S.btn('ghost'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Layout size={13} /> カバーデザイナーへ
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
