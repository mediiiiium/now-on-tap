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
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/nowontap_logo.png" alt="Now On Tap" width={96} height={96} />
            <div>
              <h1 className="text-3xl text-gray-900 leading-none" style={{ fontFamily: 'var(--font-permanent-marker)' }}>Now On Tap</h1>
              <p className="text-xl text-gray-400 mt-1" style={{ fontFamily: 'var(--font-permanent-marker)' }}>Walk in knowing.</p>
            </div>
          </a>
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
