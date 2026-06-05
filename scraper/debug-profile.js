const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

const SESSION_FILE = `${__dirname}/../data/session.json`;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const storageState = JSON.parse(fs.readFileSync(SESSION_FILE));
  const context = await browser.newContext({
    storageState,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://www.instagram.com/p2b.haus/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'data/debug-profile.png', fullPage: false });
  console.log('URL:', page.url());

  // 投稿リンクを探す
  const postLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    return [...new Set(links.map(a => a.href))].slice(0, 5);
  });
  console.log('Post links:', postLinks);

  await browser.close();
})();
