/**
 * beers テーブルの正規化バッチ
 * - bar: instagram_username → bars.id
 * - brewery: beers.brewery → breweries (完全一致 → Claude名寄せ)
 * - style: beers.style → beer_styles (完全一致 → Claude名寄せ)
 * - マスタにない場合は自動追加（needs_review=true）
 *
 * Usage: node scripts/normalize-beers.js [--dry-run]
 */
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DRY_RUN = process.argv.includes('--dry-run');

// ── Claude 名寄せ ──────────────────────────────────────────

async function resolveBreweriesWithClaude(unmatchedNames, breweries) {
  if (unmatchedNames.length === 0) return {};
  const list = breweries.map(b => `${b.id}\t${b.name}${b.name_ja ? ` / ${b.name_ja}` : ''}`).join('\n');
  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `ビールに記載されたブルワリー名をマスタIDに紐付けてください。省略形・別名・表記揺れを考慮してください。マッチしない場合はnullにしてください。
確信が持てない場合（似ているが同一か不明、略称で複数候補あり等）はconfidenceをlowにしてください。

## 紐付けたい名前
${unmatchedNames.join('\n')}

## マスタ（id<TAB>name / name_ja）
${list}

## 出力（JSONのみ）
{"名前": {"id": id_or_null, "confidence": "high" or "low"}, ...}`,
    }],
  });
  // confidence=low のマッチは null 扱い（新規登録でneeds_review=true）
  const raw = parseJson(msg.content[0].text);
  const result = {};
  for (const [name, val] of Object.entries(raw)) {
    if (val && typeof val === 'object') {
      result[name] = val.confidence === 'high' ? val.id : null;
    } else {
      result[name] = val; // 旧形式フォールバック
    }
  }
  return result;
}

async function resolveStylesWithClaude(unmatchedStyles, masterStyles) {
  if (unmatchedStyles.length === 0) return {};
  const list = masterStyles.map(s => `${s.id}\t${s.name}（${s.category}）`).join('\n');
  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `ビールに記載されたスタイル名をマスタIDに紐付けてください。表記揺れ・略称を考慮してください。マッチしない場合はnullにしてください。

## 紐付けたい名前
${unmatchedStyles.join('\n')}

## マスタ（id<TAB>name（category））
${list}

## 出力（JSONのみ）
{"名前": id_or_null, ...}`,
    }],
  });
  return parseJson(msg.content[0].text);
}

function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1) return {};
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return {}; }
}

// ── マスタ自動追加 ─────────────────────────────────────────

async function addBrewery(name) {
  const { data, error } = await sb.from('breweries')
    .insert({ name, needs_review: true })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

async function addStyle(name) {
  const { data, error } = await sb.from('styles')
    .insert({ name, category: 'Other', needs_review: true })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

// ── メイン ────────────────────────────────────────────────

async function main() {
  // 未正規化のビールを取得（brewery_id or style_id が null のもの）
  const { data: beers } = await sb.from('beers')
    .select('id, instagram_username, brewery, style, brewery_id, style_id')
    .or('brewery_id.is.null,style_id.is.null');

  const [{ data: bars }, { data: breweries }, { data: masterStyles }, { data: aliases }] = await Promise.all([
    sb.from('bars').select('id, instagram_username'),
    sb.from('breweries').select('id, name, name_ja'),
    sb.from('styles').select('id, name, category'),
    sb.from('brewery_aliases').select('brewery_id, alias'),
  ]);

  const barMap = new Map(bars.map(b => [b.instagram_username, b.id]));
  const brewByName = new Map(breweries.map(b => [b.name, b.id]));
  const brewByNameJa = new Map(breweries.filter(b => b.name_ja).map(b => [b.name_ja, b.id]));
  const brewByAlias = new Map((aliases ?? []).map(a => [a.alias, a.brewery_id]));
  const styleByName = new Map(masterStyles.map(s => [s.name, s.id]));

  // 未マッチ収集
  const unmatchedBreweries = new Set();
  const unmatchedStyles = new Set();

  for (const beer of beers) {
    if (!beer.brewery_id && beer.brewery) {
      if (!brewByName.has(beer.brewery) && !brewByNameJa.has(beer.brewery) && !brewByAlias.has(beer.brewery)) {
        unmatchedBreweries.add(beer.brewery);
      }
    }
    if (!beer.style_id && beer.style) {
      if (!styleByName.has(beer.style)) {
        unmatchedStyles.add(beer.style);
      }
    }
  }

  console.log(`未マッチ brewery: ${unmatchedBreweries.size}件 / style: ${unmatchedStyles.size}件`);

  // Claude 名寄せ
  const [brewResolved, styleResolved] = await Promise.all([
    resolveBreweriesWithClaude([...unmatchedBreweries], breweries),
    resolveStylesWithClaude([...unmatchedStyles], masterStyles),
  ]);

  // マスタにない → 自動追加
  const newBreweries = { added: 0, names: [] };
  const newStyles = { added: 0, names: [] };

  if (!DRY_RUN) {
    for (const name of unmatchedBreweries) {
      if (!brewResolved[name]) {
        try {
          const id = await addBrewery(name);
          brewResolved[name] = id;
          brewByName.set(name, id);
          newBreweries.added++;
          newBreweries.names.push(name);
        } catch (e) {
          console.error(`brewery追加失敗: ${name}`, e.message);
        }
      }
    }
    for (const name of unmatchedStyles) {
      if (!styleResolved[name]) {
        try {
          const id = await addStyle(name);
          styleResolved[name] = id;
          styleByName.set(name, id);
          newStyles.added++;
          newStyles.names.push(name);
        } catch (e) {
          console.error(`style追加失敗: ${name}`, e.message);
        }
      }
    }
  }

  // beers 更新
  let updated = 0;
  for (const beer of beers) {
    const patch = {};

    if (!beer.brewery_id && beer.brewery) {
      const id = brewByName.get(beer.brewery) ?? brewByNameJa.get(beer.brewery) ?? brewByAlias.get(beer.brewery) ?? brewResolved[beer.brewery];
      if (id) patch.brewery_id = id;
    }

    if (!beer.style_id && beer.style) {
      const id = styleByName.get(beer.style) ?? styleResolved[beer.style];
      if (id) patch.style_id = id;
    }

    if (Object.keys(patch).length === 0) continue;

    if (DRY_RUN) {
      console.log(`beer ${beer.id}:`, patch);
      continue;
    }

    const { error } = await sb.from('beers').update(patch).eq('id', beer.id);
    if (error) console.error(`beer ${beer.id} 更新失敗:`, error.message);
    else updated++;
  }

  console.log(`beers 更新: ${updated}件`);
  console.log(`新規brewery追加: ${newBreweries.added}件`, newBreweries.names);
  console.log(`styles未マッチ（要手動対応）: ${newStyles.added}件`, newStyles.names);

  return { newBreweries, newStyles };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
