const mysql = require('mysql2/promise');
const https = require('https');

// ── DB QOŞULMASI ──────────────────────────────────────────────
const DB_URI = 'mysql://root:FSwcItRwblpOoewEDSkxffCUzOYVPLWD@yamanote.proxy.rlwy.net:19774/railway';

const BASE = 'https://asoiu.edu.az/information_technologies_and_control';

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

// ── SİYAHI SƏHİFƏSİNDƏN MÜƏLLİMLƏRİ ÇIXAR ───────────────────
function parseTeacherList(html) {
  const teachers = [];
  const regex = /teacher_single\/(\d+)[^>]*>[\s\S]*?<h1[^>]*>\s*<a[^>]*>(.*?)<\/a>\s*<\/h1>\s*<p[^>]*>(.*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const asoiu_id = match[1].trim();
    const name     = match[2].trim();
    const role     = match[3].trim();
    if (name) teachers.push({ asoiu_id, name, role });
  }
  return teachers;
}

// ── MÜƏLLİMİN ÖZ SƏHİFƏSİNDƏN MƏLUMAT ÇIXAR ─────────────────
function parseTeacherDetail(html, asoiu_id) {
  // Şəkil
  const photoMatch = html.match(/upload\/teacher\/([^"']+\.(jpg|jpeg|png|PNG|JPG|JPEG))/i);
  const photo_url = photoMatch
    ? `${BASE}/upload/teacher/${photoMatch[1]}`
    : null;

  // Email
  const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@asoiu\.edu\.az)/i);
  const email = emailMatch ? emailMatch[1] : null;

  // Kafedra
  const deptMatch = html.match(/Department[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i)
    || html.match(/Kafedra[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i);
  const department_asoiu = deptMatch ? deptMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  // Vəzifə
  const posMatch = html.match(/Position[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i)
    || html.match(/Vəzifə[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i);
  const position = posMatch ? posMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  // Akademik dərəcə
  const degreeMatch = html.match(/Academic degree[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i)
    || html.match(/Elmi dərəcə[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i);
  const academic_degree = degreeMatch ? degreeMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  return { photo_url, email, department_asoiu, position, academic_degree };
}

// ── ANA FUNKSIYA ──────────────────────────────────────────────
async function main() {
  console.log('🚀 Ətraflı scraper başladı...\n');

  const pool = await mysql.createPool(DB_URI);

  // Yeni sütunları əlavə et (əgər yoxdursa)
  console.log('📦 Bazaya yeni sütunlar əlavə edilir...');
  const alterQueries = [
    `ALTER TABLE professors ADD COLUMN photo_url TEXT`,
    `ALTER TABLE professors ADD COLUMN email VARCHAR(255)`,
    `ALTER TABLE professors ADD COLUMN position VARCHAR(255)`,
    `ALTER TABLE professors ADD COLUMN academic_degree VARCHAR(255)`,
    `ALTER TABLE professors ADD COLUMN asoiu_id INT`,
  ];
  for (const q of alterQueries) {
    try { await pool.query(q); } catch(e) { console.log('Sütun artıq var: ' + e.message.split("'")[1]); }
  }
  console.log('✅ Sütunlar hazırdır\n');

  // Bütün müəllim siyahısını al
  let allTeachers = [];
  const pages = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156];

  for (const offset of pages) {
    const url = offset === 0
      ? `${BASE}/allTeachers`
      : `${BASE}/allTeachers/${offset}`;

    console.log(`📄 Siyahı səhifəsi: ${url}`);
    try {
      const html = await fetchPage(url);
      const teachers = parseTeacherList(html);
      if (teachers.length === 0) { console.log('   ⚠️ Boş, dayanıram'); break; }
      console.log(`   ✅ ${teachers.length} müəllim`);
      allTeachers.push(...teachers);
      await new Promise(r => setTimeout(r, 600));
    } catch(e) {
      console.log(`   ❌ Xəta: ${e.message}`);
      break;
    }
  }

  // Dublikatları sil
  const unique = [];
  const seen = new Set();
  for (const t of allTeachers) {
    if (!seen.has(t.name)) { seen.add(t.name); unique.push(t); }
  }

  console.log(`\n📊 Cəmi ${unique.length} unikal müəllim\n`);
  console.log('🔍 Hər müəllimin profil səhifəsi oxunur...\n');

  let updated = 0;
  let added   = 0;

  for (const t of unique) {
    // Profil səhifəsini oxu
    const detailUrl = `${BASE}/teacher_single/${t.asoiu_id}`;
    let detail = {};
    try {
      const html = await fetchPage(detailUrl);
      detail = parseTeacherDetail(html, t.asoiu_id);
      await new Promise(r => setTimeout(r, 400));
    } catch(e) {
      console.log(`   ⚠️ Profil oxunmadı: ${t.name}`);
    }

    // Bazada var?
    const [existing] = await pool.query(
      'SELECT id FROM professors WHERE full_name = ?', [t.name]
    );

    const bio = [
      detail.position,
      detail.academic_degree,
      detail.department_asoiu
    ].filter(Boolean).join(' | ') || t.role || 'ASOIU müəllimi';

    if (existing.length > 0) {
      // Yenilə
      await pool.query(
        `UPDATE professors SET
          photo_url = ?, email = ?, position = ?,
          academic_degree = ?, biography = ?, asoiu_id = ?
         WHERE full_name = ?`,
        [
          detail.photo_url, detail.email, detail.position,
          detail.academic_degree, bio, t.asoiu_id,
          t.name
        ]
      );
      console.log(`   🔄 Yeniləndi: ${t.name}`);
      updated++;
    } else {
      // Yeni əlavə et
      await pool.query(
        `INSERT INTO professors
          (full_name, university, faculty, department, biography, photo_url, email, position, academic_degree, asoiu_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.name,
          'ASOIU',
          'Information Technologies and Control',
          detail.department_asoiu || 'Information Technologies',
          bio,
          detail.photo_url,
          detail.email,
          detail.position,
          detail.academic_degree,
          t.asoiu_id
        ]
      );
      console.log(`   ✅ Əlavə edildi: ${t.name}`);
      added++;
    }
  }

  console.log(`\n🎉 Tamamlandı!`);
  console.log(`   ✅ Yeni əlavə: ${added}`);
  console.log(`   🔄 Yeniləndi: ${updated}`);

  await pool.end();
}

main().catch(e => {
  console.error('❌ Xəta:', e.message);
  process.exit(1);
});