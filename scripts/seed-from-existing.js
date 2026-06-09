// 既存のスクリーンショット + tap-lists.json からDBに投入
const { savePost, upsertBar } = require('../db/supabase');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const tapLists = require('../data/tap-lists.json');

// 投稿日時はスクレイパー結果から（tap-lists.jsonには入っていないので別途取得）
const postDates = {
  'DZE_JKkGOVV': '2026-06-02T09:08:17.000Z',
  'DXoMEnXEvck': '2026-04-27T08:11:54.000Z',
  'DZMt-MCGBga': '2026-06-05T09:12:10.000Z',
  'DZKKazOGFKS': '2026-06-04T09:23:02.000Z',
  'DZFEbevGGX7': '2026-06-02T09:54:29.000Z',
};

async function seed() {
  for (const [username, posts] of Object.entries(tapLists)) {
    console.log(`\n📍 ${username}`);
    await upsertBar(username,
      username === 'p2b.haus' ? 'P2B Haus' : username,
      username === 'p2b.haus' ? '吉祥寺' : null
    );

    for (const post of posts) {
      const result = await savePost({
        instagramUsername: username,
        postId: post.postId,
        postUrl: `https://www.instagram.com/p/${post.postId}/`,
        postedAt: postDates[post.postId] ?? null,
        isTapList: post.is_tap_list,
        beers: post.beers,
      });
      console.log(`  ${post.postId}: ${result.skipped ? 'スキップ' : `✅ 保存 (${post.beers?.length}ビール)`}`);
    }
  }
  console.log('\n✅ 完了');
}

seed().catch(console.error);
