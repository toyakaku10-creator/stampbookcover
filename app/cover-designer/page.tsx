'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Grid, RefreshCw, Shuffle, AlignCenter,
  Trash2, Copy, Download, ImageIcon, Minus, Plus,
  Stamp, ChevronDown, ChevronUp, X
} from 'lucide-react';
import type { Stamp as StampType } from '@/lib/types';
import { getStamps } from '@/lib/stampStorage';

const REAL_W = 2094;
const REAL_H = 5307;
const SCALE = 0.18;
const DISP_W = Math.round(REAL_W * SCALE);
const DISP_H = Math.round(REAL_H * SCALE);

type ArrangementType = 'grid' | 'circular' | 'random' | 'border';
type BgType = 'solid' | 'gradient';
type GradDir = 'vertical' | 'horizontal' | 'diagonal';

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

export default function CoverDesignerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null);
  const [stamps, setStamps] = useState<StampType[]>([]);
  const [selectedStampForPlace, setSelectedStampForPlace] = useState<StampType | null>(null);
  const [arrangement, setArrangement] = useState<ArrangementType>('grid');
  const [arrangementCount, setArrangementCount] = useState(9);
  const [bgType, setBgType] = useState<BgType>('solid');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgColor2, setBgColor2] = useState('#cccccc');
  const [gradDir, setGradDir] = useState<GradDir>('vertical');
  const [stampScale, setStampScale] = useState(0.5);
  const [expandedSection, setExpandedSection] = useState<string>('bg');

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
        width: DISP_W,
        height: DISP_H,
        backgroundColor: '#ffffff',
      });
      fabricRef.current = canvas;
      fabricRef.current._fabric = fabric;
    });

    return () => {
      disposed = true;
      if (canvas) { canvas.dispose(); canvas = null; }
      fabricRef.current = null;
    };
  }, []);

  const applyBackground = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    if (!fabric) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.getObjects().filter((o: any) => o._isBg).forEach((o: any) => canvas.remove(o));

    if (bgType === 'solid') {
      canvas.backgroundColor = bgColor;
      canvas.renderAll();
    } else {
      canvas.backgroundColor = '#ffffff';
      const coords = gradDir === 'vertical'
        ? { x1: 0, y1: 0, x2: 0, y2: DISP_H }
        : gradDir === 'horizontal'
        ? { x1: 0, y1: 0, x2: DISP_W, y2: 0 }
        : { x1: 0, y1: 0, x2: DISP_W, y2: DISP_H };
      const grad = new fabric.Gradient({
        type: 'linear', coords,
        colorStops: [{ offset: 0, color: bgColor }, { offset: 1, color: bgColor2 }],
      });
      const rect = new fabric.Rect({
        left: 0, top: 0, width: DISP_W, height: DISP_H,
        fill: grad, selectable: false, evented: false,
      });
      rect._isBg = true;
      canvas.add(rect);
      canvas.sendToBack(rect);
      canvas.renderAll();
    }
  }, [bgType, bgColor, bgColor2, gradDir]);

  useEffect(() => { applyBackground(); }, [applyBackground]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enlivenAndGroup = useCallback(async (fabric: any, objects: object[], x: number, y: number, scale: number) => {
    const canvas = fabricRef.current;
    if (!canvas || objects.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enlivened: any[] = await fabric.util.enlivenObjects([...objects]);
    if (!enlivened || enlivened.length === 0) return;
    const group = new fabric.Group(enlivened, {
      left: x, top: y, scaleX: scale, scaleY: scale,
      originX: 'center', originY: 'center',
    });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  }, []);

  const placeStamp = useCallback((stamp: StampType, x: number, y: number, scale: number = stampScale) => {
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas?._fabric;
    if (!canvas || !fabric) return;
    const json = stamp.fabricJSON as { objects?: object[] };
    enlivenAndGroup(fabric, json.objects || [], x, y, scale);
  }, [stampScale, enlivenAndGroup]);

  const arrangeStamps = useCallback(async () => {
    if (!selectedStampForPlace || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    if (!fabric) return;

    const stamp = selectedStampForPlace;
    const n = arrangementCount;
    const json = stamp.fabricJSON as { objects?: object[] };
    const objects = json.objects || [];
    const scale = stampScale;

    const placeAt = async (positions: { x: number; y: number }[]) => {
      for (const pos of positions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enlivened: any[] = await fabric.util.enlivenObjects([...objects]);
        if (!enlivened || enlivened.length === 0) continue;
        const group = new fabric.Group(enlivened, {
          left: pos.x, top: pos.y, scaleX: scale, scaleY: scale,
          originX: 'center', originY: 'center',
        });
        canvas.add(group);
      }
      canvas.renderAll();
    };

    if (arrangement === 'grid') {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const positions: { x: number; y: number }[] = [];
      for (let r = 0; r < rows && positions.length < n; r++)
        for (let c = 0; c < cols && positions.length < n; c++)
          positions.push({ x: (DISP_W / cols) * c + DISP_W / cols / 2, y: (DISP_H / rows) * r + DISP_H / rows / 2 });
      await placeAt(positions);
    } else if (arrangement === 'circular') {
      await placeAt(Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i) / n - Math.PI / 2;
        return { x: DISP_W / 2 + DISP_W * 0.38 * Math.cos(a), y: DISP_H / 2 + DISP_H * 0.38 * Math.sin(a) };
      }));
    } else if (arrangement === 'random') {
      await placeAt(Array.from({ length: n }, () => ({
        x: 40 + Math.random() * (DISP_W - 80), y: 40 + Math.random() * (DISP_H - 80),
      })));
    } else if (arrangement === 'border') {
      const m = 30;
      const topLen = DISP_W - 2 * m, rightLen = DISP_H - 2 * m;
      const perim = 2 * (topLen + rightLen);
      await placeAt(Array.from({ length: n }, (_, i) => {
        const t = (i / n) * perim;
        if (t < topLen) return { x: m + t, y: m };
        if (t < topLen + rightLen) return { x: DISP_W - m, y: m + (t - topLen) };
        if (t < topLen * 2 + rightLen) return { x: DISP_W - m - (t - topLen - rightLen), y: DISP_H - m };
        return { x: m, y: DISP_H - m - (t - topLen * 2 - rightLen) };
      }));
    }
  }, [selectedStampForPlace, arrangement, arrangementCount, stampScale]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabric = canvas._fabric;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ImageClass = fabric.FabricImage ?? fabric.Image;
      const img = await ImageClass.fromURL(dataUrl, { crossOrigin: 'anonymous' });
      const scale = Math.min(DISP_W / (img.width ?? 1), DISP_H / (img.height ?? 1));
      img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale });
      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
    };
    reader.readAsDataURL(file);
  };

  const exportJPEG = async () => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 1 / SCALE });
    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'bookcover.jpg'; a.click();
  };

  const exportPDF = async () => {
    if (!fabricRef.current) return;
    const { jsPDF } = await import('jspdf');
    const dataUrl = fabricRef.current.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 1 / SCALE });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [152, 385] });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, 152, 385);
    pdf.save('bookcover.pdf');
  };

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active) { fabricRef.current.remove(active); fabricRef.current.renderAll(); }
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
  };

  const toggle = (key: string) => setExpandedSection(s => s === key ? '' : key);

  const ARRANGEMENTS: { id: ArrangementType; icon: React.ReactNode; label: string }[] = [
    { id: 'grid',     icon: <Grid size={14} />,        label: 'グリッド' },
    { id: 'circular', icon: <RefreshCw size={14} />,   label: '円形' },
    { id: 'random',   icon: <Shuffle size={14} />,     label: 'ランダム' },
    { id: 'border',   icon: <AlignCenter size={14} />, label: 'ボーダー' },
  ];

  // suppress unused import warning
  void X;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ height: 44, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, flexShrink: 0 }}>
        <Link href="/" style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13 }}>
          <ChevronLeft size={14} /> ホーム
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>カバーデザイナー</span>
        <span style={{ fontSize: 11, color: '#555' }}>152×385mm / 350dpi</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
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
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>

          {/* Background section */}
          <div>
            <button onClick={() => toggle('bg')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>背景</span>
              {expandedSection === 'bg' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'bg' && (
              <div style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  <button onClick={() => setBgType('solid')} style={{ ...S.btn(bgType === 'solid'), flex: 1 }}>単色</button>
                  <button onClick={() => setBgType('gradient')} style={{ ...S.btn(bgType === 'gradient'), flex: 1 }}>グラデ</button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ ...S.label, marginBottom: 4 }}>色{bgType === 'gradient' ? ' 1' : ''}</div>
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: '100%', height: 28, borderRadius: 6 }} />
                </div>
                {bgType === 'gradient' && (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ ...S.label, marginBottom: 4 }}>色 2</div>
                      <input type="color" value={bgColor2} onChange={e => setBgColor2(e.target.value)} style={{ width: '100%', height: 28, borderRadius: 6 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['vertical', 'horizontal', 'diagonal'] as GradDir[]).map(d => (
                        <button key={d} onClick={() => setGradDir(d)} style={{ ...S.btn(gradDir === d), flex: 1, fontSize: 10 }}>
                          {d === 'vertical' ? '縦' : d === 'horizontal' ? '横' : '斜め'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Image section */}
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

          {/* Stamp section */}
          <div>
            <button onClick={() => toggle('stamp')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>スタンプ</span>
              {expandedSection === 'stamp' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'stamp' && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {stamps.length === 0 && <div style={{ fontSize: 11, color: '#555' }}>スタンプなし</div>}
                  {stamps.map(s => (
                    <div key={s.id} onClick={() => setSelectedStampForPlace(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 6,
                        border: `1px solid ${selectedStampForPlace?.id === s.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedStampForPlace?.id === s.id ? 'rgba(232,197,71,0.08)' : 'var(--bg)',
                        cursor: 'pointer' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumbnail} alt={s.name} style={{ width: 28, height: 28, objectFit: 'contain', background: '#fff', borderRadius: 3 }} />
                      <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    </div>
                  ))}
                </div>
                {selectedStampForPlace && (
                  <>
                    <div>
                      <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                        <span>サイズ</span><span style={{ color: 'var(--accent)' }}>{Math.round(stampScale * 100)}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => setStampScale(s => Math.max(0.05, s - 0.05))} style={S.iconBtn()}>
                          <Minus size={12} />
                        </button>
                        <input type="range" min="5" max="200" value={Math.round(stampScale * 100)}
                          onChange={e => setStampScale(Number(e.target.value) / 100)} style={{ flex: 1 }} />
                        <button onClick={() => setStampScale(s => Math.min(2, s + 0.05))} style={S.iconBtn()}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => placeStamp(selectedStampForPlace, DISP_W / 2, DISP_H / 2)}
                      style={{ ...S.btn(true), width: '100%' }}>
                      <Stamp size={13} /> 中央に配置
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Arrangement section */}
          <div>
            <button onClick={() => toggle('arrange')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>均等配置</span>
              {expandedSection === 'arrange' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedSection === 'arrange' && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {ARRANGEMENTS.map(a => (
                    <button key={a.id} onClick={() => setArrangement(a.id)}
                      style={{ ...S.btn(arrangement === a.id), flexDirection: 'column', gap: 2, padding: '6px 4px', fontSize: 10 }}>
                      {a.icon}
                      {a.label}
                    </button>
                  ))}
                </div>
                <div>
                  <div style={{ ...S.label, display: 'flex', justifyContent: 'space-between' }}>
                    <span>個数</span><span style={{ color: 'var(--accent)' }}>{arrangementCount}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setArrangementCount(c => Math.max(1, c - 1))} style={S.iconBtn()}>
                      <Minus size={12} />
                    </button>
                    <input type="range" min="1" max="50" value={arrangementCount}
                      onChange={e => setArrangementCount(Number(e.target.value))} style={{ flex: 1 }} />
                    <button onClick={() => setArrangementCount(c => Math.min(50, c + 1))} style={S.iconBtn()}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <button onClick={arrangeStamps} disabled={!selectedStampForPlace}
                  style={{ ...S.btn(true), width: '100%', opacity: selectedStampForPlace ? 1 : 0.4, cursor: selectedStampForPlace ? 'pointer' : 'not-allowed' }}>
                  <Grid size={13} /> 均等配置を実行
                </button>
                {!selectedStampForPlace && (
                  <div style={{ fontSize: 10, color: '#555', textAlign: 'center' }}>
                    先にスタンプを選択してください
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, background: '#111', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24 }}>
          <div style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)', flexShrink: 0 }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
