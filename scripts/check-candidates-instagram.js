/**
 * 東京候補店舗のInstagramアカウントを確認する
 * - アカウントが存在するか
 * - 最近タップリスト画像を投稿しているか
 * - フォロワー数
 *
 * Usage: node scripts/check-candidates-instagram.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SESSION_FILE = path.join(__dirname, '../data/session.json');

const CANDIDATES = [
  'baldys_goodbeer','blue_front_shibaura','afterschoolbrewery','chuolinebeerworks_',
  'busobrewery.kawasemibrew','logram_brewing','buzzed_lamb_brewing','nikubee.official',
  'fetishclubbeer','romeo_brewery','breadale.brewery','tama_tumuji_werks',
  '21brewcave','kunitachi_brewery','habuminatobrewery','adachi_brewery',
  'omebeer_tokyo','sakeyajapan','kaiser_chick','ucciare','hk.camos',
  'bathe_yotsume_brewery','canon.brewing','dam_brewery_restaurant','thisbrewing',
  'racines_aoyama','10ants_brewing','kichibrewing','hinomotobeer','kunisawa_brewing',
  'hitujiaisu','ourdays_brewery','shinjukuale','honeycomb_and_hopworks',
  '2hai_me_no_beer','papasbrewing.co','sakeya.kitami','faryeasttokyo',
  'haneda_sky_brewing','beerclubpopeye.kido','futakobrewery','36sauna',
  'craftrock_brewing','hokusaibeeratelier','virgobeer2000','uokin_harumi',
  'folkwaysbrewing','anchor.point','vertere','ginzabrewery','sakeya.nishiogi',
  'crancbeer','gotojozo','hyuga_brewery','kagoyatasuku','meisterbrau_meguro',
  'sakadukibrewing','sakadukilab','springvalleybrewery_official','tyharbor_brewery_official',
  'tokyoaleworks','fatbarley','mountainriverbrewery','ikarijyouzou','ogabrewing','takaobeer',
];

async function checkAccount(page, username) {
  try {
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded', timeout: 15000,
    });
    await page.waitForTimeout(2000);

    // 404チェック
    const url = page.url();
    if (url.includes('/accounts/login') || url.includes('404')) {
      return { username, exists: false, reason: 'not found / private' };
    }

    // フォロワー数
    const followersText = await page.evaluate(() => {
      const items = document.querySelectorAll('li');
      for (const li of items) {
        const text = li.textContent;
        if (text.includes('フォロワー') || text.includes('followers')) {
          const m = text.match(/([\d,\.]+[万K]?)\s*(フォロワー|followers)/);
          return m ? m[1] : null;
        }
      }
      return null;
    });

    // 投稿数
    const postsText = await page.evaluate(() => {
      const items = document.querySelectorAll('li');
      for (const li of items) {
        const text = li.textContent;
        if (text.includes('件の投稿') || text.includes('posts')) {
          const m = text.match(/([\d,]+)\s*(件の投稿|posts)/);
          return m ? m[1] : null;
        }
      }
      return null;
    });

    // 直近投稿のalt/aria-labelからタップリスト関連キーワード確認
    const recentAlts = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('article img, ._aagv img'));
      return imgs.slice(0, 9).map(img => img.alt || img.getAttribute('aria-label') || '');
    });

    const tapKeywords = ['タップ', 'tap', 'ビール', 'beer', 'craft', 'クラフト', 'IPA', 'on tap'];
    const hasTapContent = recentAlts.some(alt =>
      tapKeywords.some(kw => alt.toLowerCase().includes(kw.toLowerCase()))
    );

    return {
      username,
      exists: true,
      followers: followersText,
      posts: postsText,
      hasTapContent,
      recentAlts: recentAlts.slice(0, 3),
    };
  } catch (e) {
    return { username, exists: false, reason: e.message.slice(0, 50) };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let context;

  if (fs.existsSync(SESSION_FILE)) {
    context = await browser.newContext({ storageState: SESSION_FILE });
    console.log('✅ Using saved session');
  } else {
    context = await browser.newContext();
    console.log('⚠️  No session found, results may be limited');
  }

  const page = await context.newPage();

  const results = [];
  console.log(`\n🔍 Checking ${CANDIDATES.length} accounts...\n`);

  for (let i = 0; i < CANDIDATES.length; i++) {
    const username = CANDIDATES[i];
    process.stdout.write(`[${i + 1}/${CANDIDATES.length}] @${username} ... `);

    const result = await checkAccount(page, username);

    if (result.exists) {
      console.log(`✓ ${result.followers ?? '?'} followers, ${result.posts ?? '?'} posts${result.hasTapContent ? ' 🍺' : ''}`);
    } else {
      console.log(`✗ ${result.reason}`);
    }

    results.push(result);
    await page.waitForTimeout(1500 + Math.random() * 1000);
  }

  await browser.close();

  // サマリー
  const active = results.filter(r => r.exists);
  const notFound = results.filter(r => !r.exists);
  const tapLikely = active.filter(r => r.hasTapContent);

  console.log(`\n📊 結果サマリー`);
  console.log(`  存在: ${active.length}件 / 不明・非公開: ${notFound.length}件`);
  console.log(`  タップ関連投稿あり（推定）: ${tapLikely.length}件`);

  console.log('\n🍺 タップリスト投稿が確認できたアカウント:');
  for (const r of tapLikely) {
    console.log(`  @${r.username} (${r.followers} followers)`);
  }

  // JSON保存
  fs.writeFileSync('candidates_check_result.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Saved to candidates_check_result.json');
}

main().catch(console.error);
