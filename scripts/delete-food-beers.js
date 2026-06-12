/**
 * フード誤抽出ビールを検出・削除する
 * 条件: 料理キーワードを含む AND ビールキーワードを含まない
 *
 * Usage:
 *   node scripts/delete-food-beers.js --dry-run  # 確認のみ
 *   node scripts/delete-food-beers.js            # 実際に削除
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

const FOOD_KEYWORDS = [
  '焼き', '焼', '揚げ', '揚', '煮', '蒸し', '蒸', '炒め', '炒',
  '和え', '盛り', '盛', 'サラダ', '刺身', '寿司', '丼', 'ご飯',
  'スープ', '味噌', '醤油', 'ポテト', 'チーズ', 'ソーセージ',
  'から揚げ', 'からあげ', '天ぷら', 'たこ焼き', 'お好み焼き',
  'ピザ', 'パスタ', 'ナチョス', 'フライ',
];

const BEER_KEYWORDS = [
  'ale', 'ipa', 'lager', 'stout', 'porter', 'pilsner', 'pilsener',
  'wheat', 'weizen', 'saison', 'sour', 'gose', 'lambic', 'hazy',
  'neipa', 'dipa', 'pale', 'amber', 'dark', 'black', 'white', 'red',
  'brewing', 'brewery', 'brewed', 'beer', 'bier', 'bière',
  'ビール', '麦酒', 'エール', 'ラガー', 'スタウト', 'ポーター',
  'ピルスナー', 'ヴァイツェン', 'セゾン', 'サワー', 'ゴーゼ',
  'ペールエール', 'ブラック', 'ホワイト', 'クラフト', '醸造',
  'ドライホップ', 'ヘイジー', 'モルト', 'ホップ',
];

function isFood(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  const hasFood = FOOD_KEYWORDS.some(k => name.includes(k));
  const hasBeer = BEER_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
  return hasFood && !hasBeer;
}

async function main() {
  const { data: beers } = await sb.from('beers').select('id, name, instagram_username').is('brewery', null);

  const foodBeers = (beers ?? []).filter(b => isFood(b.name));

  console.log(`brewery NULL: ${beers?.length}件`);
  console.log(`フード判定: ${foodBeers.length}件`);
  foodBeers.forEach(b => console.log(` - [${b.id}] ${b.name} @${b.instagram_username}`));

  if (foodBeers.length === 0) { console.log('削除対象なし'); return; }
  if (DRY_RUN) { console.log('\n--dry-run のため削除スキップ'); return; }

  const ids = foodBeers.map(b => b.id);
  const { error } = await sb.from('beers').delete().in('id', ids);
  if (error) { console.error('削除失敗:', error.message); return; }
  console.log(`✅ ${foodBeers.length}件削除完了`);
}

main().catch(console.error);
