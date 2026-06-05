const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
require('dotenv').config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeTapList(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `この画像はビアバーのInstagram投稿です。
タップリスト（現在提供中のビール一覧）が含まれているか判定し、含まれている場合はビールの情報を抽出してください。

以下のJSON形式で返してください（タップリストがない場合は is_tap_list: false）:
{
  "is_tap_list": true/false,
  "beers": [
    {
      "name": "ビール名",
      "brewery": "醸造所名（わかれば）",
      "style": "スタイル（例: IPA, Stout, Saison）",
      "abv": "アルコール度数（例: 5.0%）",
      "price": "価格（わかれば）",
      "notes": "その他メモ（わかれば）"
    }
  ]
}

JSONのみ返してください。マークダウンのコードブロックは不要です。`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim()
    .replace(/^```json\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    return { is_tap_list: false, raw: text };
  }
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
