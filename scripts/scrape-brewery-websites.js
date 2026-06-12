/**
 * ブルワリーの公式サイトからビールリストをスクレイプして brewery_known_beers に保存する
 *
 * Usage:
 *   node scripts/scrape-brewery-websites.js           # 全件
 *   node scripts/scrape-brewery-websites.js --limit 10
 *   node scripts/scrape-brewery-websites.js --dry-run
 */
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? parseInt(process.argv[i + 1]) : null;
})();

function fetchUrl(url, redirects = 3) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000));
  const fetch = new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NowOnTap/1.0)' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        res.resume();
        return fetchUrl(next, redirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = '';
      res.on('data', c => { data += c; if (data.length > 300000) { req.destroy(); resolve(data); } });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
  return Promise.race([fetch, timeout]);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 8000);
}

async function extractBeers(breweryName, text) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `以下は「${breweryName}」の公式サイトのテキストです。
このブルワリーが醸造・販売しているビールのリストを抽出してください。

ルール：
- ビール名、ABV（アルコール度数）、スタイルを抽出
- ABVは数値のみ（例: "5.5"）
- ビールでないもの（フード、グッズ等）は含めない
- 10件以上ある場合は代表的な20件まで
- 見つからない場合は空配列

JSON形式で返答：
{"beers": [{"name": "...", "name_ja": "...", "abv": "5.5", "style": "IPA"}, ...]}

テキスト：
${text}`,
    }],
  });

  try {
    const json = msg.content[0].text.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json).beers ?? [] : [];
  } catch { return []; }
}

async function main() {
  const { data: breweries } = await supabase
    .from('breweries')
    .select('id, name, name_ja, website_url')
    .not('website_url', 'is', null)
    .order('id');

  const targets = LIMIT ? breweries.slice(0, LIMIT) : breweries;
  console.log(`🍺 ${targets.length} breweries to scrape`);

  let ok = 0, empty = 0, fail = 0;

  for (const brewery of targets) {
    const label = brewery.name_ja ?? brewery.name;
    try {
      const html = await fetchUrl(brewery.website_url);
      const text = stripHtml(html);
      const beers = await extractBeers(brewery.name, text);

      if (beers.length === 0) {
        console.log(`  ○ ${label}: ビールなし`);
        empty++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${label}: ${beers.length}件 — ${beers.map(b => b.name).join(', ')}`);
        ok++;
        continue;
      }

      const rows = beers.map(b => ({
        brewery_id: brewery.id,
        name: b.name,
        name_ja: b.name_ja || null,
        abv: b.abv || null,
        style: b.style || null,
        scraped_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('brewery_known_beers')
        .upsert(rows, { onConflict: 'brewery_id,name', ignoreDuplicates: false });

      if (error) throw new Error(error.message);
      console.log(`  ✓ ${label}: ${beers.length}件`);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${label}: ${e.message}`);
      fail++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n完了: ${ok} ok, ${empty} empty, ${fail} failed`);
}

main().catch(console.error);
