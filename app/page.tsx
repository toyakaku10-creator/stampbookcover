'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold">スタンプブックカバーデザイナー</h1>
      <p className="text-gray-400">スタンプを作成してブックカバーをデザインしよう</p>
      <div className="flex gap-6">
        <Link href="/stamp-editor" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold transition">
          スタンプエディタ
        </Link>
        <Link href="/cover-designer" className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-xl text-lg font-semibold transition">
          カバーデザイナー
        </Link>
      </div>
    </div>
  );
}
