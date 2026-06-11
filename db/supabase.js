const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getBar(instagramUsername) {
  const { data } = await supabase
    .from('bars')
    .select('id, instagram_username, name, area')
    .eq('instagram_username', instagramUsername)
    .single();
  return data ?? null;
}

async function upsertBar(instagramUsername, name = null, area = null) {
  const { data, error } = await supabase
    .from('bars')
    .upsert({
      instagram_username: instagramUsername,
      name,
      area,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: 'instagram_username' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function markBarClosed(instagramUsername) {
  const { error } = await supabase
    .from('bars')
    .update({ is_closed: true })
    .eq('instagram_username', instagramUsername);
  if (error) throw error;
}

async function savePost({ instagramUsername, postId, postUrl, postedAt, caption, isTapList, beers }) {
  // 既存チェック
  const { data: existing } = await supabase
    .from('posts')
    .select('id')
    .eq('post_id', postId)
    .single();
  if (existing) return { skipped: true, postDbId: existing.id };

  // バーを取得/作成
  const bar = await upsertBar(instagramUsername);

  // 投稿を保存
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      bar_id: bar.id,
      instagram_username: instagramUsername,
      post_id: postId,
      post_url: postUrl,
      posted_at: postedAt,
      caption: caption ?? null,
      is_tap_list: isTapList,
    })
    .select()
    .single();
  if (postError) throw postError;

  // ビールを保存
  if (isTapList && beers?.length > 0) {
    const beerRows = beers.map(b => ({
      post_id: post.id,
      instagram_username: instagramUsername,
      name: b.name,
      name_ja: b.name_ja ?? null,
      name_en: b.name_en ?? null,
      brewery: b.brewery,
      brewery_en: b.brewery_en ?? null,
      style: b.style,
      abv: b.abv,
      price: b.price,
      notes: b.notes,
    }));
    const { error: beerError } = await supabase.from('beers').insert(beerRows);
    if (beerError) throw beerError;
  }

  return { skipped: false, postDbId: post.id };
}

async function getCurrentTapLists() {
  const { data, error } = await supabase
    .from('current_tap_lists')
    .select('*')
    .order('last_updated', { ascending: false });
  if (error) throw error;

  // bar単位にグループ化
  const bars = {};
  for (const row of data) {
    const key = row.instagram_username;
    if (!bars[key]) {
      bars[key] = {
        instagram_username: key,
        bar_name: row.bar_name,
        area: row.area,
        last_updated: row.last_updated,
        post_url: row.post_url,
        beers: [],
      };
    }
    bars[key].beers.push({
      name: row.beer_name,
      brewery: row.brewery,
      style: row.style,
      abv: row.abv,
      price: row.price,
      notes: row.notes,
    });
  }
  return Object.values(bars);
}

module.exports = { getBar, upsertBar, markBarClosed, savePost, getCurrentTapLists };
