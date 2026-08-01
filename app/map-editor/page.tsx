'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MousePointer2, Undo2, Trash2, Download, Upload } from 'lucide-react';
import { getStamps } from '@/lib/stampStorage';
import type { Stamp } from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import {
  jitteredBezierPathStr,
  buildRoadObjects,
  buildRailwayObjects,
  buildRiverObjects,
  type Point,
} from '@/lib/handDrawnPath';

// ── キャンバスサイズプリセット ────────────────────────────────
type CanvasPreset = { id: string; label: string; sub: string; w: number; h: number };
const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'square',  label: '正方形',     sub: '600 × 600',  w: 600, h: 600 },
  { id: 'land43',  label: '横長 4:3',   sub: '640 × 480',  w: 640, h: 480 },
  { id: 'land169', label: '横長 16:9',  sub: '720 × 405',  w: 720, h: 405 },
  { id: 'port',    label: '縦長 3:4',   sub: '480 × 640',  w: 480, h: 640 },
  { id: 'a4p',     label: 'A4 縦',      sub: '500 × 707',  w: 500, h: 707 },
  { id: 'a4l',     label: 'A4 横',      sub: '707 × 500',  w: 707, h: 500 },
  { id: 'custom',  label: 'カスタム',   sub: '自由設定',   w: 700, h: 500 },
];
const DEFAULT_PRESET = CANVAS_PRESETS[1]; // 横長 4:3

// ── 背景色プリセット ──────────────────────────────────────────
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
const DEFAULT_BG = '#F5F0E8';

// ── 描画ツール識別 ────────────────────────────────────────────
const DRAWING_TOOLS = ['road', 'railway', 'river'] as const;
const MAP_EXTRA_PROPS = ['_mapLineType', '_isBgImage', '_mapStampId'];

type MapTool = 'select' | 'road' | 'railway' | 'river' | 'stamp';

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
    width: 228, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9,
    overflowY: 'auto', flexShrink: 0,
  } as React.CSSProperties,
  lbl: {
    fontSize: 10, color: '#888', fontWeight: 700, letterSpacing: 0.4, marginBottom: 2,
  } as React.CSSProperties,
  sectionHead: {
    fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 2,
  } as React.CSSProperties,
  input: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 5, color: 'var(--text)', padding: '3px 6px', fontSize: 12,
  } as React.CSSProperties,
  btn: (variant?: 'accent' | 'ghost-danger'): React.CSSProperties => ({
    width: '100%', padding: '6px 0', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    ...(variant === 'accent'
      ? { background: 'var(--accent)', color: '#0F2340', border: 'none' }
      : variant === 'ghost-danger'
      ? { background: 'transparent', color: '#C0392B', border: '1px solid #C0392B' }
      : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }),
  }),
  divider: { height: 1, background: 'var(--border)', flexShrink: 0 } as React.CSSProperties,
};

// ── ツールアイコン ────────────────────────────────────────────
const RoadIcon    = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}><line x1="2" y1="7" x2="18" y2="7" /><line x1="2" y1="13" x2="18" y2="13" /></svg>;
const RailwayIcon = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}><line x1="4" y1="4" x2="4" y2="16" /><line x1="16" y1="4" x2="16" y2="16" /><line x1="4" y1="7" x2="16" y2="7" /><line x1="4" y1="10" x2="16" y2="10" /><line x1="4" y1="13" x2="16" y2="13" /></svg>;
const RiverIcon   = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M2 7 Q5 5 8 7 Q11 9 14 7 Q17 5 18 7" /><path d="M2 13 Q5 11 8 13 Q11 15 14 13 Q17 11 18 13" /></svg>;
const StampIcon   = () => <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="10" cy="8" r="4.5" /><rect x="6" y="14" width="8" height="2.5" rx="1" /><line x1="10" y1="12.5" x2="10" y2="14" /></svg>;

