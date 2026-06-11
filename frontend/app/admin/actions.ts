'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function updateBrewery(id: number, oldName: string, fields: {
  name?: string;
  name_ja?: string;
  prefecture?: string;
  website_url?: string;
  untappd_url?: string;
}) {
  // name変更時は旧nameをエイリアスに保存
  if (fields.name && fields.name !== oldName) {
    await sb.from('brewery_aliases').upsert({ brewery_id: id, alias: oldName }, { onConflict: 'alias' });
  }
  const { error } = await sb.from('breweries').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function approveBrewery(id: number) {
  const { error } = await sb.from('breweries').update({ needs_review: false }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteBrewery(id: number) {
  const { error } = await sb.from('breweries').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

const STYLE_CATEGORIES = ['Hoppy', 'Lager', 'Dark', 'Belgian', 'Wheat', 'Sour', 'Malt', 'Strong', 'Other'];

export { STYLE_CATEGORIES };

export async function updateStyle(id: number, fields: { name?: string; category?: string }) {
  const { error } = await sb.from('styles').update(fields).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function approveStyle(id: number) {
  const { error } = await sb.from('styles').update({ needs_review: false }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteStyle(id: number) {
  const { error } = await sb.from('styles').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function addBar(bar: { name: string; name_en: string | null; instagram: string; type: string | null }) {
  const { error } = await sb.from('bars').insert({
    instagram_username: bar.instagram,
    name: bar.name,
    name_en: bar.name_en ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function skipBar(instagram: string) {
  // スキップはDBに記録せず楽観的UIのみ（次回KML照合で再表示）
}

export async function snoozeAlert(instagram_username: string) {
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('bars').update({ alert_snoozed_until: until }).eq('instagram_username', instagram_username);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
