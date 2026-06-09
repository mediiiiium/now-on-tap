const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const csv = fs.readFileSync(process.argv[2], 'utf-8');
  const lines = csv.trim().split('\n').slice(1); // skip header

  let ok = 0;
  for (const line of lines) {
    const [id, name, , name_en] = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
    if (!id || !name_en) continue;

    const { error } = await supabase
      .from('bars')
      .update({ name, name_en: name_en || null })
      .eq('id', parseInt(id));

    if (error) console.error(`❌ id=${id}: ${error.message}`);
    else { console.log(`✅ ${name} → ${name_en}`); ok++; }
  }
  console.log(`\n完了: ${ok}件`);
}

run().catch(console.error);
