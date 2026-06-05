const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // networkidleまで待つ
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.fill('input[name="email"]', process.env.INSTAGRAM_USERNAME);
  await page.fill('input[name="pass"]', process.env.INSTAGRAM_PASSWORD);
  await page.waitForTimeout(1000);

  const allButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      type: b.type,
      text: b.textContent.trim().slice(0, 80),
      visible: b.offsetParent !== null,
    }));
  });
  console.log('All buttons after networkidle:', JSON.stringify(allButtons, null, 2));

  // div/aもチェック（role=buttonなど）
  const roleButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="button"]')).map(b => ({
      tag: b.tagName,
      text: b.textContent.trim().slice(0, 80),
      visible: b.offsetParent !== null,
    }));
  });
  console.log('Role=button elements:', JSON.stringify(roleButtons, null, 2));

  await page.screenshot({ path: 'data/debug-dom2.png' });
  await browser.close();
})();
