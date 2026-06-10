import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Beer = {
  name: string;
  brewery: string | null;
  style: string | null;
  abv: string | null;
  price: string | null;
  notes: string | null;
};

export type Bar = {
  instagram_username: string;
  bar_name: string | null;
  area: string | null;
  last_updated: string | null;   // タップリストなしの場合 null
  post_url: string | null;
  beers: Beer[];
  has_tap_list: boolean;         // タップリストデータがあるか
};

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
        area: row.area,
        last_updated: row.last_updated,
        post_url: row.post_url,
        beers: [],
        has_tap_list: row.last_updated !== null,
      };
    }
    if (row.beer_name) {
      bars[key].beers.push({
        name: row.beer_name,
        brewery: row.brewery,
        style: row.style,
        abv: row.abv,
        price: row.price,
        notes: row.notes,
      });
    }
  }
  return Object.values(bars);
}
