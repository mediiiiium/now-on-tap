/**
 * alwayslovebeer PDF のブルワリー一覧を Claude でパースして breweries テーブルに投入する
 * 先に supabase/add_breweries_master.sql + ALTER TABLE を実行しておくこと
 *
 * Usage: node scripts/import-breweries-from-pdf.js [--dry-run] [--pages N-M]
 *   --pages 5-28   特定ページ範囲のみ処理（デフォルト: 5-28）
 */
const { execSync } = require('child_process');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DRY_RUN = process.argv.includes('--dry-run');

const PDF_PATH = '/Users/toruuneoka/Desktop/最新版976ヵ所！日本のクラフトビール醸造所（ブルワリー）一覧.pdf';

// 醸造所リストが含まれるページ範囲
const PAGE_START = 5;
const PAGE_END = 28;

function extractPages(start, end) {
  // Python で各ページのテキストをJSON配列で出力
  const script = `
import pdfplumber, json, warnings, sys
warnings.filterwarnings("ignore")
pdf = pdfplumber.open(sys.argv[1])
pages = []
for i, page in enumerate(pdf.pages):
    if ${start - 1} <= i <= ${end - 1}:
        t = page.extract_text()
        pages.append({"page": i+1, "text": t or ""})
print(json.dumps(pages, ensure_ascii=False))
`;
  const helperPath = path.join(__dirname, '_extract_pages.py');
  require('fs').writeFileSync(helperPath, script);
  const out = execSync(`python3 "${helperPath}" "${PDF_PATH}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(out);
}

async function parsePageBreweries(pageNum, text) {
  const prompt = `以下は日本のクラフトビール醸造所一覧サイトのPDFから抽出したページ${pageNum}のテキストです。
2列レイアウトのため、テキストが混在・折り返しになっています。

このページに含まれるブルワリーを全て抽出してください。
都道府県名が含まれていればそれも使って prefecture を埋めてください。

JSON配列で出力:
[
  {
    "name": "表示用の正式名（英語名があれば英語、なければ日本語）",
    "name_ja": "日本語名またはnull",
    "prefecture": "都道府県名（例: 東京都, 北海道, 大阪府, 京都府, 神奈川県）またはnull"
  }
]

テキスト:
${text}`;

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const t = msg.content[0].text;
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return [];
  }
}

async function insertBrewery(brewery) {
  const row = {
    name: brewery.name,
    name_ja: brewery.name_ja ?? null,
    prefecture: brewery.prefecture ?? null,
    country: 'JP',
  };

  const { data: inserted, error: insertError } = await supabase
    .from('breweries')
    .insert(row)
    .select('id')
    .single();

  if (!insertError) return inserted.id;

  if (insertError.code === '23505') {
    const { data: existing, error: selectError } = await supabase
      .from('breweries').select('id').eq('name', brewery.name).single();
    if (selectError) throw selectError;
    return existing.id;
  }

  throw insertError;
}

async function main() {
  console.log(`📄 Extracting pages ${PAGE_START}–${PAGE_END} from PDF...`);
  const pages = extractPages(PAGE_START, PAGE_END);
  console.log(`  ${pages.length} pages loaded`);

  let totalOk = 0, totalFail = 0, totalSkip = 0;

  for (const { page, text } of pages) {
    if (!text.trim()) { totalSkip++; continue; }

    console.log(`\n🤖 Page ${page} (${text.length} chars)...`);
    const breweries = await parsePageBreweries(page, text);
    const valid = breweries.filter(b => b.name && b.name.length >= 2);
    console.log(`  ${valid.length} breweries found`);

    if (DRY_RUN) {
      valid.slice(0, 5).forEach(b =>
        console.log(`  [${b.prefecture ?? '?'}] ${b.name}${b.name_ja ? ` (${b.name_ja})` : ''}`)
      );
      if (valid.length > 5) console.log(`  ... and ${valid.length - 5} more`);
      continue;
    }

    for (const brewery of valid) {
      try {
        await insertBrewery(brewery);
        totalOk++;
      } catch (e) {
        console.error(`  ✗ ${brewery.name}: ${e.message}`);
        totalFail++;
      }
    }
  }

  if (!DRY_RUN) {
    console.log(`\nDone: ${totalOk} inserted, ${totalFail} failed, ${totalSkip} pages skipped`);
  }
}

main().catch(console.error);
