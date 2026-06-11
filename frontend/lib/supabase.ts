import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Beer = {
  name: string;
  name_ja: string | null;   // 日本語ビール名
  name_en: string | null;   // 英語ビール名
  brewery: string | null;
  brewery_ja: string | null; // 日本語ブルワリー名
  brewery_en: string | null; // 英語ブルワリー名
  style: string | null;
  abv: string | null;
  price: string | null;
  notes: string | null;
};

export type Bar = {
  instagram_username: string;
  bar_name: string | null;
  bar_name_en: string | null; // 英語バー名
  area: string | null;
  area_en: string | null;     // 英語エリア名
  website_url: string | null;
  google_maps_url: string | null;
  last_updated: string | null;
  post_url: string | null;
  caption: string | null;     // Instagramキャプション
  beers: Beer[];
  has_tap_list: boolean;
};

export type StyleGroup = {
  group_name: string;
  styles: string[];
};

export async function getStyleGroups(): Promise<StyleGroup[]> {
  const { data, error } = await supabase
    .from('beer_styles')
    .select('name, group_name')
    .order('group_name');
  if (error) throw error;

  const groups: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!groups[row.group_name]) groups[row.group_name] = [];
    groups[row.group_name].push(row.name);
  }
  return Object.entries(groups).map(([group_name, styles]) => ({ group_name, styles }));
}

export async function getTapLists(): Promise<Bar[]> {
  const { data, error } = await supabase
    .from('current_tap_lists')
    .select('*')
    .order('last_updated', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const bars: Record<string, Bar> = {};
  for (const row of data ?? []) {
    const key = row.instagram_username;
    if (!bars[key]) {
      bars[key] = {
        instagram_username: key,
        bar_name: row.bar_name,
        bar_name_en: row.bar_name_en,
        area: row.area,
        area_en: row.area_en,
        website_url: row.website_url ?? null,
        google_maps_url: row.google_maps_url ?? null,
        last_updated: row.last_updated,
        post_url: row.post_url,
        caption: row.caption ?? null,
        beers: [],
        has_tap_list: row.last_updated !== null,
      };
    }
    if (row.beer_name) {
      bars[key].beers.push({
        name: row.beer_name,
        name_ja: row.beer_name_ja,
        name_en: row.beer_name_en,
        brewery: row.brewery,
        brewery_ja: row.brewery_ja ?? null,
        brewery_en: row.brewery_en,
        style: row.style,
        abv: row.abv,
        price: row.price,
        notes: row.notes,
      });
    }
  }
  return Object.values(bars);
}
