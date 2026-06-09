import { getTapLists, Bar } from '@/lib/supabase';
import Image from 'next/image';
import BarList from './BarList';

export const revalidate = 3600;

export default async function Home() {
  let bars: Bar[] = [];
  try {
    bars = await getTapLists();
  } catch (e) {
    console.error(e);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Image src="/logo.png" alt="Now On Tap" width={44} height={44} className="rounded-xl" />
          <div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">Now On Tap</h1>
            <p className="text-xs text-gray-400 mt-0.5">東京のクラフトビール、いまなにがある？</p>
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {bars.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🍺</p>
            <p>データを取得中です</p>
          </div>
        ) : (
          <BarList bars={bars} />
        )}
      </div>
    </main>
  );
}
