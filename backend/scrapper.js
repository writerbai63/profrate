const mysql = require('mysql2/promise');
const https = require('https');
// Baza və internet sorğuları üçün lazımlı paketlər

// ── DB QOŞULMASI ──────────────────────────────────────────────
const DB_URI = 'mysql://root:FSwcItRwblpOoewEDSkxffCUzOYVPLWD@yamanote.proxy.rlwy.net:19774/railway';
// Railway platformasındakı uzaq bazaya qoşulma linki

const BASE = 'https://asoiu.edu.az/information_technologies_and_control';
// ASOIU saytının IT fakültəsinin baza ünvanı

// ── SAYTDAN MƏTN OXUMAQ ───────────────────────────────────────
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Brauzer kimi görünmək üçün User-Agent başlığı əlavə edirik
      let data = '';
      res.on('data', chunk => data += chunk);
      // Gələn məlumatı hissə-hissə yığırıq
      res.on('end', () => resolve(data));
      // Hamısı gəldikdən sonra tam mətni qaytarırıq
    }).on('error', reject);
  });
}

// ── SİYAHI SƏHİFƏSİNDƏN MÜƏLLİMLƏRİ ÇIXAR ───────────────────
function parseTeacherList(html) {
  const teachers = [];
  const regex = /teacher_single\/(\d+)[^>]*>[\s\S]*?<h1[^>]*>\s*<a[^>]*>(.*?)<\/a>\s*<\/h1>\s*<p[^>]*>(.*?)<\/p>/gi;
  // HTML içindən müəllim ID-si, adı və rolunu tapmaq üçün regex naxışı
  let match;
  while ((match = regex.exec(html)) !== null) {
    const asoiu_id = match[1].trim();  // Saytdakı müəllim ID-si
    const name     = match[2].trim();  // Müəllimin adı
    const role     = match[3].trim();  // Vəzifəsi (müəllim, dosent və s.)
    if (name) teachers.push({ asoiu_id, name, role });
    // Adı varsa siyahıya əlavə edirik
  }
  return teachers;
}

