'use client';

import { useState } from 'react';
import { updateBrewery, approveBrewery, deleteBrewery, countBreweryBeers } from './adminClient';

type Brewery = {
  id: number;
  name: string;
  name_ja: string | null;
  prefecture: string | null;
  country: string | null;
  website_url: string | null;
  untappd_url: string | null;
};

type RowStatus = 'idle' | 'saving' | 'saved' | 'approved' | 'deleted';

function BreweryRow({ brewery }: { brewery: Brewery }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    name: brewery.name,
    name_ja: brewery.name_ja ?? '',
    prefecture: brewery.prefecture ?? '',
    country: brewery.country ?? '日本',
    website_url: brewery.website_url ?? '',
    untappd_url: brewery.untappd_url ?? '',
  });
  const [status, setStatus] = useState<RowStatus>('idle');

  async function handleSave() {
    setStatus('saving');
    try {
      await updateBrewery(brewery.id, brewery.name, {
        name: fields.name || undefined,
        name_ja: fields.name_ja || undefined,
        prefecture: fields.prefecture || undefined,
        country: fields.country || undefined,
        website_url: fields.website_url || undefined,
        untappd_url: fields.untappd_url || undefined,
      });
      setEditing(false);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch { setStatus('idle'); }
  }

  async function handleApprove() {
    setStatus('approved');
    try { await approveBrewery(brewery.id); } catch { setStatus('idle'); }
  }

  async function handleDelete() {
    const beerCount = await countBreweryBeers(brewery.id);
    const msg = beerCount > 0
      ? `"${brewery.name}" を削除しますか？\n⚠️ このブルワリーには ${beerCount} 件のビールが紐づいています。`
      : `"${brewery.name}" を削除しますか？`;
    if (!confirm(msg)) return;
    setStatus('deleted');
    try { await deleteBrewery(brewery.id); } catch { setStatus('idle'); }
  }

  const busy = status === 'saving' || status === 'approved' || status === 'deleted';
  const isAbroad = fields.country && fields.country !== '日本';

  if (status === 'approved') {
    return (
      <tr className="opacity-40 transition-opacity duration-500 border-b bg-green-50">
        <td className="px-3 py-2 text-sm font-medium text-gray-400">{fields.name}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-green-600">✓ 承認済み</td>
        <td />
      </tr>
    );
  }

  if (status === 'deleted') {
    return (
      <tr className="opacity-40 transition-opacity duration-500 border-b bg-red-50">
        <td className="px-3 py-2 text-sm font-medium text-gray-400 line-through">{fields.name}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-red-500">削除中...</td>
        <td />
      </tr>
    );
  }

  if (editing) {
    return (
      <tr className="bg-yellow-50 border-b">
        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1 text-sm" value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} /></td>
        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1 text-sm" value={fields.name_ja} onChange={e => setFields(f => ({ ...f, name_ja: e.target.value }))} placeholder="日本語名" /></td>
        <td className="px-3 py-2"><input className="w-20 border rounded px-2 py-1 text-sm" value={fields.country} onChange={e => setFields(f => ({ ...f, country: e.target.value }))} placeholder="国" /></td>
        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1 text-sm" value={fields.prefecture} onChange={e => setFields(f => ({ ...f, prefecture: e.target.value }))} placeholder="都道府県" /></td>
        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1 text-sm" value={fields.website_url} onChange={e => setFields(f => ({ ...f, website_url: e.target.value }))} placeholder="https://..." /></td>
        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1 text-sm" value={fields.untappd_url} onChange={e => setFields(f => ({ ...f, untappd_url: e.target.value }))} placeholder="https://untappd.com/..." /></td>
        <td className="px-3 py-2 whitespace-nowrap space-x-2">
          <button onClick={handleSave} disabled={busy} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">{status === 'saving' ? '保存中...' : '保存'}</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300">キャンセル</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b transition-colors ${status === 'saved' ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
      <td className="px-3 py-2 text-sm font-medium">{fields.name}{status === 'saved' && <span className="ml-2 text-green-600 text-xs">✓</span>}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{fields.name_ja || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-sm">
        {isAbroad
          ? <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{fields.country}</span>
          : <span className="text-gray-400 text-xs">🇯🇵</span>}
      </td>
      <td className="px-3 py-2 text-sm text-gray-500 text-xs">{fields.prefecture || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-sm">{fields.website_url ? <a href={fields.website_url} target="_blank" className="text-blue-600 hover:underline">🔗</a> : <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-sm">{fields.untappd_url ? <a href={fields.untappd_url} target="_blank" className="text-blue-600 hover:underline">🍺</a> : <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 whitespace-nowrap space-x-2">
        <button onClick={() => setEditing(true)} className="px-3 py-1 bg-gray-100 text-sm rounded hover:bg-gray-200">編集</button>
        <button onClick={handleApprove} disabled={busy} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">承認</button>
        <button onClick={handleDelete} disabled={busy} className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 disabled:opacity-50">削除</button>
      </td>
    </tr>
  );
}

export default function BreweryReview({ breweries }: { breweries: Brewery[] }) {
  if (breweries.length === 0) {
    return <p className="text-gray-500 py-8 text-center">要確認のブルワリーはありません ✅</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
            <th className="px-3 py-2">Brewery (EN)</th>
            <th className="px-3 py-2">Brewery (JA)</th>
            <th className="px-3 py-2">Country</th>
            <th className="px-3 py-2">Prefecture</th>
            <th className="px-3 py-2">Web</th>
            <th className="px-3 py-2">Untappd</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {breweries.map(b => <BreweryRow key={b.id} brewery={b} />)}
        </tbody>
      </table>
    </div>
  );
}
