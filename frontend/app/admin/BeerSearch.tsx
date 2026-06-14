'use client';

import { useState } from 'react';
import { searchBeers, updateBeer, deleteBeer } from './actions';
import type { BeerRow } from './constants';

type RowStatus = 'idle' | 'editing' | 'saving' | 'deleted';

function BeerRow({ beer }: { beer: BeerRow }) {
  const [status, setStatus] = useState<RowStatus>('idle');
  const [fields, setFields] = useState({
    name: beer.name,
    name_ja: beer.name_ja ?? '',
    name_en: beer.name_en ?? '',
    brewery: beer.brewery ?? '',
    style: beer.style ?? '',
    abv: beer.abv ?? '',
    notes: beer.notes ?? '',
  });

  async function handleSave() {
    setStatus('saving');
    try {
      await updateBeer(beer.id, {
        name: fields.name || undefined,
        name_ja: fields.name_ja || undefined,
        name_en: fields.name_en || undefined,
        brewery: fields.brewery || undefined,
        style: fields.style || undefined,
        abv: fields.abv || undefined,
        notes: fields.notes || undefined,
      });
      setStatus('idle');
    } catch { setStatus('editing'); }
  }

  async function handleDelete() {
    if (!confirm(`"${beer.name}" を削除しますか？`)) return;
    setStatus('deleted');
    try { await deleteBeer(beer.id); } catch { setStatus('idle'); }
  }

  if (status === 'deleted') {
    return (
      <tr className="opacity-40 border-b bg-red-50">
        <td className="px-3 py-2 text-sm text-gray-400 line-through">{fields.name}</td>
        <td colSpan={6} className="px-3 py-2 text-sm text-red-500">削除済み</td>
      </tr>
    );
  }

  if (status === 'editing' || status === 'saving') {
    const busy = status === 'saving';
    return (
      <tr className="bg-yellow-50 border-b">
        <td className="px-2 py-1"><input className="w-full border rounded px-2 py-1 text-xs" value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} /></td>
        <td className="px-2 py-1"><input className="w-full border rounded px-2 py-1 text-xs" value={fields.name_ja} onChange={e => setFields(f => ({ ...f, name_ja: e.target.value }))} placeholder="JA" /></td>
        <td className="px-2 py-1"><input className="w-full border rounded px-2 py-1 text-xs" value={fields.brewery} onChange={e => setFields(f => ({ ...f, brewery: e.target.value }))} placeholder="ブルワリー" /></td>
        <td className="px-2 py-1"><input className="w-24 border rounded px-2 py-1 text-xs" value={fields.style} onChange={e => setFields(f => ({ ...f, style: e.target.value }))} placeholder="スタイル" /></td>
        <td className="px-2 py-1"><input className="w-16 border rounded px-2 py-1 text-xs" value={fields.abv} onChange={e => setFields(f => ({ ...f, abv: e.target.value }))} placeholder="ABV" /></td>
        <td className="px-2 py-1 text-xs text-gray-400">@{beer.instagram_username}</td>
        <td className="px-2 py-1 whitespace-nowrap space-x-1">
          <button onClick={handleSave} disabled={busy} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">{busy ? '保存中' : '保存'}</button>
          <button onClick={() => setStatus('idle')} className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300">キャンセル</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2 text-sm font-medium">{fields.name}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fields.name_ja || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fields.brewery || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fields.style || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fields.abv || <span className="text-gray-300">—</span>}</td>
      <td className="px-3 py-2 text-xs text-gray-400">@{beer.instagram_username}</td>
      <td className="px-3 py-2 whitespace-nowrap space-x-1">
        <button onClick={() => setStatus('editing')} className="px-2 py-1 bg-gray-100 text-xs rounded hover:bg-gray-200">編集</button>
        <button onClick={handleDelete} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200">削除</button>
      </td>
    </tr>
  );
}

export default function BeerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BeerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await searchBeers(query);
      setResults(data);
      setSearched(true);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 p-3 border-b">
        <input
          className="flex-1 border rounded px-3 py-1.5 text-sm"
          placeholder="ビール名 / ブルワリー名 / @アカウント名"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? '検索中...' : '検索'}
        </button>
      </form>

      {searched && (
        results.length === 0 ? (
          <p className="text-gray-500 py-6 text-center text-sm">該当なし</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Beer</th>
                  <th className="px-3 py-2">JA</th>
                  <th className="px-3 py-2">Brewery</th>
                  <th className="px-3 py-2">Style</th>
                  <th className="px-3 py-2">ABV</th>
                  <th className="px-3 py-2">Bar</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>{results.map(b => <BeerRow key={b.id} beer={b} />)}</tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
