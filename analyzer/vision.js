const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
require('dotenv').config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function makeImageContent(base64Image) {
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: base64Image },
  };
}

// ステップ1: Haikuでタップリストか否かだけ判定（安価・高速）
async function classifyTapList(base64Image) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        makeImageContent(base64Image),
        {
          type: 'text',
          text: `この画像はビアバーのInstagram投稿です。
「現在タップで提供中のビール一覧（タップリスト）」が明示されているかを判定してください。

【タップリストと判定する条件】
- 3種類以上のビール名が一覧形式で並んでいる
- 「ON TAP」「NOW ON TAP」「TAP LIST」「現在のタップ」などの見出しがある
- 各ビールにスタイル・度数・価格などの詳細情報が付いている

【タップリストと判定してはいけないケース】
- 新商品・入荷のお知らせ（1〜2種類だけ紹介）
- イベント・営業時間・お知らせの告知
- 飲み放題コース・料金プランの案内
- ビールの写真だけで文字情報が少ない
- ビール名が3種類未満しか確認できない

"true" か "false" のみ返してください。`,
        },
      ],
    }],
  });

  const text = response.content[0].text.trim().toLowerCase();
  return text === 'true';
}

// ステップ2: Sonnetでビール情報を精度高く抽出
async function extractBeers(base64Image, caption = null) {
  const captionSection = caption
    ? `\n\n【投稿キャプション（補助情報として活用してください）】\n${caption}\n`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        makeImageContent(base64Image),
        {
          type: 'text',
          text: `この画像はビアバーのタップリスト（現在提供中のクラフトビール一覧）です。
すべてのビール情報を正確に抽出してください。${captionSection}

【nameフィールドのルール】
- 個々のビールの商品名のみを入れる
- 醸造所名・ブルワリー名はnameに含めない（例: "Y.MARKET BREWING ビステリック IPA" → name: "ビステリック IPA", brewery: "Y.MARKET BREWING"）
- 先頭の番号・記号は除く（例: "1. Hopfield" → "Hopfield"）
- コース名・飲み放題プラン名（例: "House Standard コース"）はビールではないので含めない

【breweryフィールドのルール】
- 醸造所名・ブルワリー名のみを入れる
- 読み取れない場合は null（"Unknown"・"不明"・""は使わない）
- 醸造所名がセクション見出しになっている場合、そのブロック内の全ビールに設定する

【その他のルール】
- 情報が読み取れない・記載がない項目はすべて null にする（"Unknown"・"不明"は絶対に使わない）
- styleはビアスタイルのみ（例: IPA, Stout, Saison, Pale Ale）。スタイルがnameと同じになる場合は null
- 飲み放題コース・料金プラン・メニューコースの行は出力しない
- ブルワリー名のみで個別のビール名が不明な場合もその行は出力しない

【多言語対応】
- name_ja: 日本語ビール名（nameが日本語ならそのまま、英語なら null）
- name_en: 英語ビール名（nameが英語ならそのまま、日本語なら英語名 or ローマ字）
- brewery_en: 英語ブルワリー名（英語ならそのまま、日本語なら公式英語名 or null）

以下のJSON配列のみ返してください。マークダウンのコードブロックは不要です。
[
  {
    "name": "ビール名（画像に書いてある表記のまま）",
    "name_ja": "日本語ビール名 or null",
    "name_en": "英語ビール名",
    "brewery": "醸造所名（画像に書いてある表記のまま）or null",
    "brewery_en": "英語醸造所名 or null",
    "style": "スタイル（例: IPA, Stout, Saison）or null",
    "abv": "アルコール度数（例: 5.0%）or null",
    "price": "価格 or null",
    "notes": "その他メモ or null"
  }
]`,
        },
      ],
    }],
  });

  const text = response.content[0].text.trim()
    .replace(/^```json\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(text);
}

async function analyzeTapList(imagePath, caption = null) {
  const base64Image = fs.readFileSync(imagePath).toString('base64');

  const isTapList = await classifyTapList(base64Image);
  if (!isTapList) {
    return { is_tap_list: false, beers: [] };
  }

  let beers = [];
  try {
    beers = await extractBeers(base64Image, caption);
  } catch {
    // 抽出失敗時は判定だけ保存
  }

  // 後処理フィルタ: プロンプトをすり抜けたノイズを除去
  beers = beers.filter(b => {
    if (!b.name) return false;
    // "Unknown" / "不明" / 空文字 は除外
    const invalidNames = ['unknown', '不明', ''];
    if (invalidNames.includes(b.name.toLowerCase())) return false;
    // コース・プラン系は除外
    if (/コース|プラン|飲み放題|course|plan/i.test(b.name)) return false;
    return true;
  }).map(b => ({
    ...b,
    // 番号プレフィックス除去（例: "1. Hopfield" → "Hopfield"）
    name: b.name.replace(/^\d+[.\)]\s*/, ''),
    // brewery / style の "Unknown"/"不明"/"" → null
    brewery: (b.brewery && !['unknown', '不明', ''].includes(b.brewery.toLowerCase())) ? b.brewery : null,
    style:   (b.style   && !['unknown', '不明', ''].includes(b.style.toLowerCase()))   ? b.style   : null,
  }));

  // 抽出結果が3件未満なら判定を取り消す
  if (beers.length < 3) {
    return { is_tap_list: false, beers: [] };
  }

  return { is_tap_list: true, beers };
}

// 直接実行用
if (require.main === module) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: node analyzer/vision.js <image_path>');
    process.exit(1);
  }
  analyzeTapList(imagePath)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(console.error);
}

module.exports = { analyzeTapList };
