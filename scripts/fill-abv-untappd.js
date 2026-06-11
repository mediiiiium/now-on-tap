const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function searchUntappd(page, name, brewery) {
  const query = encodeURIComponent(`${name} ${brewery}`);
  await page.goto(`https://untappd.com/search?q=${query}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(2000 + Math.random() * 1000);

  return await page.evaluate(({ beerName, breweryName }) => {
    for (const item of document.querySelectorAll('.beer-item')) {
      const n = item.querySelector('.name a')?.textContent?.trim();
      const b = item.querySelector('.brewery a')?.textContent?.trim();
      const s = item.querySelector('.style')?.textContent?.trim();
      const a = item.querySelector('.abv')?.textContent?.trim()?.match(/[\d.]+%/)?.[0] ?? null;
      if (!n) continue;
      const nm = n.toLowerCase().includes(beerName.toLowerCase()) ||
                 beerName.toLowerCase().includes(n.toLowerCase());
      const bm = !breweryName ||
                 (b && (b.toLowerCase().includes(breweryName.toLowerCase()) ||
                        breweryName.toLowerCase().includes(b.toLowerCase())));
      if (nm && bm) return { name: n, brewery: b, style: s, abv: a };
    }
    return null;
  }, { beerName: name, breweryName: brewery });
}

async function run() {
  // 直近7日以内に追加されたビールのみ対象（--all フラグで全件）
  const fullScan = process.argv.includes('--all');
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // brewery=null のビール OR abv/style が欠けているビールを対象に
  let query = supabase
    .from('beers')
    .select('id, name, brewery, style, abv')
    .not('name', 'is', null)
    .or('brewery.is.null,abv.is.null,style.is.null');

  if (!fullScan) query = query.gte('created_at', since);

  const { data: beers } = await query;
  console.log(fullScan ? '全件モード' : `直近7日モード (${since.slice(0,10)} 以降)`);

  // brewery+nameでユニーク化
  const nameMap = {};
  for (const b of beers) {
    const key = `${b.brewery ?? ''}|||${b.name}`;
    if (!nameMap[key]) nameMap[key] = { name: b.name, brewery: b.brewery, style: b.style, abv: b.abv, ids: [] };
    nameMap[key].ids.push(b.id);
  }
  const targets = Object.values(nameMap);
  console.log(`対象: ${targets.length}ユニークビール (${beers.length}レコード)\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  let hit = 0, miss = 0, skip = 0;

  for (const t of targets) {
    process.stdout.write(`"${t.name}" / ${t.brewery} ... `);

    let result = null;
    try {
      result = await searchUntappd(page, t.name, t.brewery);
    } catch (err) {
      console.log('❌', err.message);
      miss++; continue;
    }

    if (!result) { console.log('－'); miss++; continue; }

    const update = {};
    if (!t.brewery && result.brewery) update.brewery = result.brewery;
    if (!t.abv     && result.abv)     update.abv     = result.abv;
    if (!t.style   && result.style)   update.style   = result.style;

    if (Object.keys(update).length === 0) { console.log('⏭  補完不要'); skip++; continue; }

    const { error } = await supabase.from('beers').update(update).in('id', t.ids);
    if (error) { console.log('❌ DB:', error.message); miss++; continue; }

    console.log(`✅ ${JSON.stringify(update)} (${t.ids.length}件)`);
    hit++;

    await page.waitForTimeout(1500 + Math.random() * 1000);
  }

  await browser.close();
  console.log(`\n完了 — 補完: ${hit} / ヒットなし: ${miss} / 不要: ${skip}`);

  const { data } = await supabase.from('beers').select('brewery, style, abv');
  const total = data.length;
  const p = f => `${data.filter(b => b[f]).length}件 (${Math.round(data.filter(b => b[f]).length/total*100)}%)`;
  console.log(`\n brewery: ${p('brewery')} / style: ${p('style')} / abv: ${p('abv')}`);
}

run().catch(console.error);
