const mysql = require('mysql2/promise');
const https = require('https');

// ── DB QOŞULMASI ──────────────────────────────────────────────
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'huseyn78',        // ← öz MySQL şifrəni yaz
  database: 'profrate',
};

// ── SAYTDAN MƏTN OXUMAQ ───────────────────────────────────────
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── MÜƏLLİMLƏRİ HTML-DƏN ÇIXAR ───────────────────────────────
function parseTeachers(html) {
  const teachers = [];
  const regex = /teacher_single\/(\d+)[^>]*>[\s\S]*?<h1[^>]*>\s*<a[^>]*>(.*?)<\/a>\s*<\/h1>\s*<p[^>]*>(.*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const id   = match[1].trim();
    const name = match[2].trim();
    const role = match[3].trim();
    if (name) teachers.push({ id, name, role });
  }
  return teachers;
}

// ── VƏZİFƏDƏN KAFEDRA ÇIXAR ──────────────────────────────────
function getDepartment(role) {
  if (!role) return 'Information Technologies';
  const r = role.toLowerCase();
  if (r.includes('computer'))      return 'Computer Engineering';
  if (r.includes('automation'))    return 'Automation and Control';
  if (r.includes('information'))   return 'Information Technologies';
  if (r.includes('cybersecurity')) return 'Cybersecurity';
  if (r.includes('mathematics'))   return 'Applied Mathematics';
  return 'Information Technologies';
}

// ── ANA FUNKSIYA ──────────────────────────────────────────────
async function main() {
  console.log('🚀 Scraper başladı...\n');

  const pool = await mysql.createPool(dbConfig);
  const baseUrl = 'https://asoiu.edu.az/information_technologies_and_control/allTeachers';

  let allTeachers = [];

  // 6 səhifə var: 0, 12, 24, 36, 48, 60, ...156
  const pages = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156];

  for (const offset of pages) {
    const url = offset === 0 ? baseUrl : `${baseUrl}/${offset}`;
    console.log(`📄 Səhifə yüklənir: ${url}`);

    try {
      const html = await fetchPage(url);
      const teachers = parseTeachers(html);

      if (teachers.length === 0) {
        console.log(`   ⚠️  Bu səhifədə müəllim tapılmadı, dayanıram.`);
        break;
      }

      console.log(`   ✅ ${teachers.length} müəllim tapıldı`);
      allTeachers.push(...teachers);

      // Sayta yük olmasın deyə gözlə
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`   ❌ Xəta: ${e.message}`);
      break;
    }
  }

  // Dublikatları sil
  const unique = [];
  const seen = new Set();
  for (const t of allTeachers) {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      unique.push(t);
    }
  }

  console.log(`\n📊 Cəmi ${unique.length} unikal müəllim tapıldı`);
  console.log('💾 Bazaya əlavə edilir...\n');

  let added   = 0;
  let skipped = 0;

  for (const t of unique) {
    // Artıq bazada varsa keç
    const [existing] = await pool.query(
      'SELECT id FROM professors WHERE full_name = ?', [t.name]
    );

    if (existing.length > 0) {
      console.log(`   ⏭️  Var: ${t.name}`);
      skipped++;
      continue;
    }

    const department = getDepartment(t.role);

    await pool.query(
      `INSERT INTO professors 
       (full_name, university, faculty, department, biography) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        t.name,
        'ASOIU',
        'Information Technologies and Control',
        department,
        t.role || 'ASOIU - Information Technologies and Control Faculty'
      ]
    );

    console.log(`   ✅ Əlavə edildi: ${t.name} (${t.role})`);
    added++;
  }

  console.log(`\n🎉 Tamamlandı!`);
  console.log(`   ✅ Əlavə edildi: ${added} müəllim`);
  console.log(`   ⏭️  Keçildi:      ${skipped} müəllim (artıq var idi)`);

  await pool.end();
}

main().catch(e => {
  console.error('❌ Xəta:', e.message);
  process.exit(1);
});