// ── MÜƏLLİMİN ÖZ SƏHİFƏSİNDƏN MƏLUMAT ÇIXAR ─────────────────
function parseTeacherDetail(html, asoiu_id) {
  // Şəkil URL-ini tapırıq
  const photoMatch = html.match(/upload\/teacher\/([^"']+\.(jpg|jpeg|png|PNG|JPG|JPEG))/i);
  const photo_url = photoMatch
    ? `${BASE}/upload/teacher/${photoMatch[1]}`
    : null;
  // Şəkil varsa tam URL qururuq, yoxdursa null

  // Email ünvanını tapırıq — asoiu.edu.az domeninə aid olanı
  const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@asoiu\.edu\.az)/i);
  const email = emailMatch ? emailMatch[1] : null;

  // Kafedra adını tapırıq — ingilis və ya Azərbaycan dilindəki variantı
  const deptMatch = html.match(/Department[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i)
    || html.match(/Kafedra[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i);
  const department_asoiu = deptMatch ? deptMatch[1].replace(/<[^>]+>/g, '').trim() : null;
  // HTML etiketlərini təmizləyib yalnız mətni saxlayırıq

  // Vəzifəsini tapırıq
  const posMatch = html.match(/Position[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i)
    || html.match(/Vəzifə[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i);
  const position = posMatch ? posMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  // Elmi dərəcəsini tapırıq
  const degreeMatch = html.match(/Academic degree[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i)
    || html.match(/Elmi dərəcə[\s\S]*?<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/i);
  const academic_degree = degreeMatch ? degreeMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  return { photo_url, email, department_asoiu, position, academic_degree };
}

// ── ANA FUNKSIYA ──────────────────────────────────────────────
async function main() {
  console.log('🚀 Ətraflı scraper başladı...\n');

  const pool = await mysql.createPool(DB_URI);
  // Uzaq bazaya qoşulma hovuzu yaradırıq

  // Yeni sütunları əlavə et (əgər yoxdursa)
  console.log('📦 Bazaya yeni sütunlar əlavə edilir...');
  const alterQueries = [
    `ALTER TABLE professors ADD COLUMN photo_url TEXT`,
    // Müəllimin şəkil linki
    `ALTER TABLE professors ADD COLUMN email VARCHAR(255)`,
    // Email ünvanı
    `ALTER TABLE professors ADD COLUMN position VARCHAR(255)`,
    // Vəzifəsi (dosent, professor və s.)
    `ALTER TABLE professors ADD COLUMN academic_degree VARCHAR(255)`,
    // Elmi dərəcəsi (PhD, fəlsəfə doktoru və s.)
    `ALTER TABLE professors ADD COLUMN asoiu_id INT`,
    // ASOIU saytındakı ID-si — sonra yeniləmək üçün lazım olur
  ];
  for (const q of alterQueries) {
    try { await pool.query(q); } catch(e) { console.log('Sütun artıq var: ' + e.message.split("'")[1]); }
    // Sütun artıq varsa xəta vermir — sadəcə bildirir
  }
  console.log('✅ Sütunlar hazırdır\n');

  // Bütün müəllim siyahısını al — səhifə-səhifə gəzirik
  let allTeachers = [];
  const pages = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156];
  // Hər səhifədə 12 müəllim olur — offset ilə növbəti səhifəyə keçirik

  for (const offset of pages) {
    const url = offset === 0
      ? `${BASE}/allTeachers`
      : `${BASE}/allTeachers/${offset}`;
    // İlk səhifə üçün offset yoxdur

    console.log(`📄 Siyahı səhifəsi: ${url}`);
    try {
      const html = await fetchPage(url);
      const teachers = parseTeacherList(html);
      // Səhifənin HTML-indən müəllimləri çıxarırıq

      if (teachers.length === 0) { console.log('   ⚠️ Boş, dayanıram'); break; }
      // Boş səhifəyə çatdıqda dayanırıq

      console.log(`   ✅ ${teachers.length} müəllim`);
      allTeachers.push(...teachers);
      // Tapılan müəllimləri ümumi siyahıya əlavə edirik

      await new Promise(r => setTimeout(r, 600));
      // Sayta çox tez-tez sorğu göndərməmək üçün 600ms gözləyirik
    } catch(e) {
      console.log(`   ❌ Xəta: ${e.message}`);
      break;
    }
  }

  // Dublikatları sil — eyni adlı müəllim iki dəfə görünməsin
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
    // Hər müəllimin öz profil səhifəsini oxuyuruq
    const detailUrl = `${BASE}/teacher_single/${t.asoiu_id}`;
    let detail = {};
    try {
      const html = await fetchPage(detailUrl);
      detail = parseTeacherDetail(html, t.asoiu_id);
      // Profil səhifəsindən ətraflı məlumat çıxarırıq

      await new Promise(r => setTimeout(r, 400));
      // Serveri yükləməmək üçün 400ms gözləyirik
    } catch(e) {
      console.log(`   ⚠️ Profil oxunmadı: ${t.name}`);
    }

    // Bu müəllim bazada artıq var?
    const [existing] = await pool.query(
      'SELECT id FROM professors WHERE full_name = ?', [t.name]
    );

    const bio = [
      detail.position,
      detail.academic_degree,
      detail.department_asoiu
    ].filter(Boolean).join(' | ') || t.role || 'ASOIU müəllimi';
    // Mövcud məlumatlardan bioqrafiya mətni qururuq — boşları atırıq

    if (existing.length > 0) {
      // Artıq bazada var — yeniləyirik
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
      // Bazada yoxdur — yeni əlavə edirik
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
  // Baza bağlantısını bağlayırıq
}

main().catch(e => {
  console.error('❌ Xəta:', e.message);
  process.exit(1);
  // Xəta olarsa proqramı dayandırırıq
});