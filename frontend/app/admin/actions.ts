import type { BeerRow, BrewerySample } from './constants';
export type { BeerRow, BrewerySample };
export { STYLE_CATEGORIES } from './constants';

async function api(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`/api/admin/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Request failed');
    throw new Error(text);
  }
  return res;
}

// ── Brewery ──────────────────────────────────────────────────────────────────

export async function updateBrewery(id: number, oldName: string, fields: {
  name?: string; name_ja?: string; prefecture?: string; country?: string; website_url?: string; untappd_url?: string;
}) {
  await api('brewery/update', { id, oldName, fields });
}

export async function approveBrewery(id: number) {
  await api('brewery/approve', { id });
}

export async function deleteBrewery(id: number) {
  await api('brewery/delete', { id });
}

export async function setBreweryCollab(id: number, is_collab: boolean) {
  await api('brewery/collab', { id, is_collab });
}

export async function countBreweryBeers(id: number): Promise<number> {
  const res = await api('brewery/count-beers', { id });
  const data = await res.json();
  return data.count;
}

export async function getBrewerySamples(id: number): Promise<BrewerySample[]> {
  const res = await api('brewery/samples', { id });
  return res.json();
}

// ── Style ────────────────────────────────────────────────────────────────────

export async function updateStyle(id: number, fields: { name?: string; category?: string }) {
  await api('style/update', { id, fields });
}

export async function approveStyle(id: number) {
  await api('style/approve', { id });
}

export async function deleteStyle(id: number) {
  await api('style/delete', { id });
}

// ── Bar ──────────────────────────────────────────────────────────────────────

export async function addBar(bar: { name: string; name_en: string | null; instagram: string; type?: string | null }) {
  await api('bar/add', { bar });
}

export async function excludeBarCandidate(instagram: string) {
  await api('bar/exclude', { instagram });
}

export async function snoozeAlert(instagram_username: string) {
  await api('bar/snooze', { instagram_username });
}

export async function setBarStatus(instagram_username: string, status: 'inactive' | 'closed') {
  await api('bar/status', { instagram_username, status });
}

// ── Beer ─────────────────────────────────────────────────────────────────────

export async function searchBeers(query: string): Promise<BeerRow[]> {
  const res = await api('beer/search', { query });
  return res.json();
}

export async function updateBeer(id: number, fields: {
  name?: string; name_ja?: string; name_en?: string;
  brewery?: string; style?: string; abv?: string; notes?: string;
}) {
  await api('beer/update', { id, fields });
}

export async function deleteBeer(id: number) {
  await api('beer/delete', { id });
}
