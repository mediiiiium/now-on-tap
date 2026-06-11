'use client';

import { useState } from 'react';
import { updateStyle, approveStyle, deleteStyle, STYLE_CATEGORIES } from './adminClient';

type Style = {
  id: number;
  name: string;
  category: string;
};

type RowStatus = 'idle' | 'saving' | 'saved' | 'approved' | 'deleted';

function StyleRow({ style }: { style: Style }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({ name: style.name, category: style.category });
  const [status, setStatus] = useState<RowStatus>('idle');
  const busy = status === 'saving' || status === 'approved' || status === 'deleted';

  async function handleSave() {
    setStatus('saving');
    try {
      await updateStyle(style.id, fields);
      setEditing(false);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch { setStatus('idle'); }
  }

  async function handleApprove() {
    setStatus('approved');
    try { await approveStyle(style.id); } catch { setStatus('idle'); }
  }

  async function handleDelete() {
    if (!confirm(`"${style.name}" を削除しますか？`)) return;
    setStatus('deleted');
    try { await deleteStyle(style.id); } catch { setStatus('idle'); }
  }

  if (status === 'approved') {
    return (
      <tr className="opacity-40 transition-opacity duration-500 border-b bg-green-50">
        <td className="px-3 py-2 text-sm text-gray-400">{fields.name}</td>
        <td colSpan={2} className="px-3 py-2 text-sm text-green-600">✓ 承認済み</td>
      </tr>
    );
  }

  if (status === 'deleted') {
    return (
      <tr className="opacity-40 transition-opacity duration-500 border-b bg-red-50">
        <td className="px-3 py-2 text-sm text-gray-400 line-through">{fields.name}</td>
        <td colSpan={2} className="px-3 py-2 text-sm text-red-500">削除中...</td>
      </tr>
    );
  }

  if (editing) {
    return (
      <tr className="bg-yellow-50 border-b">
        <td className="px-3 py-2"><input className="w-full border rounded px-2 py-1 text-sm" value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} /></td>
        <td className="px-3 py-2">
          <select className="w-full border rounded px-2 py-1 text-sm" value={fields.category} onChange={e => setFields(f => ({ ...f, category: e.target.value }))}>
            {STYLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </td>
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
      <td className="px-3 py-2 text-sm text-gray-500">{fields.category}</td>
      <td className="px-3 py-2 whitespace-nowrap space-x-2">
        <button onClick={() => setEditing(true)} className="px-3 py-1 bg-gray-100 text-sm rounded hover:bg-gray-200">編集</button>
        <button onClick={handleApprove} disabled={busy} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">承認</button>
        <button onClick={handleDelete} disabled={busy} className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 disabled:opacity-50">削除</button>
      </td>
    </tr>
  );
}

export default function StyleReview({ styles }: { styles: Style[] }) {
  if (styles.length === 0) {
    return <p className="text-gray-500 py-8 text-center">要確認のスタイルはありません ✅</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
            <th className="px-3 py-2">Style Name</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {styles.map(s => <StyleRow key={s.id} style={s} />)}
        </tbody>
      </table>
    </div>
  );
}
