'use client';

import AppTabs from './AppTabs';

/**
 * 両ページ共通ヘッダー。
 * [STAMP BOOK COVER] [タブ]  ←固定左部→  <children> ←右端→
 * children にページ固有ボタンを渡すと marginLeft:auto で右寄せされる。
 */
export default function AppHeader({
  children,
  startChildren,
}: {
  children?: React.ReactNode;
  startChildren?: React.ReactNode;
}) {
  return (
    <header style={{
      height: 44, flexShrink: 0,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/zebra-icon.png" alt="しまうまアイコン" style={{ height: 28, width: 28, objectFit: 'contain', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)', flexShrink: 0 }}>
        STAMP BOOK COVER
      </span>
      <AppTabs />
      {startChildren && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {startChildren}
        </div>
      )}
      {children && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {children}
        </div>
      )}
    </header>
  );
}
