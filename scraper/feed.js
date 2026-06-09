const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SESSION_FILE = path.join(__dirname, '../data/session.json');
const SCREENSHOTS_DIR = path.join(__dirname, '../data/screenshots');

async function scrapeFeed(scrollCount = 10) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log('フィードを取得中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const seenPostIds = new Set();
    const results = [];

    for (let i = 0; i < scrollCount; i++) {
      // 現在表示されている投稿リンクを収集
      const posts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')).map(a => ({
          postUrl: a.href,
          postId: a.href.match(/\/(?:p|reel)\/([^/]+)/)?.[1],
        })).filter(p => p.postId);
      });

      for (const post of posts) {
        if (seenPostIds.has(post.postId)) continue;
        seenPostIds.add(post.postId);

        // 投稿ページに移動してスクリーンショット + メタ情報取得
        try {
          const username = await getPostUsername(page, post.postUrl);
          if (!username) continue;

          const outputPath = path.join(SCREENSHOTS_DIR, username, `${post.postId}.png`);
          if (fs.existsSync(outputPath)) {
            console.log(`  ⏭  @${username}/${post.postId} スキップ（取得済み）`);
            continue;
          }

          console.log(`  📸 @${username}/${post.postId}`);
          const meta = await screenshotPost(page, post.postUrl, outputPath);
          results.push({ username, postId: post.postId, ...meta });

          await page.waitForTimeout(1000 + Math.random() * 1000);
          // フィードに戻る
          await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
          await page.waitForTimeout(1500);

        } catch (err) {
          console.error(`  ❌ ${post.postId}: ${err.message}`);
          await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
          await page.waitForTimeout(1500);
        }
      }

      // スクロール
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.waitForTimeout(2000);
    }

    console.log(`\n合計 ${results.length} 件の新規投稿を取得`);
    return results;

  } finally {
    await browser.close();
  }
}

async function getPostUsername(page, postUrl) {
  await page.goto(postUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  return await page.evaluate(() => {
    // <header> や投稿上部のユーザー名リンクを優先
    const selectors = [
      'header a[href^="/"]',
      'article a[href^="/"]',
      'main a[href^="/"]',
    ];
    for (const sel of selectors) {
      for (const a of document.querySelectorAll(sel)) {
        const href = a.getAttribute('href');
        // /username/ 形式のみ（/p/ /reels/ /explore/ 等を除外）
        if (href && /^\/[a-zA-Z0-9_.]+\/$/.test(href) &&
            !['p', 'reels', 'explore', 'stories', 'tv', 'reel'].includes(href.replace(/\//g, ''))) {
          return href.replace(/\//g, '');
        }
      }
    }
    return null;
  });
}

async function screenshotPost(page, postUrl, outputPath) {
  // getPostUsernameですでにページにいるのでそのまま使う
  const postedAt = await page.evaluate(() => {
    const time = document.querySelector('time');
    return time ? time.getAttribute('datetime') : null;
  }).catch(() => null);

  const main = page.locator('main').first();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await main.screenshot({ path: outputPath });

  return { postUrl, postedAt, screenshotPath: outputPath };
}

module.exports = { scrapeFeed };

if (require.main === module) {
  scrapeFeed(5).catch(console.error);
}
