const { chromium } = require('playwright');
require('dotenv').config();

const SESSION_FILE = `${__dirname}/../data/session.json`;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(`https://www.instagram.com/${process.env.INSTAGRAM_USERNAME}/following/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'data/debug-following2.png' });
  console.log('URL:', page.url());

  // ユーザー名リンクを取得
  const users = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/"]'))
      .map(a => a.getAttribute('href').replace(/\//g, ''))
      .filter(u => u && !u.includes('?') && u.length > 0 && !['explore','reel','reels','p','stories','tv'].includes(u));
  });
  console.log('Users found:', users.slice(0, 10));
  console.log('Total:', users.length);

  await browser.close();
})();
