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

const CANVAS_W = 700;
const CANVAS_H = 500;
const MAP_EXTRA_PROPS = ['_mapLineType', '_isBgImage', '_mapStampId'];
const DRAWING_TOOLS = ['road', 'railway', 'river'] as const;

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
    width: 224, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    overflowY: 'auto', flexShrink: 0,
  } as React.CSSProperties,
  label: {
    fontSize: 11, color: '#888', marginBottom: 3, fontWeight: 600, letterSpacing: 0.4,
  } as React.CSSProperties,
  input: {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 12,
  } as React.CSSProperties,
  btn: (variant?: 'accent' | 'danger'): React.CSSProperties => ({
    width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: variant === 'accent' ? 'var(--accent)' : variant === 'danger' ? '#C0392B' : 'var(--surface)',
    color: variant === 'accent' ? '#0F2340' : '#fff',
    fontSize: 12, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  }),
  divider: { height: 1, background: 'var(--border)', flexShrink: 0 } as React.CSSProperties,
  rangeRow: (label: string, val: number | string, unit?: string): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between',
  }),
};

// ── ツールアイコン（カスタム SVG） ────────────────────────────
const RoadIcon = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <line x1="2" y1="7" x2="18" y2="7" />
    <line x1="2" y1="13" x2="18" y2="13" />
  </svg>
);
const RailwayIcon = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <line x1="4" y1="4" x2="4" y2="16" />
    <line x1="16" y1="4" x2="16" y2="16" />
    <line x1="4" y1="7"  x2="16" y2="7"  />
    <line x1="4" y1="10" x2="16" y2="10" />
    <line x1="4" y1="13" x2="16" y2="13" />
  </svg>
);
const RiverIcon = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M2 7 Q5 5 8 7 Q11 9 14 7 Q17 5 18 7" />
    <path d="M2 13 Q5 11 8 13 Q11 15 14 13 Q17 11 18 13" />
  </svg>
);
const StampIcon = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}>
    <circle cx="10" cy="8" r="4.5" />
    <rect x="6" y="14" width="8" height="2.5" rx="1" />
    <line x1="10" y1="12.5" x2="10" y2="14" />
  </svg>
);

