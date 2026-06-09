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

  await page.goto(`https://www.instagram.com/${process.env.INSTAGRAM_USERNAME}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'data/debug-following.png' });

  // フォロー中リンクを探す
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).map(a => ({
      href: a.href,
      text: a.textContent.trim().slice(0, 30),
    })).filter(a => a.text.match(/フォロー|following/i) || a.href.includes('following'))
  );
  console.log('Following links:', links);

  await browser.close();
})();
