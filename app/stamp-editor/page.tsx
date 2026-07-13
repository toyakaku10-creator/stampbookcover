'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  MousePointer2, Minus, Plus, Square, Circle, Triangle,
  Type, Bold, Italic, Underline, AlignLeft,
  Trash2, Save, X, Undo2, XCircle,
  Copy, BringToFront, SendToBack, Magnet, RotateCw, RotateCcw,
} from 'lucide-react';
import { Tool } from '@/lib/types';
import { saveStamp, getStamps, deleteStamp, renameStamp } from '@/lib/stampStorage';
import type { Stamp } from '@/lib/types';
import { buildArcPath, buildObjectAt } from '@/lib/shapePlacement';
import AppHeader from '@/components/AppHeader';
import { ensureHimmeliStamps } from '@/lib/himmeliStamps';

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact'];
const CANVAS_SIZE = 400;
const GOLD = '#C9A84C';

// ── ツール一覧 ──────────────────────────────────────────────
const TOOLS: { id: Tool; icon: React.ReactNode; title: string }[] = [
  { id: 'select', icon: <MousePointer2 size={18} />, title: '選択' },
  { id: 'line',   icon: <Minus size={18} />,         title: '直線' },
  { id: 'rect',   icon: <Square size={18} />,        title: '矩形' },
  {
    id: 'trapezoid', title: '台形',
    icon: (
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="4,16 16,16 14,4 6,4" />
      </svg>
    ),
  },
  { id: 'circle', icon: <Circle size={18} />, title: '円' },
  {
    id: 'arc', title: '円弧',
    icon: (
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M 2 10 A 8 8 0 0 1 18 10" />
      </svg>
    ),
  },
  { id: 'triangle', icon: <Triangle size={18} />, title: '三角' },

  {
    id: 'polygon', title: '多角形',
    icon: (
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="10,1 18,6 15,16 5,16 2,6" />
      </svg>
    ),
  },
  {
    id: 'h-diamond', title: '菱形',
    icon: (
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="10,1 19,10 10,19 1,10" />
      </svg>
    ),
  },
  {
    id: 'dot', title: '点',
    icon: (
      <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor">
        <circle cx="10" cy="10" r="4" />
      </svg>
    ),
  },
  { id: 'text', icon: <Type size={18} />, title: 'テキスト' },
];

// ── 選択オブジェクトの有効プロパティを取得 ──────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEffectiveProps(obj: any) {
  // Group の場合は最初の子から色プロパティを読む
  let ref = obj;
  if (obj?.type === 'group') {
    const children = obj.getObjects?.() ?? [];
    if (children.length > 0) ref = children[0];
  }
  const rawFill = ref.fill;
  const fill = (!rawFill || rawFill === 'transparent') ? 'transparent' : rawFill as string;
  return {
    stroke:      (typeof ref.stroke === 'string' && ref.stroke) ? ref.stroke : GOLD,
    fill,
    strokeWidth: ref.strokeWidth ?? 1.5,
  };
}

const S = {
  toolbar: {
    width: 48, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    padding: '8px 0', gap: 2, overflowY: 'auto' as const, flexShrink: 0,
  },
  toolBtn: (active: boolean, danger = false): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#0F2340' : danger ? 'var(--danger)' : 'var(--text)',
    transition: 'background 0.15s',
  }),
  divider: { width: 24, height: 1, background: 'var(--border)', margin: '4px 0' },
  tbBtn: (active = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', borderRadius: 6,
    background: active ? '#C9A84C' : '#1A3358',
    color: active ? '#0F2340' : '#F5F0E8',
    border: '1px solid #2A4570', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'background 0.15s',
  }),
  panel: {
    width: 200, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)',
    overflowY: 'auto' as const, padding: 12, flexShrink: 0,
    display: 'flex', flexDirection: 'column' as const, gap: 14,
  },
  label: {
    fontSize: 10, fontWeight: 600, color: '#888',
    textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6,
  },
  input: {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '6px 8px', fontSize: 12, outline: 'none',
  },
  btn: (variant: 'accent' | 'danger' | 'ghost' = 'ghost'): React.CSSProperties => ({
    width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    background: variant === 'accent' ? 'var(--accent)' : variant === 'danger' ? 'var(--danger)' : 'var(--bg)',
    color: variant === 'accent' ? '#0F2340' : 'var(--text)',
    transition: 'opacity 0.15s',
  }),
  stampCard: (selected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
    background: selected ? 'rgba(201,168,76,0.1)' : 'var(--bg)', cursor: 'pointer',
  }),
  actionRow: {
    display: 'flex', gap: 4,
  } as React.CSSProperties,
  actionBtn: (): React.CSSProperties => ({
    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
  }),
};

