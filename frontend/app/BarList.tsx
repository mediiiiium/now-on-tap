'use client';

import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja, enUS } from 'date-fns/locale';
import { Bar, Beer, StyleGroup } from '@/lib/supabase';

type Locale = 'ja' | 'en';

// --- helpers ---

function daysAgo(dateStr: string, locale: Locale) {
  return formatDistanceToNow(new Date(dateStr), {
    addSuffix: true,
    locale: locale === 'en' ? enUS : ja,
  });
}

function val(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t === 'Unknown' || t === '不明') return null;
  return t;
}

// --- エリアゾーン ---

const ZONES: { label: string; labelEn: string; areas: string[] }[] = [
  { label: '渋谷・原宿・表参道',         labelEn: 'Shibuya / Harajuku / Omotesando', areas: ['渋谷', '道玄坂', '神泉', '代官山', '北参道', '原宿', '表参道', '麻布十番', '神谷町'] },
  { label: '恵比寿・目黒・五反田',       labelEn: 'Ebisu / Meguro / Gotanda',        areas: ['恵比寿', '目黒', '五反田', '都立大学', '学芸大学', '武蔵小山', '大井町', '自由が丘'] },
  { label: '下北沢・三軒茶屋・二子玉川', labelEn: 'Shimokitazawa / Sangenjaya / Futakotamagawa', areas: ['下北沢', '三軒茶屋', '祖師ヶ谷大蔵', '経堂', '梅丘', '二子玉川', '狛江'] },
  { label: '新宿・代々木・笹塚',         labelEn: 'Shinjuku / Yoyogi / Sasazuka',    areas: ['新宿', '代々木', '代々木八幡', '代々木公園', '南新宿', '西新宿', '笹塚', '幡ヶ谷', '幡ノ下田'] },
  { label: '池袋・大塚・高田馬場',       labelEn: 'Ikebukuro / Otsuka / Takadanobaba', areas: ['池袋', '大塚', '高田馬場', '北池袋', '椎名町', '要町', '早稲田', '目白'] },
  { label: '銀座・有楽町・八重洲',       labelEn: 'Ginza / Yurakucho / Yaesu',       areas: ['銀座', '有楽町', '八重洲', '大手町', '丸の内', '三越前'] },
  { label: '神田・秋葉原・神保町',       labelEn: 'Kanda / Akihabara / Jimbocho',    areas: ['神田', '秋葉原', '神保町', '小川町'] },
  { label: '飯田橋・神楽坂・水道橋',     labelEn: 'Iidabashi / Kagurazaka / Suidobashi', areas: ['飯田橋', '神楽坂', '人形町', '千駄木', '後楽園', '水道橋'] },
  { label: '虎ノ門・新橋',               labelEn: 'Toranomon / Shimbashi',           areas: ['虎ノ門', '新橋'] },
  { label: '品川・浜松町・大森',         labelEn: 'Shinagawa / Hamamatsucho / Omori', areas: ['浜松町', '田町', '品川', '天王洲アイル', '大森'] },
  { label: '上野・浅草・赤羽',           labelEn: 'Ueno / Asakusa / Akabane',        areas: ['上野', '日暮里', '浅草', '御徒町', '築地', '赤羽', '東十条', '十条'] },
  { label: '清澄白河・森下・押上',       labelEn: 'Kiyosumi / Morishita / Oshiage',  areas: ['清澄白河', '森下', '押上', '門前仲町', '東陽町', '立石'] },
  { label: '中野・高円寺・吉祥寺',       labelEn: 'Nakano / Koenji / Kichijoji',     areas: ['中野', '高円寺', '阿佐ヶ谷', '吉祥寺', '三鷹', '国立', '高井戸', '永福町', '新井薬師前', '上石神井'] },
  { label: '立川・八王子・昭島',         labelEn: 'Tachikawa / Hachioji / Akishima', areas: ['立川', '昭島', '八王子', '東村山', '高尾', '奥多摩'] },
];


// --- BarCard ---

