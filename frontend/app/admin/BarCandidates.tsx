'use client';

import { useState } from 'react';
import { addBar, skipBar } from './adminClient';

export type BarCandidate = {
  name: string;
  name_en: string | null;
  instagram: string;
  type: string | null;
};

type RowStatus = 'idle' | 'adding' | 'added' | 'skipped';

function CandidateRow({ bar }: { bar: BarCandidate }) {
  const [status, setStatus] = useState<RowStatus>('idle');
  const busy = status === 'adding' || status === 'added' || status === 'skipped';

  async function handleAdd() {
    setStatus('adding');
    try { await addBar(bar); setStatus('added'); } catch { setStatus('idle'); }
  }

  async function handleSkip() {
    setStatus('skipped');
    try { await skipBar(bar.instagram); } catch { setStatus('idle'); }
  }

  if (status === 'added') {
    return (
      <tr className="opacity-40 border-b bg-green-50">
        <td className="px-3 py-2 text-sm text-gray-400">{bar.name}</td>
        <td colSpan={3} className="px-3 py-2 text-sm text-green-600">✓ 追加済み</td>
      </tr>
    );
  }
  if (status === 'skipped') {
    return (
      <tr className="opacity-40 border-b bg-gray-50">
        <td className="px-3 py-2 text-sm text-gray-400 line-through">{bar.name}</td>
        <td colSpan={3} className="px-3 py-2 text-sm text-gray-400">スキップ</td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2 text-sm font-medium">{bar.name}{bar.name_en ? <span className="ml-1 text-gray-400 font-normal">/ {bar.name_en}</span> : ''}</td>
      <td className="px-3 py-2 text-sm">
        <a href={`https://www.instagram.com/${bar.instagram}/`} target="_blank" className="text-blue-600 hover:underline">@{bar.instagram}</a>
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">{bar.type ?? '—'}</td>
      <td className="px-3 py-2 whitespace-nowrap space-x-2">
        <button onClick={handleAdd} disabled={busy} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">{status === 'adding' ? '追加中...' : '追加'}</button>
        <button onClick={handleSkip} disabled={busy} className="px-3 py-1 bg-gray-100 text-sm rounded hover:bg-gray-200 disabled:opacity-50">スキップ</button>
      </td>
    </tr>
  );
}

export default function BarCandidates({ bars }: { bars: BarCandidate[] }) {
  if (bars.length === 0) {
    return <p className="text-gray-500 py-8 text-center">新規バー候補はありません ✅</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
            <th className="px-3 py-2">Bar Name</th>
            <th className="px-3 py-2">Instagram</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>{bars.map(b => <CandidateRow key={b.instagram} bar={b} />)}</tbody>
      </table>
    </div>
  );
}
