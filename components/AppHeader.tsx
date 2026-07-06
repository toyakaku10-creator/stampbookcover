'use client';

import AppTabs from './AppTabs';

/**
 * 両ページ共通ヘッダー。
 * [STAMP BOOK COVER] [タブ]  ←固定左部→  <children> ←右端→
 * children にページ固有ボタンを渡すと marginLeft:auto で右寄せされる。
 */
export default function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header style={{
      height: 44, flexShrink: 0,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)', flexShrink: 0 }}>
        STAMP BOOK COVER
      </span>
      <AppTabs />
      {children && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {children}
        </div>
      )}
    </header>
  );
}
