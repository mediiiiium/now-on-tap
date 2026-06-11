'use client';

import { useState } from 'react';
import { snoozeAlert, setBarStatus } from './adminClient';

export type TapListAlert = {
  username: string;
  totalPosts: number;
  tapListPosts: number;
  tapListRate: string;
  lastPost: string;
  lastTapList: string;
  diagnosis: string;
  severity: string;
};

type RowStatus = 'idle' | 'loading' | 'snoozed' | 'inactive' | 'closed';

function AlertRow({ alert }: { alert: TapListAlert }) {
  const [status, setStatus] = useState<RowStatus>('idle');
  const busy = status === 'loading';

  async function handleSnooze() {
    setStatus('loading');
    try { await snoozeAlert(alert.username); setStatus('snoozed'); } catch { setStatus('idle'); }
  }

  async function handleInactive() {
    setStatus('loading');
    try { await setBarStatus(alert.username, 'inactive'); setStatus('inactive'); } catch { setStatus('idle'); }
  }

  async function handleClosed() {
    if (!confirm(`@${alert.username} を閉店にしますか？`)) return;
    setStatus('loading');
    try { await setBarStatus(alert.username, 'closed'); setStatus('closed'); } catch { setStatus('idle'); }
  }

  if (status === 'snoozed') {
    return (
      <tr className="opacity-40 border-b bg-green-50">
        <td className="px-3 py-2 text-sm text-gray-400">@{alert.username}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-green-600">✓ 7日間スヌーズ</td>
      </tr>
    );
  }
  if (status === 'inactive') {
    return (
      <tr className="opacity-40 border-b bg-gray-50">
        <td className="px-3 py-2 text-sm text-gray-400">@{alert.username}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-gray-500">📵 SNS未稼動に設定</td>
      </tr>
    );
  }
  if (status === 'closed') {
    return (
      <tr className="opacity-40 border-b bg-red-50">
        <td className="px-3 py-2 text-sm text-gray-400 line-through">@{alert.username}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-red-500">🚪 閉店に設定</td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-2 text-sm font-medium">
        <a href={`https://www.instagram.com/${alert.username}/`} target="_blank" className="text-blue-600 hover:underline">@{alert.username}</a>
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">
        投稿 {alert.totalPosts}件 / TL {alert.tapListPosts}件 ({alert.tapListRate})
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">
        最終TL: {alert.lastTapList}
      </td>
      <td className="px-3 py-2 text-sm text-gray-500 max-w-xs">{alert.diagnosis}</td>
      <td className="px-3 py-2 whitespace-nowrap space-x-1">
        <button onClick={handleSnooze} disabled={busy} className="px-2 py-1 bg-gray-100 text-sm rounded hover:bg-gray-200 disabled:opacity-50">
          {busy ? '処理中...' : 'スヌーズ'}
        </button>
        <button onClick={handleInactive} disabled={busy} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200 disabled:opacity-50">
          SNS未稼動
        </button>
        <button onClick={handleClosed} disabled={busy} className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 disabled:opacity-50">
          閉店
        </button>
      </td>
    </tr>
  );
}

export default function TapListAlerts({ alerts }: { alerts: TapListAlert[] }) {
  if (alerts.length === 0) {
    return <p className="text-gray-500 py-8 text-center">タップリスト異常はありません ✅</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 text-xs text-gray-500 uppercase">
            <th className="px-3 py-2">Account</th>
            <th className="px-3 py-2">Stats</th>
            <th className="px-3 py-2">Last TL</th>
            <th className="px-3 py-2">Diagnosis</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>{alerts.map(a => <AlertRow key={a.username} alert={a} />)}</tbody>
      </table>
    </div>
  );
}
