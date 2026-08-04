'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MousePointer2, Undo2, Trash2, Download, Upload, Maximize2, X, Magnet } from 'lucide-react';
import { getStamps } from '@/lib/stampStorage';
import type { Stamp } from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import { saveMap, getSavedMaps, getMap } from '@/lib/mapStorage';
import type { SavedMap } from '@/lib/mapStorage';
import {
  jitteredBezierPathStr,
  buildRoadObjects,
  buildRailwayObjects,
  buildRiverObjects,
  buildGreenAreaObjects,
  buildBridgeObjects,
  buildPlazaObjects,
  type Point,
} from '@/lib/handDrawnPath';

// ── DPI 変換 ─────────────────────────────────────────────────
const DISPLAY_DPI = 72;
const PRINT_DPI   = 300;
const MAX_PX_W    = 820;
const MAX_PX_H    = 560;

function computeCanvas(mmW: number, mmH: number) {
  const rawW = (mmW * DISPLAY_DPI) / 25.4;
  const rawH = (mmH * DISPLAY_DPI) / 25.4;
  const fit  = Math.min(MAX_PX_W / rawW, MAX_PX_H / rawH, 1.0);
  return {
    pxW:  Math.round(rawW * fit),
    pxH:  Math.round(rawH * fit),
    mult: (PRINT_DPI / DISPLAY_DPI) / fit,
  };
}

/** hex (#rrggbb) + alpha (0‑1) → rgba 文字列 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** rgba(r,g,b,a) 文字列を { color: '#rrggbb', alpha: number } に分解 */
function parseRgba(s: string): { color: string; alpha: number } {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    const hex = '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
    return { color: hex, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }
  return { color: s || '#000000', alpha: 1 };
}

// ── サイズプリセット (mm) ─────────────────────────────────────
type CanvasPreset = { name: string; mmW: number; mmH: number };
const CANVAS_PRESETS: CanvasPreset[] = [
  { name: '応募サイズ', mmW: 385, mmH: 152 },
  { name: '標準カバー', mmW: 340, mmH: 255 },
];
const DEFAULT_PRESET = CANVAS_PRESETS[0];

// ── 背景色プリセット ─────────────────────────────────────────
const BG_COLOR_PRESETS = [
  { label: '白',         color: '#FFFFFF' },
  { label: 'クリーム',   color: '#FFFEF0' },
  { label: 'クラフト紙', color: '#F5F0E8' },
  { label: '薄茶',       color: '#E8D9C0' },
  { label: '薄青',       color: '#EEF4FB' },
  { label: '薄緑',       color: '#EDF5EE' },
  { label: '薄黄',       color: '#FEFBE8' },
  { label: '薄桃',       color: '#FCEEF0' },
];
const DEFAULT_BG = '#FFFEF0';

// ── ツール定義 ────────────────────────────────────────────────
const DRAWING_TOOLS = ['road', 'railway', 'river', 'greenarea', 'bridge', 'plaza'] as const;
const MAP_EXTRA_PROPS = ['_mapLineType', '_isBgImage', '_mapStampId', '_anchorPoints', '_strokeId', '_mapOpts'];

type MapTool = 'select' | 'road' | 'railway' | 'river' | 'greenarea' | 'bridge' | 'plaza' | 'stamp';

// 緑地のみ確定に 3 点以上必要（閉じた多角形）; bridge/plaza は 2 点
const MIN_ANCHOR: Record<string, number> = { greenarea: 3, plaza: 2, bridge: 2 };
function minAnchor(tool: MapTool) { return MIN_ANCHOR[tool] ?? 2; }

// ── スタイル定数 ─────────────────────────────────────────────
const S = {
  toolBtn: (active: boolean): React.CSSProperties => ({
    width: 40, height: 40, borderRadius: 8, border: 'none',
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#0F2340' : 'var(--text)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }),
  panel: {
    width: 228, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
    overflowY: 'auto', flexShrink: 0,
  } as React.CSSProperties,
  sectionHead: { fontSize: 11, color: 'var(--accent)', fontWeight: 700 } as React.CSSProperties,
  lbl: { fontSize: 10, color: '#888', fontWeight: 700, letterSpacing: 0.4, marginBottom: 2 } as React.CSSProperties,
  input: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 5, color: 'var(--text)', padding: '3px 6px', fontSize: 12,
  } as React.CSSProperties,
  btn: (v?: 'accent' | 'ghost-danger'): React.CSSProperties => ({
    width: '100%', padding: '6px 0', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    ...(v === 'accent'
      ? { background: 'var(--accent)', color: '#0F2340', border: 'none' }
      : v === 'ghost-danger'
      ? { background: 'transparent', color: '#C0392B', border: '1px solid #C0392B' }
      : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }),
  }),
  divider: { height: 1, background: 'var(--border)', flexShrink: 0 } as React.CSSProperties,
  // カバーデザイナーと同じツールバーボタンスタイル
  tbBtn: (active = false): React.CSSProperties => ({
    background: active ? '#1E4080' : '#1A3358',
    border: 'none', borderRadius: 6,
    color: active ? '#C9A84C' : 'var(--text)',
    padding: '4px 8px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
  }),
};

// ── アイコン ─────────────────────────────────────────────────
const RoadIcon      = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="2" y1="7" x2="18" y2="7"/><line x1="2" y1="13" x2="18" y2="13"/></svg>;
const RailwayIcon   = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}><line x1="4" y1="4" x2="4" y2="16"/><line x1="16" y1="4" x2="16" y2="16"/><line x1="4" y1="7" x2="16" y2="7"/><line x1="4" y1="10" x2="16" y2="10"/><line x1="4" y1="13" x2="16" y2="13"/></svg>;
const RiverIcon     = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M2 7 Q5 5 8 7 Q11 9 14 7 Q17 5 18 7"/><path d="M2 13 Q5 11 8 13 Q11 15 14 13 Q17 11 18 13"/></svg>;
const GreenAreaIcon = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="rgba(125,195,107,0.35)" stroke="currentColor" strokeWidth={1.5}><path d="M10 3 Q14 5 16 9 Q17 14 13 16 Q8 18 5 15 Q2 11 4 7 Q7 3 10 3 Z"/></svg>;
const StampIcon     = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="10" cy="8" r="4.5"/><rect x="6" y="14" width="8" height="2.5" rx="1"/><line x1="10" y1="12.5" x2="10" y2="14"/></svg>;
const BridgeIcon    = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="7" x2="16" y2="7"/><line x1="4" y1="10" x2="16" y2="10"/><line x1="4" y1="13" x2="16" y2="13"/></svg>;
const PlazaIcon     = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6} strokeDasharray="3 2"><rect x="3" y="4" width="14" height="12" rx="1"/></svg>;

// ── 初期計算 ─────────────────────────────────────────────────
const INIT = computeCanvas(DEFAULT_PRESET.mmW, DEFAULT_PRESET.mmH);

