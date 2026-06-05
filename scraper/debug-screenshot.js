const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'data/debug-login.png', fullPage: true });
  console.log('Screenshot saved to data/debug-login.png');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  // 全inputを列挙
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name, type: i.type, placeholder: i.placeholder
    }))
  );
  console.log('Inputs found:', inputs);

  await browser.close();
})();
