'use client';
import Link from 'next/link';
import { Stamp, Layout } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }} className="flex flex-col items-center justify-center gap-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#C9A84C' }}>StampBook Cover</h1>
        <p style={{ color: '#888' }} className="text-sm">スタンプを作成してブックカバーをデザイン</p>
      </div>
      <div className="flex gap-4">
        <Link href="/stamp-editor">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} className="flex flex-col items-center gap-3 px-10 py-8 hover:border-[var(--accent)] transition-colors cursor-pointer">
            <Stamp size={32} color="var(--accent)" />
            <span className="text-sm font-medium">スタンプエディタ</span>
          </div>
        </Link>
        <Link href="/cover-designer">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} className="flex flex-col items-center gap-3 px-10 py-8 hover:border-[var(--accent)] transition-colors cursor-pointer">
            <Layout size={32} color="var(--accent)" />
            <span className="text-sm font-medium">カバーデザイナー</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
