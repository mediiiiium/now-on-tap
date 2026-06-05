import { getTapLists, Bar, Beer } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

export const revalidate = 3600;

function daysAgo(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ja });
}

function BarCard({ bar }: { bar: Bar }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-900 text-lg leading-tight">
              {bar.bar_name ?? bar.instagram_username}
            </h2>
            {bar.area && (
              <span className="text-xs text-gray-400 mt-0.5 block">{bar.area}</span>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs text-gray-400">{daysAgo(bar.last_updated)}</span>
            {bar.post_url && (
              <a
                href={bar.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-amber-500 hover:text-amber-600 mt-0.5"
              >
                投稿を見る →
              </a>
            )}
          </div>
        </div>
      </div>
      <ul className="divide-y divide-gray-50">
        {bar.beers.map((beer: Beer, i: number) => (
          <li key={i} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">{beer.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {[beer.brewery, beer.style].filter(Boolean).join(' · ')}
              </p>
            </div>
            {beer.abv && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                {beer.abv}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Now On Tap</h1>
            <p className="text-xs text-gray-400">東京のクラフトビール、いまなにがある？</p>
          </div>
          <span className="text-xs text-gray-400">{bars.length}店舗</span>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {bars.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🍺</p>
            <p>データを取得中です</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bars.map(bar => (
              <BarCard key={bar.instagram_username} bar={bar} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
