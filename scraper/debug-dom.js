const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.fill('input[name="email"]', process.env.INSTAGRAM_USERNAME);
  await page.fill('input[name="pass"]', process.env.INSTAGRAM_PASSWORD);
  await page.waitForTimeout(1000);

  // ボタン類のDOMを全部出す
  const allButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      type: b.type,
      text: b.textContent.trim().slice(0, 80),
      visible: b.offsetParent !== null,
      rect: b.getBoundingClientRect(),
      classes: b.className.slice(0, 100),
    }));
  });
  console.log('All buttons:', JSON.stringify(allButtons, null, 2));

  await browser.close();
})();
