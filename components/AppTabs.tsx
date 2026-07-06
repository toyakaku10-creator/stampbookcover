'use client';

import { usePathname, useRouter } from 'next/navigation';

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '4px 14px',
  borderRadius: 6,
  border: active ? 'none' : '1px solid #2A4570',
  background: active ? '#C9A84C' : 'transparent',
  color: active ? '#0F2340' : '#F5F0E8',
  fontWeight: active ? 600 : 500,
  fontSize: 12,
  cursor: 'pointer',
  transition: 'background 0.15s',
  whiteSpace: 'nowrap' as const,
});

export default function AppTabs({ onBeforeNavigate }: { onBeforeNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const navigate = (href: string) => {
    onBeforeNavigate?.();
    router.push(href);
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        style={TAB_STYLE(pathname === '/stamp-editor')}
        onClick={() => navigate('/stamp-editor')}
      >
        スタンプエディタ
      </button>
      <button
        style={TAB_STYLE(pathname === '/cover-designer')}
        onClick={() => navigate('/cover-designer')}
      >
        カバーデザイナー
      </button>
    </div>
  );
}
