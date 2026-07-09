'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import {
  Grid, Shuffle, AlignCenter,
  Trash2, Copy, Download, ImageIcon, Minus, Plus,
  Stamp, ChevronDown, ChevronUp, X, Undo2, Magnet, RefreshCw,
  MousePointer2, Square, Circle, Triangle, Type,
} from 'lucide-react';
import type { Stamp as StampType, Tool } from '@/lib/types';
import { getStamps } from '@/lib/stampStorage';
import { buildObjectAt } from '@/lib/shapePlacement';

const COVER_PRESETS = [
  { name: '応募サイズ', w: 385, h: 152, locked: true },
  { name: '標準カバー', w: 340, h: 255, locked: false },
];

const SHAPE_TOOL_IDS: Tool[] = [
  'line', 'rect', 'trapezoid', 'circle', 'arc',
  'triangle', 'right-triangle', 'polygon', 'h-diamond', 'dot', 'text',
];

const SHAPE_TOOLS: { id: Tool; icon: React.ReactNode; title: string }[] = [
  { id: 'select',         icon: <MousePointer2 size={14} />, title: '選択' },
  { id: 'line',           icon: <Minus size={14} />,         title: '直線' },
  { id: 'rect',           icon: <Square size={14} />,        title: '矩形' },
  { id: 'trapezoid',      title: '台形', icon: (
    <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="4,16 16,16 14,4 6,4" />
    </svg>
  )},
  { id: 'circle',         icon: <Circle size={14} />,        title: '円' },
  { id: 'arc',            title: '円弧', icon: (
    <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M 2 10 A 8 8 0 0 1 18 10" />
    </svg>
  )},
  { id: 'triangle',       icon: <Triangle size={14} />,      title: '三角' },
  { id: 'right-triangle', title: '直角三角', icon: (
    <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="2,18 18,18 2,2" />
    </svg>
  )},
  { id: 'polygon',        title: '多角形', icon: (
    <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="10,1 18,6 15,16 5,16 2,6" />
    </svg>
  )},
  { id: 'h-diamond',      title: '菱形', icon: (
    <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="10,1 19,10 10,19 1,10" />
    </svg>
  )},
  { id: 'dot',            title: '点', icon: (
    <svg viewBox="0 0 20 20" width={14} height={14} fill="currentColor">
      <circle cx="10" cy="10" r="4" />
    </svg>
  )},
  { id: 'text',           icon: <Type size={14} />,          title: 'テキスト' },
];
const DPI = 350;
const mmToPx = (mm: number) => Math.round(mm / 25.4 * DPI);

const INIT_W_PX = mmToPx(385);
const INIT_H_PX = mmToPx(152);
const INIT_SCALE = 0.07;
const DISP_W = Math.round(INIT_W_PX * INIT_SCALE);
const DISP_H = Math.round(INIT_H_PX * INIT_SCALE);
const SNAP_GRID = 10;
const BOOK_W = 142, BOOK_H = 152, SPINE_W = 15;

type ArrangementType = 'grid' | 'stagger' | 'frame' | 'concentric';

const S = {
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 6,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    padding: '10px 12px 6px',
    borderTop: '1px solid var(--border)',
  } as React.CSSProperties,
  btn: (active = false, danger = false): React.CSSProperties => ({
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 10px',
    background: danger ? 'var(--danger)' : active ? 'var(--accent)' : 'var(--bg)',
    color: active && !danger ? '#1A1A1A' : 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transition: 'opacity 0.15s',
  }),
  iconBtn: (active = false): React.CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? 'var(--accent)' : 'var(--bg)',
    color: active ? '#1A1A1A' : 'var(--text)',
  }),
};

function NumberStepper({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
}) {
  const btnStyle: React.CSSProperties = {
    width: 24, height: 24, background: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, lineHeight: 1, flexShrink: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {label && <span style={{ fontSize: 11, color: 'var(--text)', flexShrink: 0 }}>{label}</span>}
      <button style={btnStyle} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span style={{ minWidth: 32, textAlign: 'center', fontSize: 12, color: 'var(--text)' }}>{value}</span>
      <button style={btnStyle} onClick={() => onChange(Math.min(max, value + step))}>＋</button>
    </div>
  );
}

