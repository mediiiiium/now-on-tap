const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
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

  await page.screenshot({ path: 'data/debug-before-submit.png' });

  // ボタン類を全部列挙
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, input[type="submit"]')).map(b => ({
      tag: b.tagName,
      type: b.type,
      text: b.textContent.trim().slice(0, 50),
      visible: b.offsetParent !== null,
      disabled: b.disabled,
    }))
  );
  console.log('Buttons:', JSON.stringify(buttons, null, 2));

  // Enterキーで送信を試みる
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  console.log('URL after Enter:', page.url());
  await page.screenshot({ path: 'data/debug-after-submit.png' });

  await browser.close();
})();
