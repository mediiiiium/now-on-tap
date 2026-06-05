const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SESSION_FILE = path.join(__dirname, '../data/session.json');

(async () => {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: node scraper/enter-code.js <6digit-code>');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ログインページから入力
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });

  await page.fill('input[name="email"]', process.env.INSTAGRAM_USERNAME);
  await page.fill('input[name="pass"]', process.env.INSTAGRAM_PASSWORD);
  await page.waitForTimeout(1000);

  const loginBtn = page.locator('[role="button"]:has-text("ログイン"), [role="button"]:has-text("Log in")').first();
  await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
  await loginBtn.click();

  // codeentry or onetap (already logged in) を待つ
  await page.waitForURL(/codeentry|checkpoint|challenge|onetap/, { timeout: 15000 });
  console.log('Current page:', page.url());

  // onetapに直行した場合はセッション保存へスキップ
  if (page.url().includes('onetap')) {
    console.log('Already authenticated, skipping code entry...');
    try {
      await page.locator('[role="button"]:has-text("後で"), [role="button"]:has-text("Not Now")').first().click({ timeout: 5000 });
    } catch {}
    const storage = await context.storageState();
    fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(storage));
    console.log('Session saved to', SESSION_FILE);
    await browser.close();
    return;
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'data/codeentry.png' });

  // コード入力フィールドを探す（プレースホルダー「コード」）
  const codeInput = page.locator('input').first();
  await codeInput.waitFor({ state: 'visible', timeout: 10000 });
  await codeInput.fill(code);
  await page.waitForTimeout(500);

  // 「次へ」ボタン
  const confirmBtn = page.locator('[role="button"]:has-text("次へ"), [role="button"]:has-text("Confirm"), [role="button"]:has-text("Next")').first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
  await confirmBtn.click();

  // onetap（ログイン情報保存ダイアログ）またはホームに遷移するまで待つ
  await page.waitForURL(/instagram\.com\/(accounts\/onetap|$)/, { timeout: 15000 });

  // 「後で」or「Not Now」をクリック
  try {
    await page.locator('[role="button"]:has-text("後で"), [role="button"]:has-text("Not Now")').first().click({ timeout: 5000 });
    await page.waitForURL('https://www.instagram.com/', { timeout: 10000 });
  } catch {}
  console.log('Login successful!');

  // セッション保存
  const storage = await context.storageState();
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storage));
  console.log('Session saved to', SESSION_FILE);

  await browser.close();
})();
