'use client';

import { useEffect, useState } from 'react';
import PinGate from './PinGate';
import BreweryReview from './BreweryReview';
import StyleReview from './StyleReview';
import BarCandidates, { BarCandidate } from './BarCandidates';
import TapListAlerts, { TapListAlert } from './TapListAlerts';
import { sb, setBarStatus } from './adminClient';

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

export type NoPosts = { username: string };

async function fetchTapListAlerts(): Promise<{ alerts: TapListAlert[]; noPosts: NoPosts[] }> {
  const [{ data: posts }, { data: bars }] = await Promise.all([
    sb.from('posts').select('instagram_username, posted_at, is_tap_list').order('posted_at', { ascending: false }),
    sb.from('bars').select('instagram_username, alert_snoozed_until, status, last_scraped_at, snooze_count'),
  ]);
  const barsMap = new Map((bars ?? []).map((b: { instagram_username: string; alert_snoozed_until: string | null; status: string | null; last_scraped_at: string | null; snooze_count: number | null }) => [b.instagram_username, b]));
  const snoozedMap = new Map((bars ?? []).map((b: { instagram_username: string; alert_snoozed_until: string | null }) => [b.instagram_username, b.alert_snoozed_until]));
  const postedSet = new Set((posts ?? []).map((p: { instagram_username: string }) => p.instagram_username));
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
    const bar = barsMap.get(username);
    if (bar?.status === 'inactive' || bar?.status === 'closed') continue;
    const snoozedUntil = snoozedMap.get(username);
    if (snoozedUntil && new Date(snoozedUntil) > now) continue;
    const lastTapListDate = acc.lastTapList ? new Date(acc.lastTapList) : null;
    const lastPostDate = acc.lastPost ? new Date(acc.lastPost) : null;
    const daysSincePost = lastPostDate ? Math.floor((now.getTime() - lastPostDate.getTime()) / 86400000) : null;
    const daysSinceTapList = lastTapListDate ? Math.floor((now.getTime() - lastTapListDate.getTime()) / 86400000) : null;
    const tapListRate = acc.totalPosts > 0 ? Math.round(acc.tapListPosts / acc.totalPosts * 100) : 0;
    let diagnosis = '', severity = 'ok';
    const isActive = lastPostDate !== null && lastPostDate >= oneMonthAgo;
    if (isActive && acc.totalPosts >= 5) {
      if (tapListRate === 0) {
        diagnosis = '🔴 投稿あり・TL一度もなし'; severity = 'error';
      } else if (lastTapListDate && lastTapListDate < oneMonthAgo) {
        diagnosis = '⚠️ TL投稿1ヶ月以上なし'; severity = 'warn';
      }
    }
    const snoozeCount = barsMap.get(username)?.snooze_count ?? 0;
    if (severity !== 'ok') alerts.push({ username, totalPosts: acc.totalPosts, tapListPosts: acc.tapListPosts, tapListRate: `${tapListRate}%`, lastPost: daysSincePost !== null ? `${daysSincePost}日前` : 'なし', lastTapList: daysSinceTapList !== null ? `${daysSinceTapList}日前` : 'なし', diagnosis, severity, snoozeCount });
  }
  const noPosts: NoPosts[] = (bars ?? [])
    .filter((b: { instagram_username: string; status: string | null; last_scraped_at: string | null }) =>
      !postedSet.has(b.instagram_username) &&
      b.status !== 'inactive' && b.status !== 'closed' &&
      b.last_scraped_at !== null
    )
    .map((b: { instagram_username: string }) => ({ username: b.instagram_username }));

  return {
    alerts: alerts.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1)),
    noPosts,
  };
}

function NoPostsRow({ username }: { username: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'inactive' | 'closed'>('idle');
  const busy = status === 'loading';

  async function handleInactive() {
    setStatus('loading');
    try { await setBarStatus(username, 'inactive'); setStatus('inactive'); } catch { setStatus('idle'); }
  }
  async function handleClosed() {
    if (!confirm(`@${username} を閉店にしますか？`)) return;
    setStatus('loading');
    try { await setBarStatus(username, 'closed'); setStatus('closed'); } catch { setStatus('idle'); }
  }

  if (status === 'inactive') return (
    <tr className="opacity-40 border-b bg-gray-50">
      <td className="px-3 py-2 text-sm text-gray-400">@{username}</td>
      <td className="px-3 py-2 text-sm text-gray-500">📵 未稼動に設定</td>
    </tr>
  );
  if (status === 'closed') return (
    <tr className="opacity-40 border-b bg-red-50">
      <td className="px-3 py-2 text-sm text-gray-400 line-through">@{username}</td>
      <td className="px-3 py-2 text-sm text-red-500">🚪 閉店に設定</td>
    </tr>
  );
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2 text-sm font-medium">
        <a href={`https://www.instagram.com/${username}/`} target="_blank" className="text-blue-600 hover:underline">@{username}</a>
      </td>
      <td className="px-3 py-2 whitespace-nowrap space-x-1">
        <button onClick={handleInactive} disabled={busy} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200 disabled:opacity-50">未稼動</button>
        <button onClick={handleClosed} disabled={busy} className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 disabled:opacity-50">閉店</button>
      </td>
    </tr>
  );
}

function AdminContent() {
  const [breweries, setBreweries] = useState<Brewery[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [barCandidates, setBarCandidates] = useState<BarCandidate[]>([]);
  const [tapListAlerts, setTapListAlerts] = useState<TapListAlert[]>([]);
  const [noPosts, setNoPosts] = useState<NoPosts[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sb.from('breweries').select('id, name, name_ja, prefecture, country, website_url, untappd_url').eq('needs_review', true).order('created_at', { ascending: false }),
      sb.from('breweries').select('id, name, name_ja, prefecture, country, website_url, untappd_url').eq('needs_review', false).filter('name', 'match', '[\\u3040-\\u9FFF\\u3000-\\u303F]'),
      sb.from('styles').select('id, name, category').eq('needs_review', true).order('created_at', { ascending: false }),
      fetchBarCandidates(),
      fetchTapListAlerts(),
    ]).then(([{ data: b }, { data: bLang }, { data: s }, bc, { alerts, noPosts: np }]) => {
      const jaRegex = /[぀-ゟ゠-ヿ一-鿿]/;
      const langIssues = (bLang ?? []).filter((br: { name: string }) => jaRegex.test(br.name));
      setBreweries([...(b ?? []), ...langIssues]);
      setStyles(s ?? []);
      setBarCandidates(bc);
      setTapListAlerts(alerts);
      setNoPosts(np);
      setLoading(false);
    });
  }, []);

  const totalIssues = breweries.length + styles.length + barCandidates.length + tapListAlerts.length + noPosts.length;

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
              📭 投稿なし
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{noPosts.length}件</span>
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {noPosts.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">投稿なしのバーはありません ✅</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
                        <th className="px-3 py-2">Account</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {noPosts.map(b => (
                        <NoPostsRow key={b.username} username={b.username} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
