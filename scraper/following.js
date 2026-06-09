const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SESSION_FILE = path.join(__dirname, '../data/session.json');

async function getFollowing(username) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // プロフィールページを開く
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // フォロー中リンクをクリック（「フォロー中N人」のテキストを含むリンク or span）
    const followingLink = page.locator('a:has-text("フォロー中"), span:has-text("フォロー中")').first();
    await followingLink.waitFor({ state: 'visible', timeout: 10000 });
    await followingLink.click();
    await page.waitForTimeout(2000);

    // モーダルが開くのを待つ
    const modal = page.locator('[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    // スクロールしながら全員取得
    const following = new Set();
    let prevCount = 0;
    let noChangeCount = 0;

    while (noChangeCount < 3) {
      // 現在表示されているユーザー名を取得
      const usernames = await modal.evaluate(() => {
        const links = Array.from(document.querySelectorAll('[role="dialog"] a[href^="/"]'));
        return links
          .map(a => a.getAttribute('href').replace(/\//g, ''))
          .filter(u => u && !u.includes('?') && u.length > 0);
      });

      usernames.forEach(u => following.add(u));

      if (following.size === prevCount) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
        prevCount = following.size;
      }

      // モーダル内をスクロール
      await modal.evaluate(el => el.scrollTop += 500);
      await page.waitForTimeout(800);
    }

    const result = [...following].filter(u => u !== username);
    console.log(`@${username} のフォロー中: ${result.length}件`);
    return result;

  } finally {
    await browser.close();
  }
}

module.exports = { getFollowing };

if (require.main === module) {
  const username = process.argv[2] || process.env.INSTAGRAM_USERNAME;
  getFollowing(username)
    .then(list => {
      console.log(list);
    })
    .catch(console.error);
}
