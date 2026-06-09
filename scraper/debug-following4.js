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

  await page.goto(`https://www.instagram.com/${process.env.INSTAGRAM_USERNAME}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 「フォロー中」を含む全テキストノードを探す
  const texts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, span'))
      .filter(e => e.textContent.includes('フォロー'))
      .map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 50), href: e.href || '' }));
  });
  console.log('フォロー含む要素:', JSON.stringify(texts, null, 2));

  await browser.close();
})();
