const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SESSION_FILE = path.join(__dirname, '../data/session.json');
const SCREENSHOTS_DIR = path.join(__dirname, '../data/screenshots');

async function login(page) {
  console.log('Logging in to Instagram...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });

  // クッキー同意ダイアログを閉じる（EU向け等）
  try {
    await page.getByRole('button', { name: /Allow|Accept|同意|許可/ }).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  } catch {}

  await page.waitForSelector('input[name="email"]', { timeout: 20000 });

  await page.fill('input[name="email"]', process.env.INSTAGRAM_USERNAME);
  await page.fill('input[name="pass"]', process.env.INSTAGRAM_PASSWORD);
  await page.waitForTimeout(1000);

  // ログインボタンをクリック（divのrole="button"）
  const loginBtn = page.locator('[role="button"]:has-text("ログイン"), [role="button"]:has-text("Log in")').first();
  await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
  await loginBtn.click();

  // Wait for login to complete
  await page.waitForURL('https://www.instagram.com/', { timeout: 15000 });
  console.log('Login successful');

  // Dismiss "Save login info" dialog if present
  try {
    await page.getByRole('button', { name: 'Not now' }).click({ timeout: 5000 });
  } catch {}

  // Dismiss notifications dialog if present
  try {
    await page.getByRole('button', { name: 'Not Now' }).click({ timeout: 5000 });
  } catch {}
}

async function saveSession(context) {
  const cookies = await context.cookies();
  const storage = await context.storageState();
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storage));
  console.log('Session saved');
}

async function loadSession(context) {
  if (!fs.existsSync(SESSION_FILE)) return false;
  const state = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  await context.addCookies(state.cookies || []);
  return true;
}

async function isLoggedIn(page) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  return page.url().includes('instagram.com') && !page.url().includes('login');
}

async function getRecentPosts(page, username, limit = 5) {
  console.log(`Fetching posts for @${username}...`);
  await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const { postLinks, bioLinks } = await page.evaluate((limit) => {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    const postLinks = [...new Set(links.map(a => a.href))].slice(0, limit);
    // bio の外部リンク（untappd等）
    const bioLinks = Array.from(document.querySelectorAll('a[href*="untappd.com"]')).map(a => a.href);
    return { postLinks, bioLinks };
  }, limit);

  console.log(`Found ${postLinks.length} posts`);
  return { postLinks, bioLinks };
}

async function screenshotPost(page, postUrl, outputPath) {
  await page.goto(postUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('main', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Get caption
  const caption = await page.evaluate(() => {
    const el = document.querySelector('h1, [data-testid="post-comment-root"] span');
    return el ? el.textContent.trim() : '';
  }).catch(() => '');

  // Get post date
  const postedAt = await page.evaluate(() => {
    const time = document.querySelector('time');
    return time ? time.getAttribute('datetime') : null;
  }).catch(() => null);

  // Screenshot the main content area
  const main = page.locator('main').first();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await main.screenshot({ path: outputPath });

  return { caption, postedAt, screenshotPath: outputPath };
}

async function scrapeBar(username) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const hasSession = fs.existsSync(SESSION_FILE);
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  };
  if (hasSession) {
    contextOptions.storageState = SESSION_FILE;
  }

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    if (!hasSession) {
      await login(page);
      await saveSession(context);
    } else {
      console.log('Using saved session');
      const loggedIn = await isLoggedIn(page);
      if (!loggedIn) {
        throw new Error('SESSION_EXPIRED');
      }
    }

    const { postLinks, bioLinks } = await getRecentPosts(page, username, 5);
    const results = [];

    for (const [i, url] of postLinks.entries()) {
      const postId = url.match(/\/p\/([^/]+)/)?.[1] || i;
      const outputPath = path.join(SCREENSHOTS_DIR, username, `${postId}.png`);

      if (fs.existsSync(outputPath)) {
        console.log(`  Skipping ${postId} (already exists)`);
        continue;
      }

      console.log(`  Screenshotting post ${postId}...`);
      try {
        const result = await screenshotPost(page, url, outputPath);
        results.push({ postId, url, ...result });
        await page.waitForTimeout(1500 + Math.random() * 1000);
      } catch (err) {
        console.error(`  Failed for ${postId}:`, err.message);
      }
    }

    return { posts: results, bioLinks };
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeBar };

// Run directly for testing
if (require.main === module) {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node scraper/instagram.js <instagram_username>');
    process.exit(1);
  }
  scrapeBar(username)
    .then(results => {
      console.log('\nResults:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(console.error);
}
