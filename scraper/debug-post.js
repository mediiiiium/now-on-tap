const { chromium } = require('playwright');
const fs = require('fs');
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

  await page.goto('https://www.instagram.com/p/DZE_JKkGOVV/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'data/debug-post.png' });

  const tags = await page.evaluate(() => {
    const important = ['article', 'main', 'section', '[role="main"]'];
    return important.map(sel => ({
      selector: sel,
      count: document.querySelectorAll(sel).length
    }));
  });
  console.log('Tags:', tags);

  // 画像を探す
  const images = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).slice(0, 5).map(img => ({
      src: img.src.slice(0, 80),
      alt: img.alt.slice(0, 50),
    }))
  );
  console.log('Images:', images);

  await browser.close();
})();
