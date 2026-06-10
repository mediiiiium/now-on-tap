'use client';

import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Bar, Beer } from '@/lib/supabase';

// --- helpers ---

function daysAgo(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ja });
}

function val(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t === 'Unknown' || t === '不明') return null;
  return t;
}

// --- エリアゾーン ---

const ZONES: { label: string; areas: string[] }[] = [
  { label: '渋谷・恵比寿・原宿',       areas: ['渋谷', '恵比寿', '原宿'] },
  { label: '新宿・代々木・池袋',       areas: ['新宿', '代々木', '池袋'] },
  { label: '銀座・有楽町・八重洲',     areas: ['銀座', '有楽町', '八重洲'] },
  { label: '神田・秋葉原・神保町',     areas: ['神田', '秋葉原', '神保町'] },
  { label: '虎ノ門・新橋・浜松町・田町', areas: ['虎ノ門', '新橋', '浜松町', '田町'] },
  { label: '大手町・丸の内・三越前',   areas: ['大手町', '丸の内', '三越前'] },
  { label: '後楽園・水道橋',           areas: ['後楽園', '水道橋'] },
  { label: '中央線',                   areas: ['中野', '高円寺', '吉祥寺', '三鷹'] },
  { label: '上野・日暮里・浅草',       areas: ['上野', '日暮里', '浅草'] },
];

// --- スタイル正規化 ---

const STYLE_ALIASES: Record<string, string> = {
  'american ipa': 'IPA', 'india pale ale': 'IPA', 'apa': 'IPA',
  'hazy pale ale': 'Hazy IPA', 'hazy': 'Hazy IPA', 'juicy ipa': 'Hazy IPA',
  'neipa': 'Hazy IPA', 'new england ipa': 'Hazy IPA',
  'wcipa': 'West Coast IPA', 'wc ipa': 'West Coast IPA', 'west coast': 'West Coast IPA',
  'double ipa': 'Imperial IPA', 'dipa': 'Imperial IPA', 'imperial ipa': 'Imperial IPA',
  'ale': 'Pale Ale', 'english pale ale': 'Pale Ale',
  'milk stout': 'Stout', 'irish dry stout': 'Stout',
  'honey porter': 'Porter', 'baltic porter': 'Porter',
  'farmhouse': 'Saison',
  'german pilsner': 'Pilsner', 'italian pilsner': 'Pilsner', 'czech pilsner': 'Pilsner',
  'sour ipa': 'Sour', 'sour ale': 'Sour', 'berliner weisse': 'Sour',
  'weizen': 'Wheat Beer', 'hefeweizen': 'Wheat Beer', 'weiss': 'Wheat Beer',
  'belgian white': 'Witbier', 'white ale': 'Witbier',
  'red ale': 'Amber Ale', 'amber': 'Amber Ale',
  'fruit ale': 'Fruit Beer',
};

function normalizeStyle(style: string | null): string | null {
  if (!style) return null;
  const key = style.toLowerCase().trim();
  if (STYLE_ALIASES[key]) return STYLE_ALIASES[key];
  for (const [alias, canonical] of Object.entries(STYLE_ALIASES)) {
    if (key.includes(alias)) return canonical;
  }
  return style;
}

// --- BarCard ---

