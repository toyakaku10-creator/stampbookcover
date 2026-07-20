'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import {
  Grid, Shuffle, Frame,
  Trash2, Copy, Download, Upload, ImageIcon, Minus, Plus,
  Stamp, ChevronDown, ChevronUp, X, Undo2, Magnet, Waves,
  MousePointer2, Square, Circle, Triangle, Type, Maximize2, BookOpen, FileJson,
  Bold, Italic, Underline, AlignLeft, Repeat,
} from 'lucide-react';

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Impact'];
import type { Stamp as StampType, Tool } from '@/lib/types';
import { getStamps, saveStamp } from '@/lib/stampStorage';
import { buildObjectAt, roundedPolygonPath, buildSegmentGroup, buildArcPath } from '@/lib/shapePlacement';

const COVER_PRESETS = [
  { name: '応募サイズ', w: 385, h: 152, locked: true },
  { name: '標準カバー', w: 340, h: 255, locked: false },
];

const SHAPE_TOOL_IDS: Tool[] = [
  'line', 'rect', 'trapezoid', 'circle', 'arc',
  'triangle', 'polygon', 'h-diamond', 'dot', 'text',
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
const BOOK_W = 105, BOOK_H = 148, SPINE_W = 15;

type ArrangementType = 'grid' | 'stagger' | 'frame' | 'wave';

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
  tbBtn: (active = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 10px',
    borderRadius: 6,
    background: active ? '#C9A84C' : '#1A3358',
    color: active ? '#0F2340' : '#F5F0E8',
    border: '1px solid #2A4570',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.15s',
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
  const [stampTab, setStampTab] = useState<'single' | 'arrange'>('single');
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
  const [showExportMenu, setShowExportMenu] = useState(false);
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
  const isBatchingRef = useRef(false);

  // スナップ
  const [snapOn, setSnapOn] = useState(false);
  const snapOnRef = useRef(false);

  // 右サイドバー プロパティ
  const [hasSelection, setHasSelection] = useState(false);
  const [isStamp, setIsStamp] = useState(false);
  const isStampRef = useRef(false);
  const [applyToSameType, setApplyToSameType] = useState(false);
  const applyToSameTypeRef = useRef(false);
  const [showReplacePanel, setShowReplacePanel] = useState(false);
  const [selFill, setSelFill] = useState('#000000');
  const [selStroke, setSelStroke] = useState('#000000');
  const [selStrokeW, setSelStrokeW] = useState(1);
  const [selOpacity, setSelOpacity] = useState(1);
  const [selAngle, setSelAngle] = useState(0);
  const [selSize, setSelSize] = useState(60);
  const [isRect, setIsRect] = useState(false);
  const [selRx, setSelRx] = useState(0);
  const [isTrapezoid, setIsTrapezoid] = useState(false);
  const [isDiamond, setIsDiamond] = useState(false);
  const [isTriangle, setIsTriangle] = useState(false);
  const [isMseg, setIsMseg] = useState(false);
  const [msegRadius, setMsegRadius] = useState(0);
  const [msegSides, setMsegSides] = useState([true, true, true, true]);
  const [selTrapRx, setSelTrapRx] = useState(0);
  const [trapTop, setTrapTop]       = useState(60);
  const [trapBottom, setTrapBottom] = useState(90);
  const [trapHeight, setTrapHeight] = useState(50);
  const [isArc, setIsArc] = useState(false);
  const [arcRadius, setArcRadius]         = useState(45);
  const [arcStartAngle, setArcStartAngle] = useState(180);
  const [arcEndAngle, setArcEndAngle]     = useState(0);
  const [isDot, setIsDot] = useState(false);
  const [dotRadius, setDotRadius] = useState(3);
  const [isTextObj, setIsTextObj] = useState(false);
  const [fontSize, setFontSize]       = useState(24);
  const [fontFamily, setFontFamily]   = useState('Arial');
  const [isBold, setIsBold]           = useState(false);
  const [isItalic, setIsItalic]       = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isVertical, setIsVertical]   = useState(false);
  const [lineCoords, setLineCoords] = useState<{ ax1: number; ay1: number; ax2: number; ay2: number } | null>(null);
  const [isRectSides, setIsRectSides] = useState(false);
  const [isFourSidedPoly, setIsFourSidedPoly] = useState(false);
  const [rectSides, setRectSides] = useState({ top: true, right: true, bottom: true, left: true });
  const [showTriSideToggle, setShowTriSideToggle] = useState(false);
  const [triSides, setTriSides] = useState({ s0: true, s1: true, s2: true });

  // 行列数直接指定
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(4);

  // 多角形の角数
  const [polygonSides, setPolygonSides] = useState(5);
  // 三角形種別
  const [triangleType, setTriangleType] = useState<'equilateral' | 'right'>('equilateral');

  // エリア指定
  const [areaMode, setAreaMode] = useState<'full' | 'custom'>('full');
  const [customArea, setCustomArea] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaRectRef = useRef<any>(null); // 点線枠（ドラッグ中も配置待ちも同じRef）
  const isAreaSelectingRef = useRef(false); // Fabricイベントハンドラ内で参照するRef
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const previewLineRef = useRef<any>(null);
  const angleTextRef = useRef<any>(null);

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
  useEffect(() => { isStampRef.current = isStamp; }, [isStamp]);
  useEffect(() => { applyToSameTypeRef.current = applyToSameType; }, [applyToSameType]);
  useEffect(() => { bgColorRef.current = bgColor; localStorage.setItem('coverdesigner-canvas-bg', bgColor); }, [bgColor]);
  useEffect(() => { if (fabricRef.current) fabricRef.current.polygonSides = polygonSides; }, [polygonSides]);
  useEffect(() => { if (fabricRef.current) fabricRef.current.triangleType = triangleType; }, [triangleType]);
  useEffect(() => {
    if (fabricRef.current) fabricRef.current.textOptions = { fontSize, fontFamily, bold: isBold, italic: isItalic, underline: isUnderline, vertical: isVertical };
  }, [fontSize, fontFamily, isBold, isItalic, isUnderline, isVertical]);

  // ── アンドゥ ──────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    if (isBatchingRef.current || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = canvas.toJSON(['isOverlay', 'data']);
    json.backgroundColor = undefined;
    // isOverlay フラグを持つオーバーレイ（エリア選択枠）を履歴から除外
    // per-object serialization で data を確実に含める
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json.objects = (canvas.getObjects() as any[])
      .map((o: any) => o.toObject(['isOverlay', 'data']))
      .filter((o: any) => !o.isOverlay);
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(JSON.stringify(json));
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
  }, []);

  const saveHistoryRef = useRef(saveHistory);
  useEffect(() => { saveHistoryRef.current = saveHistory; }, [saveHistory]);

  const beginBatch = useCallback(() => { isBatchingRef.current = true; }, []);
  const endBatch = useCallback(() => {
    isBatchingRef.current = false;
    saveHistoryRef.current();
  }, []);

  // ── 旧構造 mseg 図形の自動マイグレーション ─────────────────────
  const migrateOldMsegShapes = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objects = canvas.getObjects() as any[];
    let migratedCount = 0;

    objects.forEach((obj: any) => {
      const looksOld = obj._msegCorners && (!obj._objects || obj._objects.length === 0);
      if (!looksOld) return;

      const corners  = obj._msegCorners as { x: number; y: number }[];
      const radius   = (obj._msegRadius as number) ?? 0;
      const sides    = (obj._msegSides  as boolean[]) ?? Array(corners.length).fill(true);
      const stroke   = (typeof obj.stroke === 'string' && obj.stroke) ? obj.stroke : '#C9A84C';
      const sw       = obj.strokeWidth ?? 1.5;
      const rawFill  = typeof obj.fill === 'string' ? obj.fill : '';
      const fill     = rawFill && rawFill !== '' ? rawFill : 'transparent';

      const newGroup = buildSegmentGroup(fabric, corners, radius, sides, stroke, sw, fill, {
        left:    obj.left,    top:    obj.top,    angle:  obj.angle  ?? 0,
        scaleX:  obj.scaleX  ?? 1,   scaleY:  obj.scaleY  ?? 1,
        opacity: obj.opacity ?? 1,
        originX: obj.originX ?? 'left', originY: obj.originY ?? 'top',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._shapeType   = obj._shapeType ?? 'mseg';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._msegCorners = corners;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._msegRadius  = radius;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._msegSides   = sides;
      if (obj._trapTop !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newGroup as any)._trapTop    = obj._trapTop;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newGroup as any)._trapBottom = obj._trapBottom;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newGroup as any)._trapHeight = obj._trapHeight;
      }

      canvas.remove(obj);
      canvas.add(newGroup);
      migratedCount++;
    });

    if (migratedCount > 0) {
      canvas.renderAll();
      saveHistoryRef.current();
      console.info(`[mseg migrate] ${migratedCount}個の旧構造図形を新構造に変換しました`);
    }
  }, []);

  const migrateOldMsegShapesRef = useRef(migrateOldMsegShapes);
  useEffect(() => { migrateOldMsegShapesRef.current = migrateOldMsegShapes; }, [migrateOldMsegShapes]);

  const undo = useCallback(async () => {
    if (historyIndexRef.current <= 0 || !fabricRef.current) return;
    const canvas = fabricRef.current;
    historyIndexRef.current--;
    isBatchingRef.current = true;
    await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]));
    canvas.backgroundColor = bgColorRef.current;
    canvas.renderAll();
    isBatchingRef.current = false;
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

  // ── 直線 絶対座標取得 ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getLineAbsCoords = useCallback((line: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = (fabricRef.current as any)?._fabric;
    if (!fabric) return null;
    const matrix = line.calcTransformMatrix();
    const p1 = fabric.util.transformPoint({ x: line.x1, y: line.y1 }, matrix);
    const p2 = fabric.util.transformPoint({ x: line.x2, y: line.y2 }, matrix);
    return {
      ax1: Math.round(p1.x), ay1: Math.round(p1.y),
      ax2: Math.round(p2.x), ay2: Math.round(p2.y),
    };
  }, []);

  // ── 選択オブジェクト プロパティ更新 ─────────────────────────────
  const updateSelProps = useCallback(() => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = canvas?.getActiveObject();
    if (!obj) { setHasSelection(false); setIsStamp(false); setIsRectSides(false); setIsFourSidedPoly(false); setShowTriSideToggle(false); setTriSides({ s0: true, s1: true, s2: true }); setIsMseg(false); return; }
    setHasSelection(true);
    setIsStamp(obj.type === 'group' && obj._shapeType !== 'rect-sides' && obj._shapeType !== 'tri-sides' && !obj._msegCorners);
    setIsRect(obj.type === 'rect');
    setIsRectSides(obj._shapeType === 'rect-sides');
    const poly4 = obj.type === 'polygon' && (obj.points?.length ?? 0) === 4;
    setIsFourSidedPoly(poly4);
    setIsTrapezoid(obj._shapeType === 'trapezoid');
    if (obj._shapeType === 'trapezoid') {
      setTrapTop(obj._trapTop ?? 60);
      setTrapBottom(obj._trapBottom ?? 90);
      setTrapHeight(obj._trapHeight ?? 50);
    }
    setIsArc(obj._shapeType === 'arc');
    if (obj._shapeType === 'arc') {
      setArcRadius(obj._arcRadius ?? 45);
      setArcStartAngle(obj._arcStartAngle ?? 180);
      setArcEndAngle(obj._arcEndAngle ?? 0);
    }
    setIsDot(obj._shapeType === 'dot');
    if (obj._shapeType === 'dot') {
      setDotRadius(obj.radius ?? 3);
    }
    const isText = obj.type === 'i-text' || obj.type === 'text';
    setIsTextObj(isText);
    if (isText) {
      setFontSize(obj.fontSize ?? 24);
      setFontFamily(obj.fontFamily ?? 'Arial');
      setIsBold(obj.fontWeight === 'bold');
      setIsItalic(obj.fontStyle === 'italic');
      setIsUnderline(obj.underline ?? false);
      setIsVertical(obj.direction === 'rtl');
    }
    if (obj.type === 'line') {
      setLineCoords(getLineAbsCoords(obj));
    } else {
      setLineCoords(null);
    }
    setIsDiamond(obj._shapeType === 'h-diamond');
    setIsTriangle(obj._shapeType === 'triangle');
    const isMsegObj = !!obj._msegCorners;
    setIsMseg(isMsegObj);
    if (isMsegObj) {
      setMsegRadius(obj._msegRadius ?? 0);
      setMsegSides([...((obj._msegSides as boolean[]) ?? [true, true, true, true])]);
      const fillChild = obj.getObjects?.()?.find((c: any) => c._isFillShape);
      if (fillChild) setSelFill(fillChild.fill ?? 'transparent');
    }
    const isTriPoly = obj._shapeType === 'triangle' && obj.type === 'polygon';
    const isTriSides = obj._shapeType === 'tri-sides';
    setShowTriSideToggle(isTriPoly || isTriSides);
    setTriSides(isTriSides ? (obj._triSides ?? { s0: true, s1: true, s2: true }) : { s0: true, s1: true, s2: true });
    if (obj.type === 'rect') {
      setRectSides({ top: true, right: true, bottom: true, left: true });
    } else if (obj._shapeType === 'rect-sides') {
      setRectSides(obj._rectSides ?? { top: true, right: true, bottom: true, left: true });
    } else if (poly4) {
      setRectSides({ top: true, right: true, bottom: true, left: true });
    }
    setSelFill(typeof obj.fill === 'string' && obj.fill ? obj.fill : '#000000');
    setSelStroke(typeof obj.stroke === 'string' && obj.stroke ? obj.stroke : '#000000');
    setSelStrokeW(obj.strokeWidth ?? 1);
    setSelOpacity(obj.opacity ?? 1);
    setSelAngle(Math.round(obj.angle ?? 0));
    setSelSize(Math.round(Math.max(obj.getScaledWidth?.() ?? 0, obj.getScaledHeight?.() ?? 0)));
    setSelRx(Math.round(obj.rx ?? 0));
    setSelTrapRx(obj._shapeType === 'trapezoid' ? Math.round(obj._msegRadius ?? obj._trapRadius ?? 0) : obj._shapeType === 'h-diamond' ? Math.round(obj._diamondRadius ?? 0) : obj._shapeType === 'triangle' ? Math.round(obj._triangleRadius ?? 0) : 0);
  }, [getLineAbsCoords]);

  const updateSelPropsRef = useRef(updateSelProps);
  useEffect(() => { updateSelPropsRef.current = updateSelProps; }, [updateSelProps]);

  // スタンプ「同じ種類全部に適用」共通ヘルパー
  // refs 経由で最新の isStamp / applyToSameType を読む（useCallback の stale closure 対策）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyToTargets = useCallback((updater: (obj: any) => void) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = canvas?.getActiveObject() as any;
    if (!canvas || !active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targets: any[] = (isStampRef.current && applyToSameTypeRef.current)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (canvas as any).getObjects().filter((o: any) => o.data?.stampId && o.data.stampId === active.data?.stampId)
      : [active];
    targets.forEach(updater);
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const replaceStamp = useCallback((newStampId: string) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = canvas?.getActiveObject() as any;
    if (!canvas || !active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stamp = (stampsRef.current as any[]).find((s: any) => s.id === newStampId);
    if (!stamp) return;
    const { left, top, angle, scaleX, scaleY, opacity } = active;
    const json = stamp.fabricJSON as { objects?: object[] };
    fabric.util.enlivenObjects([...(json.objects || [])]).then((enlivened: any[]) => {
      if (!enlivened.length) return;
      const group = new fabric.Group(enlivened, {
        left, top, angle, scaleX, scaleY, opacity,
        originX: 'center' as const, originY: 'center' as const,
        data: { stampId: newStampId },
      });
      canvas.remove(active);
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      saveHistoryRef.current();
      setShowReplacePanel(false);
    });
  }, []);

  const applySelProp = useCallback((props: object) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj || !canvas) return;
    obj.set(props);
    // mseg グループはプロパティを子に選択的に伝播
    if (!!(obj as any)._msegCorners) {
      const children: any[] = (obj as any).getObjects?.() ?? [];
      const strokeProps: Record<string, unknown> = {};
      if ('stroke'      in (props as any)) strokeProps.stroke      = (props as any).stroke;
      if ('strokeWidth' in (props as any)) strokeProps.strokeWidth = (props as any).strokeWidth;
      if (Object.keys(strokeProps).length > 0) {
        children.forEach((child: any) => { if (!child._isFillShape) child.set(strokeProps); });
      }
      if ('fill' in (props as any)) {
        const fillChild = children.find((c: any) => c._isFillShape);
        if (fillChild) fillChild.set({ fill: (props as any).fill });
      }
    }
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
      isBatchingRef.current = true;
      if (savedState) {
        canvas.loadFromJSON(JSON.parse(savedState), () => {
          canvas.backgroundColor = savedBg;
          canvas.renderAll();
          isBatchingRef.current = false;
          migrateOldMsegShapesRef.current();
          saveHistoryRef.current();
          setTimeout(() => canvas.renderAll(), 50);
        });
      } else {
        canvas.backgroundColor = savedBg;
        canvas.renderAll();
        isBatchingRef.current = false;
        saveHistoryRef.current();
      }

      // ヒストリー
      canvas.on('object:added', () => saveHistoryRef.current());
      canvas.on('object:modified', () => saveHistoryRef.current());
      canvas.on('object:removed', () => saveHistoryRef.current());

      // スナップ（オブジェクト間：BBox4隅・中心・polygon頂点）
      const getSnapPoints = (obj: any): { x: number; y: number }[] => {
        const br = obj.getBoundingRect(true);
        const points = [
          { x: br.left,                y: br.top                 },
          { x: br.left + br.width,     y: br.top                 },
          { x: br.left,                y: br.top + br.height     },
          { x: br.left + br.width,     y: br.top + br.height     },
          { x: br.left + br.width / 2, y: br.top + br.height / 2 },
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

      const SNAP_THRESHOLD = 6;
      canvas.on('object:moving', (e: any) => {
        if (!snapOnRef.current || !e.target) return;
        const moving = e.target;
        const others = canvas.getObjects().filter((o: any) => o !== moving && !o.isOverlay);
        const movingPoints = getSnapPoints(moving);
        let bestDist = Infinity;
        let snapDx = 0, snapDy = 0;

        others.forEach((obj: any) => {
          const targetPoints = getSnapPoints(obj);
          movingPoints.forEach(mp => {
            targetPoints.forEach(tp => {
              const dx = tp.x - mp.x, dy = tp.y - mp.y;
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) { bestDist = dist; snapDx = dx; snapDy = dy; }
            });
          });
        });

        if (bestDist < SNAP_THRESHOLD * SNAP_THRESHOLD) {
          moving.set({ left: (moving.left ?? 0) + snapDx, top: (moving.top ?? 0) + snapDy });
        }
        moving.setCoords();
      });

      // 選択
      canvas.on('selection:created', () => updateSelPropsRef.current());
      canvas.on('selection:updated', () => updateSelPropsRef.current());
      canvas.on('selection:cleared', () => setHasSelection(false));

      // エリア指定ドラッグ用座標取得（getScenePoint優先）
      const getPt = (opt: any) => {
        try {
          if (typeof canvas.getScenePoint === 'function') {
            return canvas.getScenePoint(opt.e);
          }
        } catch (e) {
          console.error('getScenePoint failed:', e);
        }
        return opt.scenePoint ?? { x: 0, y: 0 };
      };

      canvas.on('mouse:down', (opt: any) => {
        if (!isAreaSelectingRef.current) return;
        const p = getPt(opt);
        dragStartRef.current = { x: p.x, y: p.y };
        isDraggingRef.current = true;
        if (areaRectRef.current) {
          canvas.remove(areaRectRef.current);
        }
        const rect = new fabric.Rect({
          left: p.x,
          top: p.y,
          width: 0,
          height: 0,
          originX: 'left',
          originY: 'top',
          fill: 'rgba(201,168,76,0.15)',
          stroke: '#C9A84C',
          strokeWidth: 2,
          strokeDashArray: [8, 4],
          selectable: false,
          evented: false,
          isOverlay: true,
        });
        areaRectRef.current = rect;
        canvas.add(rect);
        canvas.bringObjectToFront(rect);
      });

      canvas.on('mouse:move', (opt: any) => {
        // 直線プレビュー更新
        if (lineStartRef.current && previewLineRef.current) {
          const p = opt.scenePoint ?? opt.pointer;
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
        if (!isDraggingRef.current || !dragStartRef.current) return;
        const p = getPt(opt);
        const left = Math.min(dragStartRef.current.x, p.x);
        const top = Math.min(dragStartRef.current.y, p.y);
        const width = Math.abs(p.x - dragStartRef.current.x);
        const height = Math.abs(p.y - dragStartRef.current.y);
        if (areaRectRef.current) {
          areaRectRef.current.set({ left, top, width, height });
          canvas.renderAll();
        }
      });

      // スタンプ・図形配置 & エリア選択完了
      canvas.on('mouse:up', (opt: any) => {
        // エリア選択のドラッグ終了
        if (isDraggingRef.current && dragStartRef.current) {
          const p = getPt(opt);
          const left = Math.min(dragStartRef.current.x, p.x);
          const top = Math.min(dragStartRef.current.y, p.y);
          const width = Math.abs(p.x - dragStartRef.current.x);
          const height = Math.abs(p.y - dragStartRef.current.y);
          isDraggingRef.current = false;
          dragStartRef.current = null;
          if (width > 5 && height > 5) {
            setCustomArea({ left, top, width, height });
          }
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
              // スタンプはグループとして配置し、stampId で種類を識別できるようにする
              const group = new fabric.Group(enlivened, {
                left: x, top: y, originX: 'center', originY: 'center',
                data: { stampId },
              });
              const naturalSize = Math.max(group.width ?? 1, group.height ?? 1);
              if (naturalSize > 0) group.scale(stampSizeRef.current / naturalSize);
              canvas.add(group);
              canvas.setActiveObject(group);
              canvas.renderAll();
            });
          }
          activeToolRef.current = 'select';
          setActiveTool('select');
          canvas.selection = true;
          canvas.defaultCursor = 'default';
          return;
        }

        // 直線：2クリック方式
        if (tool === 'line') {
          if (!lineStartRef.current) {
            // 1回目：始点を記録してプレビュー線を表示
            lineStartRef.current = { x, y };
            const strokeColor = canvas.drawColor ?? '#C9A84C';
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
            const strokeColor = canvas.drawColor ?? '#C9A84C';
            const sw = canvas.strokeW ?? 1.5;
            const line = new fabric.Line([start.x, start.y, x, y], {
              stroke: strokeColor, strokeWidth: sw, strokeUniform: true,
            });
            canvas.add(line);
            canvas.setActiveObject(line);
            canvas.renderAll();
            lineStartRef.current = null;
            previewLineRef.current = null;
            activeToolRef.current = 'select';
            setActiveTool('select');
            canvas.selection = true;
            canvas.defaultCursor = 'default';
          }
          return;
        }

        // その他の図形配置
        if (SHAPE_TOOL_IDS.includes(tool as Tool)) {
          const obj = buildObjectAt(fabric, canvas, tool as Tool, x, y);
          if (obj) {
            canvas.add(obj);
            canvas.setActiveObject(obj);
            canvas.renderAll();
          }
          activeToolRef.current = 'select';
          setActiveTool('select');
          canvas.selection = true;
          canvas.defaultCursor = 'default';
        }
      });
    });

    return () => {
      disposed = true;
      if (canvas) {
        try {
          const baseJson: any = canvas.toJSON(['isOverlay', 'data']);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          baseJson.objects = (canvas.getObjects() as any[]).map((o: any) => o.toObject(['isOverlay', 'data']));
          const json = JSON.stringify(baseJson);
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
    // グリッド・千鳥は cols×rows が個数、フレーム・波は arrangementCount
    const n = (arrangement === 'grid' || arrangement === 'stagger')
      ? Math.max(1, cols) * Math.max(1, rows)
      : arrangementCount;
    const defaultM = 20;

    // 配置エリア
    const area = areaMode === 'custom' && customArea
      ? customArea
      : { left: defaultM, top: defaultM, width: canvasW - defaultM * 2, height: canvasH - defaultM * 2 };

    const placeAt = async (positions: { x: number; y: number }[]) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      beginBatch();
      try {
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
            data: { stampId: sid },
          });
          const naturalSize = Math.max(group.width ?? 1, group.height ?? 1);
          if (naturalSize > 0) group.scale(stampSize / naturalSize);
          canvas.add(group);
        }
        // 配置後に点線枠を削除
        if (areaRectRef.current) {
          canvas.remove(areaRectRef.current);
          areaRectRef.current = null;
        }
        canvas.renderAll();
      } finally {
        endBatch(); // isBatchingRef = false → saveHistory を1回実行
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
      const margin = stampSize / 2;
      const inner = {
        left: area.left + margin,
        top: area.top + margin,
        width: Math.max(1, area.width - margin * 2),
        height: Math.max(1, area.height - margin * 2),
      };
      const fw = inner.width, fh = inner.height;
      const perim = 2 * (fw + fh);
      await placeAt(Array.from({ length: n }, (_, i) => {
        const t = (i / n) * perim;
        if (t < fw)           return { x: inner.left + t,        y: inner.top };
        if (t < fw + fh)      return { x: inner.left + fw,       y: inner.top + (t - fw) };
        if (t < fw * 2 + fh)  return { x: inner.left + fw - (t - fw - fh), y: inner.top + fh };
        return { x: inner.left, y: inner.top + fh - (t - fw * 2 - fh) };
      }));

    } else if (arrangement === 'wave') {
      const amplitude = area.height * 0.25;
      const wavelength = area.width / 3;
      const centerY = area.top + area.height / 2;
      await placeAt(Array.from({ length: n }, (_, i) => {
        const t = n > 1 ? i / (n - 1) : 0;
        const x = area.left + area.width * t;
        const y = centerY + amplitude * Math.sin((x - area.left) / wavelength * Math.PI * 2);
        return { x, y };
      }));
    }
  }, [selectedStamps, stamps, arrangement, arrangementCount, stampSize, cols, rows, areaMode, customArea, beginBatch, endBatch]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ImageClass = fabric.FabricImage ?? fabric.Image;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        const img = await ImageClass.fromURL(dataUrl, { crossOrigin: 'anonymous' });
        const cw = canvas.width as number;
        const ch = canvas.height as number;
        const scale = Math.min(cw / (img.width ?? 1), ch / (img.height ?? 1));
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale });
        canvas.add(img);
        canvas.sendObjectToBack ? canvas.sendObjectToBack(img) : canvas.sendToBack(img);
        canvas.renderAll();
        requestAnimationFrame(() => { canvas.renderAll(); });
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
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    if (active.type === 'activeselection') {
      (active as any).getObjects().forEach((obj: any) => canvas.remove(obj));
      canvas.discardActiveObject();
    } else {
      canvas.remove(active);
    }
    canvas.renderAll();
    saveHistoryRef.current();
  };

  const clearAll = () => {
    if (!fabricRef.current) return;
    beginBatch();
    fabricRef.current.remove(...fabricRef.current.getObjects());
    fabricRef.current.renderAll();
    endBatch();
    localStorage.removeItem('coverdesigner-canvas-state');
  };

  const CLONE_EXTRA_PROPS = [
    '_shapeType', '_msegCorners', '_msegSides', '_msegRadius',
    '_trapTop', '_trapBottom', '_trapHeight',
    '_arcRadius', '_arcStartAngle', '_arcEndAngle',
    '_isFillShape', '_msegChild',
  ];

  const duplicateSelected = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;

    if (active.type === 'activeselection') {
      const objs = (active as any).getObjects();
      const clones: any[] = await Promise.all(objs.map((o: any) => o.clone(CLONE_EXTRA_PROPS)));
      canvas.discardActiveObject();
      clones.forEach(c => { c.set({ left: c.left + 20, top: c.top + 20 }); canvas.add(c); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('fabric');
      const fabric: any = mod.fabric ?? mod.default ?? mod;
      const sel = new fabric.ActiveSelection(clones, { canvas });
      canvas.setActiveObject(sel);
    } else {
      const cloned = await (active as any).clone(CLONE_EXTRA_PROPS);
      cloned.set({ left: active.left + 20, top: active.top + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
    }
    canvas.renderAll();
    saveHistoryRef.current();
  };

  const registerAsStamp = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;

    const name = window.prompt('スタンプ名を入力してください', 'スタンプ');
    if (!name) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('fabric');
    const fabric: any = mod.fabric ?? mod.default ?? mod;

    // fabricJSON に保存するオブジェクトのJSONを生成する。
    // 単一Groupは子要素をキャンバス絶対座標でフラット化して、
    // スタンプエディタで個々の図形として編集できるようにする。
    // mseg図形（_msegCornersあり）は1つのまとまった図形なのでそのまま保存する。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const STAMP_EDITOR_SIZE = 400;
    const buildObjectsJSON = (): any[] => {
      const type = (active as any).type;
      const isPlainGroup = type === 'group' && !(active as any)._msegCorners;

      // ── 単一図形（mseg含む）: left/top を stamp-editor 中心に上書き ──
      // matrix 計算を避け確実に (200, 200) に配置する
      // scaleX/scaleY/angle 等は toObject() の値をそのまま使用
      if (!isPlainGroup && type !== 'activeselection') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = (active as any).toObject(CLONE_EXTRA_PROPS);
        console.debug('[stamp] single', json.type, 'orig left:', json.left, 'top:', json.top);
        return [{
          ...json,
          left:    STAMP_EDITOR_SIZE / 2,
          top:     STAMP_EDITOR_SIZE / 2,
          originX: 'center' as const,
          originY: 'center' as const,
        }];
      }

      // ── activeselection / plainGroup: 各オブジェクトの絶対座標を取得してオフセット ──
      // calcTransformMatrix() でグループ階層を含む canvas 絶対行列を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sources: any[] = (active as any).getObjects();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const absItems = sources.map((obj: any) => {
        const mat = obj.calcTransformMatrix();
        const dec = fabric.util.qrDecompose(mat);
        // getCenterPoint() で originX/Y によらず canvas 絶対中心を取得
        const cp = obj.getCenterPoint();
        console.debug('[stamp] child', obj.type, 'dec.tx:', dec.translateX, 'cp.x:', cp.x);
        return { json: obj.toObject(CLONE_EXTRA_PROPS), cx: cp.x, cy: cp.y, dec };
      });

      // オブジェクト群の重心を stamp-editor キャンバス中心 (200, 200) にオフセット
      const groupCx = absItems.reduce((s, o) => s + o.cx, 0) / absItems.length;
      const groupCy = absItems.reduce((s, o) => s + o.cy, 0) / absItems.length;
      const dx = STAMP_EDITOR_SIZE / 2 - groupCx;
      const dy = STAMP_EDITOR_SIZE / 2 - groupCy;
      console.debug('[stamp] group center:', groupCx, groupCy, 'dx:', dx, 'dy:', dy);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return absItems.map(({ json, cx, cy, dec }: any) => ({
        ...json,
        left:    cx + dx,
        top:     cy + dy,
        scaleX:  dec.scaleX,
        scaleY:  dec.scaleY,
        angle:   dec.angle,
        skewX:   dec.skewX ?? 0,
        skewY:   dec.skewY ?? 0,
        flipX:   (json as any).flipX ?? false,
        flipY:   (json as any).flipY ?? false,
        originX: 'center' as const,
        originY: 'center' as const,
      }));
    };

    // サムネイル生成用クローン（activeselection か単一オブジェクトかに関わらず1グループにまとめる）
    const srcObjects: any[] = (active as any).type === 'activeselection'
      ? (active as any).getObjects()
      : [active];
    const cloned: any[] = await Promise.all(srcObjects.map((o: any) => o.clone(CLONE_EXTRA_PROPS)));

    let thumbnail = '';
    try {
      const thumbEl = document.createElement('canvas');
      const thumbCanvas: any = new fabric.StaticCanvas(thumbEl, { width: 200, height: 200, backgroundColor: '#ffffff' });
      const group = new fabric.Group(cloned);
      const w = group.getScaledWidth?.() ?? group.width ?? 1;
      const h = group.getScaledHeight?.() ?? group.height ?? 1;
      const scale = 160 / Math.max(w, h, 1);
      group.set({ scaleX: scale, scaleY: scale, left: 100, top: 100, originX: 'center', originY: 'center' });
      thumbCanvas.add(group);
      thumbCanvas.renderAll();
      thumbnail = thumbCanvas.toDataURL({ format: 'png', multiplier: 1 });
      thumbCanvas.dispose();
    } catch {
      thumbnail = '';
    }

    const stamp: StampType = {
      id: `stamp-${Date.now()}`,
      name,
      thumbnail,
      fabricJSON: { objects: buildObjectsJSON() },
      createdAt: new Date().toISOString(),
    };
    saveStamp(stamp);
    window.alert(`「${name}」をスタンプとして登録しました`);
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

  const toggleShapeSection = () => {
    if (expandedSection === 'shape' && activeTool === 'polygon') {
      setActiveTool('select');
      activeToolRef.current = 'select';
      if (fabricRef.current) {
        fabricRef.current.selection = true;
        fabricRef.current.defaultCursor = 'default';
      }
    }
    setExpandedSection(s => s === 'shape' ? '' : 'shape');
  };

  // ── 台形 角の丸み ──────────────────────────────────────────────────
  const applyTrapezoidProps = useCallback((topW: number, botW: number, h: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || old._shapeType !== 'trapezoid') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newShape: any;
    if (old._msegCorners) {
      const corners = [
        { x: -topW / 2, y: -h / 2 }, { x: topW / 2, y: -h / 2 },
        { x: botW / 2, y:  h / 2 }, { x: -botW / 2, y:  h / 2 },
      ];
      const radius = old._msegRadius ?? 0;
      const sides  = old._msegSides  ?? [true, true, true, true];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = old.getObjects?.() ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fillChild   = children.find((c: any) => c._isFillShape);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const strokeChild = children.find((c: any) => !c._isFillShape);
      const fill   = fillChild?.fill   ?? 'transparent';
      const stroke = strokeChild?.stroke      ?? '#C9A84C';
      const sw     = strokeChild?.strokeWidth ?? 1.5;
      newShape = buildSegmentGroup(fabric, corners, radius, sides, stroke, sw, fill, {
        left: old.left, top: old.top, angle: old.angle,
        scaleX: old.scaleX, scaleY: old.scaleY, opacity: old.opacity,
        originX: old.originX, originY: old.originY,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShape as any)._shapeType   = 'trapezoid';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShape as any)._msegCorners = corners;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShape as any)._msegRadius  = radius;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShape as any)._msegSides   = sides;
    } else {
      const half = (botW - topW) / 2;
      newShape = new fabric.Polygon(
        [{ x: half, y: 0 }, { x: half + topW, y: 0 }, { x: botW, y: h }, { x: 0, y: h }],
        {
          left: old.left, top: old.top, angle: old.angle,
          scaleX: old.scaleX, scaleY: old.scaleY, opacity: old.opacity,
          stroke: old.stroke, strokeWidth: old.strokeWidth,
          fill: old.fill, strokeUniform: true,
        },
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShape as any)._shapeType  = 'trapezoid';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newShape as any)._trapRadius = old._trapRadius ?? 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newShape as any)._trapTop    = topW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newShape as any)._trapBottom = botW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newShape as any)._trapHeight = h;
    canvas.remove(old);
    canvas.add(newShape);
    canvas.setActiveObject(newShape);
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const applyArcProps = useCallback((r: number, startDeg: number, endDeg: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || old._shapeType !== 'arc') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;
    const p = new fabric.Path(buildArcPath(r, startDeg, endDeg), {
      left: old.left, top: old.top, angle: old.angle,
      scaleX: old.scaleX, scaleY: old.scaleY, opacity: old.opacity,
      stroke: old.stroke, strokeWidth: old.strokeWidth,
      fill: 'transparent', strokeUniform: true,
      originX: old.originX, originY: old.originY,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._shapeType    = 'arc';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._arcRadius    = r;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._arcStartAngle = startDeg;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any)._arcEndAngle  = endDeg;
    canvas.remove(old);
    canvas.add(p);
    canvas.setActiveObject(p);
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const applyDotRadius = useCallback((r: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active: any = canvas?.getActiveObject();
    if (!canvas || !active || active._shapeType !== 'dot') return;
    active.set({ radius: r });
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const applyTextProp = useCallback((props: Record<string, unknown>) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active: any = canvas?.getActiveObject();
    if (!canvas || !active) return;
    active.set(props);
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const applyFontSize   = useCallback((v: number) => { setFontSize(v);   applyTextProp({ fontSize: v }); }, [applyTextProp]);
  const applyFontFamily = useCallback((v: string) => { setFontFamily(v); applyTextProp({ fontFamily: v }); }, [applyTextProp]);
  const toggleBold      = useCallback(() => setIsBold(prev => { const next = !prev; applyTextProp({ fontWeight: next ? 'bold' : 'normal' }); return next; }), [applyTextProp]);
  const toggleItalic    = useCallback(() => setIsItalic(prev => { const next = !prev; applyTextProp({ fontStyle: next ? 'italic' : 'normal' }); return next; }), [applyTextProp]);
  const toggleUnderline = useCallback(() => setIsUnderline(prev => { const next = !prev; applyTextProp({ underline: next }); return next; }), [applyTextProp]);
  const toggleVertical  = useCallback(() => setIsVertical(prev => { const next = !prev; applyTextProp({ direction: next ? 'rtl' : 'ltr' }); return next; }), [applyTextProp]);

  const updateLineEndpoint = useCallback((endpoint: 1 | 2, axis: 'x' | 'y', value: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const line: any = canvas?.getActiveObject();
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
    const newMatrix = line.calcTransformMatrix();
    const np1 = fabric.util.transformPoint({ x: line.x1, y: line.y1 }, newMatrix);
    const np2 = fabric.util.transformPoint({ x: line.x2, y: line.y2 }, newMatrix);
    setLineCoords({ ax1: Math.round(np1.x), ay1: Math.round(np1.y), ax2: Math.round(np2.x), ay2: Math.round(np2.y) });
    canvas.renderAll();
    saveHistoryRef.current();
  }, []);

  const applyTrapezoidRadius = useCallback(async (radius: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || old._shapeType !== 'trapezoid' || old._msegCorners) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('fabric');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = mod.fabric ?? mod.default ?? mod;
    const topW = old._trapTop ?? 60;
    const botW = old._trapBottom ?? 90;
    const h    = old._trapHeight ?? 50;
    const half = (botW - topW) / 2;
    const points: { x: number; y: number }[] = old._trapPoints ?? [
      { x: half, y: 0 }, { x: half + topW, y: 0 }, { x: botW, y: h }, { x: 0, y: h },
    ];
    const pathStr = roundedPolygonPath(points, radius);
    const newPath = new fabric.Path(pathStr, {
      left: old.left, top: old.top, angle: old.angle,
      scaleX: old.scaleX, scaleY: old.scaleY, opacity: old.opacity,
      stroke: old.stroke, strokeWidth: old.strokeWidth,
      fill: old.fill, strokeUniform: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._shapeType = 'trapezoid';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._trapTop    = topW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._trapBottom = botW;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._trapHeight = h;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._trapPoints = points;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._trapRadius = radius;
    canvas.remove(old);
    canvas.add(newPath);
    canvas.setActiveObject(newPath);
    canvas.renderAll();
    setSelTrapRx(radius);
    setIsTrapezoid(true);
    saveHistoryRef.current();
  }, []);

  // ── 菱形 角の丸み ──────────────────────────────────────────────────
  const applyDiamondRadius = useCallback(async (radius: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || old._shapeType !== 'h-diamond' || old._msegCorners) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('fabric');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = mod.fabric ?? mod.default ?? mod;
    const W = 60, H = Math.round(W * Math.sqrt(3));
    const points: { x: number; y: number }[] = old._diamondPoints ?? [
      { x: W / 2, y: 0 }, { x: W, y: H / 2 }, { x: W / 2, y: H }, { x: 0, y: H / 2 },
    ];
    const pathStr = roundedPolygonPath(points, radius);
    const newPath = new fabric.Path(pathStr, {
      left: old.left, top: old.top, angle: old.angle,
      scaleX: old.scaleX, scaleY: old.scaleY, opacity: old.opacity,
      stroke: old.stroke, strokeWidth: old.strokeWidth,
      fill: old.fill, strokeUniform: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._shapeType = 'h-diamond';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._diamondPoints = points;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._diamondRadius = radius;
    canvas.remove(old);
    canvas.add(newPath);
    canvas.setActiveObject(newPath);
    canvas.renderAll();
    setSelTrapRx(radius);
    setIsDiamond(true);
    saveHistoryRef.current();
  }, []);

  // ── 三角形 角の丸み ────────────────────────────────────────────────
  const applyTriangleRadius = useCallback(async (radius: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || old._shapeType !== 'triangle' || old._msegCorners) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('fabric');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = mod.fabric ?? mod.default ?? mod;
    const SIDE = 80, HEIGHT = Math.round(SIDE * (Math.sqrt(3) / 2));
    const points: { x: number; y: number }[] = old._trianglePoints ?? [
      { x: SIDE / 2, y: 0 }, { x: SIDE, y: HEIGHT }, { x: 0, y: HEIGHT },
    ];
    const pathStr = roundedPolygonPath(points, radius);
    const newPath = new fabric.Path(pathStr, {
      left: old.left, top: old.top, angle: old.angle,
      scaleX: old.scaleX, scaleY: old.scaleY, opacity: old.opacity,
      stroke: old.stroke, strokeWidth: old.strokeWidth,
      fill: old.fill, strokeUniform: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._shapeType = 'triangle';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._trianglePoints = points;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newPath as any)._triangleRadius = radius;
    canvas.remove(old);
    canvas.add(newPath);
    canvas.setActiveObject(newPath);
    canvas.renderAll();
    setSelTrapRx(radius);
    setIsTriangle(true);
    saveHistoryRef.current();
  }, []);

  // ── 4辺図形 辺の表示切替 ──────────────────────────────────────────
  const toggleRectSide = useCallback((side: 'top' | 'right' | 'bottom' | 'left') => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active: any = canvas?.getActiveObject();
    if (!canvas || !active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;

    const newSides = { ...rectSides, [side]: !rectSides[side] };
    setRectSides(newSides);

    // 中心揃え済み4頂点を取得
    let pts: { x: number; y: number }[];
    let stroke: string, strokeWidth: number;
    if (active._shapeType === 'rect-sides') {
      pts = active._sidePoints ?? (() => {
        const hw = (active._rectW ?? 60) / 2, hh = (active._rectH ?? 60) / 2;
        return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
      })();
      stroke = active._rectStroke ?? '#C9A84C'; strokeWidth = active._rectStrokeW ?? 1.5;
    } else if (active.type === 'rect') {
      const hw = (active.width ?? 60) / 2, hh = (active.height ?? 60) / 2;
      pts = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
      stroke = active.stroke ?? '#C9A84C'; strokeWidth = active.strokeWidth ?? 1.5;
    } else if (active.type === 'polygon') {
      // Fabric v6+ の polygon.points は中心揃え済み
      pts = active.points as { x: number; y: number }[];
      stroke = active.stroke ?? '#C9A84C'; strokeWidth = active.strokeWidth ?? 1.5;
    } else {
      return;
    }
    if (pts.length !== 4) return;

    const angle = active.angle ?? 0, scaleX = active.scaleX ?? 1, scaleY = active.scaleY ?? 1, opacity = active.opacity ?? 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const center: { x: number; y: number } = active.getCenterPoint?.() ?? { x: active.left, y: active.top };
    const sideKeys: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
    const lineOpts = { stroke, strokeWidth, strokeUniform: true, fill: 'transparent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: any[] = [];
    for (let i = 0; i < 4; i++) {
      if (newSides[sideKeys[i]]) {
        const p1 = pts[i], p2 = pts[(i + 1) % 4];
        lines.push(new fabric.Line([p1.x, p1.y, p2.x, p2.y], lineOpts));
      }
    }

    if (lines.length === 0) {
      canvas.remove(active);
      canvas.renderAll();
      saveHistoryRef.current();
      return;
    }

    const group = new fabric.Group(lines, {
      left: center.x, top: center.y, originX: 'center', originY: 'center',
      angle, scaleX, scaleY, opacity,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._shapeType = 'rect-sides';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._sidePoints = pts;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._rectStroke = stroke;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._rectStrokeW = strokeWidth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._rectSides = newSides;
    canvas.remove(active);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    setIsRect(false);
    setIsFourSidedPoly(false);
    setIsRectSides(true);
    saveHistoryRef.current();
  }, [rectSides]);

  // ── mseg 角の丸み ──────────────────────────────────────────────────
  const applyMsegRadius = useCallback((radius: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || !old._msegCorners) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;
    const corners = old._msegCorners as { x: number; y: number }[];
    const sides   = old._msegSides   as boolean[];
    const children: any[] = old.getObjects?.() ?? [];
    const fillChild  = children.find((c: any) => c._isFillShape);
    const strokeChild = children.find((c: any) => !c._isFillShape);
    const fill   = fillChild?.fill   ?? 'transparent';
    const stroke = strokeChild?.stroke      ?? '#C9A84C';
    const sw     = strokeChild?.strokeWidth ?? 1.5;
    const newGroup = buildSegmentGroup(fabric, corners, radius, sides, stroke, sw, fill, {
      left: old.left, top: old.top, angle: old.angle ?? 0,
      scaleX: old.scaleX ?? 1, scaleY: old.scaleY ?? 1, opacity: old.opacity ?? 1,
      originX: old.originX ?? 'left', originY: old.originY ?? 'top',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._shapeType   = old._shapeType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._msegCorners = corners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._msegRadius  = radius;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._msegSides   = sides;
    if (old._trapTop !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._trapTop    = old._trapTop;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._trapBottom = old._trapBottom;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._trapHeight = old._trapHeight;
    }
    canvas.remove(old);
    canvas.add(newGroup);
    canvas.setActiveObject(newGroup);
    canvas.renderAll();
    setMsegRadius(radius);
    saveHistoryRef.current();
  }, []);

  // ── mseg 辺の表示切替 ──────────────────────────────────────────────
  const toggleMsegSide = useCallback((idx: number) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const old: any = canvas?.getActiveObject();
    if (!canvas || !old || !old._msegCorners) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;
    const corners = old._msegCorners as { x: number; y: number }[];
    const radius  = old._msegRadius  as number ?? 0;
    const newSides = [...(old._msegSides as boolean[])];
    newSides[idx] = !newSides[idx];
    const children: any[] = old.getObjects?.() ?? [];
    const fillChild  = children.find((c: any) => c._isFillShape);
    const strokeChild = children.find((c: any) => !c._isFillShape);
    const fill   = fillChild?.fill   ?? 'transparent';
    const stroke = strokeChild?.stroke      ?? '#C9A84C';
    const sw     = strokeChild?.strokeWidth ?? 1.5;
    const newGroup = buildSegmentGroup(fabric, corners, radius, newSides, stroke, sw, fill, {
      left: old.left, top: old.top, angle: old.angle ?? 0,
      scaleX: old.scaleX ?? 1, scaleY: old.scaleY ?? 1, opacity: old.opacity ?? 1,
      originX: old.originX ?? 'left', originY: old.originY ?? 'top',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._shapeType   = old._shapeType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._msegCorners = corners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._msegRadius  = radius;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newGroup as any)._msegSides   = newSides;
    if (old._trapTop !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._trapTop    = old._trapTop;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._trapBottom = old._trapBottom;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newGroup as any)._trapHeight = old._trapHeight;
    }
    canvas.remove(old);
    canvas.add(newGroup);
    canvas.setActiveObject(newGroup);
    canvas.renderAll();
    setMsegSides(newSides);
    saveHistoryRef.current();
  }, []);

  // ── 三角形 辺の表示切替 ──────────────────────────────────────────
  const toggleTriSide = useCallback((key: 's0' | 's1' | 's2') => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active: any = canvas?.getActiveObject();
    if (!canvas || !active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric: any = (canvas as any)._fabric;
    if (!fabric) return;

    const newSides = { ...triSides, [key]: !triSides[key] };
    setTriSides(newSides);

    let pts: { x: number; y: number }[];
    let stroke: string, strokeWidth: number;
    if (active._shapeType === 'tri-sides') {
      pts = active._triSidePoints ?? [];
      stroke = active._triStroke ?? '#C9A84C'; strokeWidth = active._triStrokeW ?? 1.5;
    } else if (active._shapeType === 'triangle' && active.type === 'polygon') {
      pts = active.points as { x: number; y: number }[];
      stroke = active.stroke ?? '#C9A84C'; strokeWidth = active.strokeWidth ?? 1.5;
    } else {
      return;
    }
    if (pts.length !== 3) return;

    const angle = active.angle ?? 0, scaleX = active.scaleX ?? 1, scaleY = active.scaleY ?? 1, opacity = active.opacity ?? 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const center: { x: number; y: number } = active.getCenterPoint?.() ?? { x: active.left, y: active.top };
    const sideKeys: ('s0' | 's1' | 's2')[] = ['s0', 's1', 's2'];
    const lineOpts = { stroke, strokeWidth, strokeUniform: true, fill: 'transparent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: any[] = [];
    for (let i = 0; i < 3; i++) {
      if (newSides[sideKeys[i]]) {
        const p1 = pts[i], p2 = pts[(i + 1) % 3];
        lines.push(new fabric.Line([p1.x, p1.y, p2.x, p2.y], lineOpts));
      }
    }

    if (lines.length === 0) {
      canvas.remove(active);
      canvas.renderAll();
      saveHistoryRef.current();
      return;
    }

    const group = new fabric.Group(lines, {
      left: center.x, top: center.y, originX: 'center', originY: 'center',
      angle, scaleX, scaleY, opacity,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._shapeType = 'tri-sides';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._triSidePoints = pts;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._triStroke = stroke;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._triStrokeW = strokeWidth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (group as any)._triSides = newSides;
    canvas.remove(active);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    setShowTriSideToggle(true);
    saveHistoryRef.current();
  }, [triSides]);

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

      const flapH = (currentTotalW - BOOK_W * 2 - SPINE_W) / 2;
      const flapV = (currentTotalH - BOOK_H) / 2;
      const bodyStartXmm = flapH;
      const bodyStartYmm = Math.max(0, flapV);

      const frontStartPx  = Math.round(imgW * bodyStartXmm / currentTotalW);
      const frontWidthPx  = Math.round(imgW * BOOK_W / currentTotalW);
      const spineStartPx  = Math.round(imgW * (bodyStartXmm + BOOK_W) / currentTotalW);
      const spineWidthPx  = Math.round(imgW * SPINE_W / currentTotalW);
      const bookStartPxY  = Math.round(imgH * bodyStartYmm / currentTotalH);
      const bookHeightPxY = Math.round(imgH * Math.min(BOOK_H, currentTotalH) / currentTotalH);
      // 縦横比を保った表紙の表示幅（HEIGHT=260を縦の基準にして横を合わせる）
      const dispFrontW = Math.round(frontWidthPx * 260 / bookHeightPxY);

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
      ctx.lineTo(spineRight + dispFrontW, 70);
      // 小口側の辺：外側に膨らむ曲線で上辺へ
      ctx.quadraticCurveTo(spineRight + dispFrontW - 8, 62, spineRight + dispFrontW - 30, 55);
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
        const rx = (spineRight + dispFrontW - 30) + 30 * t - 8 * t * (1 - t) * 2;
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
      const frontScale = 260 / bookHeightPxY;
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


      // 背表紙：外側クリップ確定 → 下地（保険）→ 画像（すべて同じパス基準・同一save内）
      // 底辺はlineTo（直線）：シアー変換後の画像底辺も対角直線のため、Bezierにすると隙間が生じる
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(spineLeft, 55);
      ctx.quadraticCurveTo(spineLeft - 4, 59, spineRight, 70);
      ctx.lineTo(spineRight, 330);
      ctx.lineTo(spineLeft, 315);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#3a3a3a';
      ctx.fill();
      // 画像描画：シアー変換 → 内側クリップ（spineLeft-4まで拡張）→ 画像
      ctx.transform(1, 15 / previewSpineW, 0, 1, spineLeft, 55);
      const SHEAR_COMPENSATE = 80;
      const leftExt = 4;  // 外側クリップの最大張り出し点（spineLeft-4）まで確実にカバー
      const dh = 260;
      const sh = Math.min(bookHeightPxY, imgH - bookStartPxY);
      ctx.beginPath();
      ctx.rect(-leftExt, 80 - SHEAR_COMPENSATE, previewSpineW + leftExt, dh);
      ctx.clip();
      ctx.scale(-1, 1);
      ctx.drawImage(
        img,
        sx, bookStartPxY,
        sw * (previewSpineW + leftExt) / previewSpineW,
        sh,
        -previewSpineW, 80 - SHEAR_COMPENSATE,
        previewSpineW + leftExt, dh
      );
      ctx.restore();

      // 背表紙：縁取り
      ctx.beginPath();
      ctx.moveTo(spineLeft, 55);
      ctx.quadraticCurveTo(spineLeft - 4, 59, spineRight, 70);
      ctx.lineTo(spineRight, 330);
      ctx.lineTo(spineLeft, 315);
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
      ctx.lineTo(spineLeft, 315);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 表紙：画像幅を先に確定（背表紙の食い込み分を差し引く）
      const spineOverlap = (sw - spineWidthPx) / 2 + OFFSET;
      const frontWidthPxAdjusted = frontWidthPx - spineOverlap;
      const dispFrontWExact = Math.round(frontWidthPxAdjusted * 260 / bookHeightPxY);

      // 表紙：白塗り + 縁取り（画像と同じ幅で描画して小口側の白余白を防ぐ）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(spineRight, 70, dispFrontWExact, 260);
      ctx.strokeStyle = '#C0B8A8';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(spineRight, 70, dispFrontWExact, 260);

      // 表紙：画像（鏡文字打ち消し）
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(img, frontStartPx, bookStartPxY, frontWidthPxAdjusted, bookHeightPxY,
        -(spineRight + dispFrontWExact), 70, dispFrontWExact, 260);
      ctx.restore();

      ctx.restore();
      // ===== 反転ここまで =====

    };
    img.src = dataUrl;
  }, [currentTotalW, currentTotalH]);

  useEffect(() => {
    if (showPreview && previewDataUrl) drawPreview(previewDataUrl);
  }, [showPreview, previewDataUrl, drawPreview]);

  const exportDesign = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = canvas.toJSON(['isOverlay', 'data']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json.objects = (canvas.getObjects() as any[]).map((o: any) => o.toObject(['isOverlay', 'data']));
    const data = {
      canvas: json,
      backgroundColor: bgColorRef.current,
      totalW: currentTotalW,
      totalH: currentTotalH,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-design-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDesign = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        isBatchingRef.current = true;
        await fabricRef.current!.loadFromJSON(data.canvas);
        const newBg = data.backgroundColor || '#ffffff';
        bgColorRef.current = newBg;
        setBgColor(newBg);
        fabricRef.current!.backgroundColor = newBg;
        if (data.totalW) setCurrentTotalW(data.totalW);
        if (data.totalH) setCurrentTotalH(data.totalH);
        fabricRef.current!.renderAll();
        isBatchingRef.current = false;
        migrateOldMsegShapesRef.current();
        saveHistoryRef.current();
      } catch {
        alert('ファイルの読み込みに失敗しました');
        isBatchingRef.current = false;
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const ARRANGEMENTS: { id: ArrangementType; icon: React.ReactNode; label: string }[] = [
    { id: 'grid',       icon: <Grid size={14} />,        label: 'グリッド' },
    { id: 'stagger',    icon: <Shuffle size={14} />,     label: '千鳥' },
    { id: 'frame',      icon: <Frame size={14} />,       label: 'フレーム' },
    { id: 'wave',        icon: <Waves size={14} />,        label: '波' },
  ];

  return (
    <div style={{ height: '100vh', overflowX: 'auto', overflowY: 'hidden', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', minWidth: 'fit-content' }}>
      <AppHeader>
        {/* ① 編集系 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => { const next = !snapOn; setSnapOn(next); snapOnRef.current = next; }}
            title={snapOn ? 'スナップON' : 'スナップOFF'}
            style={S.tbBtn(snapOn)}
            onMouseEnter={e => { if (!snapOn) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (!snapOn) e.currentTarget.style.background = '#1A3358'; }}>
            <Magnet size={14} />
          </button>
          <button onClick={undo} disabled={!canUndo} title="元に戻す (Ctrl+Z)"
            style={{ ...S.tbBtn(), opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (canUndo) e.currentTarget.style.background = '#1A3358'; }}>
            <Undo2 size={14} />
          </button>
          <button
            onClick={() => { if (!window.confirm('すべて削除しますか？')) return; clearAll(); }}
            title="全クリア"
            style={{ ...S.tbBtn(), color: '#6B7A99' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2A1A1A'; e.currentTarget.style.color = '#E05A5A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1A3358'; e.currentTarget.style.color = '#6B7A99'; }}>
            <Trash2 size={14} />
          </button>
        </div>

        <div style={{ width: 1, height: 20, background: '#2A4570' }} />

        {/* ② 表示系 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setShowSizeModal(true)} title="サイズ変更"
            style={{ ...S.tbBtn(), minWidth: 'fit-content' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1A3358'; }}>
            <Maximize2 size={14} />
            <span style={{ color: '#C9A84C' }}>{currentTotalW}×{currentTotalH}mm</span>
          </button>
          <button onClick={openPreview} style={S.tbBtn()}
            onMouseEnter={e => { e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1A3358'; }}>
            <BookOpen size={14} /> プレビュー
          </button>
        </div>

        <div style={{ width: 1, height: 20, background: '#2A4570' }} />

        {/* ③ 出力系（ドロップダウン） */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExportMenu(v => !v)} style={{ ...S.tbBtn(showExportMenu), gap: 6 }}
            onMouseEnter={e => { if (!showExportMenu) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (!showExportMenu) e.currentTarget.style.background = '#1A3358'; }}>
            <Download size={14} /> 書き出し <ChevronDown size={11} />
          </button>
          {showExportMenu && (
            <>
              {/* オーバーレイ（クリック外で閉じる） */}
              <div onClick={() => setShowExportMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: '#1A3358', border: '1px solid #2A4570',
                borderRadius: 6, padding: 4, minWidth: 180, zIndex: 100,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
                {[
                  { label: 'JPEGで書き出し',            icon: <Download size={12} />, action: () => { exportJPEG();      setShowExportMenu(false); } },
                  { label: 'PDFで書き出し',              icon: <Download size={12} />, action: () => { exportPDF();       setShowExportMenu(false); } },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#2A4570'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                    {item.icon}{item.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid #2A4570', margin: '4px 0' }} />
                <button onClick={() => { exportDesign(); setShowExportMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2A4570'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                  <FileJson size={12} />デザインを書き出し（JSON）
                </button>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', color: 'var(--text)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2A4570'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                  <Upload size={12} />デザインを読み込み（JSON）
                  <input type="file" accept=".json" onChange={e => { importDesign(e); setShowExportMenu(false); }} style={{ display: 'none' }} />
                </label>
              </div>
            </>
          )}
        </div>
      </AppHeader>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ width: 200, minWidth: 200, maxWidth: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable', flexShrink: 0 }}>

          {/* 1. 背景色 — 常時表示 */}
          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ ...S.label, marginBottom: 4 }}>背景色</div>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
              style={{ width: '100%', height: 32, borderRadius: 6 }} />
          </div>

          {/* 2. スタンプ（タブ切り替え） */}
          <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)' }}>
            {/* タブ */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, borderBottom: '1px solid #2A4570' }}>
              <button
                onClick={() => setStampTab('single')}
                style={{
                  flex: 1, padding: '6px 0',
                  color: stampTab === 'single' ? '#C9A84C' : '#6B7A99',
                  borderBottom: stampTab === 'single' ? '2px solid #C9A84C' : '2px solid transparent',
                  background: 'transparent', border: 'none',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                単独配置
              </button>
              <button
                onClick={() => setStampTab('arrange')}
                style={{
                  flex: 1, padding: '6px 0',
                  color: stampTab === 'arrange' ? '#C9A84C' : '#6B7A99',
                  borderBottom: stampTab === 'arrange' ? '2px solid #C9A84C' : '2px solid transparent',
                  background: 'transparent', border: 'none',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                均等配置
              </button>
            </div>

            {/* 単独配置タブ */}
            {stampTab === 'single' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
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
            )}

            {/* 均等配置タブ */}
            {stampTab === 'arrange' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <NumberStepper label="サイズ" value={stampSize} onChange={setStampSize} min={10} max={300} step={5} />
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
                    <div style={{ fontSize: 10, color: customArea ? '#C9A84C' : '#888' }}>
                      {customArea
                        ? `選択範囲: ${Math.round(customArea.width)}×${Math.round(customArea.height)}px`
                        : 'ドラッグでエリアを選択してください'}
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
            )}
          </div>

          {/* 3. 図形 — 常時表示 */}
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ ...S.sectionTitle, padding: '10px 0 6px' }}>図形</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
              {SHAPE_TOOLS.map(t => {
                const isActive = activeTool === t.id;
                const btnStyle = {
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                  gap: 2, padding: '5px 2px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--accent)' : 'var(--bg)',
                  color: isActive ? '#1A1A1A' : 'var(--text)',
                  fontSize: 8, fontWeight: 600, width: '100%',
                };
                if (t.id === 'triangle') {
                  const miniBtn = (active: boolean) => ({ width: 22, height: 16, border: '1px solid var(--border)', borderRadius: 3, background: active ? '#C9A84C' : 'var(--bg)', color: active ? '#1A1A1A' : 'var(--text)', cursor: 'pointer', fontSize: 9, fontWeight: 700, padding: 0, lineHeight: 1 } as const);
                  return (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => setTool(isActive ? 'select' : 'triangle')} title={t.title} style={btnStyle}>
                        {t.icon}三角
                      </button>
                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <button onClick={() => setTriangleType('equilateral')} style={miniBtn(triangleType === 'equilateral')}>正</button>
                          <button onClick={() => setTriangleType('right')}       style={miniBtn(triangleType === 'right')}>直</button>
                        </div>
                      )}
                    </div>
                  );
                }
                if (t.id === 'polygon') {
                  return (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => setTool(isActive ? 'select' : 'polygon')} title={t.title} style={btnStyle}>
                        {t.icon}多角
                      </button>
                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
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
                  <button key={t.id} onClick={() => setTool(isActive && t.id !== 'select' ? 'select' : t.id)}
                    title={t.title} style={btnStyle}>
                    {t.icon}
                    {t.title.length <= 3 ? t.title : t.title.slice(0, 3)}
                  </button>
                );
              })}
              {/* 画像アップロード（ツール一覧末尾） */}
              <label title="画像をアップロード" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '5px 2px', borderRadius: 6, cursor: 'pointer',
                background: 'var(--bg)', color: 'var(--text)', fontSize: 8, fontWeight: 600,
              }}>
                <ImageIcon size={14} />
                画像
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
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

        </div>

        {/* Canvas */}
        <div ref={canvasContainerRef} style={{ flex: 1, background: '#111', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, cursor: activeTool === 'select' ? 'default' : 'crosshair' }}>
          <div style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)', flexShrink: 0 }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Right panel — プロパティ */}
        <div style={{ width: 176, minWidth: 176, maxWidth: 176, background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', scrollbarGutter: 'stable', flexShrink: 0 }}>
          {!hasSelection ? (
            <div style={{ padding: 16, fontSize: 11, color: '#555', textAlign: 'center', marginTop: 24 }}>
              オブジェクトを<br />選択してください
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* 塗り色・線色・線幅（スタンプ以外のみ） */}
              {!isStamp && (
                <>
                  <div style={{ ...S.sectionTitle, borderTop: 'none' }}>塗り色</div>
                  <div style={{ padding: '0 12px 8px' }}>
                    <input type="color" value={selFill}
                      onChange={e => { setSelFill(e.target.value); applySelProp({ fill: e.target.value }); }}
                      style={{ width: '100%', height: 28, borderRadius: 6, cursor: 'pointer' }} />
                  </div>

                  <div style={S.sectionTitle}>線色</div>
                  <div style={{ padding: '0 12px 8px' }}>
                    <input type="color" value={selStroke}
                      onChange={e => { setSelStroke(e.target.value); applySelProp({ stroke: e.target.value }); }}
                      style={{ width: '100%', height: 28, borderRadius: 6, cursor: 'pointer' }} />
                  </div>

                  <div style={S.sectionTitle}>線幅</div>
                  <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => { const v = Math.max(0, selStrokeW - 1); setSelStrokeW(v); applySelProp({ strokeWidth: v }); }}
                      style={S.iconBtn()}><Minus size={12} /></button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selStrokeW}</span>
                    <button onClick={() => { const v = selStrokeW + 1; setSelStrokeW(v); applySelProp({ strokeWidth: v }); }}
                      style={S.iconBtn()}><Plus size={12} /></button>
                  </div>

                  {isMseg && (() => {
                    const sideBtn = (active: boolean): React.CSSProperties => ({
                      background: active ? 'var(--accent)' : 'var(--bg)',
                      color: active ? '#1A1A1A' : 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      cursor: 'pointer', fontSize: 10, fontWeight: 600,
                      padding: 0, width: 28, height: 24,
                    });
                    const isTriMseg = msegSides.length === 3;
                    return (
                      <>
                        <div style={S.sectionTitle}>角の丸み</div>
                        <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => applyMsegRadius(Math.max(0, msegRadius - 2))} style={S.iconBtn()}><Minus size={12} /></button>
                          <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{msegRadius}</span>
                          <button onClick={() => applyMsegRadius(msegRadius + 2)} style={S.iconBtn()}><Plus size={12} /></button>
                        </div>
                        <div style={S.sectionTitle}>辺の表示</div>
                        {isTriMseg ? (
                          <div style={{ padding: '0 12px 10px', display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => toggleMsegSide(0)} style={sideBtn(msegSides[0])}>左</button>
                            <button onClick={() => toggleMsegSide(1)} style={sideBtn(msegSides[1])}>底</button>
                            <button onClick={() => toggleMsegSide(2)} style={sideBtn(msegSides[2])}>右</button>
                          </div>
                        ) : (
                          <div style={{ padding: '0 12px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gridTemplateRows: 'repeat(3, 24px)', gap: 2, justifyContent: 'center' }}>
                            <div /><button onClick={() => toggleMsegSide(0)} style={sideBtn(msegSides[0])}>上</button><div />
                            <button onClick={() => toggleMsegSide(3)} style={sideBtn(msegSides[3])}>左</button><div /><button onClick={() => toggleMsegSide(1)} style={sideBtn(msegSides[1])}>右</button>
                            <div /><button onClick={() => toggleMsegSide(2)} style={sideBtn(msegSides[2])}>下</button><div />
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {isRect && (
                    <>
                      <div style={S.sectionTitle}>角の丸み</div>
                      <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => {
                          const v = Math.max(0, selRx - 2);
                          setSelRx(v);
                          applySelProp({ rx: v, ry: v });
                          saveHistoryRef.current();
                        }} style={S.iconBtn()}><Minus size={12} /></button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selRx}</span>
                        <button onClick={() => {
                          const v = selRx + 2;
                          setSelRx(v);
                          applySelProp({ rx: v, ry: v });
                          saveHistoryRef.current();
                        }} style={S.iconBtn()}><Plus size={12} /></button>
                      </div>
                    </>
                  )}

                  {isTrapezoid && (
                    <>
                      <div style={S.sectionTitle}>台形</div>
                      <div style={{ padding: '0 12px 8px' }}>
                        {([
                          { label: '上辺', value: trapTop,    set: (v: number) => { setTrapTop(v);    applyTrapezoidProps(v, trapBottom, trapHeight); } },
                          { label: '下辺', value: trapBottom, set: (v: number) => { setTrapBottom(v); applyTrapezoidProps(trapTop, v, trapHeight); } },
                          { label: '高さ', value: trapHeight, set: (v: number) => { setTrapHeight(v); applyTrapezoidProps(trapTop, trapBottom, v); } },
                        ] as { label: string; value: number; set: (v: number) => void }[]).map(({ label, value, set }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: '#888', width: 26 }}>{label}</span>
                            <input type="number" min={1} max={200} value={value}
                              onChange={e => set(Number(e.target.value))}
                              style={{ width: 52, padding: '3px 5px', textAlign: 'center', fontSize: 11,
                                background: 'var(--bg)', color: 'var(--text)',
                                border: '1px solid var(--border)', borderRadius: 4 }} />
                            <span style={{ fontSize: 11, color: '#888' }}>px</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {isArc && (
                    <>
                      <div style={S.sectionTitle}>円弧</div>
                      <div style={{ padding: '0 12px 8px' }}>
                        {([
                          { label: '半径',   value: arcRadius,     min: 1,    max: 300, unit: 'px', set: (v: number) => { setArcRadius(v);     applyArcProps(v, arcStartAngle, arcEndAngle); } },
                          { label: '開始角', value: arcStartAngle, min: -360, max: 360, unit: '°',  set: (v: number) => { setArcStartAngle(v); applyArcProps(arcRadius, v, arcEndAngle); } },
                          { label: '終了角', value: arcEndAngle,   min: -360, max: 360, unit: '°',  set: (v: number) => { setArcEndAngle(v);   applyArcProps(arcRadius, arcStartAngle, v); } },
                        ] as { label: string; value: number; min: number; max: number; unit: string; set: (v: number) => void }[]).map(({ label, value, min, max, unit, set }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: '#888', width: 36 }}>{label}</span>
                            <input type="number" min={min} max={max} value={value}
                              onChange={e => set(Number(e.target.value))}
                              style={{ width: 52, padding: '3px 5px', textAlign: 'center', fontSize: 11,
                                background: 'var(--bg)', color: 'var(--text)',
                                border: '1px solid var(--border)', borderRadius: 4 }} />
                            <span style={{ fontSize: 11, color: '#888' }}>{unit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {isDot && (
                    <>
                      <div style={S.sectionTitle}>点</div>
                      <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#888', width: 26 }}>半径</span>
                        <input type="range" min={1} max={30} value={dotRadius}
                          onChange={e => { const r = Number(e.target.value); setDotRadius(r); applyDotRadius(r); }}
                          style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, width: 24, textAlign: 'center' }}>{dotRadius}</span>
                      </div>
                    </>
                  )}

                  {isTextObj && (
                    <>
                      <div style={S.sectionTitle}>テキスト</div>
                      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>フォント</div>
                          <select value={fontFamily} onChange={e => applyFontFamily(e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 11,
                              background: 'var(--bg)', color: 'var(--text)',
                              border: '1px solid var(--border)', borderRadius: 4, appearance: 'none' as const }}>
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                            <span>サイズ</span><span style={{ color: 'var(--accent)' }}>{fontSize}px</span>
                          </div>
                          <input type="range" min={8} max={120} value={fontSize}
                            onChange={e => applyFontSize(Number(e.target.value))}
                            style={{ width: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {([
                            { icon: <Bold size={14} />,      active: isBold,      toggle: toggleBold,      title: '太字' },
                            { icon: <Italic size={14} />,    active: isItalic,    toggle: toggleItalic,    title: '斜体' },
                            { icon: <Underline size={14} />, active: isUnderline, toggle: toggleUnderline, title: '下線' },
                            { icon: <AlignLeft size={14} />, active: isVertical,  toggle: toggleVertical,  title: '縦書き' },
                          ] as { icon: React.ReactNode; active: boolean; toggle: () => void; title: string }[]).map((item, i) => (
                            <button key={i} title={item.title} onClick={item.toggle}
                              style={{ flex: 1, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                                background: item.active ? 'var(--accent)' : 'var(--bg)',
                                color: item.active ? '#0F2340' : 'var(--text)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {item.icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {lineCoords !== null && (
                    <>
                      <div style={S.sectionTitle}>始点 / 終点</div>
                      <div style={{ padding: '0 12px 8px' }}>
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>始点</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: '#888', width: 14 }}>X</span>
                          <input type="number" value={lineCoords.ax1}
                            onChange={e => updateLineEndpoint(1, 'x', Number(e.target.value))}
                            style={{ width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11,
                              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }} />
                          <span style={{ fontSize: 11, color: '#888', width: 14 }}>Y</span>
                          <input type="number" value={lineCoords.ay1}
                            onChange={e => updateLineEndpoint(1, 'y', Number(e.target.value))}
                            style={{ width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11,
                              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>終点</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#888', width: 14 }}>X</span>
                          <input type="number" value={lineCoords.ax2}
                            onChange={e => updateLineEndpoint(2, 'x', Number(e.target.value))}
                            style={{ width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11,
                              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }} />
                          <span style={{ fontSize: 11, color: '#888', width: 14 }}>Y</span>
                          <input type="number" value={lineCoords.ay2}
                            onChange={e => updateLineEndpoint(2, 'y', Number(e.target.value))}
                            style={{ width: 54, padding: '3px 5px', textAlign: 'center', fontSize: 11,
                              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }} />
                        </div>
                      </div>
                    </>
                  )}

                  {isTrapezoid && !isMseg && (
                    <>
                      <div style={S.sectionTitle}>角の丸み</div>
                      <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => applyTrapezoidRadius(Math.max(0, selTrapRx - 2))}
                          style={S.iconBtn()}><Minus size={12} /></button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selTrapRx}</span>
                        <button onClick={() => applyTrapezoidRadius(selTrapRx + 2)}
                          style={S.iconBtn()}><Plus size={12} /></button>
                      </div>
                    </>
                  )}

                  {isDiamond && !isMseg && (
                    <>
                      <div style={S.sectionTitle}>角の丸み</div>
                      <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => applyDiamondRadius(Math.max(0, selTrapRx - 2))}
                          style={S.iconBtn()}><Minus size={12} /></button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selTrapRx}</span>
                        <button onClick={() => applyDiamondRadius(selTrapRx + 2)}
                          style={S.iconBtn()}><Plus size={12} /></button>
                      </div>
                    </>
                  )}

                  {isTriangle && !isMseg && (
                    <>
                      <div style={S.sectionTitle}>角の丸み</div>
                      <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => applyTriangleRadius(Math.max(0, selTrapRx - 2))}
                          style={S.iconBtn()}><Minus size={12} /></button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selTrapRx}</span>
                        <button onClick={() => applyTriangleRadius(selTrapRx + 2)}
                          style={S.iconBtn()}><Plus size={12} /></button>
                      </div>
                    </>
                  )}

                  {showTriSideToggle && (() => {
                    const sideBtn = (active: boolean): React.CSSProperties => ({
                      background: active ? 'var(--accent)' : 'var(--bg)',
                      color: active ? '#1A1A1A' : 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      cursor: 'pointer', fontSize: 10, fontWeight: 600,
                      padding: 0, width: 28, height: 24,
                    });
                    return (
                      <>
                        <div style={S.sectionTitle}>辺の表示</div>
                        <div style={{ padding: '0 12px 10px', display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => toggleTriSide('s2')} style={sideBtn(triSides.s2)}>左</button>
                          <button onClick={() => toggleTriSide('s1')} style={sideBtn(triSides.s1)}>底</button>
                          <button onClick={() => toggleTriSide('s0')} style={sideBtn(triSides.s0)}>右</button>
                        </div>
                      </>
                    );
                  })()}

                  {(isRect || isRectSides || isFourSidedPoly) && (() => {
                    const sideBtn = (active: boolean): React.CSSProperties => ({
                      background: active ? 'var(--accent)' : 'var(--bg)',
                      color: active ? '#1A1A1A' : 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      cursor: 'pointer', fontSize: 10, fontWeight: 600,
                      padding: 0, width: 28, height: 24,
                    });
                    return (
                      <>
                        <div style={S.sectionTitle}>辺の表示</div>
                        <div style={{ padding: '0 12px 10px', display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gridTemplateRows: 'repeat(3, 24px)', gap: 2, justifyContent: 'center' }}>
                          <div /><button onClick={() => toggleRectSide('top')} style={sideBtn(rectSides.top)}>上</button><div />
                          <button onClick={() => toggleRectSide('left')} style={sideBtn(rectSides.left)}>左</button><div /><button onClick={() => toggleRectSide('right')} style={sideBtn(rectSides.right)}>右</button>
                          <div /><button onClick={() => toggleRectSide('bottom')} style={sideBtn(rectSides.bottom)}>下</button><div />
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* 同じ種類全部に適用チェックボックス（スタンプ選択時のみ） */}
              {isStamp && (
                <label style={{ padding: '4px 12px 6px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                  <input type="checkbox" checked={applyToSameType} onChange={e => setApplyToSameType(e.target.checked)} />
                  同じ種類全部に適用
                </label>
              )}

              {/* サイズ */}
              <div style={S.sectionTitle}>サイズ</div>
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => {
                  const obj = fabricRef.current?.getActiveObject() as any;
                  if (!obj) return;
                  const cur = Math.max(obj.getScaledWidth(), obj.getScaledHeight());
                  const next = Math.max(10, cur - 5);
                  const naturalSize = Math.max(obj.width ?? 1, obj.height ?? 1);
                  applyToTargets((o: any) => { o.set({ scaleX: next / naturalSize, scaleY: next / naturalSize }); o.setCoords(); });
                  setSelSize(Math.round(next));
                }} style={S.iconBtn()}><Minus size={12} /></button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>{selSize}</span>
                <button onClick={() => {
                  const obj = fabricRef.current?.getActiveObject() as any;
                  if (!obj) return;
                  const cur = Math.max(obj.getScaledWidth(), obj.getScaledHeight());
                  const next = cur + 5;
                  const naturalSize = Math.max(obj.width ?? 1, obj.height ?? 1);
                  applyToTargets((o: any) => { o.set({ scaleX: next / naturalSize, scaleY: next / naturalSize }); o.setCoords(); });
                  setSelSize(Math.round(next));
                }} style={S.iconBtn()}><Plus size={12} /></button>
                <span style={{ fontSize: 11, color: '#888' }}>px</span>
              </div>

              {/* 透明度 */}
              <div style={S.sectionTitle}>透明度</div>
              <div style={{ padding: '0 12px 8px' }}>
                <input type="range" min={0} max={100} value={Math.round(selOpacity * 100)}
                  onChange={e => { const v = Number(e.target.value) / 100; setSelOpacity(v); applyToTargets((o: any) => o.set({ opacity: v })); }}
                  style={{ width: '100%' }} />
                <div style={{ fontSize: 10, color: '#888', textAlign: 'right' }}>{Math.round(selOpacity * 100)}%</div>
              </div>

              {/* 角度 */}
              <div style={S.sectionTitle}>角度</div>
              <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={-360} max={360} value={selAngle}
                  onChange={e => { const v = Number(e.target.value); setSelAngle(v); applyToTargets((o: any) => o.set({ angle: v })); }}
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

              {/* スタンプ置き換え */}
              {isStamp && (
                <div style={{ padding: '0 12px 8px' }}>
                  <button onClick={() => setShowReplacePanel(v => !v)}
                    style={{ ...S.btn(showReplacePanel), width: '100%', fontSize: 10, padding: '5px 4px' }}>
                    <Repeat size={11} />スタンプを置き換え
                  </button>
                  {showReplacePanel && (
                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      {stamps.map(stamp => (
                        <div key={stamp.id} onClick={() => replaceStamp(stamp.id)}
                          style={{
                            width: 36, height: 36, cursor: 'pointer', borderRadius: 4,
                            border: '1px solid #2A4570', background: '#fff', overflow: 'hidden',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A4570'; }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={stamp.thumbnail} alt={stamp.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* スタンプ登録 */}
              <div style={{ padding: '0 12px 8px' }}>
                <button onClick={registerAsStamp}
                  style={{ ...S.btn(), width: '100%', fontSize: 10, padding: '5px 4px' }}>
                  <Stamp size={11} />スタンプに登録
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
