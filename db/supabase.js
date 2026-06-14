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
    .update({ status: 'closed' })
    .eq('instagram_username', instagramUsername);
  if (error) throw error;
}

async function savePost({ instagramUsername, postId, postUrl, postedAt, caption, isTapList, beers }) {
  const { data: existing } = await supabase
    .from('posts')
    .select('id')
    .eq('post_id', postId)
    .single();
  if (existing) return { skipped: true, postDbId: existing.id };

  const bar = await upsertBar(instagramUsername);

  const { data, error } = await supabase.rpc('save_post_with_beers', {
    p_bar_id: bar.id,
    p_instagram: instagramUsername,
    p_post_id: postId,
    p_post_url: postUrl,
    p_posted_at: postedAt,
    p_caption: caption ?? null,
    p_is_tap_list: isTapList,
    p_beers: (isTapList && beers?.length > 0) ? beers : [],
  });
  if (error) throw error;

  return { skipped: false, postDbId: data };
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
