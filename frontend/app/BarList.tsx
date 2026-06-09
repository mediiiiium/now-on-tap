'use client';

import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Bar, Beer } from '@/lib/supabase';

function daysAgo(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ja });
}

function val(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed === '' || trimmed === 'Unknown' || trimmed === '不明') return null;
  return trimmed;
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
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-amber-500 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-300'
      }`}
    >
      {label}
    </button>
  );
}

// スタイルの正規化（大文字小文字・表記ゆれを吸収）
const STYLE_ALIASES: Record<string, string> = {
  'ipa': 'IPA',
  'hazy ipa': 'Hazy IPA',
  'hazy pale ale': 'Hazy IPA',
  'west coast ipa': 'West Coast IPA',
  'wcipa': 'West Coast IPA',
  'pale ale': 'Pale Ale',
  'stout': 'Stout',
  'milk stout': 'Stout',
  'imperial stout': 'Stout',
  'porter': 'Porter',
  'saison': 'Saison',
  'lager': 'Lager',
  'pilsner': 'Lager',
  'pilsen': 'Lager',
  'wheat': 'Wheat',
  'weizen': 'Wheat',
  'hefeweizen': 'Wheat',
  'sour': 'Sour',
  'gose': 'Sour',
  'berliner': 'Sour',
  'barleywine': 'Barleywine',
  'amber': 'Amber',
  'red ale': 'Amber',
};

function normalizeStyle(style: string | null): string | null {
  if (!style) return null;
  const key = style.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(STYLE_ALIASES)) {
    if (key.includes(alias)) return canonical;
  }
  return style;
}

export default function BarList({ bars }: { bars: Bar[] }) {
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [breweryQuery, setBreweryQuery] = useState('');

  // エリア一覧（データから自動生成）
  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const bar of bars) {
      if (bar.area) set.add(bar.area);
    }
    return Array.from(set).sort();
  }, [bars]);

  // スタイル一覧（正規化して重複排除）
  const styles = useMemo(() => {
    const set = new Set<string>();
    for (const bar of bars) {
      for (const beer of bar.beers) {
        const s = normalizeStyle(val(beer.style));
        if (s) set.add(s);
      }
    }
    return Array.from(set).sort();
  }, [bars]);

  // フィルタ適用
  const filtered = useMemo(() => {
    const query = breweryQuery.trim().toLowerCase();
    return bars.filter((bar) => {
      if (areaFilter && bar.area !== areaFilter) return false;
      if (styleFilter) {
        const hasStyle = bar.beers.some(
          (b) => normalizeStyle(val(b.style)) === styleFilter
        );
        if (!hasStyle) return false;
      }
      if (query) {
        const hasBrewery = bar.beers.some((b) =>
          val(b.brewery)?.toLowerCase().includes(query)
        );
        if (!hasBrewery) return false;
      }
      return true;
    });
  }, [bars, areaFilter, styleFilter, breweryQuery]);

  const hasFilter = areaFilter || styleFilter || breweryQuery.trim();

  return (
    <div>
      {/* フィルター */}
      <div className="space-y-3 mb-6">
        {/* ブルワリー検索 */}
        <div className="relative">
          <input
            type="text"
            placeholder="ブルワリーで検索..."
            value={breweryQuery}
            onChange={(e) => setBreweryQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          {breweryQuery && (
            <button
              onClick={() => setBreweryQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* エリアフィルタ */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Chip label="全エリア" active={!areaFilter} onClick={() => setAreaFilter(null)} />
          {areas.map((area) => (
            <Chip
              key={area}
              label={area}
              active={areaFilter === area}
              onClick={() => setAreaFilter(areaFilter === area ? null : area)}
            />
          ))}
        </div>

        {/* スタイルフィルタ */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Chip label="全スタイル" active={!styleFilter} onClick={() => setStyleFilter(null)} />
          {styles.map((style) => (
            <Chip
              key={style}
              label={style}
              active={styleFilter === style}
              onClick={() => setStyleFilter(styleFilter === style ? null : style)}
            />
          ))}
        </div>
      </div>

      {/* 件数 */}
      <p className="text-xs text-gray-400 mb-4">
        {hasFilter ? `${filtered.length} / ${bars.length}店舗` : `${bars.length}店舗`}
      </p>

      {/* バーリスト */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">🍺</p>
          <p className="text-sm">該当する店舗がありません</p>
          <button
            onClick={() => {
              setAreaFilter(null);
              setStyleFilter(null);
              setBreweryQuery('');
            }}
            className="mt-3 text-xs text-amber-500 hover:text-amber-600"
          >
            フィルタをリセット
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((bar) => (
            <BarCard key={bar.instagram_username} bar={bar} />
          ))}
        </div>
      )}
    </div>
  );
}