function BarCard({ bar, highlightStyles, highlightBrewery, locale }: {
  bar: Bar;
  highlightStyles?: Set<string>;
  highlightBrewery?: string;
  locale: Locale;
}) {
  const displayName = locale === 'en'
    ? (val(bar.bar_name_en) ?? val(bar.bar_name) ?? bar.instagram_username)
    : (val(bar.bar_name) ?? bar.instagram_username);

  const displayArea = locale === 'en'
    ? (val(bar.area_en) ?? val(bar.area))
    : val(bar.area);

  const beers = useMemo(() => {
    if (highlightStyles && highlightStyles.size > 0) {
      return bar.beers.filter(b => {
        const s = val(b.style);
        return s && highlightStyles.has(s);
      });
    }
    if (highlightBrewery) {
      const q = highlightBrewery.toLowerCase();
      return bar.beers.filter(b => {
        const br = locale === 'en'
          ? (val(b.brewery_en) ?? val(b.brewery))
          : val(b.brewery);
        return br?.toLowerCase().includes(q);
      });
    }
    return bar.beers;
  }, [bar.beers, highlightStyles, highlightBrewery, locale]);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${bar.has_tap_list ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-900 text-lg leading-tight">
              {displayName}
            </h2>
            {displayArea && (
              <span className="text-xs text-gray-400 mt-0.5 block">{displayArea}</span>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
            {bar.last_updated && (
              <span className="text-xs text-gray-400">{daysAgo(bar.last_updated, locale)}</span>
            )}
            <div className="flex gap-2">
              <a href={`https://www.instagram.com/${bar.instagram_username}/`}
                target="_blank" rel="noopener noreferrer"
                className="text-gray-300 hover:text-pink-400 transition-colors"
                aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(val(bar.bar_name) ?? bar.instagram_username)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-gray-300 hover:text-blue-400 transition-colors"
                aria-label="Google Maps">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
      {bar.has_tap_list ? (
        <ul className="divide-y divide-gray-50">
          {beers.map((beer: Beer, i: number) => {
            const beerName = locale === 'en'
              ? (val(beer.name_en) ?? val(beer.name))
              : (val(beer.name_ja) ?? val(beer.name));
            const breweryName = locale === 'en'
              ? (val(beer.brewery_en) ?? val(beer.brewery))
              : val(beer.brewery);
            return (
              <li key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {breweryName && (
                    <p className="text-xs text-gray-500 font-medium truncate">{breweryName}</p>
                  )}
                  <p className="font-medium text-gray-800 text-sm truncate">{beerName ?? '—'}</p>
                  {val(beer.style) && (
                    <p className="text-xs text-gray-400 truncate">{val(beer.style)}</p>
                  )}
                </div>
                {val(beer.abv) && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                    {val(beer.abv)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-xs text-gray-400">
          {locale === 'en' ? 'Please check with the bar for their tap list.' : 'タップリストは各店舗にご確認ください。'}
        </p>
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

function AreaView({ bars, locale }: { bars: Bar[]; locale: Locale }) {
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
        <Chip label={locale === 'en' ? 'All' : 'すべて'} active={!selectedZone} onClick={() => setSelectedZone(null)} />
        {availableZones.map(z => (
          <Chip key={z.label} label={locale === 'en' ? z.labelEn : z.label}
            active={selectedZone === z.label}
            onClick={() => setSelectedZone(selectedZone === z.label ? null : z.label)} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {locale === 'en' ? `${filtered.length} bars` : `${filtered.length}店舗`}
      </p>
      <div className="space-y-4">
        {filtered.map(bar => <BarCard key={bar.instagram_username} bar={bar} locale={locale} />)}
      </div>
    </div>
  );
}

// --- StyleView ---

function StyleView({ bars, styleGroups, locale }: { bars: Bar[]; styleGroups: StyleGroup[]; locale: Locale }) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Only show groups that have at least one matching beer in current tap lists
  const availableGroups = useMemo(() => {
    const stylesInUse = new Set<string>();
    for (const bar of bars) {
      for (const beer of bar.beers) {
        const s = val(beer.style);
        if (s) stylesInUse.add(s);
      }
    }
    return styleGroups.filter(g => g.styles.some(s => stylesInUse.has(s)));
  }, [bars, styleGroups]);

  const highlightStyles = useMemo<Set<string> | undefined>(() => {
    if (!selectedGroup) return undefined;
    const group = styleGroups.find(g => g.group_name === selectedGroup);
    return group ? new Set(group.styles) : undefined;
  }, [selectedGroup, styleGroups]);

  const filtered = useMemo(() => {
    if (!highlightStyles) return bars;
    return bars.filter(bar =>
      bar.beers.some(b => {
        const s = val(b.style);
        return s && highlightStyles.has(s);
      })
    );
  }, [bars, highlightStyles]);

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-2">
        {availableGroups.map(g => (
          <Chip key={g.group_name} label={g.group_name}
            active={selectedGroup === g.group_name}
            onClick={() => setSelectedGroup(selectedGroup === g.group_name ? null : g.group_name)} />
        ))}
      </div>
      {selectedGroup && (
        <button onClick={() => setSelectedGroup(null)}
          className="text-xs text-gray-400 hover:text-gray-600 mb-4 block mt-2">
          {locale === 'en' ? '✕ Clear' : '✕ 選択解除'}
        </button>
      )}
      <p className="text-xs text-gray-400 mb-4 mt-4">
        {selectedGroup
          ? (locale === 'en' ? `${filtered.length} bars` : `${filtered.length}店舗でヒット`)
          : (locale === 'en' ? `${bars.length} bars` : `${bars.length}店舗`)}
      </p>
      <div className="space-y-4">
        {filtered.map(bar => (
          <BarCard key={bar.instagram_username} bar={bar} locale={locale}
            highlightStyles={highlightStyles} />
        ))}
      </div>
    </div>
  );
}

// --- BreweryView ---

function BreweryView({ bars, locale }: { bars: Bar[]; locale: Locale }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bars;
    return bars.filter(bar =>
      bar.beers.some(b => {
        const br = locale === 'en'
          ? (val(b.brewery_en) ?? val(b.brewery))
          : val(b.brewery);
        return br?.toLowerCase().includes(q);
      })
    );
  }, [bars, query, locale]);

  return (
    <div>
      <div className="relative mb-5">
        <input type="text"
          placeholder={locale === 'en' ? 'Search by brewery...' : 'ブルワリー名で検索...'}
          value={query} onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm">✕</button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {query
          ? (locale === 'en' ? `${filtered.length} bars` : `${filtered.length}店舗でヒット`)
          : (locale === 'en' ? `${bars.length} bars` : `${bars.length}店舗`)}
      </p>
      <div className="space-y-4">
        {filtered.map(bar => (
          <BarCard key={bar.instagram_username} bar={bar} locale={locale}
            highlightBrewery={query.trim() || undefined} />
        ))}
      </div>
    </div>
  );
}

// --- Main ---

type Axis = 'area' | 'style' | 'brewery';

const AXIS_OPTIONS: { key: Axis; label: string; labelEn: string; sub: string; subEn: string }[] = [
  { key: 'area',    label: 'エリアから探す',     labelEn: 'Search by Area',    sub: '渋谷・新宿・銀座...',          subEn: 'Shibuya, Shinjuku, Ginza...' },
  { key: 'style',   label: 'スタイルから探す',   labelEn: 'Search by Style',   sub: 'IPA・Stout・Sour...',          subEn: 'IPA, Stout, Sour...' },
  { key: 'brewery', label: 'ブルワリーから探す', labelEn: 'Search by Brewery', sub: '好きな醸造所のビールがどこに入ってるか', subEn: "Find where your favorite brewery's beers are on tap" },
];

// --- Locale toggle ---

function LocaleToggle({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5 text-xs font-medium">
      <button
        onClick={() => onChange('ja')}
        className={`px-3 py-1 rounded-full transition-colors ${locale === 'ja' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
        日本語
      </button>
      <button
        onClick={() => onChange('en')}
        className={`px-3 py-1 rounded-full transition-colors ${locale === 'en' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
        EN
      </button>
    </div>
  );
}

export default function BarList({ bars, styleGroups }: { bars: Bar[]; styleGroups: StyleGroup[] }) {
  const [axis, setAxis] = useState<Axis | null>(null);
  const [locale, setLocale] = useState<Locale>('ja');

  if (!axis) {
    return (
      <div className="flex flex-col items-center gap-3 mt-6">
        <div className="flex items-center justify-between w-full max-w-sm mb-1">
          <p className="text-sm text-gray-400">
            {locale === 'en' ? 'Where to drink? What to drink?' : 'どこで飲む？ 何を飲む？'}
          </p>
          <LocaleToggle locale={locale} onChange={setLocale} />
        </div>
        {AXIS_OPTIONS.map(({ key, label, labelEn, sub, subEn }) => (
          <button key={key} onClick={() => setAxis(key)}
            className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl px-6 py-4 text-left hover:border-amber-400 hover:shadow-sm transition-all">
            <p className="font-bold text-gray-900">{locale === 'en' ? labelEn : label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{locale === 'en' ? subEn : sub}</p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setAxis(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
          ‹ {locale === 'en' ? 'reselect' : '選び直す'}
        </button>
        <LocaleToggle locale={locale} onChange={setLocale} />
      </div>
      {axis === 'area'    && <AreaView bars={bars} locale={locale} />}
      {axis === 'style'   && <StyleView bars={bars} styleGroups={styleGroups} locale={locale} />}
      {axis === 'brewery' && <BreweryView bars={bars} locale={locale} />}
    </div>
  );
}
