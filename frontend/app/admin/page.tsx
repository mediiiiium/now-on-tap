'use client';

import { useEffect, useState } from 'react';
import PinGate from './PinGate';
import BreweryReview from './BreweryReview';
import StyleReview from './StyleReview';
import BarCandidates, { BarCandidate } from './BarCandidates';
import TapListAlerts, { TapListAlert } from './TapListAlerts';
import { sb } from './adminClient';

type Brewery = { id: number; name: string; name_ja: string | null; prefecture: string | null; country: string | null; website_url: string | null; untappd_url: string | null };
type Style = { id: number; name: string; category: string };

const KML_URL = 'https://www.google.com/maps/d/kml?mid=1DaSgYBnJZnlWFmNFqvvHFqP6G_MxKGP4&forcekml=1';

async function fetchBarCandidates(): Promise<BarCandidate[]> {
  try {
    const res = await fetch(KML_URL);
    const xml = await res.text();
    const placemarks = xml.split('<Placemark>').slice(1);
    const results: BarCandidate[] = [];
    for (const p of placemarks) {
      const nameMatch = p.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/) ?? p.match(/<name>(.*?)<\/name>/);
      const descMatch = p.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? p.match(/<description>([\s\S]*?)<\/description>/);
      const name = nameMatch?.[1]?.trim() ?? '';
      const desc = descMatch?.[1] ?? '';
      const fields: Record<string, string> = {};
      for (const part of desc.split('<br>')) {
        const idx = part.indexOf(': ');
        if (idx > 0) fields[part.slice(0, idx).trim()] = part.slice(idx + 2).trim();
      }
      const igMatch = (fields['Instagram'] ?? '').match(/instagram\.com\/([^/?"\s]+)/);
      const instagram = igMatch ? igMatch[1].replace(/\/$/, '') : null;
      if (fields['都道府県'] === '東京' && instagram) {
        results.push({ name, name_en: fields['Brewery'] ?? null, instagram, type: fields['形態'] ?? null });
      }
    }
    const { data: registered } = await sb.from('bars').select('instagram_username');
    const registeredSet = new Set((registered ?? []).map((r: { instagram_username: string }) => r.instagram_username.toLowerCase()));
    return results.filter(b => !registeredSet.has(b.instagram.toLowerCase()));
  } catch { return []; }
}

async function fetchTapListAlerts(): Promise<TapListAlert[]> {
  const [{ data: posts }, { data: bars }] = await Promise.all([
    sb.from('posts').select('instagram_username, posted_at, is_tap_list').order('posted_at', { ascending: false }),
    sb.from('bars').select('instagram_username, alert_snoozed_until'),
  ]);
  const snoozedMap = new Map((bars ?? []).map((b: { instagram_username: string; alert_snoozed_until: string | null }) => [b.instagram_username, b.alert_snoozed_until]));
  const accounts: Record<string, { totalPosts: number; tapListPosts: number; lastTapList: string | null; lastPost: string | null }> = {};
  for (const post of posts ?? []) {
    const u = post.instagram_username;
    if (!accounts[u]) accounts[u] = { totalPosts: 0, tapListPosts: 0, lastTapList: null, lastPost: null };
    accounts[u].totalPosts++;
    if (post.is_tap_list) {
      accounts[u].tapListPosts++;
      if (!accounts[u].lastTapList || post.posted_at > accounts[u].lastTapList!) accounts[u].lastTapList = post.posted_at;
    }
    if (!accounts[u].lastPost || post.posted_at > accounts[u].lastPost!) accounts[u].lastPost = post.posted_at;
  }
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const alerts: TapListAlert[] = [];
  for (const [username, acc] of Object.entries(accounts)) {
    const snoozedUntil = snoozedMap.get(username);
    if (snoozedUntil && new Date(snoozedUntil) > now) continue;
    const lastTapListDate = acc.lastTapList ? new Date(acc.lastTapList) : null;
    const lastPostDate = acc.lastPost ? new Date(acc.lastPost) : null;
    const daysSincePost = lastPostDate ? Math.floor((now.getTime() - lastPostDate.getTime()) / 86400000) : null;
    const daysSinceTapList = lastTapListDate ? Math.floor((now.getTime() - lastTapListDate.getTime()) / 86400000) : null;
    const tapListRate = acc.totalPosts > 0 ? Math.round(acc.tapListPosts / acc.totalPosts * 100) : 0;
    let diagnosis = '', severity = 'ok';
    if (!lastTapListDate && acc.totalPosts >= 3 && tapListRate === 0) { diagnosis = '⚠️ タップリスト投稿なし'; severity = 'warn'; }
    else if (lastTapListDate && lastTapListDate < oneMonthAgo) {
      if (daysSincePost !== null && daysSincePost < 7) { diagnosis = '🔴 最近投稿あり、TL未検出'; severity = 'error'; }
      else if (daysSincePost !== null && daysSincePost >= 30) { diagnosis = '😴 投稿1ヶ月以上なし'; severity = 'warn'; }
      else { diagnosis = '⚠️ TL投稿1ヶ月以上なし'; severity = 'warn'; }
    }
    if (severity !== 'ok') alerts.push({ username, totalPosts: acc.totalPosts, tapListPosts: acc.tapListPosts, tapListRate: `${tapListRate}%`, lastPost: daysSincePost !== null ? `${daysSincePost}日前` : 'なし', lastTapList: daysSinceTapList !== null ? `${daysSinceTapList}日前` : 'なし', diagnosis, severity });
  }
  return alerts.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
}

function AdminContent() {
  const [breweries, setBreweries] = useState<Brewery[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [barCandidates, setBarCandidates] = useState<BarCandidate[]>([]);
  const [tapListAlerts, setTapListAlerts] = useState<TapListAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sb.from('breweries').select('id, name, name_ja, prefecture, country, website_url, untappd_url').eq('needs_review', true).order('created_at', { ascending: false }),
      sb.from('styles').select('id, name, category').eq('needs_review', true).order('created_at', { ascending: false }),
      fetchBarCandidates(),
      fetchTapListAlerts(),
    ]).then(([{ data: b }, { data: s }, bc, tla]) => {
      setBreweries(b ?? []);
      setStyles(s ?? []);
      setBarCandidates(bc);
      setTapListAlerts(tla);
      setLoading(false);
    });
  }, []);

  const totalIssues = breweries.length + styles.length + barCandidates.length + tapListAlerts.length;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Now On Tap — 管理</h1>
            <p className="text-xs text-gray-400">{loading ? '読み込み中...' : `要確認: ${totalIssues}件`}</p>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:underline">← サイトに戻る</a>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-gray-400">読み込み中...</div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              ⚠️ タップリスト要確認
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{tapListAlerts.length}件</span>
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <TapListAlerts alerts={tapListAlerts} />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              🏪 新規バー候補
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{barCandidates.length}件</span>
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <BarCandidates bars={barCandidates} />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              🏭 ブルワリー要確認
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">{breweries.length}件</span>
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <BreweryReview breweries={breweries} />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              🍺 ビアスタイル要確認
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">{styles.length}件</span>
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <StyleReview styles={styles} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function AdminPage() {
  return (
    <PinGate>
      <AdminContent />
    </PinGate>
  );
}