export default function CoverDesignerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [stamps, setStamps] = useState<StampType[]>([]);
  const [arrangement, setArrangement] = useState<ArrangementType>('grid');
  const [arrangementCount, setArrangementCount] = useState(9);
  const [bgColor, setBgColor] = useState(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem('coverdesigner-canvas-bg') || '#ffffff')
      : '#ffffff'
  );
  const bgColorRef = useRef(
    typeof window !== 'undefined'
      ? (localStorage.getItem('coverdesigner-canvas-bg') || '#ffffff')
      : '#ffffff'
  );
  const [stampSize, setStampSize] = useState(60);
  const stampSizeRef = useRef(60);
  const [selectedStamps, setSelectedStamps] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [currentTotalW, setCurrentTotalW] = useState(385);
  const [currentTotalH, setCurrentTotalH] = useState(152);
  const currentTotalWRef = useRef(385);
  const currentTotalHRef = useRef(152);
  const dispScaleRef = useRef(INIT_SCALE);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [activeSizeName, setActiveSizeName] = useState('応募サイズ');
  const [customW, setCustomW] = useState(385);
  const [customH, setCustomH] = useState(152);
  const [activeTool, setActiveTool] = useState('select');
  const activeToolRef = useRef('select');
  const stampsRef = useRef<StampType[]>([]);
  // アンドゥ
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const restoringRef = useRef(false);

  // スナップ
  const [snapOn, setSnapOn] = useState(false);
  const snapOnRef = useRef(false);

  // 右サイドバー プロパティ
  const [hasSelection, setHasSelection] = useState(false);
  const [selFill, setSelFill] = useState('#000000');
  const [selStroke, setSelStroke] = useState('#000000');
  const [selStrokeW, setSelStrokeW] = useState(1);
  const [selOpacity, setSelOpacity] = useState(1);
  const [selAngle, setSelAngle] = useState(0);

  // 行列数直接指定
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(4);

  // エリア指定
  const [areaMode, setAreaMode] = useState<'full' | 'custom'>('full');
  const [customArea, setCustomArea] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaRectRef = useRef<any>(null); // 点線枠（ドラッグ中も配置待ちも同じRef）
  const isAreaSelectingRef = useRef(false); // Fabricイベントハンドラ内で参照するRef

  const setTool = (tool: string) => {
    setActiveTool(tool);
    activeToolRef.current = tool;
    if (fabricRef.current) {
      fabricRef.current.selection = tool === 'select';
      fabricRef.current.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
    }
  };

  const startAreaSelect = () => {
    if (fabricRef.current) {
      fabricRef.current.selection = false;
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
    }
    isAreaSelectingRef.current = true;
    setIsAreaSelecting(true);
    setAreaMode('custom');
  };

  useEffect(() => { setStamps(getStamps()); }, []);
  useEffect(() => { stampsRef.current = stamps; }, [stamps]);
  useEffect(() => { stampSizeRef.current = stampSize; }, [stampSize]);
  useEffect(() => { bgColorRef.current = bgColor; localStorage.setItem('coverdesigner-canvas-bg', bgColor); }, [bgColor]);

  // ── アンドゥ ──────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    if (restoringRef.current) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      // UIオーバーレイ（エリア選択枠）を一時除外してからJSON化
      const areaRect = areaRectRef.current;
      if (areaRect) canvas.remove(areaRect);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = canvas.toJSON();
      json.backgroundColor = undefined; // 背景色は別管理のため除外
      if (areaRect) canvas.add(areaRect);
      const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
      trimmed.push(JSON.stringify(json));
      if (trimmed.length > 50) trimmed.shift();
      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      setCanUndo(trimmed.length > 1);
    } catch { /* ignore */ }
  }, []);

  const saveHistoryRef = useRef(saveHistory);
  useEffect(() => { saveHistoryRef.current = saveHistory; }, [saveHistory]);

  const undo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    restoringRef.current = true;
    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]), () => {
      canvas.backgroundColor = bgColorRef.current;
      canvas.renderAll();
      setTimeout(() => {
        canvas.backgroundColor = bgColorRef.current;
        canvas.renderAll();
        restoringRef.current = false;
      }, 30);
    });
    setCanUndo(historyIndexRef.current > 0);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo]);

  // ── 選択オブジェクト プロパティ更新 ─────────────────────────────
  const updateSelProps = useCallback(() => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = canvas?.getActiveObject();
    if (!obj) { setHasSelection(false); return; }
    setHasSelection(true);
    setSelFill(typeof obj.fill === 'string' && obj.fill ? obj.fill : '#000000');
    setSelStroke(typeof obj.stroke === 'string' && obj.stroke ? obj.stroke : '#000000');
    setSelStrokeW(obj.strokeWidth ?? 1);
    setSelOpacity(obj.opacity ?? 1);
    setSelAngle(Math.round(obj.angle ?? 0));
  }, []);

  const updateSelPropsRef = useRef(updateSelProps);
  useEffect(() => { updateSelPropsRef.current = updateSelProps; }, [updateSelProps]);

  const applySelProp = useCallback((props: object) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj || !canvas) return;
    obj.set(props);
    canvas.renderAll();
  }, []);

  // ── ハンドラ用ref同期 ───────────────────────────────────────────
  useEffect(() => { isAreaSelectingRef.current = isAreaSelecting; }, [isAreaSelecting]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // areaMode が 'full' に戻ったとき点線枠を削除
  useEffect(() => {
    if (areaMode !== 'custom' && areaRectRef.current && fabricRef.current) {
      fabricRef.current.remove(areaRectRef.current);
      areaRectRef.current = null;
      fabricRef.current.renderAll();
    }
  }, [areaMode]);

  // ── Fabricキャンバス初期化 ────────────────────────────────────────
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
        width: DISP_W,
        height: DISP_H,
        backgroundColor: '#ffffff',
      });
      fabricRef.current = canvas;
      fabricRef.current._fabric = fabric;
      requestAnimationFrame(() => applySize(currentTotalWRef.current, currentTotalHRef.current));

      // 状態復元
      const savedState = localStorage.getItem('coverdesigner-canvas-state');
      const savedBg = localStorage.getItem('coverdesigner-canvas-bg') || '#ffffff';
      bgColorRef.current = savedBg;
      restoringRef.current = true;
      if (savedState) {
        canvas.loadFromJSON(JSON.parse(savedState), () => {
          canvas.backgroundColor = savedBg;
          canvas.renderAll();
          restoringRef.current = false;
          saveHistoryRef.current();
          setTimeout(() => canvas.renderAll(), 50);
        });
      } else {
        canvas.backgroundColor = savedBg;
        canvas.renderAll();
        restoringRef.current = false;
        saveHistoryRef.current();
      }

      // ヒストリー
      canvas.on('object:modified', () => saveHistoryRef.current());
      canvas.on('object:removed', () => saveHistoryRef.current());

      // スナップ
      canvas.on('object:moving', (e: any) => {
        if (!snapOnRef.current || !e.target) return;
        e.target.set({
          left: Math.round(e.target.left / SNAP_GRID) * SNAP_GRID,
          top: Math.round(e.target.top / SNAP_GRID) * SNAP_GRID,
        });
      });

      // 選択
      canvas.on('selection:created', () => updateSelPropsRef.current());
      canvas.on('selection:updated', () => updateSelPropsRef.current());
      canvas.on('selection:cleared', () => setHasSelection(false));

      // エリア指定ドラッグ（fabric内部座標 + ref参照でクロージャ問題を回避）
      const getPt = (opt: any) => {
        const pt = opt.scenePoint;
        return pt ? { x: pt.x as number, y: pt.y as number } : { x: 0, y: 0 };
      };

      canvas.on('mouse:down', (opt: any) => {
        const p = getPt(opt);
        if (isAreaSelectingRef.current) {
          dragStartRef.current = { x: p.x, y: p.y };
          isDraggingRef.current = true;
          if (areaRectRef.current) canvas.remove(areaRectRef.current);
          const rect = new fabric.Rect({
            left: p.x, top: p.y, width: 0, height: 0,
            fill: 'transparent',
            stroke: '#C9A84C',
            strokeWidth: 1.5,
            strokeDashArray: [6, 4],
            selectable: false,
            evented: false,
          });
          areaRectRef.current = rect;
          canvas.add(rect);
        }
      });

      canvas.on('mouse:move', (opt: any) => {
        if (!isDraggingRef.current || !dragStartRef.current || !areaRectRef.current) return;
        const p = getPt(opt);
        const left = Math.min(dragStartRef.current.x, p.x);
        const top = Math.min(dragStartRef.current.y, p.y);
        const width = Math.abs(p.x - dragStartRef.current.x);
        const height = Math.abs(p.y - dragStartRef.current.y);
        areaRectRef.current.set({ left, top, width, height });
        canvas.renderAll();
      });

      // スタンプ・図形配置 & エリア選択完了
      canvas.on('mouse:up', (opt: any) => {
        const p = getPt(opt);

        // エリア選択のドラッグ終了
        if (isDraggingRef.current && dragStartRef.current) {
          const left = Math.min(dragStartRef.current.x, p.x);
          const top = Math.min(dragStartRef.current.y, p.y);
          const width = Math.abs(p.x - dragStartRef.current.x);
          const height = Math.abs(p.y - dragStartRef.current.y);
          isDraggingRef.current = false;
          dragStartRef.current = null;
          if (width > 5 && height > 5) {
            setCustomArea({ left, top, width, height });
          } else {
            if (areaRectRef.current) { canvas.remove(areaRectRef.current); areaRectRef.current = null; }
            setCustomArea(null);
          }
          canvas.renderAll();
          return;
        }

        // 通常のスタンプ・図形配置（ref参照で最新のtoolを取得）
        const tool = activeToolRef.current;
        if (tool === 'select') return;
        const pt = opt.scenePoint ?? opt.pointer;
        if (!pt) return;
        const { x, y } = pt;

        // スタンプ配置
        if (tool.startsWith('stamp-')) {
          const stampId = tool.replace('stamp-', '');
          const stamp = stampsRef.current.find((s: StampType) => s.id === stampId);
          if (stamp) {
            const json = stamp.fabricJSON as { objects?: object[] };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fabric.util.enlivenObjects([...(json.objects || [])]).then((enlivened: any[]) => {
              if (!enlivened.length) return;
              const group = new fabric.Group(enlivened, {
                left: x, top: y, originX: 'center', originY: 'center',
              });
              const naturalSize = Math.max(group.width ?? 1, group.height ?? 1);
              if (naturalSize > 0) group.scale(stampSizeRef.current / naturalSize);
              canvas.add(group);
              canvas.setActiveObject(group);
              canvas.renderAll();
              saveHistoryRef.current();
            });
          }
          activeToolRef.current = 'select';
          setActiveTool('select');
          canvas.selection = true;
          canvas.defaultCursor = 'default';
          return;
        }

        // 図形配置
        if (SHAPE_TOOL_IDS.includes(tool as Tool)) {
          const obj = buildObjectAt(fabric, canvas, tool as Tool, x, y);
          if (obj) {
            canvas.add(obj);
            canvas.setActiveObject(obj);
            canvas.renderAll();
            saveHistoryRef.current();
          }
          // 図形ツールは維持（連続配置可能）
        }
      });
    });

    return () => {
      disposed = true;
      if (canvas) {
        try {
          const json = JSON.stringify(canvas.toJSON());
          localStorage.setItem('coverdesigner-canvas-state', json);
          localStorage.setItem('coverdesigner-canvas-bg', bgColorRef.current);
        } catch { /* ignore */ }
        canvas.dispose();
        canvas = null;
      }
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && fabricRef.current) {
        fabricRef.current.renderAll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const applyBackground = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.backgroundColor = bgColor;
    fabricRef.current.renderAll();
  }, [bgColor]);

  useEffect(() => { applyBackground(); }, [applyBackground]);

  // ── 均等配置 ──────────────────────────────────────────────────────
  const runArrange = useCallback(async () => {
    if (selectedStamps.length === 0 || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    if (!fabric) return;

    const canvasW = canvas.width as number;
    const canvasH = canvas.height as number;
    // グリッド・千鳥は cols×rows が個数、フレーム・同心円は arrangementCount
    const n = (arrangement === 'grid' || arrangement === 'stagger')
      ? Math.max(1, cols) * Math.max(1, rows)
      : arrangementCount;
    const defaultM = 20;

    // 配置エリア
    const area = areaMode === 'custom' && customArea
      ? customArea
      : { left: defaultM, top: defaultM, width: canvasW - defaultM * 2, height: canvasH - defaultM * 2 };

    const placeAt = async (positions: { x: number; y: number }[]) => {
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const sid = selectedStamps[i % selectedStamps.length];
        const stamp = stamps.find(s => s.id === sid);
        if (!stamp) continue;
        const json = stamp.fabricJSON as { objects?: object[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enlivened: any[] = await fabric.util.enlivenObjects([...(json.objects || [])]);
        if (!enlivened || !enlivened.length) continue;
        const group = new fabric.Group(enlivened, {
          left: pos.x, top: pos.y, originX: 'center', originY: 'center',
        });
        const naturalSize = Math.max(group.width ?? 1, group.height ?? 1);
        if (naturalSize > 0) group.scale(stampSize / naturalSize);
        canvas.add(group);
      }
      canvas.renderAll();
      saveHistoryRef.current();
      // 配置後に点線枠を削除
      if (areaRectRef.current) {
        canvas.remove(areaRectRef.current);
        areaRectRef.current = null;
        canvas.renderAll();
      }
      setCustomArea(null);
    };

    if (arrangement === 'grid') {
      const c = Math.max(1, cols), r = Math.max(1, rows);
      const cw = area.width / c;
      const rh = area.height / r;
      const positions: { x: number; y: number }[] = [];
      for (let ri = 0; ri < r && positions.length < n; ri++)
        for (let ci = 0; ci < c && positions.length < n; ci++)
          positions.push({ x: area.left + cw * ci + cw / 2, y: area.top + rh * ri + rh / 2 });
      await placeAt(positions);

    } else if (arrangement === 'stagger') {
      const c = Math.max(2, cols), r = Math.max(1, rows);
      const cw = area.width / c;
      const rh = area.height / r;
      const positions: { x: number; y: number }[] = [];
      for (let ri = 0; ri < r && positions.length < n; ri++) {
        const isOffsetRow = ri % 2 === 1;
        const colCount = isOffsetRow ? c - 1 : c;
        for (let ci = 0; ci < colCount && positions.length < n; ci++)
          positions.push({
            x: area.left + cw * ci + cw / 2 + (isOffsetRow ? cw / 2 : 0),
            y: area.top  + rh * ri + rh / 2,
          });
      }
      await placeAt(positions.slice(0, n));

    } else if (arrangement === 'frame') {
      const fw = area.width, fh = area.height;
      const perim = 2 * (fw + fh);
      await placeAt(Array.from({ length: n }, (_, i) => {
        const t = (i / n) * perim;
        if (t < fw)           return { x: area.left + t,        y: area.top };
        if (t < fw + fh)      return { x: area.left + fw,       y: area.top + (t - fw) };
        if (t < fw * 2 + fh)  return { x: area.left + fw - (t - fw - fh), y: area.top + fh };
        return { x: area.left, y: area.top + fh - (t - fw * 2 - fh) };
      }));

    } else if (arrangement === 'concentric') {
      const cx = area.left + area.width / 2;
      const cy = area.top  + area.height / 2;
      const rings = Math.max(1, Math.round(Math.sqrt(n / Math.PI)));
      const positions: { x: number; y: number }[] = [];
      if (n > 0) positions.push({ x: cx, y: cy });
      let remaining = n - 1;
      for (let ri = 1; ri <= rings && remaining > 0; ri++) {
        const rx = (area.width  / 2) * ri / rings;
        const ry = (area.height / 2) * ri / rings;
        const count = Math.min(remaining, Math.round(2 * Math.PI * ri * 3));
        for (let i = 0; i < count; i++) {
          const a = (2 * Math.PI * i) / count;
          positions.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
        }
        remaining -= count;
      }
      await placeAt(positions.slice(0, n));
    }
  }, [selectedStamps, stamps, arrangement, arrangementCount, stampSize, cols, rows, areaMode, customArea]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleImageUpload called', e.target.files);
    const file = e.target.files?.[0];
    if (!file) { console.log('no file selected'); return; }
    console.log('file:', file.name, file.type, file.size);
    if (!fabricRef.current) { console.log('no canvas'); return; }
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    console.log('fabric:', !!fabric, 'FabricImage:', !!fabric?.FabricImage, 'Image:', !!fabric?.Image);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      console.log('FileReader onload fired');
      const dataUrl = ev.target?.result as string;
      console.log('dataUrl length:', dataUrl?.length);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ImageClass = fabric.FabricImage ?? fabric.Image;
      console.log('ImageClass:', !!ImageClass);
      try {
        const img = await ImageClass.fromURL(dataUrl, { crossOrigin: 'anonymous' });
        console.log('FabricImage loaded', img.width, img.height);
        const cw = canvas.width as number;
        const ch = canvas.height as number;
        const scale = Math.min(cw / (img.width ?? 1), ch / (img.height ?? 1));
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale });
        canvas.add(img);
        canvas.sendObjectToBack ? canvas.sendObjectToBack(img) : canvas.sendToBack(img);
        canvas.renderAll();
        requestAnimationFrame(() => { canvas.renderAll(); });
        saveHistoryRef.current();
        console.log('image placed on canvas');
      } catch (err) {
        console.error('FabricImage.fromURL error:', err);
      }
    };
    reader.onerror = (err) => { console.error('FileReader error:', err); };
    reader.readAsDataURL(file);
  };

  const exportJPEG = async () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const areaRect = areaRectRef.current;
    if (areaRect) canvas.remove(areaRect);
    const multiplier = 1 / dispScaleRef.current;
    const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.95, multiplier });
    if (areaRect) { canvas.add(areaRect); canvas.renderAll(); }
    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'bookcover.jpg'; a.click();
  };

  const exportPDF = async () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const areaRect = areaRectRef.current;
    if (areaRect) canvas.remove(areaRect);
    const wMm = currentTotalWRef.current;
    const hMm = currentTotalHRef.current;
    const { jsPDF } = await import('jspdf');
    const multiplier = 1 / dispScaleRef.current;
    const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.95, multiplier });
    if (areaRect) { canvas.add(areaRect); canvas.renderAll(); }
    const orientation = wMm >= hMm ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'mm', format: [wMm, hMm] });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, wMm, hMm);
    pdf.save('bookcover.pdf');
  };

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active) { fabricRef.current.remove(active); fabricRef.current.renderAll(); }
  };

  const clearAll = () => {
    if (!fabricRef.current) return;
    fabricRef.current.remove(...fabricRef.current.getObjects());
    fabricRef.current.renderAll();
    saveHistoryRef.current();
    localStorage.removeItem('coverdesigner-canvas-state');
  };

  const duplicateSelected = async () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const active = canvas.getActiveObject();
    if (!active) return;
    const cloned = await active.clone();
    cloned.set({ left: active.left + 20, top: active.top + 20 });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.renderAll();
    saveHistoryRef.current();
  };

  const applySize = useCallback((wMm: number, hMm: number) => {
    const realWPx = mmToPx(wMm);
    const realHPx = mmToPx(hMm);
    const container = canvasContainerRef.current;
    const availW = container ? container.clientWidth  - 40 : 800;
    const availH = container ? container.clientHeight - 40 : 600;
    const scale = Math.min(availW / realWPx, availH / realHPx, 0.3);
    const dispW = Math.round(realWPx * scale);
    const dispH = Math.round(realHPx * scale);
    if (fabricRef.current) {
      fabricRef.current.setDimensions({ width: dispW, height: dispH });
      fabricRef.current.renderAll();
    }
    dispScaleRef.current = scale;
    currentTotalWRef.current = wMm;
    currentTotalHRef.current = hMm;
    setCurrentTotalW(wMm);
    setCurrentTotalH(hMm);
  }, []);

  useEffect(() => {
    const handleResize = () => applySize(currentTotalWRef.current, currentTotalHRef.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applySize]);

  const toggle = (key: string) => setExpandedSection(s => s === key ? '' : key);

  // ── プレビュー ────────────────────────────────────────────────────
  const openPreview = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const areaRect = areaRectRef.current;
    if (areaRect) canvas.remove(areaRect);
    const realWpx = Math.round(currentTotalW / 25.4 * DPI);
    const dispW = canvas.getWidth();
    const multiplier = realWpx / dispW;
    const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 1.0, multiplier });
    if (areaRect) { canvas.add(areaRect); canvas.renderAll(); }
    setPreviewDataUrl(dataUrl);
    setShowPreview(true);
  }, [currentTotalW]);

  const drawPreview = useCallback((dataUrl: string) => {
    const pc = previewCanvasRef.current;
    if (!pc) return;
    const ctx = pc.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const imgW = img.width, imgH = img.height;
      console.log('preview canvas:', pc.width, pc.height);
      console.log('img size:', imgW, imgH);
      console.log('devicePixelRatio:', window.devicePixelRatio);

      const flapH = (currentTotalW - BOOK_W * 2 - SPINE_W) / 2;
      // デバッグ：背表紙の切り出し位置確認
      console.log('imgW:', imgW, 'imgH:', imgH);
      console.log('currentTotalW:', currentTotalW, 'currentTotalH:', currentTotalH);
      console.log('flapH:', flapH);
      {
        const _spineStart = Math.round(imgW * (flapH + BOOK_W) / currentTotalW);
        const _spineW = Math.round(imgW * SPINE_W / currentTotalW);
        console.log('spineStartPx:', _spineStart, 'spineWidthPx:', _spineW, '/ imgW:', imgW);
        console.log('背表紙の切り出し範囲:', _spineStart, '〜', _spineStart + _spineW, '/', imgW);
      }
      const flapV = (currentTotalH - BOOK_H) / 2;
      const bodyStartXmm = flapH;
      const bodyStartYmm = Math.max(0, flapV);

      const frontStartPx  = Math.round(imgW * bodyStartXmm / currentTotalW);
      const frontWidthPx  = Math.round(imgW * BOOK_W / currentTotalW);
      const spineStartPx  = Math.round(imgW * (bodyStartXmm + BOOK_W) / currentTotalW);
      const spineWidthPx  = Math.round(imgW * SPINE_W / currentTotalW);
      const bookStartPxY  = Math.round(imgH * bodyStartYmm / currentTotalH);
      const bookHeightPxY = Math.round(imgH * Math.min(BOOK_H, currentTotalH) / currentTotalH);

      // デバッグ：縦横比確認（previewSpineWはこの後に定義されるため後ろで出力）

      // 固定レイアウト定数
      const TOP = 80;
      const HEIGHT = 260;
      const FRONT_L = 90;
      const FRONT_W = 200;
      const FRONT_R = FRONT_L + FRONT_W;   // 290
      const SPINE_W_PREVIEW = 30;
      const SPINE_L = FRONT_R;              // 290
      const SPINE_R = SPINE_L + SPINE_W_PREVIEW; // 320

      // 以前の完成版ロジック（左:背表紙、右:表紙）
      const previewSpineW = Math.round(268 * SPINE_W / BOOK_H); // 実際の縦横比に合わせる（≈26px）
      const spineLeft = 90;
      const spineRight = spineLeft + previewSpineW;

      console.log('=== 背表紙の比率チェック ===');
      console.log('切り出し元: 幅', spineWidthPx, 'px × 高さ', bookHeightPxY, 'px');
      console.log('切り出し元の比率:', (spineWidthPx / bookHeightPxY).toFixed(4));
      console.log('描画先: 幅', previewSpineW, 'px × 高さ 268px');
      console.log('描画先の比率:', (previewSpineW / 268).toFixed(4));
      console.log('理論値(SPINE_W/BOOK_H):', (SPINE_W / BOOK_H).toFixed(4));

      ctx.clearRect(0, 0, pc.width, pc.height);
      ctx.fillStyle = '#E8E8E8';
      ctx.fillRect(0, 0, pc.width, pc.height);

      // ===== 描画全体を左右反転（scale(-1,1)で鏡写し） =====
      ctx.save();
      ctx.translate(pc.width, 0);
      ctx.scale(-1, 1);

      // 上面（曲線の辺）
      ctx.beginPath();
      ctx.moveTo(spineLeft, 55);
      // 背表紙側の辺：外側に膨らむ曲線
      ctx.quadraticCurveTo(spineLeft + 8, 62, spineRight, 70);
      // 下辺（手前）
      ctx.lineTo(spineRight + 200, 70);
      // 小口側の辺：外側に膨らむ曲線で上辺へ
      ctx.quadraticCurveTo(spineRight + 200 - 8, 62, spineRight + 200 - 30, 55);
      // 上辺（奥）
      ctx.closePath();
      ctx.fillStyle = '#F0EAE0';
      ctx.fill();

      // 上面：ページの横線（曲線の辺に沿って）
      const lineCount = 30;
      for (let i = 1; i < lineCount; i++) {
        const t = i / lineCount;
        // 背表紙側の曲線を補間（quadratic近似）
        const lx = spineLeft + (spineRight - spineLeft) * t + 8 * t * (1 - t) * 2;
        const ly = 55 + 15 * t;
        // 小口側の曲線を補間
        const rx = (spineRight + 200 - 30) + 30 * t - 8 * t * (1 - t) * 2;
        ctx.strokeStyle = i % 4 === 0 ? 'rgba(160,153,143,0.6)' : 'rgba(190,185,178,0.35)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ly);
        ctx.stroke();
      }

      ctx.strokeStyle = '#C0B8A8';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // 背表紙：描画パラメータ（clipより先に計算）
      const frontScale = 200 / frontWidthPx;
      const correctSpineDisplayW = spineWidthPx * frontScale;
      const ZOOM_FIX = previewSpineW / correctSpineDisplayW;
      const sw = spineWidthPx * ZOOM_FIX;
      const shFixed = bookHeightPxY * ZOOM_FIX;
      const OFFSET = spineWidthPx * 0.1;
      const sx = spineStartPx - (sw - spineWidthPx) / 2 - OFFSET;
      const syFixed = bookStartPxY - (shFixed - bookHeightPxY) / 2;
      const displayHeightExtra = 260 * (ZOOM_FIX - 1);
      const dyFixed = 80 - displayHeightExtra / 2;
      const dhFixed = 260 + displayHeightExtra;
      console.log('ZOOM_FIX(理論値):', ZOOM_FIX.toFixed(3), 'dyFixed:', dyFixed.toFixed(1), 'dhFixed:', dhFixed.toFixed(1));

      // 背表紙：画像（スパイン形状にクリップして描画）
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(spineLeft, 55);
      ctx.quadraticCurveTo(spineLeft - 4, 59, spineRight, 70);
      ctx.lineTo(spineRight, 330);
      ctx.quadraticCurveTo(spineLeft - 4, 319, spineLeft, 315);
      ctx.closePath();
      ctx.clip();
      ctx.transform(1, 15 / previewSpineW, 0, 1, spineLeft, 55);
      const SHEAR_COMPENSATE = 80;
      ctx.beginPath();
      ctx.rect(0, 80 - SHEAR_COMPENSATE, previewSpineW, 260);
      ctx.clip();
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, bookStartPxY, sw, bookHeightPxY, -previewSpineW, 80 - SHEAR_COMPENSATE, previewSpineW, 260);
      ctx.restore();

      // 背表紙：縁取り
      ctx.beginPath();
      ctx.moveTo(spineLeft, 55);
      ctx.quadraticCurveTo(spineLeft - 4, 59, spineRight, 70);
      ctx.lineTo(spineRight, 330);
      ctx.quadraticCurveTo(spineLeft - 4, 319, spineLeft, 315);
      ctx.closePath();
      ctx.strokeStyle = '#C0B8A8';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // 背表紙：外端（右端）のエッジシャドウ
      ctx.save();
      const edgeShadow = ctx.createLinearGradient(spineLeft, 0, spineLeft + 15, 0);
      edgeShadow.addColorStop(0, 'rgba(0,0,0,0.3)');
      edgeShadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = edgeShadow;
      ctx.beginPath();
      ctx.moveTo(spineLeft, 55);
      ctx.quadraticCurveTo(spineLeft - 4, 59, spineRight, 70);
      ctx.lineTo(spineRight, 330);
      ctx.quadraticCurveTo(spineLeft - 4, 319, spineLeft, 315);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 表紙：白塗り + 縁取り
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(spineRight, 70, 200, 260);
      ctx.strokeStyle = '#C0B8A8';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(spineRight, 70, 200, 260);

      // 表紙：画像（鏡文字打ち消し）
      // 背表紙の切り出しが表紙側に食い込んだ分を削る
      const spineOverlap = (sw - spineWidthPx) / 2 + OFFSET;
      const frontWidthPxAdjusted = frontWidthPx - spineOverlap;
      console.log('=== 切り出し範囲 ===');
      console.log('表紙 x:', frontStartPx, '〜', frontStartPx + frontWidthPxAdjusted);
      console.log('背表紙 sx:', sx, '〜', sx + sw);
      console.log('この2つが連続しているべき（表紙の右端 ≒ 背表紙の左端）');
      console.log('表紙 y:', bookStartPxY, '〜', bookStartPxY + bookHeightPxY);
      console.log('背表紙 sy:（表紙と同じはず）', bookStartPxY, '〜', bookStartPxY + bookHeightPxY);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(img, frontStartPx, bookStartPxY, frontWidthPxAdjusted, bookHeightPxY,
        -(spineRight + 200), 70, 200, 260);
      ctx.restore();

      ctx.restore();
      // ===== 反転ここまで =====

    };
    img.src = dataUrl;
  }, [currentTotalW, currentTotalH]);

  useEffect(() => {
    if (showPreview && previewDataUrl) drawPreview(previewDataUrl);
  }, [showPreview, previewDataUrl, drawPreview]);

  const ARRANGEMENTS: { id: ArrangementType; icon: React.ReactNode; label: string }[] = [
    { id: 'grid',       icon: <Grid size={14} />,        label: 'グリッド' },
    { id: 'stagger',    icon: <Shuffle size={14} />,     label: '千鳥' },
    { id: 'frame',      icon: <AlignCenter size={14} />, label: 'フレーム' },
    { id: 'concentric', icon: <RefreshCw size={14} />,   label: '同心円' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <AppHeader>
        <button onClick={() => setShowSizeModal(true)}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
          {currentTotalW}×{currentTotalH}mm
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <button onClick={undo} disabled={!canUndo} title="元に戻す (Ctrl+Z)"
          style={{ ...S.iconBtn(), opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'default' }}>
          <Undo2 size={15} />
        </button>
        <button onClick={() => { const next = !snapOn; setSnapOn(next); snapOnRef.current = next; }}
          title={snapOn ? 'スナップON' : 'スナップOFF'}
          style={S.iconBtn(snapOn)}>
          <Magnet size={15} />
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <button onClick={duplicateSelected} style={S.btn()}>
          <Copy size={13} /> 複製
        </button>
        <button onClick={deleteSelected} style={S.btn(false, true)}>
          <Trash2 size={13} /> 削除
        </button>
        <button onClick={exportJPEG} style={S.btn()}>
          <Download size={13} /> JPEG
        </button>
        <button onClick={exportPDF} style={{ ...S.btn(true), background: 'var(--accent)', color: '#1A1A1A' }}>
          <Download size={13} /> PDF
        </button>
        <button onClick={openPreview} style={S.btn()}>
          プレビュー
        </button>
      </AppHeader>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>

          {/* 1. スタンプ — 常時表示 */}
          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#C9A84C', fontSize: 12, fontWeight: 500 }}>スタンプを配置</span>
              {activeTool.startsWith('stamp-') && (
                <button onClick={() => setTool('select')}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                  <X size={11} />
                </button>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <NumberStepper label="サイズ" value={stampSize} onChange={setStampSize} min={10} max={300} step={5} />
            </div>
            {stamps.length === 0
              ? <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>スタンプなし</div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {stamps.map(stamp => {
                    const isActive = activeTool === `stamp-${stamp.id}`;
                    return (
                      <div key={stamp.id} onClick={() => setTool(isActive ? 'select' : `stamp-${stamp.id}`)}
                        style={{
                          width: 53, height: 53, background: '#ffffff', borderRadius: 6,
                          border: isActive ? '2px solid #C9A84C' : '2px solid transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', overflow: 'hidden',
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={stamp.thumbnail} alt={stamp.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>

          {/* 2. 均等配置 — 常時表示 */}
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ borderTop: '2px solid #C9A84C', margin: '12px 0 0', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#C9A84C', fontSize: 12, fontWeight: 500 }}>均等に配置</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {ARRANGEMENTS.map(a => (
                <button key={a.id} onClick={() => setArrangement(a.id)}
                  style={{ ...S.btn(arrangement === a.id), flexDirection: 'column', gap: 2, padding: '6px 4px', fontSize: 10 }}>
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>

            {/* 列数・行数（グリッド・千鳥のみ） */}
            {(arrangement === 'grid' || arrangement === 'stagger') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <NumberStepper label="列数" value={cols} onChange={setCols} min={1} max={20} />
                <NumberStepper label="行数" value={rows} onChange={setRows} min={1} max={20} />
              </div>
            )}

            {(arrangement === 'grid' || arrangement === 'stagger') ? (
              <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between', marginBottom: 0 }}>
                <span>合計</span>
                <span style={{ color: 'var(--accent)' }}>{Math.max(1, cols) * Math.max(1, rows)}個</span>
              </div>
            ) : (
              <NumberStepper label="個数" value={arrangementCount} onChange={setArrangementCount} min={1} max={100} />
            )}

            {/* エリア指定 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#888' }}>配置エリア</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer' }}>
                  <input type="radio" checked={areaMode === 'full'} onChange={() => { setAreaMode('full'); setIsAreaSelecting(false); isAreaSelectingRef.current = false; if (fabricRef.current) { fabricRef.current.selection = true; fabricRef.current.renderAll(); } }} />
                  全体
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, cursor: 'pointer' }}>
                  <input type="radio" checked={areaMode === 'custom'} onChange={startAreaSelect} />
                  エリア指定
                </label>
              </div>
              {areaMode === 'custom' && (
                <div style={{ fontSize: 10, color: isAreaSelecting ? '#C9A84C' : customArea ? '#888' : '#555' }}>
                  {isAreaSelecting
                    ? 'キャンバスでドラッグ'
                    : customArea
                      ? (
                        <span>
                          {Math.round(customArea.width)}×{Math.round(customArea.height)}px
                          <button onClick={startAreaSelect}
                            style={{ marginLeft: 6, fontSize: 9, color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            再選択
                          </button>
                        </span>
                      )
                      : 'ドラッグでエリアを選択'}
                </div>
              )}
            </div>
            {selectedStamps.length > 0 && (
              <button onClick={() => setSelectedStamps([])}
                style={{ fontSize: 10, color: '#888', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 4, padding: 0 }}>
                選択解除
              </button>
            )}
            {stamps.length === 0 && <div style={{ fontSize: 11, color: '#555' }}>スタンプなし</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              {stamps.map(s => {
                const idx = selectedStamps.indexOf(s.id);
                const isSel = idx !== -1;
                return (
                  <div key={s.id}
                    onClick={() => setSelectedStamps(prev =>
                      prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                    )}
                    style={{ position: 'relative', width: 53, height: 53, background: '#ffffff', borderRadius: 6,
                      border: isSel ? '2px solid #C9A84C' : '2px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumbnail} alt={s.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                    {isSel && (
                      <div style={{
                        position: 'absolute', top: 2, right: 2,
                        background: '#C9A84C', color: '#0F2340',
                        borderRadius: '50%', width: 16, height: 16,
                        fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {idx + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={runArrange} disabled={selectedStamps.length === 0}
              style={{ ...S.btn(true), width: '100%', opacity: selectedStamps.length > 0 ? 1 : 0.4, cursor: selectedStamps.length > 0 ? 'pointer' : 'not-allowed' }}>
              <Grid size={13} /> 配置を実行
            </button>
          </div>

          {/* 3. 背景色 — 常時表示（スタンプ+均等配置ブロックとの区切り） */}
          <div style={{ borderTop: '2px solid #C9A84C', margin: '12px 0 0', padding: '12px 12px 12px' }}>
            <div style={{ ...S.label, marginBottom: 4 }}>背景色</div>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
              style={{ width: '100%', height: 32, borderRadius: 6 }} />
          </div>

          {/* 4. 図形 — 折りたたみ */}
          <div>
            <button onClick={() => toggle('shape')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>図形</span>
              {expandedSection === 'shape' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'shape' && (
              <div style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                  {SHAPE_TOOLS.map(t => {
                    const isActive = activeTool === t.id;
                    return (
                      <button key={t.id} onClick={() => setTool(isActive && t.id !== 'select' ? 'select' : t.id)}
                        title={t.title}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 2, padding: '5px 2px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: isActive ? 'var(--accent)' : 'var(--bg)',
                          color: isActive ? '#1A1A1A' : 'var(--text)',
                          fontSize: 8, fontWeight: 600,
                        }}>
                        {t.icon}
                        {t.title.length <= 3 ? t.title : t.title.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
                {activeTool !== 'select' && SHAPE_TOOL_IDS.includes(activeTool as Tool) && (
                  <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    クリックして配置
                    <button onClick={() => setTool('select')}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. 画像 — 折りたたみ */}
          <div>
            <button onClick={() => toggle('img')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>画像</span>
              {expandedSection === 'img' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'img' && (
              <div style={{ padding: '0 12px 12px' }}>
                <label style={{ ...S.btn(), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                  <ImageIcon size={13} /> 画像をアップロード
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>

          {/* 全クリア */}
          <div style={{ marginTop: 16, padding: '12px 12px 16px', borderTop: '1px solid #2A4570' }}>
            <button
              onClick={() => { if (!window.confirm('すべて削除しますか？')) return; clearAll(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', color: '#6B7A99', fontSize: 11, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#E05A5A'; e.currentTarget.style.background = '#2A4570'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6B7A99'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Trash2 size={12} />
              全クリア
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={canvasContainerRef} style={{ flex: 1, background: '#111', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, cursor: activeTool === 'select' ? 'default' : 'crosshair' }}>
          <div style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)', flexShrink: 0 }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Right panel — プロパティ */}
        <div style={{ width: 176, background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
          {!hasSelection ? (
            <div style={{ padding: 16, fontSize: 11, color: '#555', textAlign: 'center', marginTop: 24 }}>
              オブジェクトを<br />選択してください
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* 塗り色 */}
              <div style={{ ...S.sectionTitle, borderTop: 'none' }}>塗り色</div>
              <div style={{ padding: '0 12px 8px' }}>
                <input type="color" value={selFill}
                  onChange={e => { setSelFill(e.target.value); applySelProp({ fill: e.target.value }); }}
                  style={{ width: '100%', height: 28, borderRadius: 6, cursor: 'pointer' }} />
              </div>

              {/* 線色 */}
              <div style={S.sectionTitle}>線色</div>
              <div style={{ padding: '0 12px 8px' }}>
                <input type="color" value={selStroke}
                  onChange={e => { setSelStroke(e.target.value); applySelProp({ stroke: e.target.value }); }}
                  style={{ width: '100%', height: 28, borderRadius: 6, cursor: 'pointer' }} />
              </div>

              {/* 線幅 */}
              <div style={S.sectionTitle}>線幅</div>
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => { const v = Math.max(0, selStrokeW - 1); setSelStrokeW(v); applySelProp({ strokeWidth: v }); }}
                  style={S.iconBtn()}><Minus size={12} /></button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selStrokeW}</span>
                <button onClick={() => { const v = selStrokeW + 1; setSelStrokeW(v); applySelProp({ strokeWidth: v }); }}
                  style={S.iconBtn()}><Plus size={12} /></button>
              </div>

              {/* 透明度 */}
              <div style={S.sectionTitle}>透明度</div>
              <div style={{ padding: '0 12px 8px' }}>
                <input type="range" min={0} max={100} value={Math.round(selOpacity * 100)}
                  onChange={e => { const v = Number(e.target.value) / 100; setSelOpacity(v); applySelProp({ opacity: v }); }}
                  style={{ width: '100%' }} />
                <div style={{ fontSize: 10, color: '#888', textAlign: 'right' }}>{Math.round(selOpacity * 100)}%</div>
              </div>

              {/* 角度 */}
              <div style={S.sectionTitle}>角度</div>
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={-360} max={360} value={selAngle}
                  onChange={e => { const v = Number(e.target.value); setSelAngle(v); applySelProp({ angle: v }); }}
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: 'var(--text)', fontSize: 12 }} />
                <span style={{ fontSize: 11, color: '#888' }}>°</span>
              </div>

              {/* レイヤー */}
              <div style={S.sectionTitle}>レイヤー</div>
              <div style={{ padding: '0 12px 8px', display: 'flex', gap: 4 }}>
                <button onClick={() => {
                  const c = fabricRef.current; const obj = c?.getActiveObject();
                  if (c && obj) { (c.bringObjectToFront ?? c.bringToFront).call(c, obj); c.renderAll(); }
                }} style={{ ...S.btn(), flex: 1, fontSize: 10, padding: '5px 4px' }}>前面</button>
                <button onClick={() => {
                  const c = fabricRef.current; const obj = c?.getActiveObject();
                  if (c && obj) { (c.sendObjectToBack ?? c.sendToBack).call(c, obj); c.renderAll(); }
                }} style={{ ...S.btn(), flex: 1, fontSize: 10, padding: '5px 4px' }}>背面</button>
              </div>

              {/* 複製・削除 */}
              <div style={{ padding: '0 12px 8px', display: 'flex', gap: 4 }}>
                <button onClick={duplicateSelected}
                  style={{ ...S.btn(), flex: 1, fontSize: 10, padding: '5px 4px' }}>
                  <Copy size={11} />複製
                </button>
                <button onClick={deleteSelected}
                  style={{ ...S.btn(false, true), flex: 1, fontSize: 10, padding: '5px 4px' }}>
                  <Trash2 size={11} />削除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* サイズモーダル */}
      {showSizeModal && (
        <div onClick={() => setShowSizeModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>サイズ設定</span>
              <button onClick={() => setShowSizeModal(false)} style={S.iconBtn()}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {COVER_PRESETS.map(p => (
                <button key={p.name} onClick={() => {
                  setActiveSizeName(p.name);
                  applySize(p.w, p.h);
                  setShowSizeModal(false);
                }} style={{
                  ...S.btn(activeSizeName === p.name),
                  justifyContent: 'space-between',
                  border: `1px solid ${activeSizeName === p.name ? '#C9A84C' : 'var(--border)'}`,
                  color: activeSizeName === p.name ? '#C9A84C' : 'var(--text)',
                  background: activeSizeName === p.name ? 'rgba(201,168,76,0.1)' : 'var(--bg)',
                }}>
                  <span>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>{p.w}×{p.h}mm</span>
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>カスタムサイズ</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.label, marginBottom: 2 }}>幅 mm</div>
                  <input type="number" value={customW} min={50} max={1000}
                    onChange={e => setCustomW(Number(e.target.value))}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.label, marginBottom: 2 }}>高さ mm</div>
                  <input type="number" value={customH} min={50} max={1000}
                    onChange={e => setCustomH(Number(e.target.value))}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12 }} />
                </div>
              </div>
              <button onClick={() => {
                setActiveSizeName('カスタム');
                applySize(customW, customH);
                setShowSizeModal(false);
              }} style={{ ...S.btn(), width: '100%' }}>
                このサイズを適用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* プレビューモーダル */}
      {showPreview && (
        <div onClick={() => setShowPreview(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', background: '#E8E8E8', borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowPreview(false)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#1A3358' }}>
              <X size={20} />
            </button>
            <p style={{ color: '#1A3358', fontSize: 13, margin: 0 }}>文庫本プレビュー</p>
            <canvas ref={previewCanvasRef} width={420} height={420} style={{ display: 'block' }} />
          </div>
        </div>
      )}
    </div>
  );
}
