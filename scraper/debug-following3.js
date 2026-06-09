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

  // 「フォロー中53人」要素を探す
  const el = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const found = els.find(e => e.childElementCount === 0 && e.textContent.trim().match(/^フォロー中\d+人$/));
    if (found) {
      return { tag: found.tagName, text: found.textContent.trim(), parent: found.parentElement?.tagName };
    }
    return null;
  });
  console.log('Element found:', el);

  // クリックしてみる
  if (el) {
    await page.locator(`text=フォロー中53人`).first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'data/debug-following3.png' });

    const dialog = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    console.log('Dialog opened:', dialog);
  }

  await browser.close();
})();