export default function MapEditor() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const fabricLibRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── ツール ───────────────────────────────────────────────────
  const [mapTool, setMapTool] = useState<MapTool>('select');
  const mapToolRef = useRef<MapTool>('select');
  useEffect(() => { mapToolRef.current = mapTool; }, [mapTool]);

  // ── アンカー点（描画モード） ─────────────────────────────────
  const anchorPointsRef = useRef<Point[]>([]);
  const [anchorCount,   setAnchorCount]   = useState(0);
  const [isDrawing,     setIsDrawing]     = useState(false);
  const previewObjsRef  = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── 線プロパティ ─────────────────────────────────────────────
  const [lineColor,    setLineColor]    = useState('#C8B89A');
  const [strokeWidth,  setStrokeWidth]  = useState(8);
  const [jitterAmt,    setJitterAmt]    = useState(3);
  const [roadDouble,   setRoadDouble]   = useState(false);
  const [railGap,      setRailGap]      = useState(10);
  const [sleeperGap,   setSleeperGap]   = useState(14);
  const [riverWidth,   setRiverWidth]   = useState(20);
  const [riverFill,    setRiverFill]    = useState('#B0D4E8');
  const [riverStroke,  setRiverStroke]  = useState('#7BAEC8');

  // stale closure 回避用 ref
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

  // ── 背景画像 ─────────────────────────────────────────────────
  const [bgOpacity,  setBgOpacity]  = useState(0.4);
  const [hasBgImage, setHasBgImage] = useState(false);
  const bgOpacityRef   = useRef(0.4);
  const bgImageObjRef  = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => { bgOpacityRef.current = bgOpacity; }, [bgOpacity]);

  // ── スタンプ ─────────────────────────────────────────────────
  const [stamps,        setStamps]        = useState<Stamp[]>([]);
  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null);
  const selectedStampRef = useRef<Stamp | null>(null);
  useEffect(() => { selectedStampRef.current = selectedStamp; }, [selectedStamp]);

  useEffect(() => { setStamps(getStamps()); }, []);

  // ── 履歴 ─────────────────────────────────────────────────────
  const historyRef    = useRef<string[]>([]);
  const historyIdxRef = useRef(0);

  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON(MAP_EXTRA_PROPS));
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(json);
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvas.loadFromJSON(JSON.parse(historyRef.current[historyIdxRef.current])) as any).then(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bgImageObjRef.current = canvas.getObjects().find((o: any) => o._isBgImage) ?? null;
        setHasBgImage(!!bgImageObjRef.current);
        canvas.renderAll();
      });
    } catch { /* 破損データは無視 */ }
  }, []);

  // ── プレビューオブジェクトを更新 ─────────────────────────────
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

  // ── パスを確定 ───────────────────────────────────────────────
  const finalizePath = useCallback(() => {
    const pts    = anchorPointsRef.current;
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;

    // プレビュー削除
    previewObjsRef.current.forEach(o => canvas.remove(o));
    previewObjsRef.current = [];

    if (pts.length >= 2) {
      const tool = mapToolRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let objs: any[] = [];

      if (tool === 'road') {
        objs = buildRoadObjects(fabric, pts, {
          color: lineColorRef.current,
          strokeWidth: strokeWidthRef.current,
          jitter: jitterAmtRef.current,
          doubleStroke: roadDoubleRef.current,
        });
      } else if (tool === 'railway') {
        objs = [buildRailwayObjects(fabric, pts, {
          color: lineColorRef.current,
          railWidth: 2,
          jitter: jitterAmtRef.current,
          railGap: railGapRef.current,
          sleeperGap: sleeperGapRef.current,
        })];
      } else if (tool === 'river') {
        objs = [buildRiverObjects(fabric, pts, {
          fillColor:   riverFillRef.current,
          strokeColor: riverStrokeRef.current,
          width:       riverWidthRef.current,
          jitter:      jitterAmtRef.current,
        })];
      }

      objs.forEach(o => canvas.add(o));
      canvas.renderAll();
      saveHistory();
    }

    anchorPointsRef.current = [];
    setAnchorCount(0);
    setIsDrawing(false);
  }, [saveHistory]);

  const cancelDrawing = useCallback(() => {
    const canvas = fabricRef.current;
    previewObjsRef.current.forEach(o => canvas?.remove(o));
    previewObjsRef.current = [];
    anchorPointsRef.current = [];
    setAnchorCount(0);
    setIsDrawing(false);
    canvas?.renderAll();
  }, []);

  // ── キャンバス初期化 ─────────────────────────────────────────
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
        width: CANVAS_W, height: CANVAS_H, backgroundColor: '#F5F0E8',
      });
      fabricRef.current = canvas;

      const initialJson = JSON.stringify(canvas.toJSON(MAP_EXTRA_PROPS));
      historyRef.current    = [initialJson];
      historyIdxRef.current = 0;

      // ── mouse:up: アンカー追加 or スタンプ配置 ─────────────
      canvas.on('mouse:up', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const tool = mapToolRef.current;
        const pt   = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
        if (!pt) return;

        if ((DRAWING_TOOLS as readonly string[]).includes(tool)) {
          anchorPointsRef.current.push({ x: pt.x, y: pt.y });
          setAnchorCount(anchorPointsRef.current.length);
          setIsDrawing(true);
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

      // ── mouse:move: プレビュー ─────────────────────────────
      canvas.on('mouse:move', (opt: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!(DRAWING_TOOLS as readonly string[]).includes(mapToolRef.current)) return;
        if (anchorPointsRef.current.length === 0) return;
        const pt = opt.pointer ?? (opt.e ? canvas.getScenePoint(opt.e) : null);
        if (pt) updatePreview({ x: pt.x, y: pt.y });
      });

      // object:modified で履歴保存
      canvas.on('object:modified', saveHistory);
    });

    return () => {
      disposed = true;
      try { canvas?.dispose(); } catch { /* ignore */ }
      fabricRef.current    = null;
      fabricLibRef.current = null;
    };
  }, [saveHistory, updatePreview]);

  // ── ツール切替時のキャンバス挙動 ────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const isLineTool = (DRAWING_TOOLS as readonly string[]).includes(mapTool);
    canvas.skipTargetFind = isLineTool || mapTool === 'stamp';
    canvas.selection      = mapTool === 'select';
    canvas.defaultCursor  = isLineTool ? 'crosshair' : 'default';
    canvas.hoverCursor    = isLineTool ? 'crosshair' : 'move';
  }, [mapTool]);

  // ── キーボードショートカット ─────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter')  { finalizePath(); }
      if (e.key === 'Escape') { cancelDrawing(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finalizePath, cancelDrawing, undo]);

  // ── 背景画像の不透明度変更 ───────────────────────────────────
  useEffect(() => {
    if (!bgImageObjRef.current || !fabricRef.current) return;
    bgImageObjRef.current.set({ opacity: bgOpacity });
    fabricRef.current.renderAll();
  }, [bgOpacity]);

  // ── 背景画像アップロード ─────────────────────────────────────
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
        const scale = Math.min(CANVAS_W / (img.width || CANVAS_W), CANVAS_H / (img.height || CANVAS_H));
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

  // ── PNG 書き出し ─────────────────────────────────────────────
  const exportPng = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const a   = document.createElement('a');
    a.href = url; a.download = 'map.png'; a.click();
  }, []);

  // ── ツール選択 ───────────────────────────────────────────────
  const selectTool = useCallback((t: MapTool) => {
    // 描画中なら自動キャンセル
    if (anchorPointsRef.current.length > 0) {
      const canvas = fabricRef.current;
      previewObjsRef.current.forEach(o => canvas?.remove(o));
      previewObjsRef.current = [];
      anchorPointsRef.current = [];
      setAnchorCount(0);
      setIsDrawing(false);
      canvas?.renderAll();
    }
    setMapTool(t);
    // ツールごとのデフォルト色を設定
    if (t === 'road')    setLineColor('#C8B89A');
    if (t === 'railway') setLineColor('#555555');
  }, []);

  // ── JSX ─────────────────────────────────────────────────────
  const isLineTool = (DRAWING_TOOLS as readonly string[]).includes(mapTool);

  const TOOLS: { id: MapTool; icon: React.ReactNode; title: string }[] = [
    { id: 'select',  icon: <MousePointer2 size={18} />, title: '選択 (V)' },
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

        {/* ── 左ツールバー ──────────────────────────────────── */}
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

        {/* ── キャンバスエリア ───────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'auto' }}>
          <canvas ref={canvasRef} />
        </div>

        {/* ── 右パネル ──────────────────────────────────────── */}
        <div style={{ ...S.panel, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>

          {/* ── 線描画プロパティ ─────────────────────────────── */}
          {isLineTool && (
            <>
              <div style={{ ...S.label, fontSize: 12, color: 'var(--accent)' }}>
                {mapTool === 'road' ? '道路' : mapTool === 'railway' ? '線路' : '川'}
              </div>

              {/* 道路 */}
              {mapTool === 'road' && (
                <>
                  <div>
                    <div style={S.label}>色</div>
                    <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)}
                      style={{ width: '100%', height: 30, borderRadius: 6 }} />
                  </div>
                  <div>
                    <div style={{ ...S.rangeRow('太さ', strokeWidth, 'px'), ...S.label }}>
                      <span>太さ</span><span style={{ color: 'var(--accent)' }}>{strokeWidth}px</span>
                    </div>
                    <input type="range" min={2} max={30} step={1} value={strokeWidth}
                      onChange={e => setStrokeWidth(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6,
                                  fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={roadDouble}
                      onChange={e => setRoadDouble(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }} />
                    二重線（鉛筆重ね書き）
                  </label>
                </>
              )}

              {/* 線路 */}
              {mapTool === 'railway' && (
                <>
                  <div>
                    <div style={S.label}>色</div>
                    <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)}
                      style={{ width: '100%', height: 30, borderRadius: 6 }} />
                  </div>
                  <div>
                    <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                      <span>レール間隔</span><span style={{ color: 'var(--accent)' }}>{railGap}px</span>
                    </div>
                    <input type="range" min={4} max={24} step={1} value={railGap}
                      onChange={e => setRailGap(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
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
                    <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                      <span>川幅</span><span style={{ color: 'var(--accent)' }}>{riverWidth}px</span>
                    </div>
                    <input type="range" min={6} max={60} step={2} value={riverWidth}
                      onChange={e => setRiverWidth(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={S.label}>水面色</div>
                    <input type="color" value={riverFill} onChange={e => setRiverFill(e.target.value)}
                      style={{ width: '100%', height: 30, borderRadius: 6 }} />
                  </div>
                  <div>
                    <div style={S.label}>輪郭色</div>
                    <input type="color" value={riverStroke} onChange={e => setRiverStroke(e.target.value)}
                      style={{ width: '100%', height: 30, borderRadius: 6 }} />
                  </div>
                </>
              )}

              {/* 手ブレ量（共通） */}
              <div>
                <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                  <span>手ブレ量</span><span style={{ color: 'var(--accent)' }}>{jitterAmt}px</span>
                </div>
                <input type="range" min={0} max={10} step={0.5} value={jitterAmt}
                  onChange={e => setJitterAmt(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div style={S.divider} />

              {/* アンカー点数 & 確定 / キャンセル */}
              <div style={{ fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
                {anchorCount === 0
                  ? 'クリックでアンカー点を追加'
                  : `アンカー点 ${anchorCount} 個`}
                {anchorCount >= 2 && (
                  <div style={{ fontSize: 10, marginTop: 2 }}>Enter で確定</div>
                )}
              </div>
              {anchorCount >= 2 && (
                <button onClick={finalizePath} style={S.btn('accent')}>
                  確定 (Enter)
                </button>
              )}
              {anchorCount > 0 && (
                <button onClick={cancelDrawing}
                  style={{ ...S.btn('danger'), background: 'transparent', border: '1px solid #C0392B',
                            color: '#C0392B', fontSize: 11 }}>
                  キャンセル (Esc)
                </button>
              )}
            </>
          )}

          {/* ── スタンプ一覧 ─────────────────────────────────── */}
          {mapTool === 'stamp' && (
            <>
              <div style={{ ...S.label, fontSize: 12, color: 'var(--accent)' }}>スタンプ配置</div>
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
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
                クリックで配置
              </div>
            </>
          )}

          {/* ── 選択モードの案内 ─────────────────────────────── */}
          {mapTool === 'select' && (
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>
              オブジェクトを選択して<br />移動・削除できます。<br />
              <span style={{ color: 'var(--accent)' }}>Delete</span> キーで削除
            </div>
          )}

          {/* ── 背景画像（下絵） ────────────────────────────── */}
          <div style={S.divider} />
          <div style={{ ...S.label, fontSize: 12, color: 'var(--accent)' }}>背景画像（下絵）</div>
          <label style={{ ...S.btn(), cursor: 'pointer', background: 'var(--surface)',
                          color: 'var(--text)', border: '1px solid var(--border)' }}>
            <Upload size={12} /> アップロード
            <input type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />
          </label>
          {hasBgImage && (
            <>
              <div>
                <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                  <span>不透明度</span>
                  <span style={{ color: 'var(--accent)' }}>{Math.round(bgOpacity * 100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.05} value={bgOpacity}
                  onChange={e => setBgOpacity(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <button onClick={removeBgImage}
                style={{ ...S.btn(), color: '#C0392B', background: 'transparent',
                          border: '1px solid #C0392B', fontSize: 11 }}>
                <Trash2 size={11} /> 背景を削除
              </button>
            </>
          )}

          {/* ── 書き出し ─────────────────────────────────────── */}
          <div style={S.divider} />
          <button onClick={exportPng}
            style={{ ...S.btn(), background: 'var(--surface)', color: 'var(--text)',
                     border: '1px solid var(--border)' }}>
            <Download size={12} /> PNG 書き出し
          </button>
        </div>

      </div>
    </div>
  );
}
