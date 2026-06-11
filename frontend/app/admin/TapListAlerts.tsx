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

type RowStatus = 'idle' | 'loading' | 'snoozed' | 'excluded';

function AlertRow({ alert }: { alert: TapListAlert }) {
  const [status, setStatus] = useState<RowStatus>('idle');
  const busy = status === 'loading';

  async function handleSnooze() {
    setStatus('loading');
    try { await snoozeAlert(alert.username); setStatus('snoozed'); } catch { setStatus('idle'); }
  }

  async function handleExclude() {
    setStatus('loading');
    try { await setBarStatus(alert.username, 'inactive'); setStatus('excluded'); } catch { setStatus('idle'); }
  }

  if (status === 'snoozed') {
    return (
      <tr className="opacity-40 border-b bg-green-50">
        <td className="px-3 py-2 text-sm text-gray-400">@{alert.username}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-green-600">✓ 7日間スヌーズ</td>
      </tr>
    );
  }
  if (status === 'excluded') {
    return (
      <tr className="opacity-40 border-b bg-gray-50">
        <td className="px-3 py-2 text-sm text-gray-400">@{alert.username}</td>
        <td colSpan={4} className="px-3 py-2 text-sm text-gray-400">除外済み</td>
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
        <button onClick={handleExclude} disabled={busy} className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded hover:bg-orange-200 disabled:opacity-50">
          除外
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
