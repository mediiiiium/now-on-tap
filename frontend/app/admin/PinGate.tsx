'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'admin_authed';
const PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '';

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    setAuthed(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PIN) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAuthed(true);
    } else {
      setError(true);
      setInput('');
      setTimeout(() => setError(false), 1500);
    }
  }

  if (authed === null) return null; // hydration待ち

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 w-72 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Now On Tap 管理</h1>
          <p className="text-xs text-gray-400 mb-6">PINを入力してください</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="••••"
              className={`w-full border rounded-lg px-4 py-3 text-center text-xl tracking-widest focus:outline-none focus:ring-2 ${error ? 'border-red-400 ring-red-200' : 'focus:ring-blue-200'}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">PINが違います</p>}
            <button type="submit" className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700">
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