export default function MapEditor() {
  const router = useRouter();
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fabricRef    = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const fabricLibRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── カバーデザイナー連携 ───────────────────────────────────
  const [editingMapId, setEditingMapId] = useState('');
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [saveName, setSaveName] = useState('');

  // ── ツール ─────────────────────────────────────────────────
  const [mapTool, setMapTool] = useState<MapTool>('select');
  const mapToolRef = useRef<MapTool>('select');
  useEffect(() => { mapToolRef.current = mapTool; }, [mapTool]);

  // ── アンカー点 ─────────────────────────────────────────────
  const anchorPointsRef = useRef<Point[]>([]);
  const [anchorCount, setAnchorCount] = useState(0);
  const previewObjsRef = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── 線・共通プロパティ ─────────────────────────────────────
  const [lineColor,   setLineColor]   = useState('#d4c4b0'); // 道路デフォルト: ベージュがかった薄いグレー
  const [strokeWidth, setStrokeWidth] = useState(4);         // 道路デフォルト幅: 4px
  const [jitterAmt,   setJitterAmt]   = useState(3);
  const [roadDouble,  setRoadDouble]  = useState(false);
  const [railGap,     setRailGap]     = useState(8);
  const [sleeperGap,  setSleeperGap]  = useState(10);
  const [riverColor,  setRiverColor]  = useState('#b5d0dc'); // 川デフォルト: 明るい水色
  const [riverWidth,  setRiverWidth]  = useState(9);         // 川デフォルト幅: 9px（太い帯状）

  const lineColorRef   = useRef('#d4c4b0');
  const strokeWidthRef = useRef(4);
  const jitterAmtRef   = useRef(3);
  const roadDoubleRef  = useRef(false);
  const railGapRef     = useRef(8);
  const sleeperGapRef  = useRef(10);
  const riverColorRef  = useRef('#b5d0dc');
  const riverWidthRef  = useRef(9);

  useEffect(() => { lineColorRef.current   = lineColor;   }, [lineColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { jitterAmtRef.current   = jitterAmt;   }, [jitterAmt]);
  useEffect(() => { roadDoubleRef.current  = roadDouble;  }, [roadDouble]);
  useEffect(() => { railGapRef.current     = railGap;     }, [railGap]);
  useEffect(() => { sleeperGapRef.current  = sleeperGap;  }, [sleeperGap]);
  useEffect(() => { riverColorRef.current  = riverColor;  }, [riverColor]);
  useEffect(() => { riverWidthRef.current  = riverWidth;  }, [riverWidth]);

  // ── 橋プロパティ ───────────────────────────────────────────
  const [bridgeColor,    setBridgeColor]    = useState('#4A3E2E'); // 線路と同色
  const [bridgeHatchLen, setBridgeHatchLen] = useState(14);
  const [bridgeHatchGap, setBridgeHatchGap] = useState(10);
  const [bridgeStrokeW,  setBridgeStrokeW]  = useState(2);        // 線路と同幅: 2px

  const bridgeColorRef    = useRef('#4A3E2E');
  const bridgeHatchLenRef = useRef(14);
  const bridgeHatchGapRef = useRef(10);
  const bridgeStrokeWRef  = useRef(2);

  useEffect(() => { bridgeColorRef.current    = bridgeColor;    }, [bridgeColor]);
  useEffect(() => { bridgeHatchLenRef.current = bridgeHatchLen; }, [bridgeHatchLen]);
  useEffect(() => { bridgeHatchGapRef.current = bridgeHatchGap; }, [bridgeHatchGap]);
  useEffect(() => { bridgeStrokeWRef.current  = bridgeStrokeW;  }, [bridgeStrokeW]);

  // ── 広場プロパティ ─────────────────────────────────────────
  const [plazaColor,   setPlazaColor]   = useState('#b3a590'); // 広場デフォルト: グレーがかったベージュ
  const [plazaStrokeW, setPlazaStrokeW] = useState(2);        // 広場デフォルト幅: 2px
  const [plazaDashLen, setPlazaDashLen] = useState(6);
  const [plazaDashGap, setPlazaDashGap] = useState(4);

  const plazaColorRef   = useRef('#b3a590');
  const plazaStrokeWRef = useRef(2);
  const plazaDashLenRef = useRef(6);
  const plazaDashGapRef = useRef(4);

  useEffect(() => { plazaColorRef.current   = plazaColor;   }, [plazaColor]);
  useEffect(() => { plazaStrokeWRef.current = plazaStrokeW; }, [plazaStrokeW]);
  useEffect(() => { plazaDashLenRef.current = plazaDashLen; }, [plazaDashLen]);
  useEffect(() => { plazaDashGapRef.current = plazaDashGap; }, [plazaDashGap]);

  // ── グリッドスナップ ───────────────────────────────────────
  const [gridSnap, setGridSnap] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const gridSnapRef = useRef(false);
  const gridSizeRef = useRef(10);
  useEffect(() => { gridSnapRef.current = gridSnap; }, [gridSnap]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);

  // ── finalizePath への参照 ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalizePathRef = useRef<() => void>(() => {});

  // ── 緑地プロパティ ─────────────────────────────────────────
  const [greenFill,        setGreenFill]        = useState('#A9B787'); // 緑地塗り: 薄い緑
  const [greenFillOpacity, setGreenFillOpacity] = useState(0.4);      // 不透明度: 40%
  const [greenStroke,      setGreenStroke]      = useState('#999999'); // 輪郭線: グレー
  const [greenStrokeW,     setGreenStrokeW]     = useState(2);        // 輪郭線幅: 2px

  const greenFillRef        = useRef('#A9B787');
  const greenFillOpacityRef = useRef(0.4);
  const greenStrokeRef      = useRef('#999999');
  const greenStrokeWRef     = useRef(2);

  useEffect(() => { greenFillRef.current        = greenFill;        }, [greenFill]);
  useEffect(() => { greenFillOpacityRef.current = greenFillOpacity; }, [greenFillOpacity]);
  useEffect(() => { greenStrokeRef.current      = greenStroke;      }, [greenStroke]);
  useEffect(() => { greenStrokeWRef.current     = greenStrokeW;     }, [greenStrokeW]);

  // ── 選択オブジェクトのプロパティ編集 ──────────────────────
  const [hasMapSel,  setHasMapSel]  = useState(false);
  const [selType,    setSelType]    = useState('');
  const [selCount,   setSelCount]   = useState(0);
  const [selStroke,  setSelStroke]  = useState('#C8B89A');
  const [selStrokeW, setSelStrokeW] = useState(8);
  const [selFill,    setSelFill]    = useState('#B0D4E8');
  const [selFillOp,  setSelFillOp]  = useState(0.4);
  const [selJitter,  setSelJitter]  = useState(3);

  const selFillRef   = useRef('#B0D4E8');
  const selFillOpRef = useRef(0.4);
  useEffect(() => { selFillRef.current   = selFill;   }, [selFill]);
  useEffect(() => { selFillOpRef.current = selFillOp; }, [selFillOp]);

  // ── キャンバスサイズ (mm) ──────────────────────────────────
  const [showSizeModal,  setShowSizeModal]  = useState(false);
  const [activeSizeName, setActiveSizeName] = useState(DEFAULT_PRESET.name);
  const [canvasMmW, setCanvasMmW] = useState(DEFAULT_PRESET.mmW);
  const [canvasMmH, setCanvasMmH] = useState(DEFAULT_PRESET.mmH);
  const [customMmW, setCustomMmW] = useState(DEFAULT_PRESET.mmW);
  const [customMmH, setCustomMmH] = useState(DEFAULT_PRESET.mmH);
  const [pxInfo,    setPxInfo]    = useState(INIT);

  const canvasMmWRef  = useRef(DEFAULT_PRESET.mmW);
  const canvasMmHRef  = useRef(DEFAULT_PRESET.mmH);
  const canvasPxWRef  = useRef(INIT.pxW);
  const canvasPxHRef  = useRef(INIT.pxH);
  const exportMultRef = useRef(INIT.mult);

  useEffect(() => { canvasMmWRef.current = canvasMmW; }, [canvasMmW]);
  useEffect(() => { canvasMmHRef.current = canvasMmH; }, [canvasMmH]);

  // ── 背景色 ─────────────────────────────────────────────────
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
  const bgColorRef = useRef(DEFAULT_BG);
  useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    canvas.renderAll();
  }, [bgColor]);

  // ── 背景画像 ───────────────────────────────────────────────
  const [bgOpacity,    setBgOpacity]    = useState(0.4);
  const [hasBgImage,   setHasBgImage]   = useState(false);
  const [bgLocked,     setBgLocked]     = useState(true);   // ロック状態（初期: ロック）
  const [bgAspectLock, setBgAspectLock] = useState(true);   // 縦横比固定
  const [bgScalePct,   setBgScalePct]   = useState(100);    // 表示用倍率 (%)
  const [bgScaleInput, setBgScaleInput] = useState('100');  // 入力フィールド用

  const bgOpacityRef    = useRef(0.4);
  const bgLockedRef     = useRef(true);
  const bgAspectLockRef = useRef(true);
  const bgImageObjRef   = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => { bgOpacityRef.current    = bgOpacity;    }, [bgOpacity]);
  useEffect(() => { bgLockedRef.current     = bgLocked;     }, [bgLocked]);
  useEffect(() => { bgAspectLockRef.current = bgAspectLock; }, [bgAspectLock]);

  useEffect(() => {
    if (!bgImageObjRef.current || !fabricRef.current) return;
    bgImageObjRef.current.set({ opacity: bgOpacity });
    fabricRef.current.renderAll();
  }, [bgOpacity]);

  // ロック切り替え → canvas オブジェクトに即時反映
  useEffect(() => {
    const img = bgImageObjRef.current;
    const canvas = fabricRef.current;
    if (!img || !canvas) return;
    img.set({ selectable: !bgLocked, evented: !bgLocked, hasControls: !bgLocked });
    if (bgLocked) canvas.discardActiveObject();
    canvas.renderAll();
  }, [bgLocked]);

  // 縦横比ロック切り替え → canvas オブジェクトに即時反映
  useEffect(() => {
    const img = bgImageObjRef.current;
    const canvas = fabricRef.current;
    if (!img || !canvas) return;
    img.set({ lockUniScaling: bgAspectLock });
    canvas.renderAll();
  }, [bgAspectLock]);

  // ── スタンプ ───────────────────────────────────────────────
  const [stamps,        setStamps]        = useState<Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null);
  const selectedStampRef = useRef<Stamp | null>(null);
  useEffect(() => { selectedStampRef.current = selectedStamp; }, [selectedStamp]);
  useEffect(() => { setStamps(getStamps()); }, []);

  // ── 履歴 ───────────────────────────────────────────────────
  const historyRef    = useRef<string[]>([]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);

  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const state = {
      json:    canvas.toJSON(MAP_EXTRA_PROPS),
      bgColor: bgColorRef.current,
      mmW:     canvasMmWRef.current,
      mmH:     canvasMmHRef.current,
    };
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(JSON.stringify(state));
    historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    setCanUndo(historyIdxRef.current > 0);
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      const { json, bgColor: savedBg, mmW, mmH } =
        JSON.parse(historyRef.current[historyIdxRef.current]);
      if (mmW && mmH) {
        const c = computeCanvas(mmW, mmH);
        canvas.setDimensions({ width: c.pxW, height: c.pxH });
        canvasPxWRef.current  = c.pxW;
        canvasPxHRef.current  = c.pxH;
        exportMultRef.current = c.mult;
        canvasMmWRef.current  = mmW;
        canvasMmHRef.current  = mmH;
        setCanvasMmW(mmW); setCanvasMmH(mmH);
        setPxInfo(c);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvas.loadFromJSON(json) as any).then(() => {
        canvas.backgroundColor = savedBg ?? bgColorRef.current;
        setBgColor(savedBg ?? bgColorRef.current);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const restoredBg = canvas.getObjects().find((o: any) => o._isBgImage) ?? null;
        bgImageObjRef.current = restoredBg;
        setHasBgImage(!!restoredBg);
        if (restoredBg) {
          // JSON から復元した値で UI を同期
          const locked = !restoredBg.selectable;
          setBgLocked(locked);
          bgLockedRef.current = locked;
          const aspect = !!restoredBg.lockUniScaling;
          setBgAspectLock(aspect);
          bgAspectLockRef.current = aspect;
          const pct = Math.round((restoredBg.scaleX || 1) * 100);
          setBgScalePct(pct);
          setBgScaleInput(String(pct));
        }
        canvas.renderAll();
      });
    } catch { /* ignore */ }
  }, []);

  // ── プレビュー ─────────────────────────────────────────────
  const updatePreview = useCallback((mousePt?: Point) => {
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    previewObjsRef.current.forEach(o => canvas.remove(o));
    previewObjsRef.current = [];

    const pts = anchorPointsRef.current;
    if (pts.length === 0) { canvas.renderAll(); return; }

    // Plaza special preview: rectangle
    if (mapToolRef.current === 'plaza' && pts.length === 1 && mousePt) {
      const pt1 = pts[0];
      const left = Math.min(pt1.x, mousePt.x);
      const top = Math.min(pt1.y, mousePt.y);
      const w = Math.abs(mousePt.x - pt1.x);
      const h = Math.abs(mousePt.y - pt1.y);
      if (w > 1 && h > 1) {
        const rectPreview = new fabric.Rect({
          left, top, width: w, height: h,
          fill: 'rgba(150,150,150,0.08)',
          stroke: '#4A90E2', strokeWidth: 1.5,
          strokeDashArray: [6, 3],
          selectable: false, evented: false,
        });
        previewObjsRef.current.push(rectPreview);
        canvas.add(rectPreview);
      }
      // anchor dot for first point
      const dot = new fabric.Circle({
        left: pt1.x, top: pt1.y, originX: 'center', originY: 'center',
        radius: 4.5, fill: '#4A90E2', stroke: '#fff', strokeWidth: 1.5,
        selectable: false, evented: false,
      });
      previewObjsRef.current.push(dot);
      canvas.add(dot);
      canvas.renderAll();
      return; // don't run normal preview
    }

    const isGreenArea = mapToolRef.current === 'greenarea';

    // アンカー点ドット
    pts.forEach(p => {
      const dot = new fabric.Circle({
        left: p.x, top: p.y, originX: 'center', originY: 'center',
        radius: 4.5, fill: '#4A90E2', stroke: '#fff', strokeWidth: 1.5,
        selectable: false, evented: false,
      });
      previewObjsRef.current.push(dot);
      canvas.add(dot);
    });

    const previewPts = mousePt ? [...pts, mousePt] : pts;
    if (previewPts.length >= 2) {
      const d = jitteredBezierPathStr(previewPts, 0);
      const path = new fabric.Path(d, {
        stroke: '#4A90E2', strokeWidth: 1.5,
        fill: isGreenArea ? 'rgba(125,195,107,0.15)' : 'transparent',
        strokeDashArray: [6, 3], selectable: false, evented: false,
      });
      previewObjsRef.current.push(path);
      canvas.add(path);

      // 緑地: マウス位置から最初の点への補助線（閉じるラインの予告）
      if (isGreenArea && pts.length >= 2 && mousePt) {
        const closing = new fabric.Line([mousePt.x, mousePt.y, pts[0].x, pts[0].y], {
          stroke: '#4A90E2', strokeWidth: 1, strokeDashArray: [3, 3],
          selectable: false, evented: false,
        });
        previewObjsRef.current.push(closing);
        canvas.add(closing);
      }
    } else if (pts.length === 1 && mousePt) {
      const line = new fabric.Line([pts[0].x, pts[0].y, mousePt.x, mousePt.y], {
        stroke: '#4A90E2', strokeWidth: 1, strokeDashArray: [4, 3],
        selectable: false, evented: false,
      });
      previewObjsRef.current.push(line);
      canvas.add(line);
    }
    canvas.renderAll();
  }, []);

  // ── パス確定 ───────────────────────────────────────────────
  const finalizePath = useCallback(() => {
    const pts    = anchorPointsRef.current;
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    previewObjsRef.current.forEach(o => canvas.remove(o));
    previewObjsRef.current = [];

    const tool  = mapToolRef.current;
    const enoughPts = pts.length >= minAnchor(tool);

    if (enoughPts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let objs: any[] = [];
      if (tool === 'road') {
        const roadObjs = buildRoadObjects(fabric, pts, {
          color: lineColorRef.current, strokeWidth: strokeWidthRef.current,
          jitter: jitterAmtRef.current, doubleStroke: roadDoubleRef.current,
        });
        if (roadObjs.length > 1) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const grp: any = new fabric.Group(roadObjs, { selectable: true });
          grp._mapLineType = 'road';
          objs = [grp];
        } else {
          objs = roadObjs;
        }
      } else if (tool === 'railway') {
        objs = [buildRailwayObjects(fabric, pts, {
          color: lineColorRef.current, railWidth: 1.5, jitter: jitterAmtRef.current,
          railGap: railGapRef.current, sleeperGap: sleeperGapRef.current,
        })];
      } else if (tool === 'river') {
        objs = [buildRiverObjects(fabric, pts, {
          color: riverColorRef.current,
          strokeWidth: riverWidthRef.current,
          jitter: jitterAmtRef.current,
        })];
      } else if (tool === 'greenarea') {
        const g = buildGreenAreaObjects(fabric, pts, {
          fillColor:   hexToRgba(greenFillRef.current, greenFillOpacityRef.current),
          strokeColor: greenStrokeRef.current,
          strokeWidth: greenStrokeWRef.current,
          jitter:      jitterAmtRef.current,
        });
        if (g) objs = [g];
      } else if (tool === 'bridge') {
        const obj = buildBridgeObjects(fabric, pts, {
          color: bridgeColorRef.current,
          hatchLength: bridgeHatchLenRef.current,
          hatchGap: bridgeHatchGapRef.current,
          strokeWidth: bridgeStrokeWRef.current,
        });
        if (obj) objs = [obj];
      } else if (tool === 'plaza') {
        const obj = buildPlazaObjects(fabric, pts[0], pts[1], {
          color: plazaColorRef.current,
          strokeWidth: plazaStrokeWRef.current,
          dashLen: plazaDashLenRef.current,
          dashGap: plazaDashGapRef.current,
        });
        if (obj) objs = [obj];
      }
      // アンカー点・オプションをオブジェクトに付与（後からプロパティ編集に使用）
      const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mapOpts: any = {};
      if (tool === 'road') mapOpts = { color: lineColorRef.current, strokeWidth: strokeWidthRef.current, doubleStroke: roadDoubleRef.current };
      else if (tool === 'railway') mapOpts = { color: lineColorRef.current, railGap: railGapRef.current, sleeperGap: sleeperGapRef.current };
      else if (tool === 'river') mapOpts = { color: riverColorRef.current, strokeWidth: riverWidthRef.current };
      else if (tool === 'greenarea') mapOpts = { fillColor: greenFillRef.current, fillOpacity: greenFillOpacityRef.current, strokeColor: greenStrokeRef.current, strokeWidth: greenStrokeWRef.current };
      else if (tool === 'bridge') mapOpts = { color: bridgeColorRef.current, hatchLength: bridgeHatchLenRef.current, hatchGap: bridgeHatchGapRef.current, strokeWidth: bridgeStrokeWRef.current };
      else if (tool === 'plaza') mapOpts = { color: plazaColorRef.current, strokeWidth: plazaStrokeWRef.current, dashLen: plazaDashLenRef.current, dashGap: plazaDashGapRef.current };
      objs.forEach(o => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (o as any)._anchorPoints = [...pts];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (o as any)._strokeId    = strokeId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (o as any)._mapOpts     = JSON.stringify(mapOpts);
      });
      objs.forEach(o => canvas.add(o));
      canvas.renderAll();
      saveHistory();
    }
    anchorPointsRef.current = [];
    setAnchorCount(0);
  }, [saveHistory]);

  useEffect(() => { finalizePathRef.current = finalizePath; }, [finalizePath]);

  const cancelDrawing = useCallback(() => {
    const canvas = fabricRef.current;
    previewObjsRef.current.forEach(o => canvas?.remove(o));
    previewObjsRef.current = [];
    anchorPointsRef.current = [];
    setAnchorCount(0);
    canvas?.renderAll();
  }, []);

  // ── 選択オブジェクトのプロパティ読み取り ─────────────────
  const syncSelProps = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = (canvas.getActiveObjects() as any[]).filter((o: any) => o._mapLineType);
    if (active.length === 0) { setHasMapSel(false); return; }

    setHasMapSel(true);
    setSelCount(active.length);
    const first = active[0];
    const lt: string = first._mapLineType;
    setSelType(lt);

    if (lt === 'road') {
      // Road は単一 Path または Group（doubleStroke）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = first.type === 'group' ? (first.getObjects?.() as any[])[0] : first;
      setSelStroke(src?.stroke || '#C8B89A');
      setSelStrokeW(src?.strokeWidth || 8);
    } else if (lt === 'railway') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = first.getObjects?.() || [];
      setSelStroke(children[0]?.stroke || '#555555');
    } else if (lt === 'river') {
      setSelStroke(first.stroke || '#7D97A3');
      setSelStrokeW(first.strokeWidth || 2);
    } else if (lt === 'greenarea') {
      const parsed = parseRgba(typeof first.fill === 'string' ? first.fill : '');
      setSelFill(parsed.color); selFillRef.current = parsed.color;
      setSelFillOp(parsed.alpha); selFillOpRef.current = parsed.alpha;
      setSelStroke(first.stroke || '#8A9870');
      setSelStrokeW(first.strokeWidth || 1.5);
    } else if (lt === 'bridge') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = first.getObjects?.() || [];
      setSelStroke(children[0]?.stroke || '#888888');
      setSelStrokeW(children[0]?.strokeWidth || 1.5);
    } else if (lt === 'plaza') {
      setSelStroke(first.stroke || '#999999');
      setSelStrokeW(first.strokeWidth || 1.5);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jitter = (first as any)._mapOpts ? (() => { try { return JSON.parse((first as any)._mapOpts)?.jitter ?? jitterAmtRef.current; } catch { return jitterAmtRef.current; } })() : jitterAmtRef.current;
    setSelJitter(jitter);
  }, []);

  /** 選択オブジェクトの線色を変更 */
  const applySelStroke = useCallback((color: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas.getActiveObjects() as any[]).filter((o: any) => o._mapLineType).forEach((obj: any) => {
      const lt: string = obj._mapLineType;
      if (lt === 'road') {
        if (obj.type === 'group') (obj.getObjects?.() || []).forEach((c: any) => c.set({ stroke: color }));
        else obj.set({ stroke: color });
      } else if (lt === 'railway') {
        (obj.getObjects?.() || []).forEach((c: any) => c.set({ stroke: color }));
      } else if (lt === 'river') {
        obj.set({ stroke: color });
      } else if (lt === 'greenarea') {
        obj.set({ stroke: color });
      } else if (lt === 'bridge') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (obj.getObjects?.() || []).forEach((c: any) => c.set({ stroke: color }));
      } else if (lt === 'plaza') {
        obj.set({ stroke: color });
      }
      try { const o = JSON.parse(obj._mapOpts || '{}'); obj._mapOpts = JSON.stringify({ ...o, color, strokeColor: color }); } catch { /* */ }
    });
    setSelStroke(color);
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);

  /** 選択オブジェクトの線幅を変更（road・greenarea） */
  const applySelStrokeW = useCallback((w: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas.getActiveObjects() as any[]).filter((o: any) => o._mapLineType).forEach((obj: any) => {
      const lt: string = obj._mapLineType;
      if (lt === 'road') {
        if (obj.type === 'group') (obj.getObjects?.() || []).forEach((c: any) => c.set({ strokeWidth: w }));
        else obj.set({ strokeWidth: w });
      } else if (lt === 'greenarea') {
        obj.set({ strokeWidth: w });
      } else if (lt === 'river') {
        obj.set({ strokeWidth: w });
      } else if (lt === 'bridge') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (obj.getObjects?.() || []).forEach((c: any) => c.set({ strokeWidth: w }));
      } else if (lt === 'plaza') {
        obj.set({ strokeWidth: w });
      }
      try { const o = JSON.parse(obj._mapOpts || '{}'); obj._mapOpts = JSON.stringify({ ...o, strokeWidth: w, width: w }); } catch { /* */ }
    });
    setSelStrokeW(w);
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);

  /** 選択オブジェクトの塗り色・不透明度を変更（river・greenarea） */
  const applySelFillColor = useCallback((color: string, opacity: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const rgba = hexToRgba(color, opacity);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas.getActiveObjects() as any[]).filter((o: any) => o._mapLineType).forEach((obj: any) => {
      const lt: string = obj._mapLineType;
      if (lt === 'greenarea') {
        obj.set({ fill: rgba });
      }
      try { const o = JSON.parse(obj._mapOpts || '{}'); obj._mapOpts = JSON.stringify({ ...o, fillColor: color, fillOpacity: opacity }); } catch { /* */ }
    });
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);

  /** 選択オブジェクトのジッターを変更（パスを再構築） */
  const applySelJitter = useCallback((jitter: number) => {
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = (canvas.getActiveObjects() as any[]).filter((o: any) => o._mapLineType && o._anchorPoints);
    if (active.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalObjs = (canvas as any)._objects as any[];

    active.forEach(oldObj => {
      const idx = internalObjs.indexOf(oldObj);
      if (idx === -1) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pts: Point[]  = (oldObj as any)._anchorPoints;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lt: string    = (oldObj as any)._mapLineType;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sid: string   = (oldObj as any)._strokeId || '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: any     = (() => { try { return JSON.parse((oldObj as any)._mapOpts || '{}'); } catch { return {}; } })();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let newObj: any = null;
      if (lt === 'road') {
        const roadObjs = buildRoadObjects(fabric, pts, { color: opts.color || lineColorRef.current, strokeWidth: opts.strokeWidth || strokeWidthRef.current, jitter, doubleStroke: opts.doubleStroke || false });
        if (roadObjs.length > 1) { newObj = new fabric.Group(roadObjs, { selectable: true }); newObj._mapLineType = 'road'; }
        else newObj = roadObjs[0];
      } else if (lt === 'railway') {
        newObj = buildRailwayObjects(fabric, pts, { color: opts.color || lineColorRef.current, railWidth: 1.5, jitter, railGap: opts.railGap || railGapRef.current, sleeperGap: opts.sleeperGap || sleeperGapRef.current });
      } else if (lt === 'river') {
        newObj = buildRiverObjects(fabric, pts, { color: opts.color || riverColorRef.current, strokeWidth: opts.strokeWidth || riverWidthRef.current, jitter });
      } else if (lt === 'greenarea') {
        newObj = buildGreenAreaObjects(fabric, pts, { fillColor: hexToRgba(opts.fillColor || greenFillRef.current, opts.fillOpacity ?? greenFillOpacityRef.current), strokeColor: opts.strokeColor || greenStrokeRef.current, strokeWidth: opts.strokeWidth || greenStrokeWRef.current, jitter });
      }
      if (!newObj) return;
      newObj._anchorPoints = pts;
      newObj._strokeId    = sid;
      newObj._mapOpts     = JSON.stringify({ ...opts, jitter });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newObj as any).canvas = canvas;
      internalObjs.splice(idx, 1, newObj);
    });

    canvas.discardActiveObject();
    canvas.renderAll();
    setSelJitter(jitter);
    saveHistory();
  }, [saveHistory]);

  // ── キャンバスサイズ変更 ───────────────────────────────────
  const applyCanvasSize = useCallback((mmW: number, mmH: number) => {
    const c = computeCanvas(mmW, mmH);
    canvasPxWRef.current  = c.pxW;
    canvasPxHRef.current  = c.pxH;
    exportMultRef.current = c.mult;
    canvasMmWRef.current  = mmW;
    canvasMmHRef.current  = mmH;
    setCanvasMmW(mmW); setCanvasMmH(mmH);
    setPxInfo(c);

    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: c.pxW, height: c.pxH });

    const img = bgImageObjRef.current;
    if (img) {
      const nw = img.width as number, nh = img.height as number;
      if (nw && nh) {
        const scale = Math.min(c.pxW / nw, c.pxH / nh);
        img.set({ scaleX: scale, scaleY: scale, left: 0, top: 0 });
      }
    }
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);


  // ── キャンバス初期化 ───────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any;
    let disposed = false;

    import('fabric').then((mod: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (disposed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric: any = mod.fabric ?? mod.default ?? mod;
      fabricLibRef.current = fabric;

      canvas = new fabric.Canvas(canvasRef.current, {
        width:           canvasPxWRef.current,
        height:          canvasPxHRef.current,
        backgroundColor: bgColorRef.current,
      });
      fabricRef.current = canvas;

      // コンテナサイズに合わせた初期表示サイズ計算
      requestAnimationFrame(() => {
        const container = canvasContainerRef.current;
        if (!container) return;
        const availW = Math.max(200, container.clientWidth - 40);
        const availH = Math.max(200, container.clientHeight - 40);
        const rawW = (canvasMmWRef.current * DISPLAY_DPI) / 25.4;
        const rawH = (canvasMmHRef.current * DISPLAY_DPI) / 25.4;
        const fit = Math.min(availW / rawW, availH / rawH, 1.0);
        const pxW = Math.round(rawW * fit);
        const pxH = Math.round(rawH * fit);
        const mult = (PRINT_DPI / DISPLAY_DPI) / fit;
        if (pxW !== canvasPxWRef.current || pxH !== canvasPxHRef.current) {
          canvas.setDimensions({ width: pxW, height: pxH });
          canvasPxWRef.current = pxW; canvasPxHRef.current = pxH;
          exportMultRef.current = mult;
          setPxInfo({ pxW, pxH, mult });
        }
      });

      // mouse:up: アンカー追加 or スタンプ配置
      canvas.on('mouse:up', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const tool = mapToolRef.current;
        const pt   = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
        if (!pt) return;
        // Fabric.js はドキュメントレベルで mouseup を監視するため、
        // キャンバス外のボタン（確定ボタン等）クリックでもこのハンドラが発火する。
        // キャンバス範囲外のイベントを無視して意図しないアンカー追加を防ぐ。
        const cw = canvas.getWidth(), ch = canvas.getHeight();
        if (pt.x < 0 || pt.y < 0 || pt.x > cw || pt.y > ch) return;

        // Plaza: auto-finalize on 2nd click
        if (tool === 'plaza') {
          let snappedPt = { x: pt.x, y: pt.y };
          if (gridSnapRef.current) {
            const g = gridSizeRef.current;
            snappedPt = { x: Math.round(pt.x / g) * g, y: Math.round(pt.y / g) * g };
          }
          anchorPointsRef.current.push(snappedPt);
          setAnchorCount(anchorPointsRef.current.length);
          if (anchorPointsRef.current.length >= 2) {
            finalizePathRef.current();
          } else {
            updatePreview(undefined);
          }
          return;
        }

        if ((DRAWING_TOOLS as readonly string[]).includes(tool)) {
          let snappedPt = { x: pt.x, y: pt.y };
          if (gridSnapRef.current) {
            const g = gridSizeRef.current;
            snappedPt = { x: Math.round(pt.x / g) * g, y: Math.round(pt.y / g) * g };
          }
          anchorPointsRef.current.push(snappedPt);
          setAnchorCount(anchorPointsRef.current.length);
          updatePreview(undefined);

        } else if (tool === 'stamp') {
          const stamp = selectedStampRef.current;
          if (!stamp) return;
          const STAMP_PX = 40;
          fabric.Image.fromURL(stamp.thumbnail).then((img: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const scale = STAMP_PX / Math.max(img.width || STAMP_PX, img.height || STAMP_PX);
            img.set({ left: pt.x, top: pt.y, originX: 'center', originY: 'center',
                      scaleX: scale, scaleY: scale });
            img._mapStampId = stamp.id;
            canvas.add(img);
            const label = new fabric.IText(stamp.name, {
              left: pt.x, top: pt.y + STAMP_PX * scale / 2 + 4,
              originX: 'center', originY: 'top',
              fontSize: 12, fill: '#333333', fontFamily: 'Arial',
            });
            canvas.add(label);
            canvas.renderAll();
            saveHistory();
          });
        }
      });

      canvas.on('mouse:move', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const tool = mapToolRef.current;
        // Plaza のみ: 矩形プレビューのためマウス位置を渡す
        if (tool === 'plaza' && anchorPointsRef.current.length === 1) {
          const pt = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
          if (pt) updatePreview({ x: pt.x, y: pt.y });
        }
        // その他の描画ツール: マウス追跡線は描画しない（アンカー間のみ表示）
      });

      canvas.on('object:modified', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        saveHistory();
        if (opt.target?._isBgImage) {
          const pct = Math.round((opt.target.scaleX || 1) * 100);
          setBgScalePct(pct);
          setBgScaleInput(String(pct));
        }
      });

      // 選択イベント
      canvas.on('selection:created', syncSelProps);
      canvas.on('selection:updated', syncSelProps);
      canvas.on('selection:cleared', () => setHasMapSel(false));

      const editId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('edit')
        : null;

      if (editId) {
        // ?edit=<id> URL param: load saved map
        const saved = getMap(editId);
        if (saved) {
          setEditingMapId(editId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (canvas.loadFromJSON(saved.fabricJson) as any).then(() => {
            canvas.backgroundColor = saved.bgColor;
            setBgColor(saved.bgColor);
            const c = computeCanvas(saved.mmW, saved.mmH);
            canvas.setDimensions({ width: c.pxW, height: c.pxH });
            canvasPxWRef.current = c.pxW; canvasPxHRef.current = c.pxH;
            exportMultRef.current = c.mult;
            canvasMmWRef.current = saved.mmW; canvasMmHRef.current = saved.mmH;
            setCanvasMmW(saved.mmW); setCanvasMmH(saved.mmH); setPxInfo(c);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            bgImageObjRef.current = canvas.getObjects().find((o: any) => o._isBgImage) ?? null;
            setHasBgImage(!!bgImageObjRef.current);
            canvas.renderAll();
          });
          return; // skip normal initial history save
        }
      } else {
        const stored = localStorage.getItem('mapeditor-canvas-state');
        if (stored) {
          try {
            const { json, bgColor: savedBg, mmW: savedMmW, mmH: savedMmH } = JSON.parse(stored);
            if (savedMmW && savedMmH) {
              const c = computeCanvas(savedMmW, savedMmH);
              canvas.setDimensions({ width: c.pxW, height: c.pxH });
              canvasPxWRef.current = c.pxW; canvasPxHRef.current = c.pxH;
              exportMultRef.current = c.mult;
              canvasMmWRef.current = savedMmW; canvasMmHRef.current = savedMmH;
              setCanvasMmW(savedMmW); setCanvasMmH(savedMmH); setPxInfo(c);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (canvas.loadFromJSON(json) as any).then(() => {
              canvas.backgroundColor = savedBg || DEFAULT_BG;
              setBgColor(savedBg || DEFAULT_BG);
              bgColorRef.current = savedBg || DEFAULT_BG;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const restoredBg = canvas.getObjects().find((o: any) => o._isBgImage) ?? null;
              bgImageObjRef.current = restoredBg;
              setHasBgImage(!!restoredBg);
              if (restoredBg) {
                const locked = !restoredBg.selectable;
                setBgLocked(locked); bgLockedRef.current = locked;
                const aspect = !!restoredBg.lockUniScaling;
                setBgAspectLock(aspect); bgAspectLockRef.current = aspect;
                const pct = Math.round((restoredBg.scaleX || 1) * 100);
                setBgScalePct(pct); setBgScaleInput(String(pct));
                setBgOpacity(restoredBg.opacity ?? 0.4);
                bgOpacityRef.current = restoredBg.opacity ?? 0.4;
              }
              canvas.renderAll();
              saveHistory();
            });
          } catch {
            // Fall through to normal empty init
            const initial = { json: canvas.toJSON(MAP_EXTRA_PROPS), bgColor: bgColorRef.current, mmW: canvasMmWRef.current, mmH: canvasMmHRef.current };
            historyRef.current = [JSON.stringify(initial)];
            historyIdxRef.current = 0;
          }
        } else {
          // normal empty init
          const initial = { json: canvas.toJSON(MAP_EXTRA_PROPS), bgColor: bgColorRef.current, mmW: canvasMmWRef.current, mmH: canvasMmHRef.current };
          historyRef.current = [JSON.stringify(initial)];
          historyIdxRef.current = 0;
        }
      }
    });

    return () => {
      disposed = true;
      try {
        if (canvas) {
          const state = JSON.stringify({
            json: canvas.toJSON(MAP_EXTRA_PROPS),
            bgColor: bgColorRef.current,
            mmW: canvasMmWRef.current,
            mmH: canvasMmHRef.current,
          });
          localStorage.setItem('mapeditor-canvas-state', state);
        }
      } catch { /* ignore */ }
      try { canvas?.dispose(); } catch { /* ignore */ }
      fabricRef.current    = null;
      fabricLibRef.current = null;
    };
  }, [saveHistory, updatePreview, syncSelProps]);

  // ── ツール切替 ────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const isLineTool = (DRAWING_TOOLS as readonly string[]).includes(mapTool);
    canvas.skipTargetFind = isLineTool || mapTool === 'stamp';
    canvas.selection      = mapTool === 'select';
    canvas.defaultCursor  = isLineTool ? 'crosshair' : 'default';
    canvas.hoverCursor    = isLineTool ? 'crosshair' : 'move';
  }, [mapTool]);

  // ── キーボードショートカット ──────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter')  { finalizePath(); }
      if (e.key === 'Escape') { cancelDrawing(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && mapToolRef.current === 'select') {
        const canvas = fabricRef.current;
        if (!canvas) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const active = canvas.getActiveObjects() as any[];
        if (active.length > 0) {
          active.forEach(o => canvas.remove(o));
          canvas.discardActiveObject();
          canvas.renderAll();
          saveHistory();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finalizePath, cancelDrawing, undo, saveHistory]);

  // ── 背景画像アップロード ──────────────────────────────────
  const handleBgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url    = ev.target?.result as string;
      const canvas = fabricRef.current;
      const fabric = fabricLibRef.current;
      if (!canvas || !fabric) return;
      if (bgImageObjRef.current) canvas.remove(bgImageObjRef.current);

      fabric.Image.fromURL(url).then((img: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const cw = canvasPxWRef.current, ch = canvasPxHRef.current;
        const nw = (img.width  as number) || cw;
        const nh = (img.height as number) || ch;
        const scale = Math.min(cw / nw, ch / nh);
        const locked = bgLockedRef.current;
        img.set({
          left: 0, top: 0, originX: 'left', originY: 'top', scaleX: scale, scaleY: scale,
          opacity: bgOpacityRef.current,
          selectable: !locked, evented: !locked, hasControls: !locked,
          lockUniScaling: bgAspectLockRef.current,
        });
        img._isBgImage = true;
        canvas.add(img);
        canvas.sendObjectToBack(img);
        bgImageObjRef.current = img;
        setHasBgImage(true);
        const pct = Math.round(scale * 100);
        setBgScalePct(pct);
        setBgScaleInput(String(pct));
        canvas.renderAll();
        saveHistory();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [saveHistory]);

  // 倍率を数値で適用
  const applyBgScale = useCallback((pctStr: string) => {
    const img = bgImageObjRef.current;
    const canvas = fabricRef.current;
    if (!img || !canvas) return;
    const pct = Math.max(1, Math.min(500, parseFloat(pctStr) || 100));
    const s = pct / 100;
    img.set({ scaleX: s, scaleY: s });
    setBgScalePct(Math.round(pct));
    setBgScaleInput(String(Math.round(pct)));
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);

  const removeBgImage = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !bgImageObjRef.current) return;
    canvas.remove(bgImageObjRef.current);
    bgImageObjRef.current = null;
    setHasBgImage(false);
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);

  // ── カバーデザイナー連携 ───────────────────────────────────
  const doSaveMap = useCallback((name: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const thumbnail = canvas.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabricJson = canvas.toJSON(MAP_EXTRA_PROPS) as any;
    const id = editingMapId || Date.now().toString();
    const map: SavedMap = {
      id,
      name: name || 'マップ背景',
      thumbnail,
      fabricJson,
      bgColor: bgColorRef.current,
      mmW: canvasMmWRef.current,
      mmH: canvasMmHRef.current,
      createdAt: Date.now(),
    };
    saveMap(map);
    setEditingMapId(id);
    setShowSavePanel(false);
  }, [editingMapId]);

  const applyToDesigner = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const pngDataUrl = canvas.toDataURL({ format: 'png', multiplier: exportMultRef.current });
    sessionStorage.setItem('mapApplyPng', pngDataUrl);
    sessionStorage.setItem('mapApplyMeta', JSON.stringify({ mmW: canvasMmWRef.current, mmH: canvasMmHRef.current }));
    router.push('/cover-designer');
  }, [router]);

  // ── PNG 書き出し（300 DPI 相当）────────────────────────────
  const exportPng = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const mult = Math.round(exportMultRef.current * 10) / 10;
    const url  = canvas.toDataURL({ format: 'png', multiplier: mult });
    const a    = document.createElement('a');
    a.href = url; a.download = 'map.png'; a.click();
  }, []);

  // ── ツール選択 ────────────────────────────────────────────
  const selectTool = useCallback((t: MapTool) => {
    if (anchorPointsRef.current.length > 0) cancelDrawing();
    setMapTool(t);
    if (t === 'road')    { setLineColor('#d4c4b0'); setStrokeWidth(4); }
    if (t === 'railway') { setLineColor('#4A3E2E'); }
    if (t === 'bridge')  { setBridgeColor('#4A3E2E'); }
    if (t === 'river')   { setRiverColor('#b5d0dc'); setRiverWidth(9); }
  }, [cancelDrawing]);

  // ── JSX ──────────────────────────────────────────────────
  const isLineTool = (DRAWING_TOOLS as readonly string[]).includes(mapTool);

  const toolLabel: Record<MapTool, string> = {
    select: '選択', road: '道路', railway: '線路',
    river: '川', greenarea: '緑地', bridge: '橋', plaza: '広場', stamp: 'スタンプ',
  };

  const TOOLS: { id: MapTool; icon: React.ReactNode; title: string }[] = [
    { id: 'select',    icon: <MousePointer2 size={18} />, title: '選択' },
    { id: 'road',      icon: <RoadIcon />,                title: '道路' },
    { id: 'railway',   icon: <RailwayIcon />,             title: '線路' },
    { id: 'river',     icon: <RiverIcon />,               title: '川' },
    { id: 'greenarea', icon: <GreenAreaIcon />,           title: '緑地（公園・森）' },
    { id: 'bridge',    icon: <BridgeIcon />,              title: '橋' },
    { id: 'plaza',     icon: <PlazaIcon />,               title: '広場・オープンスペース' },
    { id: 'stamp',     icon: <StampIcon />,               title: 'スタンプ' },
  ];

  const canFinalize = anchorCount >= minAnchor(mapTool);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  background: 'var(--bg)', color: 'var(--text)' }}>
      <AppHeader>
        {/* ① 編集系 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setGridSnap(v => !v)} title={gridSnap ? 'グリッドスナップON' : 'グリッドスナップOFF'}
            style={S.tbBtn(gridSnap)}
            onMouseEnter={e => { if (!gridSnap) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (!gridSnap) e.currentTarget.style.background = '#1A3358'; }}>
            <Magnet size={14} />
          </button>
          <button onClick={undo} disabled={!canUndo} title="元に戻す (⌘Z)"
            style={{ ...S.tbBtn(), opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = '#243F66'; }}
            onMouseLeave={e => { if (canUndo) e.currentTarget.style.background = '#1A3358'; }}>
            <Undo2 size={14} />
          </button>
        </div>
        <div style={{ width: 1, height: 20, background: '#2A4570' }} />
        {/* ② サイズ */}
        <button onClick={() => setShowSizeModal(true)} title="サイズ変更"
          style={{ ...S.tbBtn(), minWidth: 'fit-content' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#243F66'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1A3358'; }}>
          <Maximize2 size={14} />
          <span style={{ color: '#C9A84C' }}>{canvasMmW}×{canvasMmH}mm</span>
        </button>
      </AppHeader>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 左ツールバー ──────────────────────────────────── */}
        <div style={{ width: 52, background: 'var(--surface)', borderRight: '1px solid var(--border)',
                      padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TOOLS.map(t => (
            <button key={t.id} title={t.title} onClick={() => selectTool(t.id)}
              style={S.toolBtn(mapTool === t.id)}>
              {t.icon}
            </button>
          ))}
        </div>

        {/* ── キャンバスエリア ─────────────────────────────── */}
        <div ref={canvasContainerRef} style={{ flex: 1, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'auto', padding: 20 }}>
          <div style={{ boxShadow: '0 2px 18px rgba(0,0,0,0.2)', display: 'inline-block' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* ── 右パネル ─────────────────────────────────────── */}
        <div style={{ ...S.panel, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>

          {/* ════ キャンバス設定 ════ */}
          <div style={S.sectionHead}>キャンバス設定</div>

          {/* 背景色 */}
          <div>
            <div style={S.lbl}>背景色</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5 }}>
              {BG_COLOR_PRESETS.map(p => (
                <button key={p.color} title={p.label} onClick={() => setBgColor(p.color)}
                  style={{ width: 22, height: 22, borderRadius: 4, cursor: 'pointer', padding: 0,
                            background: p.color, flexShrink: 0,
                            border: bgColor === p.color ? '2px solid var(--accent)' : '1px solid var(--border)',
                            outline:       bgColor === p.color ? '1px solid var(--accent)' : 'none',
                            outlineOffset: 1 }} />
              ))}
            </div>
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
              style={{ width: '100%', height: 26, borderRadius: 5, border: '1px solid var(--border)',
                        cursor: 'pointer' }} />
          </div>

          {/* グリッド間隔（スナップON時のみ表示） */}
          {gridSnap && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#888' }}>グリッド間隔</span>
              <input type="number" min={2} max={50} step={1} value={gridSize}
                onChange={e => setGridSize(Number(e.target.value) || 10)}
                style={{ ...S.input, width: 48, textAlign: 'center' }} />
              <span style={{ fontSize: 10, color: '#888' }}>px</span>
            </div>
          )}

          <div style={S.divider} />

          {/* ════ 線ツール プロパティ ════ */}
          {isLineTool && (
            <>
              <div style={S.sectionHead}>{toolLabel[mapTool]}</div>

              {/* 道路 */}
              {mapTool === 'road' && (
                <>
                  <div>
                    <div style={S.lbl}>色</div>
                    <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>太さ</span><span style={{ color: 'var(--accent)' }}>{strokeWidth}px</span>
                    </div>
                    <input type="range" min={2} max={30} step={1} value={strokeWidth}
                      onChange={e => setStrokeWidth(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox" checked={roadDouble} onChange={e => setRoadDouble(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }} />
                    二重線（鉛筆重ね書き）
                  </label>
                </>
              )}

              {/* 線路 */}
              {mapTool === 'railway' && (
                <>
                  <div>
                    <div style={S.lbl}>色</div>
                    <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>レール間隔</span><span style={{ color: 'var(--accent)' }}>{railGap}px</span>
                    </div>
                    <input type="range" min={4} max={24} step={1} value={railGap}
                      onChange={e => setRailGap(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>枕木間隔</span><span style={{ color: 'var(--accent)' }}>{sleeperGap}px</span>
                    </div>
                    <input type="range" min={6} max={32} step={1} value={sleeperGap}
                      onChange={e => setSleeperGap(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {/* 川 */}
              {mapTool === 'river' && (
                <>
                  <div>
                    <div style={S.lbl}>色</div>
                    <input type="color" value={riverColor} onChange={e => setRiverColor(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>太さ</span><span style={{ color: 'var(--accent)' }}>{riverWidth}px</span>
                    </div>
                    <input type="range" min={1} max={30} step={0.5} value={riverWidth}
                      onChange={e => setRiverWidth(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {/* 緑地 */}
              {mapTool === 'greenarea' && (
                <>
                  <div>
                    <div style={S.lbl}>塗り色</div>
                    <input type="color" value={greenFill} onChange={e => setGreenFill(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>塗り透明度</span>
                      <span style={{ color: 'var(--accent)' }}>{Math.round(greenFillOpacity * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.05} value={greenFillOpacity}
                      onChange={e => setGreenFillOpacity(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={S.lbl}>輪郭色</div>
                    <input type="color" value={greenStroke} onChange={e => setGreenStroke(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>輪郭の太さ</span>
                      <span style={{ color: 'var(--accent)' }}>{greenStrokeW}px</span>
                    </div>
                    <input type="range" min={1} max={10} step={0.5} value={greenStrokeW}
                      onChange={e => setGreenStrokeW(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {/* 橋 */}
              {mapTool === 'bridge' && (
                <>
                  <div>
                    <div style={S.lbl}>色</div>
                    <input type="color" value={bridgeColor} onChange={e => setBridgeColor(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>ハッチ長さ</span><span style={{ color: 'var(--accent)' }}>{bridgeHatchLen}px</span>
                    </div>
                    <input type="range" min={4} max={24} step={1} value={bridgeHatchLen}
                      onChange={e => setBridgeHatchLen(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>ハッチ間隔</span><span style={{ color: 'var(--accent)' }}>{bridgeHatchGap}px</span>
                    </div>
                    <input type="range" min={4} max={24} step={1} value={bridgeHatchGap}
                      onChange={e => setBridgeHatchGap(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>線の太さ</span><span style={{ color: 'var(--accent)' }}>{bridgeStrokeW}px</span>
                    </div>
                    <input type="range" min={0.5} max={4} step={0.5} value={bridgeStrokeW}
                      onChange={e => setBridgeStrokeW(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {/* 広場 */}
              {mapTool === 'plaza' && (
                <>
                  <div>
                    <div style={S.lbl}>色</div>
                    <input type="color" value={plazaColor} onChange={e => setPlazaColor(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>線の太さ</span><span style={{ color: 'var(--accent)' }}>{plazaStrokeW}px</span>
                    </div>
                    <input type="range" min={0.5} max={4} step={0.5} value={plazaStrokeW}
                      onChange={e => setPlazaStrokeW(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>破線 長さ</span><span style={{ color: 'var(--accent)' }}>{plazaDashLen}</span>
                    </div>
                    <input type="range" min={2} max={16} step={1} value={plazaDashLen}
                      onChange={e => setPlazaDashLen(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>破線 間隔</span><span style={{ color: 'var(--accent)' }}>{plazaDashGap}</span>
                    </div>
                    <input type="range" min={2} max={16} step={1} value={plazaDashGap}
                      onChange={e => setPlazaDashGap(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {/* 手ブレ量（bridge・plaza 以外） */}
              {!['bridge', 'plaza'].includes(mapTool) && (
                <div>
                  <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                    <span>手ブレ量</span><span style={{ color: 'var(--accent)' }}>{jitterAmt}px</span>
                  </div>
                  <input type="range" min={0} max={10} step={0.5} value={jitterAmt}
                    onChange={e => setJitterAmt(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              )}

              <div style={S.divider} />

              {/* アンカー点情報 & 確定 / キャンセル */}
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
                {anchorCount === 0
                  ? mapTool === 'greenarea'
                    ? 'クリックで頂点を追加（3点以上）'
                    : mapTool === 'plaza'
                    ? '1点目: 角を指定'
                    : 'クリックで点を追加'
                  : mapTool === 'plaza' && anchorCount === 1
                  ? '2点目: 対角を指定'
                  : `アンカー点 ${anchorCount} 個`}
                {canFinalize && (
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    {mapTool === 'greenarea' ? 'Enter で閉じて確定' : 'Enter で確定'}
                  </div>
                )}
              </div>
              {canFinalize && mapTool !== 'plaza' && (
                <button onClick={finalizePath} style={S.btn('accent')}>確定 (Enter)</button>
              )}
              {anchorCount > 0 && (
                <button onClick={cancelDrawing} style={S.btn('ghost-danger')}>
                  キャンセル (Esc)
                </button>
              )}
            </>
          )}

          {/* スタンプ一覧 */}
          {mapTool === 'stamp' && (
            <>
              <div style={S.sectionHead}>スタンプ配置</div>
              {stamps.length === 0 ? (
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  スタンプエディターでスタンプを登録してください
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {stamps.map(s => (
                    <div key={s.id} onClick={() => setSelectedStamp(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8,
                               padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                               background: selectedStamp?.id === s.id ? 'rgba(201,168,76,0.15)' : 'var(--bg)',
                               border: `1px solid ${selectedStamp?.id === s.id ? 'var(--accent)' : 'var(--border)'}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumbnail} alt={s.name}
                        style={{ width: 28, height: 28, objectFit: 'contain',
                                 background: '#fff', borderRadius: 3, padding: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1, minWidth: 0,
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {selectedStamp && (
                <div style={{ fontSize: 11, color: 'var(--accent)', textAlign: 'center' }}>
                  「{selectedStamp.name}」を配置中
                </div>
              )}
              <div style={{ fontSize: 10, color: '#888', textAlign: 'center' }}>クリックで配置</div>
            </>
          )}

          {/* 選択モード */}
          {mapTool === 'select' && !hasMapSel && (
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.7 }}>
              オブジェクトを選択して<br />移動・削除できます。<br />
              <span style={{ color: 'var(--accent)' }}>Delete</span> キーで削除
            </div>
          )}

          {/* 選択オブジェクト プロパティ編集 */}
          {mapTool === 'select' && hasMapSel && (
            <>
              <div style={S.sectionHead}>
                {({ road: '道路', railway: '線路', river: '川', greenarea: '緑地', bridge: '橋', plaza: '広場' } as Record<string,string>)[selType] ?? selType}
                {selCount > 1 && <span style={{ fontWeight: 400, color: '#888' }}> × {selCount}</span>}
              </div>

              {/* 線の色 */}
              <div>
                <div style={S.lbl}>線の色</div>
                <input type="color" value={selStroke}
                  onChange={e => { setSelStroke(e.target.value); applySelStroke(e.target.value); }}
                  style={{ width: '100%', height: 28, borderRadius: 5 }} />
              </div>

              {/* 線の太さ (road / greenarea / bridge / plaza) */}
              {(selType === 'road' || selType === 'greenarea' || selType === 'plaza' || selType === 'bridge') && (
                <div>
                  <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                    <span>線の太さ</span><span style={{ color: 'var(--accent)' }}>{selStrokeW}px</span>
                  </div>
                  <input type="range" min={1} max={30} step={1} value={selStrokeW}
                    onChange={e => { setSelStrokeW(Number(e.target.value)); applySelStrokeW(Number(e.target.value)); }}
                    style={{ width: '100%' }} />
                </div>
              )}
              {selType === 'river' && (
                <div>
                  <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                    <span>線の太さ</span><span style={{ color: 'var(--accent)' }}>{selStrokeW}px</span>
                  </div>
                  <input type="range" min={1} max={30} step={0.5} value={selStrokeW}
                    onChange={e => { setSelStrokeW(Number(e.target.value)); applySelStrokeW(Number(e.target.value)); }}
                    style={{ width: '100%' }} />
                </div>
              )}

              {/* 塗り (greenarea のみ) */}
              {selType === 'greenarea' && (
                <>
                  <div>
                    <div style={S.lbl}>塗りの色</div>
                    <input type="color" value={selFill}
                      onChange={e => { setSelFill(e.target.value); selFillRef.current = e.target.value; applySelFillColor(e.target.value, selFillOpRef.current); }}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>塗りの透明度</span>
                      <span style={{ color: 'var(--accent)' }}>{Math.round(selFillOp * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.05} value={selFillOp}
                      onChange={e => { const v = Number(e.target.value); setSelFillOp(v); selFillOpRef.current = v; applySelFillColor(selFillRef.current, v); }}
                      style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {/* ジッター（再構築が必要なため mouseUp で適用; bridge・plaza はスキップ） */}
              {!['bridge', 'plaza'].includes(selType) && (
                <div>
                  <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                    <span>手ブレ量</span><span style={{ color: 'var(--accent)' }}>{selJitter}px</span>
                  </div>
                  <input type="range" min={0} max={10} step={0.5} value={selJitter}
                    onChange={e => setSelJitter(Number(e.target.value))}
                    onMouseUp={e => applySelJitter(Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={e => applySelJitter(Number((e.target as HTMLInputElement).value))}
                    style={{ width: '100%' }} />
                  <div style={{ fontSize: 9, color: '#888', textAlign: 'right' }}>マウスを離すと適用</div>
                </div>
              )}
              {/* レイヤー操作 */}
              <div style={S.lbl}>レイヤー</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {([
                  { label: '最前面', fn: (c: any, o: any) => (c.bringObjectToFront ?? c.bringToFront).call(c, o) },
                  { label: '最背面', fn: (c: any, o: any) => (c.sendObjectToBack  ?? c.sendToBack).call(c, o) },
                  { label: '前面へ', fn: (c: any, o: any) => (c.bringObjectForward  ?? c.bringForward).call(c, o) },
                  { label: '背面へ', fn: (c: any, o: any) => (c.sendObjectBackwards ?? c.sendBackwards).call(c, o) },
                ] as { label: string; fn: (c: any, o: any) => void }[]).map(({ label, fn }) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <button key={label} style={{ ...S.btn(), fontSize: 10, padding: '5px 4px', justifyContent: 'center' }}
                    onClick={() => {
                      const c = fabricRef.current; const obj = c?.getActiveObject();
                      if (!c || !obj) return;
                      fn(c, obj); c.renderAll(); saveHistory();
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={S.divider} />
            </>
          )}

          {/* ════ 下絵（背景画像） ════ */}
          <div style={S.divider} />
          <div style={S.sectionHead}>下絵（背景画像）</div>
          <label style={{ ...S.btn(), cursor: 'pointer' }}>
            <Upload size={11} /> アップロード
            <input type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />
          </label>
          {hasBgImage && (
            <>
              {/* ロック切り替え */}
              <button
                onClick={() => setBgLocked(v => !v)}
                style={{
                  ...S.btn(bgLocked ? undefined : 'accent'),
                  justifyContent: 'center', gap: 5,
                  borderColor: bgLocked ? 'var(--border)' : 'var(--accent)',
                }}>
                {bgLocked ? '🔒 ロック中（移動不可）' : '🔓 移動・リサイズ可'}
              </button>

              {/* 移動・リサイズ時のみ表示するコントロール */}
              {!bgLocked && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                    <input type="checkbox" checked={bgAspectLock}
                      onChange={e => setBgAspectLock(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }} />
                    縦横比を固定
                  </label>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>倍率</span>
                      <span style={{ color: 'var(--accent)' }}>{bgScalePct}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="number" min={1} max={500} step={1}
                        value={bgScaleInput}
                        onChange={e => setBgScaleInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyBgScale(bgScaleInput)}
                        style={{ ...S.input, flex: 1, textAlign: 'center' }} />
                      <span style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>%</span>
                      <button onClick={() => applyBgScale(bgScaleInput)}
                        style={{ ...S.btn('accent'), width: 'auto', padding: '3px 8px', fontSize: 10 }}>
                        適用
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 不透明度（常に表示） */}
              <div>
                <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                  <span>不透明度</span>
                  <span style={{ color: 'var(--accent)' }}>{Math.round(bgOpacity * 100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.05} value={bgOpacity}
                  onChange={e => setBgOpacity(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <button onClick={removeBgImage} style={S.btn('ghost-danger')}>
                <Trash2 size={11} /> 背景を削除
              </button>
            </>
          )}

          {/* ════ カバーデザイナー連携 ════ */}
          <div style={S.divider} />
          <div style={S.sectionHead}>カバーデザイナー連携</div>

          {/* Save panel toggle */}
          {!showSavePanel ? (
            <button onClick={() => { setSaveName(editingMapId ? (getSavedMaps().find((m: SavedMap) => m.id === editingMapId)?.name ?? '') : ''); setShowSavePanel(true); }} style={S.btn()}>
              💾 背景として保存...
            </button>
          ) : (
            <div>
              <div style={S.lbl}>{editingMapId ? '上書き保存' : '名前を入力'}</div>
              <input
                autoFocus
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSaveMap(saveName)}
                placeholder="マップ背景"
                style={{ ...S.input, width: '100%', marginBottom: 4 }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => doSaveMap(saveName)} style={{ ...S.btn('accent'), flex: 1 }}>保存</button>
                <button onClick={() => setShowSavePanel(false)} style={{ ...S.btn(), flex: 1 }}>キャンセル</button>
              </div>
            </div>
          )}

          {editingMapId && (
            <div style={{ fontSize: 10, color: 'var(--accent)', textAlign: 'center' }}>
              保存済み ✓
            </div>
          )}

          <button onClick={applyToDesigner} style={S.btn('accent')}>
            カバーデザイナーに適用 →
          </button>

          {/* ════ 書き出し ════ */}
          <div style={S.divider} />
          <button onClick={exportPng} style={S.btn()}>
            <Download size={11} /> PNG 書き出し（300 DPI）
          </button>
        </div>
      </div>

      {/* ══ サイズ設定モーダル ══════════════════════════════════ */}
      {showSizeModal && (
        <div onClick={() => setShowSizeModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24,
                     width: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>サイズ設定</span>
              <button onClick={() => setShowSizeModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                         color: 'var(--text)', padding: 4, borderRadius: 4 }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CANVAS_PRESETS.map(p => (
                <button key={p.name} onClick={() => {
                  setActiveSizeName(p.name);
                  applyCanvasSize(p.mmW, p.mmH);
                  setShowSizeModal(false);
                }} style={{
                  ...S.btn(),
                  justifyContent: 'space-between',
                  border: `1px solid ${activeSizeName === p.name ? '#C9A84C' : 'var(--border)'}`,
                  color: activeSizeName === p.name ? '#C9A84C' : 'var(--text)',
                  background: activeSizeName === p.name ? 'rgba(201,168,76,0.1)' : 'var(--bg)',
                }}>
                  <span>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>{p.mmW}×{p.mmH}mm</span>
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ ...S.lbl, marginBottom: 8 }}>カスタムサイズ</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.lbl, marginBottom: 2 }}>幅 mm</div>
                  <input type="number" value={customMmW} min={50} max={1200}
                    onChange={e => setCustomMmW(Number(e.target.value))}
                    style={{ width: '100%', ...S.input }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.lbl, marginBottom: 2 }}>高さ mm</div>
                  <input type="number" value={customMmH} min={50} max={1200}
                    onChange={e => setCustomMmH(Number(e.target.value))}
                    style={{ width: '100%', ...S.input }} />
                </div>
              </div>
              <button onClick={() => {
                const mmW = Math.max(50, Math.min(1200, customMmW || canvasMmWRef.current));
                const mmH = Math.max(50, Math.min(1200, customMmH || canvasMmHRef.current));
                setActiveSizeName('カスタム');
                applyCanvasSize(mmW, mmH);
                setShowSizeModal(false);
              }} style={{ ...S.btn(), width: '100%' }}>
                このサイズを適用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