export default function MapEditor() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const fabricLibRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── ツール ──────────────────────────────────────────────────
  const [mapTool, setMapTool] = useState<MapTool>('select');
  const mapToolRef = useRef<MapTool>('select');
  useEffect(() => { mapToolRef.current = mapTool; }, [mapTool]);

  // ── アンカー点（描画モード） ────────────────────────────────
  const anchorPointsRef = useRef<Point[]>([]);
  const [anchorCount, setAnchorCount] = useState(0);
  const previewObjsRef = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── 線プロパティ ────────────────────────────────────────────
  const [lineColor,   setLineColor]   = useState('#C8B89A');
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [jitterAmt,   setJitterAmt]   = useState(3);
  const [roadDouble,  setRoadDouble]  = useState(false);
  const [railGap,     setRailGap]     = useState(10);
  const [sleeperGap,  setSleeperGap]  = useState(14);
  const [riverWidth,  setRiverWidth]  = useState(20);
  const [riverFill,   setRiverFill]   = useState('#B0D4E8');
  const [riverStroke, setRiverStroke] = useState('#7BAEC8');

  const lineColorRef   = useRef('#C8B89A');
  const strokeWidthRef = useRef(8);
  const jitterAmtRef   = useRef(3);
  const roadDoubleRef  = useRef(false);
  const railGapRef     = useRef(10);
  const sleeperGapRef  = useRef(14);
  const riverWidthRef  = useRef(20);
  const riverFillRef   = useRef('#B0D4E8');
  const riverStrokeRef = useRef('#7BAEC8');

  useEffect(() => { lineColorRef.current   = lineColor;   }, [lineColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { jitterAmtRef.current   = jitterAmt;   }, [jitterAmt]);
  useEffect(() => { roadDoubleRef.current  = roadDouble;  }, [roadDouble]);
  useEffect(() => { railGapRef.current     = railGap;     }, [railGap]);
  useEffect(() => { sleeperGapRef.current  = sleeperGap;  }, [sleeperGap]);
  useEffect(() => { riverWidthRef.current  = riverWidth;  }, [riverWidth]);
  useEffect(() => { riverFillRef.current   = riverFill;   }, [riverFill]);
  useEffect(() => { riverStrokeRef.current = riverStroke; }, [riverStroke]);

  // ── キャンバスサイズ ────────────────────────────────────────
  const [canvasPresetId, setCanvasPresetId] = useState(DEFAULT_PRESET.id);
  const [canvasW, setCanvasW] = useState(DEFAULT_PRESET.w);
  const [canvasH, setCanvasH] = useState(DEFAULT_PRESET.h);
  const [customW, setCustomW] = useState(String(DEFAULT_PRESET.w));
  const [customH, setCustomH] = useState(String(DEFAULT_PRESET.h));
  const canvasWRef = useRef(DEFAULT_PRESET.w);
  const canvasHRef = useRef(DEFAULT_PRESET.h);
  useEffect(() => { canvasWRef.current = canvasW; }, [canvasW]);
  useEffect(() => { canvasHRef.current = canvasH; }, [canvasH]);

  // ── 背景色 ──────────────────────────────────────────────────
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
  const bgColorRef = useRef(DEFAULT_BG);
  useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);

  // bgColor 変更 → キャンバスに即時反映
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    canvas.renderAll();
  }, [bgColor]);

  // ── 背景画像 ────────────────────────────────────────────────
  const [bgOpacity,  setBgOpacity]  = useState(0.4);
  const [hasBgImage, setHasBgImage] = useState(false);
  const bgOpacityRef  = useRef(0.4);
  const bgImageObjRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => { bgOpacityRef.current = bgOpacity; }, [bgOpacity]);

  useEffect(() => {
    if (!bgImageObjRef.current || !fabricRef.current) return;
    bgImageObjRef.current.set({ opacity: bgOpacity });
    fabricRef.current.renderAll();
  }, [bgOpacity]);

  // ── スタンプ ────────────────────────────────────────────────
  const [stamps,        setStamps]        = useState<Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null);
  const selectedStampRef = useRef<Stamp | null>(null);
  useEffect(() => { selectedStampRef.current = selectedStamp; }, [selectedStamp]);
  useEffect(() => { setStamps(getStamps()); }, []);

  // ── 履歴 ────────────────────────────────────────────────────
  const historyRef    = useRef<string[]>([]);
  const historyIdxRef = useRef(0);

  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const state = { json: canvas.toJSON(MAP_EXTRA_PROPS), bgColor: bgColorRef.current };
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(JSON.stringify(state));
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      const { json, bgColor: savedBg } = JSON.parse(historyRef.current[historyIdxRef.current]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvas.loadFromJSON(json) as any).then(() => {
        canvas.backgroundColor = savedBg ?? bgColorRef.current;
        setBgColor(savedBg ?? bgColorRef.current);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bgImageObjRef.current = canvas.getObjects().find((o: any) => o._isBgImage) ?? null;
        setHasBgImage(!!bgImageObjRef.current);
        canvas.renderAll();
      });
    } catch { /* 破損データは無視 */ }
  }, []);

  // ── プレビュー更新 ─────────────────────────────────────────
  const updatePreview = useCallback((mousePt?: Point) => {
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    previewObjsRef.current.forEach(o => canvas.remove(o));
    previewObjsRef.current = [];

    const pts = anchorPointsRef.current;
    if (pts.length === 0) { canvas.renderAll(); return; }

    const previewStyle = {
      stroke: '#4A90E2', strokeWidth: 1.5,
      fill: 'transparent', strokeDashArray: [6, 3],
      selectable: false, evented: false,
    };

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
      const path = new fabric.Path(d, previewStyle);
      previewObjsRef.current.push(path);
      canvas.add(path);
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

    if (pts.length >= 2) {
      const tool = mapToolRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let objs: any[] = [];
      if (tool === 'road') {
        objs = buildRoadObjects(fabric, pts, {
          color: lineColorRef.current, strokeWidth: strokeWidthRef.current,
          jitter: jitterAmtRef.current, doubleStroke: roadDoubleRef.current,
        });
      } else if (tool === 'railway') {
        objs = [buildRailwayObjects(fabric, pts, {
          color: lineColorRef.current, railWidth: 2,
          jitter: jitterAmtRef.current,
          railGap: railGapRef.current, sleeperGap: sleeperGapRef.current,
        })];
      } else if (tool === 'river') {
        objs = [buildRiverObjects(fabric, pts, {
          fillColor: riverFillRef.current, strokeColor: riverStrokeRef.current,
          width: riverWidthRef.current, jitter: jitterAmtRef.current,
        })];
      }
      objs.forEach(o => canvas.add(o));
      canvas.renderAll();
      saveHistory();
    }
    anchorPointsRef.current = [];
    setAnchorCount(0);
  }, [saveHistory]);

  const cancelDrawing = useCallback(() => {
    const canvas = fabricRef.current;
    previewObjsRef.current.forEach(o => canvas?.remove(o));
    previewObjsRef.current = [];
    anchorPointsRef.current = [];
    setAnchorCount(0);
    canvas?.renderAll();
  }, []);

  // ── キャンバスサイズ変更 ────────────────────────────────────
  const applyCanvasSize = useCallback((w: number, h: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: w, height: h });
    canvasWRef.current = w;
    canvasHRef.current = h;
    // 背景画像をキャンバスに合わせてリスケール
    const img = bgImageObjRef.current;
    if (img) {
      const nw = img.width  as number;
      const nh = img.height as number;
      if (nw && nh) {
        const scale = Math.min(w / nw, h / nh);
        img.set({ scaleX: scale, scaleY: scale, left: 0, top: 0 });
      }
    }
    canvas.renderAll();
    saveHistory();
  }, [saveHistory]);

  const handlePresetSelect = useCallback((preset: CanvasPreset) => {
    setCanvasPresetId(preset.id);
    if (preset.id !== 'custom') {
      setCanvasW(preset.w);
      setCanvasH(preset.h);
      setCustomW(String(preset.w));
      setCustomH(String(preset.h));
      applyCanvasSize(preset.w, preset.h);
    }
  }, [applyCanvasSize]);

  const applyCustomSize = useCallback(() => {
    const w = Math.max(100, Math.min(2000, parseInt(customW) || canvasWRef.current));
    const h = Math.max(100, Math.min(2000, parseInt(customH) || canvasHRef.current));
    setCanvasW(w);
    setCanvasH(h);
    setCustomW(String(w));
    setCustomH(String(h));
    applyCanvasSize(w, h);
  }, [customW, customH, applyCanvasSize]);

  // ── キャンバス初期化 ────────────────────────────────────────
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
        width: canvasWRef.current,
        height: canvasHRef.current,
        backgroundColor: bgColorRef.current,
      });
      fabricRef.current = canvas;

      const initial = { json: canvas.toJSON(MAP_EXTRA_PROPS), bgColor: bgColorRef.current };
      historyRef.current    = [JSON.stringify(initial)];
      historyIdxRef.current = 0;

      // mouse:up: アンカー追加 or スタンプ配置
      canvas.on('mouse:up', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const tool = mapToolRef.current;
        const pt   = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
        if (!pt) return;

        if ((DRAWING_TOOLS as readonly string[]).includes(tool)) {
          anchorPointsRef.current.push({ x: pt.x, y: pt.y });
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

      // mouse:move: プレビュー
      canvas.on('mouse:move', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!(DRAWING_TOOLS as readonly string[]).includes(mapToolRef.current)) return;
        if (anchorPointsRef.current.length === 0) return;
        const pt = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
        if (pt) updatePreview({ x: pt.x, y: pt.y });
      });

      // Delete キーで選択オブジェクト削除
      canvas.on('key:down', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (opt.e?.key === 'Delete' || opt.e?.key === 'Backspace') {
          const active = canvas.getActiveObjects();
          if (active.length > 0) {
            active.forEach((o: any) => canvas.remove(o)); // eslint-disable-line @typescript-eslint/no-explicit-any
            canvas.discardActiveObject();
            canvas.renderAll();
            saveHistory();
          }
        }
      });

      canvas.on('object:modified', saveHistory);
    });

    return () => {
      disposed = true;
      try { canvas?.dispose(); } catch { /* ignore */ }
      fabricRef.current    = null;
      fabricLibRef.current = null;
    };
  }, [saveHistory, updatePreview]);

  // ── ツール切替時のキャンバス設定 ──────────────────────────
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
        const active = canvas.getActiveObjects();
        if (active.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          active.forEach((o: any) => canvas.remove(o));
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
        const cw = canvasWRef.current;
        const ch = canvasHRef.current;
        const nw = img.width  as number || cw;
        const nh = img.height as number || ch;
        // キャンバスにフィットするスケールで配置
        const scale = Math.min(cw / nw, ch / nh);
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale,
                  opacity: bgOpacityRef.current, selectable: false, evented: false });
        img._isBgImage = true;
        canvas.add(img);
        canvas.sendObjectToBack(img);
        bgImageObjRef.current = img;
        setHasBgImage(true);
        canvas.renderAll();
        saveHistory();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

  // ── PNG 書き出し ──────────────────────────────────────────
  const exportPng = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const a   = document.createElement('a');
    a.href = url; a.download = 'map.png'; a.click();
  }, []);

  // ── ツール選択 ────────────────────────────────────────────
  const selectTool = useCallback((t: MapTool) => {
    if (anchorPointsRef.current.length > 0) cancelDrawing();
    setMapTool(t);
    if (t === 'road')    setLineColor('#C8B89A');
    if (t === 'railway') setLineColor('#555555');
  }, [cancelDrawing]);

  // ── JSX ──────────────────────────────────────────────────
  const isLineTool = (DRAWING_TOOLS as readonly string[]).includes(mapTool);

  const TOOLS: { id: MapTool; icon: React.ReactNode; title: string }[] = [
    { id: 'select',  icon: <MousePointer2 size={18} />, title: '選択' },
    { id: 'road',    icon: <RoadIcon />,                title: '道路' },
    { id: 'railway', icon: <RailwayIcon />,             title: '線路' },
    { id: 'river',   icon: <RiverIcon />,               title: '川' },
    { id: 'stamp',   icon: <StampIcon />,               title: 'スタンプ' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
                  background: 'var(--bg)', color: 'var(--text)' }}>
      <AppHeader />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 左ツールバー ────────────────────────────────── */}
        <div style={{ width: 52, background: 'var(--surface)', borderRight: '1px solid var(--border)',
                      padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TOOLS.map(t => (
            <button key={t.id} title={t.title} onClick={() => selectTool(t.id)}
              style={S.toolBtn(mapTool === t.id)}>
              {t.icon}
            </button>
          ))}
          <div style={S.divider} />
          <button title="元に戻す (⌘Z)" onClick={undo} style={S.toolBtn(false)}>
            <Undo2 size={18} />
          </button>
        </div>

        {/* ── キャンバスエリア ─────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'auto', padding: 16 }}>
          <div style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.18)', display: 'inline-block' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* ── 右パネル ────────────────────────────────────── */}
        <div style={{ ...S.panel, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>

          {/* ════ キャンバス設定 ════ */}
          <div style={S.sectionHead}>キャンバス設定</div>

          {/* サイズプリセット */}
          <div>
            <div style={S.lbl}>サイズ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              {CANVAS_PRESETS.map(p => (
                <button key={p.id} onClick={() => handlePresetSelect(p)}
                  style={{ padding: '4px 2px', fontSize: 10, borderRadius: 5, border: 'none', cursor: 'pointer',
                            textAlign: 'center', lineHeight: 1.35,
                            background: canvasPresetId === p.id ? 'var(--accent)' : 'var(--bg)',
                            color: canvasPresetId === p.id ? '#0F2340' : 'var(--text)' }}>
                  <span style={{ fontWeight: 700 }}>{p.label}</span><br />
                  <span style={{ fontSize: 9, opacity: 0.75 }}>{p.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* カスタムサイズ入力 */}
          {canvasPresetId === 'custom' && (
            <div>
              <div style={S.lbl}>カスタムサイズ (px)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min={100} max={2000} value={customW}
                  onChange={e => setCustomW(e.target.value)}
                  style={{ ...S.input, width: 60, textAlign: 'center' }} placeholder="W" />
                <span style={{ fontSize: 10, color: '#888' }}>×</span>
                <input type="number" min={100} max={2000} value={customH}
                  onChange={e => setCustomH(e.target.value)}
                  style={{ ...S.input, width: 60, textAlign: 'center' }} placeholder="H" />
                <button onClick={applyCustomSize}
                  style={{ ...S.input, border: 'none', background: 'var(--accent)', color: '#0F2340',
                            cursor: 'pointer', padding: '3px 8px', fontWeight: 700, fontSize: 11,
                            borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  適用
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
                現在: {canvasW} × {canvasH} px
              </div>
            </div>
          )}

          {/* 背景色 */}
          <div>
            <div style={S.lbl}>背景色</div>
            {/* プリセットスウォッチ */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5 }}>
              {BG_COLOR_PRESETS.map(p => (
                <button key={p.color} title={p.label} onClick={() => setBgColor(p.color)}
                  style={{ width: 22, height: 22, borderRadius: 4, cursor: 'pointer', padding: 0,
                            background: p.color, flexShrink: 0,
                            border: bgColor === p.color ? '2px solid var(--accent)' : '1px solid var(--border)',
                            outline: bgColor === p.color ? '1px solid var(--accent)' : 'none',
                            outlineOffset: 1 }} />
              ))}
            </div>
            {/* カラーピッカー（カスタム色） */}
            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
              style={{ width: '100%', height: 26, borderRadius: 5, border: '1px solid var(--border)',
                        cursor: 'pointer' }} />
          </div>

          <div style={S.divider} />

          {/* ════ ツール固有プロパティ ════ */}
          {isLineTool && (
            <>
              <div style={S.sectionHead}>
                {mapTool === 'road' ? '道路' : mapTool === 'railway' ? '線路' : '川'}
              </div>

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

              {mapTool === 'river' && (
                <>
                  <div>
                    <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                      <span>川幅</span><span style={{ color: 'var(--accent)' }}>{riverWidth}px</span>
                    </div>
                    <input type="range" min={6} max={60} step={2} value={riverWidth}
                      onChange={e => setRiverWidth(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={S.lbl}>水面色</div>
                    <input type="color" value={riverFill} onChange={e => setRiverFill(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                  <div>
                    <div style={S.lbl}>輪郭色</div>
                    <input type="color" value={riverStroke} onChange={e => setRiverStroke(e.target.value)}
                      style={{ width: '100%', height: 28, borderRadius: 5 }} />
                  </div>
                </>
              )}

              <div>
                <div style={{ ...S.lbl, display: 'flex', justifyContent: 'space-between' }}>
                  <span>手ブレ量</span><span style={{ color: 'var(--accent)' }}>{jitterAmt}px</span>
                </div>
                <input type="range" min={0} max={10} step={0.5} value={jitterAmt}
                  onChange={e => setJitterAmt(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div style={S.divider} />

              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
                {anchorCount === 0 ? 'クリックで点を追加' : `アンカー点 ${anchorCount} 個`}
                {anchorCount >= 2 && <div style={{ fontSize: 10 }}>Enter で確定</div>}
              </div>
              {anchorCount >= 2 && (
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
                  スタンプエディターで<br />スタンプを登録してください
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

          {/* 選択モード案内 */}
          {mapTool === 'select' && (
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.7 }}>
              オブジェクトを選択して<br />移動・削除できます。<br />
              <span style={{ color: 'var(--accent)' }}>Delete</span> キーで削除
            </div>
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

          {/* ════ 書き出し ════ */}
          <div style={S.divider} />
          <button onClick={exportPng} style={S.btn()}>
            <Download size={11} /> PNG 書き出し（2×）
          </button>
        </div>
      </div>
    </div>
  );
}
