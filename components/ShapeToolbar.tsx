'use client';

import {
  MousePointer2, Minus, Square, Circle, Triangle, Type,
} from 'lucide-react';
import type { Tool } from '@/lib/types';

const TOOL_DEFS: { id: Tool; icon: React.ReactNode; title: string }[] = [
  { id: 'select',         icon: <MousePointer2 size={14} />, title: '選択' },
  { id: 'line',           icon: <Minus size={14} />,         title: '直線' },
  { id: 'rect',           icon: <Square size={14} />,        title: '矩形' },
  {
    id: 'trapezoid', title: '台形',
    icon: (
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="3,13 13,13 11,3 5,3" />
      </svg>
    ),
  },
  { id: 'circle',         icon: <Circle size={14} />,        title: '円' },
  {
    id: 'arc', title: '円弧',
    icon: (
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M 2 8 A 6 6 0 0 1 14 8" />
      </svg>
    ),
  },
  { id: 'triangle',       icon: <Triangle size={14} />,      title: '三角' },
  {
    id: 'hexagon', title: '六角形',
    icon: (
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="8,1 14.2,4.5 14.2,11.5 8,15 1.8,11.5 1.8,4.5" />
      </svg>
    ),
  },
  {
    id: 'polygon', title: '多角形',
    icon: (
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="8,1 14,5 12,13 4,13 2,5" />
      </svg>
    ),
  },
  {
    id: 'h-diamond', title: '菱形',
    icon: (
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="8,1 15,8 8,15 1,8" />
      </svg>
    ),
  },
  {
    id: 'dot', title: '点',
    icon: (
      <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
        <circle cx="8" cy="8" r="3" />
      </svg>
    ),
  },
  { id: 'text',           icon: <Type size={14} />,          title: 'テキスト' },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'var(--accent)' : 'var(--bg)',
  color: active ? '#0F2340' : 'var(--text)',
  transition: 'background 0.15s',
});

export default function ShapeToolbar({
  tool,
  onToolChange,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
      {TOOL_DEFS.map(t => (
        <button key={t.id} title={t.title} onClick={() => onToolChange(t.id)} style={btnStyle(tool === t.id)}>
          {t.icon}
        </button>
      ))}
    </div>
  );
}