function BarCard({ bar, highlightStyles, highlightBrewery }: {
  bar: Bar;
  highlightStyles?: Set<string>;
  highlightBrewery?: string;
}) {
  const beers = useMemo(() => {
    if (highlightStyles && highlightStyles.size > 0) {
      return bar.beers.filter(b => {
        const s = normalizeStyle(val(b.style));
        return s && highlightStyles.has(s);
      });
    }
    if (highlightBrewery) {
      const q = highlightBrewery.toLowerCase();
      return bar.beers.filter(b => val(b.brewery)?.toLowerCase().includes(q));
    }
    return bar.beers;
  }, [bar.beers, highlightStyles, highlightBrewery]);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${bar.has_tap_list ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
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
            {bar.last_updated && (
              <span className="text-xs text-gray-400">{daysAgo(bar.last_updated)}</span>
            )}
            {bar.post_url && (
              <a href={bar.post_url} target="_blank" rel="noopener noreferrer"
                className="block text-xs text-amber-500 hover:text-amber-600 mt-0.5">
                投稿を見る →
              </a>
            )}
          </div>
        </div>
      </div>
      {bar.has_tap_list ? (
        <ul className="divide-y divide-gray-50">
          {beers.map((beer: Beer, i: number) => (
            <li key={i} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{val(beer.name) ?? '—'}</p>
                {[val(beer.brewery), val(beer.style)].some(Boolean) && (
                  <p className="text-xs text-gray-400 truncate">
                    {[val(beer.brewery), val(beer.style)].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {val(beer.abv) && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                  {val(beer.abv)}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-xs text-gray-400">タップリストは各店舗にご確認ください。</p>
      )}
    </div>
  );
}

// --- Chip ---

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-amber-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-300'
      }`}>
      {label}
    </button>
  );
}

// --- AreaView ---

function AreaView({ bars }: { bars: Bar[] }) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const availableZones = useMemo(
    () => ZONES.filter(z => bars.some(b => b.area && z.areas.includes(b.area))),
    [bars]
  );

  const filtered = useMemo(() => {
    const zone = ZONES.find(z => z.label === selectedZone);
    if (!zone) return bars;
    return bars.filter(b => b.area && zone.areas.includes(b.area));
  }, [bars, selectedZone]);

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        <Chip label="すべて" active={!selectedZone} onClick={() => setSelectedZone(null)} />
        {availableZones.map(z => (
          <Chip key={z.label} label={z.label} active={selectedZone === z.label}
            onClick={() => setSelectedZone(selectedZone === z.label ? null : z.label)} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-4">{filtered.length}店舗</p>
      <div className="space-y-4">
        {filtered.map(bar => <BarCard key={bar.instagram_username} bar={bar} />)}
      </div>
    </div>
  );
}

// --- StyleView ---

function StyleView({ bars }: { bars: Bar[] }) {
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());

  const styles = useMemo(() => {
    const count = new Map<string, number>();
    for (const bar of bars) {
      for (const beer of bar.beers) {
        const s = normalizeStyle(val(beer.style));
        if (s) count.set(s, (count.get(s) || 0) + 1);
      }
    }
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [bars]);

  const toggle = (style: string) => {
    setSelectedStyles(prev => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style); else next.add(style);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (selectedStyles.size === 0) return bars;
    return bars.filter(bar =>
      bar.beers.some(b => {
        const s = normalizeStyle(val(b.style));
        return s && selectedStyles.has(s);
      })
    );
  }, [bars, selectedStyles]);

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-2">
        {styles.map(s => (
          <Chip key={s} label={s} active={selectedStyles.has(s)} onClick={() => toggle(s)} />
        ))}
      </div>
      {selectedStyles.size > 0 && (
        <button onClick={() => setSelectedStyles(new Set())}
          className="text-xs text-gray-400 hover:text-gray-600 mb-4 block mt-2">
          ✕ 選択解除
        </button>
      )}
      <p className="text-xs text-gray-400 mb-4 mt-4">
        {selectedStyles.size > 0 ? `${filtered.length}店舗でヒット` : `${bars.length}店舗`}
      </p>
      <div className="space-y-4">
        {filtered.map(bar => (
          <BarCard key={bar.instagram_username} bar={bar}
            highlightStyles={selectedStyles.size > 0 ? selectedStyles : undefined} />
        ))}
      </div>
    </div>
  );
}

// --- BreweryView ---

function BreweryView({ bars }: { bars: Bar[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bars;
    return bars.filter(bar =>
      bar.beers.some(b => val(b.brewery)?.toLowerCase().includes(q))
    );
  }, [bars, query]);

  return (
    <div>
      <div className="relative mb-5">
        <input type="text" placeholder="ブルワリー名で検索..."
          value={query} onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm">✕</button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {query ? `${filtered.length}店舗でヒット` : `${bars.length}店舗`}
      </p>
      <div className="space-y-4">
        {filtered.map(bar => (
          <BarCard key={bar.instagram_username} bar={bar}
            highlightBrewery={query.trim() || undefined} />
        ))}
      </div>
    </div>
  );
}

// --- Main ---

type Axis = 'area' | 'style' | 'brewery';

const AXIS_OPTIONS: { key: Axis; label: string; sub: string }[] = [
  { key: 'area',    label: 'エリアから探す',     sub: '渋谷・新宿・銀座...' },
  { key: 'style',   label: 'スタイルから探す',   sub: 'IPA・Stout・Sour...' },
  { key: 'brewery', label: 'ブルワリーから探す', sub: '好きな醸造所のビールがどこに入ってるか' },
];

export default function BarList({ bars }: { bars: Bar[] }) {
  const [axis, setAxis] = useState<Axis | null>(null);

  if (!axis) {
    return (
      <div className="flex flex-col items-center gap-3 mt-6">
        <p className="text-sm text-gray-400 mb-1">どこで飲む？ 何を飲む？</p>
        {AXIS_OPTIONS.map(({ key, label, sub }) => (
          <button key={key} onClick={() => setAxis(key)}
            className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl px-6 py-4 text-left hover:border-amber-400 hover:shadow-sm transition-all">
            <p className="font-bold text-gray-900">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setAxis(null)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        ‹ reselect
      </button>
      {axis === 'area'    && <AreaView bars={bars} />}
      {axis === 'style'   && <StyleView bars={bars} />}
      {axis === 'brewery' && <BreweryView bars={bars} />}
    </div>
  );
}
