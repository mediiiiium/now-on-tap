import { createClient } from '@supabase/supabase-js';

export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function updateBrewery(id: number, oldName: string, fields: {
  name?: string; name_ja?: string; prefecture?: string; country?: string; website_url?: string; untappd_url?: string;
}) {
  if (fields.name && fields.name !== oldName) {
    await sb.from('brewery_aliases').upsert({ brewery_id: id, alias: oldName }, { onConflict: 'alias' });
  }
  const { error } = await sb.from('breweries').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function approveBrewery(id: number) {
  const { error } = await sb.from('breweries').update({ needs_review: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBrewery(id: number) {
  const { error } = await sb.from('breweries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function countBreweryBeers(id: number): Promise<number> {
  const { count } = await sb.from('beers').select('id', { count: 'exact', head: true }).eq('brewery_id', id);
  return count ?? 0;
}

export type BrewerySample = { beer_name: string; instagram_username: string };

export async function getBrewerySamples(id: number): Promise<BrewerySample[]> {
  const { data } = await sb.from('beers').select('name, instagram_username').eq('brewery_id', id).limit(3);
  return (data ?? []).map(b => ({ beer_name: b.name, instagram_username: b.instagram_username }));
}

export const STYLE_CATEGORIES = ['Hoppy', 'Lager', 'Dark', 'Belgian', 'Wheat', 'Sour', 'Malt', 'Strong', 'Other'];

export async function updateStyle(id: number, fields: { name?: string; category?: string }) {
  const { error } = await sb.from('styles').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function approveStyle(id: number) {
  const { error } = await sb.from('styles').update({ needs_review: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteStyle(id: number) {
  const { error } = await sb.from('styles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function addBar(bar: { name: string; name_en: string | null; instagram: string }) {
  const { error } = await sb.from('bars').insert({
    instagram_username: bar.instagram,
    name: bar.name,
    name_en: bar.name_en ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function excludeBarCandidate(instagram: string) {
  const { error } = await sb.from('bars').insert({ instagram_username: instagram, status: 'excluded' });
  if (error) throw new Error(error.message);
}

export async function snoozeAlert(instagram_username: string) {
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('bars').update({ alert_snoozed_until: until }).eq('instagram_username', instagram_username);
  if (error) throw new Error(error.message);
}

export async function setBarStatus(instagram_username: string, status: 'inactive' | 'closed') {
  const { error } = await sb.from('bars').update({ status }).eq('instagram_username', instagram_username);
  if (error) throw new Error(error.message);
}