export default function StampEditorPage() {
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef          = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastActiveRef      = useRef<any>(null);
  const historyRef         = useRef<string[]>([]);
  const historyIndexRef    = useRef<number>(-1);
  const isApplyingFromSelRef = useRef(false);  // 選択同期中フラグ（無限ループ防止）
  const toolRef            = useRef<Tool>('select');  // canvas イベント用（stale closure 回避）
  const bgColorRef         = useRef('#ffffff');  // 背景色を別管理（loadFromJSON で失われないよう）
  const snapEnabledRef     = useRef(true);  // スナップ状態（canvas イベント用）
  const saveHistoryRef     = useRef<() => void>(() => {});  // JSX から saveHistory を呼ぶため
  // 直線ハンドル管理
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineHandlesRef     = useRef<{ h1: any; h2: any; line: any } | null>(null);
  const lineStartRef       = useRef<{ x: number; y: number } | null>(null);
  const previewLineRef     = useRef<any>(null);
  const angleTextRef       = useRef<any>(null);

  const [tool, setTool]           = useState<Tool>('select');
  // 統一プロパティパネル用 state（配置デフォルト兼選択オブジェクト反映）
  const [color, setColor]         = useState(GOLD);       // ② 初期値をゴールドに統一
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(1.5);    // ② 初期値を 1.5 に統一
  const [polygonSides, setPolygonSides] = useState(5);   // 多角形の角数（3〜12）
  // テキスト専用
  const [fontSize, setFontSize]   = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [bold, setBold]           = useState(false);
  const [italic, setItalic]       = useState(false);
  const [underline, setUnderline] = useState(false);
  const [vertical, setVertical]   = useState(false);
  // 選択状態
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedObjType, setSelectedObjType] = useState('');
  const [currentAngle, setCurrentAngle] = useState(0);

  const [stampName, setStampName]     = useState('');
  const [stamps, setStamps]           = useState<Stamp[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [canUndo, setCanUndo]         = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  // 直線端点編集
  const [lineCoords, setLineCoords] = useState<{ ax1: number; ay1: number; ax2: number; ay2: number } | null>(null);
  const [selRx, setSelRx] = useState(0);
  // カスタム形状の種類
  const [selectedShapeType, setSelectedShapeType] = useState<'trapezoid' | 'arc' | 'dot' | null>(null);
  // 台形プロパティ
  const [trapTop, setTrapTop]       = useState(60);
  const [trapBottom, setTrapBottom] = useState(90);
  const [trapHeight, setTrapHeight] = useState(50);
  // 円弧プロパティ
  const [arcRadius, setArcRadius]           = useState(45);
  const [arcStartAngle, setArcStartAngle]   = useState(180);
  const [arcEndAngle, setArcEndAngle]       = useState(0);
  // 点プロパティ
  const [dotRadius, setDotRadius] = useState(3);

  useEffect(() => {
    ensureHimmeliStamps().then(() => setStamps(getStamps())).catch(console.error);
  }, []);

  // toolRef を tool state と常に同期（canvas イベントハンドラが stale にならないよう）
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // snapEnabledRef を snapEnabled state と常に同期
  useEffect(() => { snapEnabledRef.current = snapEnabled; }, [snapEnabled]);

  // ── 直線の端点をキャンバス絶対座標で取得 ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLineAbsCoords = useCallback((line: any) => {
    const fabric = fabricRef.current?._fabric;
    if (!fabric) return null;
    const matrix = line.calcTransformMatrix();
    const p1 = fabric.util.transformPoint({ x: line.x1, y: line.y1 }, matrix);
    const p2 = fabric.util.transformPoint({ x: line.x2, y: line.y2 }, matrix);
    return {
      ax1: Math.round(p1.x), ay1: Math.round(p1.y),
      ax2: Math.round(p2.x), ay2: Math.round(p2.y),
    };
  }, []);

  // ── 選択オブジェクトからパネルへ同期 ─────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncFromObj = useCallback((obj: any) => {
    if (!obj) { setHasSelection(false); setSelectedObjType(''); setLineCoords(null); setSelRx(0); return; }
    const props = getEffectiveProps(obj);
    isApplyingFromSelRef.current = true;
    setColor(props.stroke);
    setFillColor(props.fill);
    setStrokeWidth(props.strokeWidth);
    setCurrentAngle(Math.round(obj.angle ?? 0));
    setHasSelection(true);
    setSelectedObjType(obj.type ?? '');
    setSelRx(obj.type === 'rect' ? Math.round(obj.rx ?? 0) : 0);
    if (obj.type === 'line') {
      const coords = getLineAbsCoords(obj);
      setLineCoords(coords);
    } else {
      setLineCoords(null);
    }
    // カスタム形状
    const st = obj._shapeType as 'trapezoid' | 'arc' | 'dot' | undefined;
    if (st === 'trapezoid') {
      setSelectedShapeType('trapezoid');
      setTrapTop(obj._trapTop ?? 60);
      setTrapBottom(obj._trapBottom ?? 90);
      setTrapHeight(obj._trapHeight ?? 50);
    } else if (st === 'arc') {
      setSelectedShapeType('arc');
      setArcRadius(obj._arcRadius ?? 45);
      setArcStartAngle(obj._arcStartAngle ?? 180);
      setArcEndAngle(obj._arcEndAngle ?? 0);
    } else if (st === 'dot') {
      setSelectedShapeType('dot');
      setDotRadius(obj.radius ?? 3);
    } else {
      setSelectedShapeType(null);
    }
  }, [getLineAbsCoords]);

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
        width: CANVAS_SIZE, height: CANVAS_SIZE, backgroundColor: '#ffffff',
      });
      fabricRef.current = canvas;
      fabricRef.current._fabric = fabric;

      // localStorageから復元
      const savedJson = localStorage.getItem('stampeditor-canvas-state');
      if (savedJson) {
        try {
          const parsed = JSON.parse(savedJson);
          canvas.loadFromJSON(parsed, () => {
            canvas.backgroundColor = '#ffffff';
            canvas.renderAll();
            setTimeout(() => { canvas.renderAll(); }, 100);
          });
        } catch { /* 破損データは無視 */ }
      }

      // 初期状態を履歴の先頭に保存（backgroundColor を必ず含める）
      const initialJson = canvas.toJSON();
      initialJson.backgroundColor = '#ffffff';
      historyRef.current      = [JSON.stringify(initialJson)];
      historyIndexRef.current = 0;

      // ── 直線ハンドル管理 ─────────────────────────────────────
      const HANDLE_RADIUS = 6;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getLineCanvasEndpoints = (line: any) => {
        const matrix = line.calcTransformMatrix();
        return {
          p1: fabric.util.transformPoint({ x: line.x1, y: line.y1 }, matrix),
          p2: fabric.util.transformPoint({ x: line.x2, y: line.y2 }, matrix),
        };
      };

      const removeLineHandles = () => {
        const handles = lineHandlesRef.current;
        lineHandlesRef.current = null; // 先に null にして競合を防ぐ
        if (!handles) return;
        try {
          if (handles.h1) canvas.remove(handles.h1);
          if (handles.h2) canvas.remove(handles.h2);
        } catch {
          // すでに削除済みの場合は無視
        }
        canvas.renderAll();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const addLineHandles = (line: any) => {
        removeLineHandles();
        const { p1, p2 } = getLineCanvasEndpoints(line);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const makeHandle = (pt: { x: number; y: number }, pointKey: 'p1' | 'p2'): any => {
          const h = new fabric.Circle({
            left: pt.x, top: pt.y,
            radius: HANDLE_RADIUS,
            fill: GOLD, stroke: '#0F2340', strokeWidth: 1.5,
            originX: 'center', originY: 'center',
            selectable: true, hasControls: false, hasBorders: false,
            strokeUniform: true,
          });
          (h as any)._isLineHandle = true;
          (h as any)._handlePoint  = pointKey;
          (h as any)._targetLine   = line;
          return h;
        };
        const h1 = makeHandle(p1, 'p1');
        const h2 = makeHandle(p2, 'p2');
        lineHandlesRef.current = { h1, h2, line };
        canvas.add(h1);
        canvas.add(h2);
        canvas.renderAll();
      };

      // ── 履歴管理 ─────────────────────────────────────────────
      const saveHistory = () => {
        // ハンドルを一時退避してシリアライズ
        const handles = lineHandlesRef.current;
        if (handles) {
          canvas.remove(handles.h1);
          canvas.remove(handles.h2);
        }
        const json = canvas.toJSON();
        json.backgroundColor = '#ffffff';
        if (handles) {
          canvas.add(handles.h1);
          canvas.add(handles.h2);
        }
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(JSON.stringify(json));
        historyIndexRef.current++;
        setCanUndo(true);
      };
      saveHistoryRef.current = saveHistory;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onAdded    = (e: any) => { if (e?.target?._isLineHandle) return; saveHistory(); };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onRemoved  = (e: any) => { if (e?.target?._isLineHandle) return; saveHistory(); };
      const onModified = () => saveHistory();
      canvas.on('object:added',    onAdded);
      canvas.on('object:removed',  onRemoved);
      canvas.on('object:modified', onModified);

      // undo 用にイベント着脱関数を ref で公開
      (canvas as any).__historyHandlers = { onAdded, onRemoved, onModified };

      canvas.on('selection:created', () => {
        const obj = canvas.getActiveObject();
        lastActiveRef.current = obj;
        syncFromObj(obj);
        if (obj?.type === 'line') addLineHandles(obj);
      });
      canvas.on('selection:updated', () => {
        // 前の選択がラインならハンドルを削除
        removeLineHandles();
        const obj = canvas.getActiveObject();
        lastActiveRef.current = obj;
        syncFromObj(obj);
        if (obj?.type === 'line') addLineHandles(obj);
      });
      canvas.on('selection:cleared', () => {
        removeLineHandles();
        lastActiveRef.current = null;
        setHasSelection(false);
        setSelectedObjType('');
        setLineCoords(null);
        setSelectedShapeType(null);
      });

      // 回転中リアルタイム角度更新 ＋ ハンドル追従
      canvas.on('object:rotating', (e: any) => {
        setCurrentAngle(Math.round(e.target.angle ?? 0));
        const lh = lineHandlesRef.current;
        if (lh && e.target?.type === 'line' && lh.line === e.target) {
          const { p1, p2 } = getLineCanvasEndpoints(e.target);
          lh.h1.set({ left: p1.x, top: p1.y });
          lh.h2.set({ left: p2.x, top: p2.y });
          lh.h1.setCoords();
          lh.h2.setCoords();
        }
      });

      // スナップ点取得（BBox4隅＋中心＋polygon頂点）
      const getSnapPoints = (obj: any): { x: number; y: number }[] => {
        const br = obj.getBoundingRect(true);
        const points = [
          { x: br.left,                   y: br.top                    },
          { x: br.left + br.width,        y: br.top                    },
          { x: br.left,                   y: br.top + br.height        },
          { x: br.left + br.width,        y: br.top + br.height        },
          { x: br.left + br.width / 2,    y: br.top  + br.height / 2  },
        ];
        if (obj.points) {
          const matrix = obj.calcTransformMatrix();
          obj.points.forEach((p: any) => {
            const tp = fabric.util.transformPoint(
              { x: p.x - (obj.pathOffset?.x ?? 0), y: p.y - (obj.pathOffset?.y ?? 0) },
              matrix,
            );
            points.push({ x: tp.x, y: tp.y });
          });
        }
        return points;
      };

      // 直線プレビュー更新
      canvas.on('mouse:move', (opt: any) => {
        if (lineStartRef.current && previewLineRef.current) {
          const p = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
          if (p) {
            previewLineRef.current.set({ x2: p.x, y2: p.y });
            const start = lineStartRef.current;
            const dx = p.x - start.x;
            const dy = p.y - start.y;
            let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
            if (angle < 0) angle += 360;
            if (!angleTextRef.current) {
              angleTextRef.current = new fabric.Text('', {
                fontSize: 12, fill: '#C9A84C', selectable: false, evented: false,
              });
              canvas.add(angleTextRef.current);
            }
            angleTextRef.current.set({ text: `${Math.round(angle)}°`, left: p.x + 10, top: p.y - 20 });
            canvas.renderAll();
          }
        }
      });

      // スナップ（頂点＋BBoxベース、最近傍ペア優先）
      const SNAP_THRESHOLD = 6;
      canvas.on('object:moving', (e: any) => {
        const moving = e.target;
        if (!moving) return;

        // ── 直線ハンドルのドラッグ ──
        if (moving._isLineHandle) {
          const line = moving._targetLine;
          if (!line) return;
          const invMatrix = fabric.util.invertTransform(line.calcTransformMatrix());
          const localPt   = fabric.util.transformPoint({ x: moving.left, y: moving.top }, invMatrix);
          if (moving._handlePoint === 'p1') {
            line.set({ x1: localPt.x, y1: localPt.y });
          } else {
            line.set({ x2: localPt.x, y2: localPt.y });
          }
          line.setCoords();
          // lineCoords を更新（react state）
          const { p1, p2 } = getLineCanvasEndpoints(line);
          setLineCoords({
            ax1: Math.round(p1.x), ay1: Math.round(p1.y),
            ax2: Math.round(p2.x), ay2: Math.round(p2.y),
          });
          canvas.renderAll();
          return; // ハンドルにはスナップ不要
        }

        // ── 直線を移動中: ハンドルを追従 ──
        const lh = lineHandlesRef.current;
        if (lh && moving.type === 'line' && lh.line === moving) {
          const { p1, p2 } = getLineCanvasEndpoints(moving);
          lh.h1.set({ left: p1.x, top: p1.y });
          lh.h2.set({ left: p2.x, top: p2.y });
          lh.h1.setCoords();
          lh.h2.setCoords();
        }

        // ── スナップ ──
        if (!snapEnabledRef.current) return;
        const others = canvas.getObjects().filter((o: any) => o !== moving && !o._isLineHandle);
        const movingPoints = getSnapPoints(moving);
        let bestDist = Infinity;
        let snapDx = 0;
        let snapDy = 0;

        others.forEach((obj: any) => {
          const targetPoints = getSnapPoints(obj);
          movingPoints.forEach(mp => {
            targetPoints.forEach(tp => {
              const dx = tp.x - mp.x;
              const dy = tp.y - mp.y;
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) {
                bestDist = dist;
                snapDx = dx;
                snapDy = dy;
              }
            });
          });
        });

        if (bestDist < SNAP_THRESHOLD * SNAP_THRESHOLD) {
          moving.set({ left: (moving.left ?? 0) + snapDx, top: (moving.top ?? 0) + snapDy });
        }
        moving.setCoords();
      });

      // ① クリックした座標に配置（mouse:up 使用 + toolRef で stale closure 回避）
      canvas.on('mouse:up', (opt: any) => {
        const mode = toolRef.current;
        if (mode === 'select') return;
        // pointer がない場合は getScenePoint にフォールバック
        const pt = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
        if (!pt) return;
        const { x, y } = pt;

        // 直線：2クリック方式
        if (mode === 'line') {
          if (!lineStartRef.current) {
            // 1回目：始点を記録してプレビュー線を表示
            lineStartRef.current = { x, y };
            const strokeColor = fabricRef.current?.drawColor ?? GOLD;
            const preview = new fabric.Line([x, y, x, y], {
              stroke: strokeColor, strokeWidth: 1.5, strokeDashArray: [4, 4],
              selectable: false, evented: false,
            });
            previewLineRef.current = preview;
            canvas.add(preview);
          } else {
            // 2回目：終点を確定して本番直線を配置
            const start = lineStartRef.current;
            if (previewLineRef.current) canvas.remove(previewLineRef.current);
            if (angleTextRef.current) { canvas.remove(angleTextRef.current); angleTextRef.current = null; }
            const strokeColor = fabricRef.current?.drawColor ?? GOLD;
            const sw = fabricRef.current?.strokeW ?? 1.5;
            const line = new fabric.Line([start.x, start.y, x, y], {
              stroke: strokeColor, strokeWidth: sw, strokeUniform: true,
            });
            canvas.add(line);
            canvas.setActiveObject(line);
            canvas.renderAll();
            lineStartRef.current = null;
            previewLineRef.current = null;
            setTool('select');
            toolRef.current                 = 'select';
            fabricRef.current.selection     = true;
            fabricRef.current.defaultCursor = 'default';
            fabricRef.current.hoverCursor   = 'move';
          }
          return;
        }

        const obj = buildObjectAt(fabric, fabricRef.current, mode, x, y);
        if (obj) {
          canvas.add(obj);
          canvas.setActiveObject(obj);
          canvas.renderAll();
        }

        // 配置後は選択ツールに戻す
        setTool('select');
        // toolRef はすぐ更新（useEffect の次サイクルを待たない）
        toolRef.current                 = 'select';
        fabricRef.current.selection     = true;
        fabricRef.current.defaultCursor = 'default';
        fabricRef.current.hoverCursor   = 'move';
      });
    });

    return () => {
      disposed = true;
      if (canvas) {
        // タブ切替時にキャンバス状態をlocalStorageに保存
        try {
          const json = canvas.toJSON();
          json.backgroundColor = '#ffffff';
          localStorage.setItem('stampeditor-canvas-state', JSON.stringify(json));
        } catch { /* ignore */ }
        // Fabric.js が DOM 解放済みの要素を参照することがあるため try-catch で保護
        try {
          canvas.dispose();
        } catch { /* dispose 時の NotFoundError は無視 */ }
        canvas = null;
      }
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFromObj]);

  // ── tool / テキスト / 多角形設定を fabricRef に同期 ─────────
  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.toolMode      = tool;
    fabricRef.current.polygonSides  = polygonSides;
    fabricRef.current.textOptions   = { fontSize, fontFamily, bold, italic, underline, vertical };
    fabricRef.current.selection     = tool === 'select';
    fabricRef.current.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
    fabricRef.current.hoverCursor   = tool === 'select' ? 'move'    : 'crosshair';
  }, [tool, polygonSides, fontSize, fontFamily, bold, italic, underline, vertical]);

  // ② 色/線幅/透明度を fabricRef（配置デフォルト）に同期し、
  //    選択オブジェクトがあれば適用する
  useEffect(() => {
    // 選択同期から来た変化はオブジェクトに反映しない
    if (isApplyingFromSelRef.current) {
      isApplyingFromSelRef.current = false;
      // fabricRef デフォルトだけ更新
      if (fabricRef.current) {
        fabricRef.current.drawColor = color;
        fabricRef.current.fillC     = fillColor;
        fabricRef.current.strokeW   = strokeWidth;
      }
      return;
    }
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.drawColor = color;
    canvas.fillC     = fillColor;
    canvas.strokeW   = strokeWidth;

    const obj = canvas.getActiveObject();
    if (!obj) return;

    const fill = fillColor === 'transparent' ? '' : fillColor;
    // Group の場合は子に再帰的に適用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyDeep = (o: any) => {
      if (o.type === 'group') {
        o.getObjects?.()?.forEach(applyDeep);
      } else {
        o.set({ stroke: color, fill, strokeWidth });
      }
    };
    applyDeep(obj);
    canvas.renderAll();
  }, [color, fillColor, strokeWidth]);

  // ── アンドゥ（イベント一時切断で saveHistory の誤発火を防ぐ） ──
  const undo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;

    // ハンドルを先に除去
    if (lineHandlesRef.current) {
      canvas.remove(lineHandlesRef.current.h1);
      canvas.remove(lineHandlesRef.current.h2);
      lineHandlesRef.current = null;
    }
    setLineCoords(null);

    const { onAdded, onRemoved, onModified } = (canvas as any).__historyHandlers ?? {};
    canvas.off('object:added',    onAdded);
    canvas.off('object:removed',  onRemoved);
    canvas.off('object:modified', onModified);

    historyIndexRef.current--;
    const json = JSON.parse(historyRef.current[historyIndexRef.current]);
    canvas.loadFromJSON(json, () => {
      canvas.backgroundColor = '#ffffff';
      canvas.backgroundImage = undefined;
      canvas.renderAll();
      setCanUndo(historyIndexRef.current > 0);

      setTimeout(() => {
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
      }, 50);

      // イベント再登録
      canvas.on('object:added',    onAdded);
      canvas.on('object:removed',  onRemoved);
      canvas.on('object:modified', onModified);
    });
  }, []);

  // ── カスタム形状を置き換えてプロパティ更新 ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replaceShape = useCallback((newObj: any) => {
    const canvas = fabricRef.current;
    const old = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !old) return;
    const { onAdded, onRemoved } = (canvas as any).__historyHandlers ?? {};
    canvas.off('object:added',   onAdded);
    canvas.off('object:removed', onRemoved);
    canvas.remove(old);
    canvas.add(newObj);
    canvas.on('object:added',   onAdded);
    canvas.on('object:removed', onRemoved);
    canvas.setActiveObject(newObj);
    lastActiveRef.current = newObj;
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const applyTrapezoidProps = useCallback((topW: number, botW: number, h: number) => {
    const canvas = fabricRef.current;
    const old = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !old || (old as any)._shapeType !== 'trapezoid') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = (canvas as any)._fabric;
    if (!fabric) return;
    const half = (botW - topW) / 2;
    const poly = new fabric.Polygon(
      [{ x: half, y: 0 }, { x: half + topW, y: 0 }, { x: botW, y: h }, { x: 0, y: h }],
      {
        left: old.left, top: old.top, angle: old.angle, scaleX: old.scaleX, scaleY: old.scaleY,
        opacity: old.opacity, stroke: old.stroke, strokeWidth: old.strokeWidth,
        fill: old.fill, strokeUniform: true,
      },
    );
    (poly as any)._shapeType = 'trapezoid';
    (poly as any)._trapTop = topW;
    (poly as any)._trapBottom = botW;
    (poly as any)._trapHeight = h;
    replaceShape(poly);
  }, [replaceShape]);

  const applyArcProps = useCallback((r: number, startDeg: number, endDeg: number) => {
    const canvas = fabricRef.current;
    const old = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !old || (old as any)._shapeType !== 'arc') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = (canvas as any)._fabric;
    if (!fabric) return;
    const p = new fabric.Path(buildArcPath(r, startDeg, endDeg), {
      left: old.left, top: old.top, angle: old.angle, scaleX: old.scaleX, scaleY: old.scaleY,
      opacity: old.opacity, stroke: old.stroke, strokeWidth: old.strokeWidth,
      fill: 'transparent', strokeUniform: true,
    });
    (p as any)._shapeType = 'arc';
    (p as any)._arcRadius = r;
    (p as any)._arcStartAngle = startDeg;
    (p as any)._arcEndAngle = endDeg;
    replaceShape(p);
  }, [replaceShape]);

  const applyDotRadius = useCallback((r: number) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !obj || (obj as any)._shapeType !== 'dot') return;
    obj.set({ radius: r });
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  // ── 直線端点をキャンバス絶対座標で更新 ─────────────────────
  const updateLineEndpoint = useCallback((endpoint: 1 | 2, axis: 'x' | 'y', value: number) => {
    const canvas = fabricRef.current;
    const line = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !line || line.type !== 'line') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = (canvas as any)._fabric;
    if (!fabric) return;
    const matrix    = line.calcTransformMatrix();
    const invMatrix = fabric.util.invertTransform(matrix);
    const p1 = fabric.util.transformPoint({ x: line.x1, y: line.y1 }, matrix);
    const p2 = fabric.util.transformPoint({ x: line.x2, y: line.y2 }, matrix);
    const target = endpoint === 1 ? { x: p1.x, y: p1.y } : { x: p2.x, y: p2.y };
    if (axis === 'x') target.x = value; else target.y = value;
    const local = fabric.util.transformPoint(target, invMatrix);
    if (endpoint === 1) {
      line.set({ x1: local.x, y1: local.y });
    } else {
      line.set({ x2: local.x, y2: local.y });
    }
    line.setCoords();
    // ハンドル位置更新
    const lh = lineHandlesRef.current;
    if (lh && lh.line === line) {
      const newMatrix = line.calcTransformMatrix();
      const np1 = fabric.util.transformPoint({ x: line.x1, y: line.y1 }, newMatrix);
      const np2 = fabric.util.transformPoint({ x: line.x2, y: line.y2 }, newMatrix);
      lh.h1.set({ left: np1.x, top: np1.y });
      lh.h2.set({ left: np2.x, top: np2.y });
      lh.h1.setCoords();
      lh.h2.setCoords();
      setLineCoords({
        ax1: Math.round(np1.x), ay1: Math.round(np1.y),
        ax2: Math.round(np2.x), ay2: Math.round(np2.y),
      });
    }
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() ?? lastActiveRef.current;
    if (!active) return;
    if (active.type === 'activeselection') {
      (active as any).getObjects().forEach((obj: any) => canvas.remove(obj));
      canvas.discardActiveObject();
    } else {
      canvas.remove(active);
    }
    lastActiveRef.current = null;
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const duplicateSelected = useCallback(async () => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    if (active.type === 'activeselection') {
      const objs = (active as any).getObjects();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clones: any[] = await Promise.all(objs.map((o: any) => o.clone()));
      canvas.discardActiveObject();
      clones.forEach(c => { c.set({ left: c.left + 20, top: c.top + 20 }); canvas.add(c); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('fabric');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric: any = mod.fabric ?? mod.default ?? mod;
      const sel = new fabric.ActiveSelection(clones, { canvas });
      canvas.setActiveObject(sel);
    } else {
      const cloned = await active.clone();
      cloned.set({ left: active.left + 20, top: active.top + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
    }
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const bringToFront = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !obj) return;
    canvas.bringObjectToFront(obj);
    canvas.renderAll();
  }, []);

  const sendToBack = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject() ?? lastActiveRef.current;
    if (!canvas || !obj) return;
    canvas.sendObjectToBack(obj);
    canvas.renderAll();
  }, []);

  const clearCanvas = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = '#ffffff';
    fabricRef.current.renderAll();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, deleteSelected]);

  const saveAsStamp = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const name = stampName.trim() || `スタンプ ${new Date().toLocaleTimeString()}`;

    // 配置用JSONは元のキャンバス（400×400）から取得
    const fabricJSON = canvas.toJSON();

    // サムネイルは 200×200・白背景・中央フィットで統一生成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = (canvas as any)._fabric;
    const objects = canvas.getObjects().filter((o: any) => !o._isLineHandle);
    let thumbnail: string;
    if (fabric && objects.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cloned: any[] = await Promise.all(objects.map((o: any) => o.clone()));
      const thumbEl = document.createElement('canvas');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const thumbCanvas: any = new fabric.Canvas(thumbEl, { width: 200, height: 200, backgroundColor: '#ffffff' });
      const group = new fabric.Group(cloned);
      // getScaledWidth/Height で子オブジェクトのスケールを含めた実寸を取得
      const w = group.getScaledWidth?.() ?? group.width ?? 1;
      const h = group.getScaledHeight?.() ?? group.height ?? 1;
      const scale = 160 / Math.max(w, h, 1);
      group.set({ scaleX: scale, scaleY: scale, left: 100, top: 100, originX: 'center', originY: 'center' });
      thumbCanvas.add(group);
      thumbCanvas.backgroundColor = '#ffffff';
      thumbCanvas.renderAll();
      thumbnail = thumbCanvas.toDataURL({ format: 'png', multiplier: 1 });
      thumbCanvas.dispose();
    } else {
      thumbnail = canvas.toDataURL({ format: 'png', multiplier: 0.5 });
    }

    const stamp: Stamp = { id: Date.now().toString(), name, thumbnail, fabricJSON, createdAt: new Date().toISOString() };
    saveStamp(stamp);
    setStamps(getStamps());
    setStampName('');
  }, [stampName]);

  const loadStamp = useCallback((stamp: Stamp) => {
    if (!fabricRef.current) return;
    fabricRef.current.loadFromJSON(stamp.fabricJSON, () => {
      // loadFromJSON がキャンバスをスタンプのサイズに縮小することがあるため元に戻す
      fabricRef.current.setDimensions({ width: CANVAS_SIZE, height: CANVAS_SIZE });
      fabricRef.current.backgroundColor = bgColorRef.current;
      fabricRef.current.requestRenderAll();
    });
    setSelectedStampId(stamp.id);
  }, []);

  const removeStamp = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteStamp(id);
    setStamps(getStamps());
  }, []);

  const isText = tool === 'text' || selectedObjType === 'i-text';

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', overflowX: 'auto', overflowY: 'hidden', minWidth: 'fit-content' }}>
      <AppHeader startChildren={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 570 }}>
          <button title={`スナップ ${snapEnabled ? 'ON' : 'OFF'}`}
            onClick={() => setSnapEnabled(v => !v)}
            style={S.tbBtn(snapEnabled)}
            onMouseEnter={e => { if (!snapEnabled) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (!snapEnabled) e.currentTarget.style.background = '#1A3358'; }}>
            <Magnet size={14} />
          </button>
          <button title="元に戻す (Ctrl+Z)" onClick={undo} disabled={!canUndo}
            style={{ ...S.tbBtn(), opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (canUndo) e.currentTarget.style.background = '#1A3358'; }}>
            <Undo2 size={14} />
          </button>
          <button title="全消去"
            onClick={() => { if (!window.confirm('すべて削除しますか？')) return; clearCanvas(); }}
            style={{ ...S.tbBtn(), color: '#6B7A99' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2A1A1A'; e.currentTarget.style.color = '#E05A5A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1A3358'; e.currentTarget.style.color = '#6B7A99'; }}>
            <Trash2 size={14} />
          </button>
        </div>
      } />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* ── アイコンツールバー ─────────────────────────────── */}
        <div style={S.toolbar}>
          {TOOLS.map(t => {
            if (t.id === 'polygon') {
              const isActive = tool === 'polygon';
              return (
                <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button title={t.title} onClick={() => setTool(isActive ? 'select' : 'polygon')} style={S.toolBtn(isActive)}>
                    {t.icon}
                  </button>
                  {isActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button onClick={() => setPolygonSides(s => Math.max(3, s - 1))}
                        style={{ width: 16, height: 16, border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>−</button>
                      <span style={{ width: 18, textAlign: 'center', fontSize: 10, fontWeight: 700 }}>{polygonSides}</span>
                      <button onClick={() => setPolygonSides(s => Math.min(12, s + 1))}
                        style={{ width: 16, height: 16, border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>＋</button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button key={t.id} title={t.title} onClick={() => setTool(t.id)} style={S.toolBtn(tool === t.id)}>
                {t.icon}
              </button>
            );
          })}
        </div>

        {/* ── ② 統一プロパティパネル ────────────────────────── */}
        <div style={S.panel}>
          {/* 線色 */}
          <div>
            <div style={S.label}>線色</div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              style={{ width: '100%', height: 32, borderRadius: 6 }} />
          </div>

          {/* 塗り色 */}
          <div>
            <div style={S.label}>塗り色</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={fillColor === 'transparent'}
                onChange={e => setFillColor(e.target.checked ? 'transparent' : '#ffffff')}
                style={{ accentColor: 'var(--accent)' }} />
              なし（透明）
            </label>
            {fillColor !== 'transparent' && (
              <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)}
                style={{ width: '100%', height: 32, borderRadius: 6 }} />
            )}
          </div>

          {/* 線幅 */}
          <div>
            <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
              <span>線幅</span><span style={{ color: 'var(--accent)' }}>{strokeWidth}px</span>
            </div>
            <input type="range" min="0.5" max="20" step="0.5" value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* テキスト専用オプション */}
          {isText && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div>
                <div style={S.label}>フォント</div>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}
                  style={{ ...S.input, appearance: 'none' }}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                  <span>サイズ</span><span style={{ color: 'var(--accent)' }}>{fontSize}px</span>
                </div>
                <input type="range" min="8" max="120" value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { icon: <Bold size={14} />,      active: bold,      toggle: () => setBold(!bold),           title: '太字' },
                  { icon: <Italic size={14} />,    active: italic,    toggle: () => setItalic(!italic),       title: '斜体' },
                  { icon: <Underline size={14} />, active: underline, toggle: () => setUnderline(!underline), title: '下線' },
                  { icon: <AlignLeft size={14} />, active: vertical,  toggle: () => setVertical(!vertical),   title: '縦書き' },
                ].map((item, i) => (
                  <button key={i} title={item.title} onClick={item.toggle}
                    style={{ flex: 1, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: item.active ? 'var(--accent)' : 'var(--bg)',
                      color: item.active ? '#0F2340' : 'var(--text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.icon}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── 台形プロパティ ───────────────────────────────── */}
          {selectedShapeType === 'trapezoid' && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div>
                <div style={S.label}>台形</div>
                {[
                  { label: '上辺', value: trapTop,    min: 1, max: 200, set: (v: number) => { setTrapTop(v);    applyTrapezoidProps(v, trapBottom, trapHeight); } },
                  { label: '下辺', value: trapBottom, min: 1, max: 200, set: (v: number) => { setTrapBottom(v); applyTrapezoidProps(trapTop, v, trapHeight); } },
                  { label: '高さ', value: trapHeight, min: 1, max: 200, set: (v: number) => { setTrapHeight(v); applyTrapezoidProps(trapTop, trapBottom, v); } },
                ].map(({ label, value, min, max, set }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 26 }}>{label}</span>
                    <input type="number" min={min} max={max} value={value}
                      onChange={e => set(Number(e.target.value))}
                      style={{ ...S.input, width: 52, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: '#888' }}>px</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── 円弧プロパティ ───────────────────────────────── */}
          {selectedShapeType === 'arc' && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div>
                <div style={S.label}>円弧</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 26 }}>半径</span>
                    <input type="number" min={5} max={200} value={arcRadius}
                      onChange={e => { const v = Number(e.target.value); setArcRadius(v); applyArcProps(v, arcStartAngle, arcEndAngle); }}
                      style={{ ...S.input, width: 52, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: '#888' }}>px</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 26 }}>開始</span>
                    <input type="number" min={0} max={359} value={arcStartAngle}
                      onChange={e => { const v = Number(e.target.value); setArcStartAngle(v); applyArcProps(arcRadius, v, arcEndAngle); }}
                      style={{ ...S.input, width: 52, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: '#888' }}>°</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 26 }}>終了</span>
                    <input type="number" min={0} max={359} value={arcEndAngle}
                      onChange={e => { const v = Number(e.target.value); setArcEndAngle(v); applyArcProps(arcRadius, arcStartAngle, v); }}
                      style={{ ...S.input, width: 52, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: '#888' }}>°</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── 点プロパティ ─────────────────────────────────── */}
          {selectedShapeType === 'dot' && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div>
                <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                  <span>点の半径</span><span style={{ color: 'var(--accent)' }}>{dotRadius}px</span>
                </div>
                <input type="range" min={1} max={20} value={dotRadius}
                  onChange={e => { const v = Number(e.target.value); setDotRadius(v); applyDotRadius(v); }}
                  style={{ width: '100%' }} />
              </div>
            </>
          )}

          {/* 選択中のみ表示するアクション */}
          {hasSelection && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* 角度 */}
              <div>
                <div style={S.label}>角度</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCw size={14} style={{ color: GOLD, flexShrink: 0 }} />
                  <input
                    type="number"
                    value={currentAngle}
                    min={0}
                    max={360}
                    onChange={e => {
                      const canvas = fabricRef.current;
                      const obj = canvas?.getActiveObject() ?? lastActiveRef.current;
                      if (!canvas || !obj) return;
                      const angle = Number(e.target.value);
                      setCurrentAngle(angle);
                      obj.set({ angle });
                      canvas.renderAll();
                      saveHistoryRef.current();
                    }}
                    style={{ ...S.input, width: 56, textAlign: 'center', padding: '4px 6px' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>°</span>
                  <button
                    title="0°にリセット"
                    onClick={() => {
                      const canvas = fabricRef.current;
                      const obj = canvas?.getActiveObject() ?? lastActiveRef.current;
                      if (!canvas || !obj) return;
                      obj.set({ angle: 0 });
                      setCurrentAngle(0);
                      canvas.renderAll();
                      saveHistoryRef.current();
                    }}
                    style={{ ...S.actionBtn(), flex: 'none', width: 28, padding: 0 }}>
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>

              {/* 角の丸み（矩形選択時のみ） */}
              {selectedObjType === 'rect' && (
                <div>
                  <div style={S.label}>角の丸み</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => {
                      const canvas = fabricRef.current;
                      const obj = canvas?.getActiveObject();
                      if (!canvas || !obj) return;
                      const v = Math.max(0, selRx - 2);
                      setSelRx(v);
                      obj.set({ rx: v, ry: v });
                      canvas.renderAll();
                      saveHistoryRef.current();
                    }} style={S.actionBtn()}><Minus size={12} /></button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text)' }}>{selRx}</span>
                    <button onClick={() => {
                      const canvas = fabricRef.current;
                      const obj = canvas?.getActiveObject();
                      if (!canvas || !obj) return;
                      const v = selRx + 2;
                      setSelRx(v);
                      obj.set({ rx: v, ry: v });
                      canvas.renderAll();
                      saveHistoryRef.current();
                    }} style={S.actionBtn()}><Plus size={12} /></button>
                  </div>
                </div>
              )}

              {/* 直線端点編集（直線選択時のみ） */}
              {selectedObjType === 'line' && lineCoords !== null && (
                <div>
                  <div style={S.label}>始点 / 終点</div>
                  {/* 始点 */}
                  <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>始点</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 14 }}>X</span>
                    <input type="number" value={lineCoords.ax1}
                      onChange={e => updateLineEndpoint(1, 'x', Number(e.target.value))}
                      style={{ ...S.input, width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: '#888', width: 14 }}>Y</span>
                    <input type="number" value={lineCoords.ay1}
                      onChange={e => updateLineEndpoint(1, 'y', Number(e.target.value))}
                      style={{ ...S.input, width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                  </div>
                  {/* 終点 */}
                  <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>終点</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#888', width: 14 }}>X</span>
                    <input type="number" value={lineCoords.ax2}
                      onChange={e => updateLineEndpoint(2, 'x', Number(e.target.value))}
                      style={{ ...S.input, width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                    <span style={{ fontSize: 11, color: '#888', width: 14 }}>Y</span>
                    <input type="number" value={lineCoords.ay2}
                      onChange={e => updateLineEndpoint(2, 'y', Number(e.target.value))}
                      style={{ ...S.input, width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11 }} />
                  </div>
                </div>
              )}

              <div style={S.actionRow}>
                <button onClick={duplicateSelected} style={S.actionBtn()} title="複製">
                  <Copy size={12} /> 複製
                </button>
                <button onClick={deleteSelected} style={{ ...S.actionBtn(), color: 'var(--danger)' }} title="削除">
                  <XCircle size={12} /> 削除
                </button>
              </div>
              <div style={S.actionRow}>
                <button onClick={bringToFront} style={S.actionBtn()} title="前面へ">
                  <BringToFront size={12} /> 前面
                </button>
                <button onClick={sendToBack} style={S.actionBtn()} title="背面へ">
                  <SendToBack size={12} /> 背面
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── キャンバス ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          {/* Fabric.js 初期化前もサイズを確保して白背景を即時表示 */}
          <div style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, background: '#ffffff' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* ── スタンプ一覧パネル ─────────────────────────────── */}
        <div style={{ width: 200, height: '100%', flexShrink: 0, background: 'var(--surface)', borderLeft: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div style={S.label}>スタンプ登録</div>
          <input type="text" value={stampName} onChange={e => setStampName(e.target.value)}
            placeholder="スタンプ名" style={S.input} />
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
                <div style={{ width: 36, height: 36, background: '#ffffff', borderRadius: 4, border: '1px solid #2A4570', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stamp.thumbnail} alt={stamp.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === stamp.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => {
                        if (editingName.trim()) { renameStamp(stamp.id, editingName.trim()); setStamps(getStamps()); }
                        setEditingId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { if (editingName.trim()) { renameStamp(stamp.id, editingName.trim()); setStamps(getStamps()); } setEditingId(null); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      style={{ width: '100%', fontSize: 11, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)', padding: '1px 4px', outline: 'none' }}
                    />
                  ) : (
                    <div
                      title="クリックで名前を変更"
                      onClick={e => { e.stopPropagation(); setEditingId(stamp.id); setEditingName(stamp.name); }}
                      style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
                    >
                      {stamp.name}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#888' }}>{new Date(stamp.createdAt).toLocaleDateString()}</div>
                </div>
                <button onClick={e => removeStamp(stamp.id, e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
