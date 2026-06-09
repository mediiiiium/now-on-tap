const { chromium } = require('playwright');
const path = require('path');
require('dotenv').config();

const SESSION_FILE = path.join(__dirname, '../data/session.json');

async function getFollowing(username) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_FILE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ユーザーIDをAPIで取得
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const userId = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const s of scripts) {
        const m = s.textContent.match(/"pk":"(\d+)"|"id":"(\d+)"/);
        if (m) return m[1] || m[2];
      }
      return null;
    });

    if (!userId) throw new Error('ユーザーIDが取得できませんでした');
    console.log(`@${username} ID: ${userId}`);

    // GraphQL APIでフォローリスト取得
    const following = [];
    let after = null;
    let hasNext = true;

    while (hasNext) {
      const variables = JSON.stringify({ id: userId, first: 50, ...(after ? { after } : {}) });
      const url = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables=${encodeURIComponent(variables)}`;

      const response = await page.evaluate(async (url) => {
        const res = await fetch(url, { credentials: 'include' });
        return res.json();
      }, url);

      const edges = response?.data?.user?.edge_follow?.edges ?? [];
      const pageInfo = response?.data?.user?.edge_follow?.page_info;

      for (const edge of edges) {
        following.push(edge.node.username);
      }

      hasNext = pageInfo?.has_next_page ?? false;
      after = pageInfo?.end_cursor ?? null;
      await page.waitForTimeout(500);
    }

    console.log(`@${username} のフォロー中: ${following.length}件`);
    return following;

  } finally {
    await browser.close();
  }
}

module.exports = { getFollowing };

if (require.main === module) {
  const username = process.argv[2] || process.env.INSTAGRAM_USERNAME;
  getFollowing(username)
    .then(list => console.log(list))
    .catch(console.error);
}
