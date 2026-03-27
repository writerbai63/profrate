const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
// Lazımlı paketləri layihəyə daxil edirik

const app = express();
// Express tətbiqini yaradırıq — bütün server işi buradan idarə olunur

const PORT = process.env.PORT || 3001;
// Server hansı portda işləyəcək — əgər mühit dəyişəni yoxdursa 3001 istifadə olunur

app.use(cors());
// Fərqli domendən gələn sorğulara icazə veririk (məsələn: frontend başqa portda işləyəndə)

app.use(express.json());
// Gələn sorğuların gövdəsini (body) JSON olaraq oxuyuruq

const path = require('path');
app.use(express.static(path.join(__dirname, 'frontend')));
// Frontend fayllarını (HTML, CSS, JS) statik olaraq servis edirik

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  // Ana ünvana gələn hər sorğuya index.html qaytarırıq
});

// ─── DB CONFIG ──────────────────────────────────────────────────────────────
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  // Verilənlər bazasının ünvanı — mühit dəyişəni yoxdursa localhost
  port: process.env.DB_PORT || 3306,
  // MySQL-in standart portu 3306-dır
  user: process.env.DB_USER || 'root',
  // Bazaya giriş üçün istifadəçi adı
  password: process.env.DB_PASSWORD || 'sənin_şifrən',
  // Bazanın şifrəsi — real layihədə mühit dəyişənindən gəlməlidir
  database: process.env.DB_NAME || 'profrate',
  // Hansı bazanı istifadə edəcəyimiz
  waitForConnections: true,
  // Bağlantı boş deyilsə gözləyirik
  connectionLimit: 10,
  // Eyni anda maksimum 10 bağlantı açıq ola bilər
};

let pool;
// Baza bağlantı hovuzu — bütün sorğular buradan keçir

async function initDB() {
  // Proqram başlayanda bazanı hazırlayan funksiya

  const initPool = await mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    waitForConnections: true,
    connectionLimit: 5,
  });
  // Əvvəlcə baza adı göstərmədən qoşuruq ki, bazanı yarada bilək

  const conn = await initPool.getConnection();
  // Hovuzdan bir bağlantı götürürük

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  // Əgər "profrate" bazası yoxdursa, yaradırıq

  await conn.query(`USE \`${dbConfig.database}\``);
  // Həmin bazanı aktiv edirik

  await conn.query(`
    CREATE TABLE IF NOT EXISTS professors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      -- Hər professorun özünəməxsus nömrəsi — avtomatik artır
      full_name VARCHAR(255) NOT NULL,
      -- Professorun tam adı — mütləq doldurulmalıdır
      university VARCHAR(255) NOT NULL,
      -- Universitetin adı
      faculty VARCHAR(255) NOT NULL,
      -- Fakültənin adı
      department VARCHAR(255) NOT NULL,
      -- Kafedranın adı
      biography TEXT,
      -- Haqqında mətn — boş ola bilər
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      -- Əlavə edilmə tarixi — avtomatik yazılır
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      -- Fənnin özünəməxsus nömrəsi
      subject_name VARCHAR(255) NOT NULL,
      -- Fənnin adı
      department VARCHAR(255) NOT NULL
      -- Hansı kafedraya aid olduğu
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS professor_subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      professor_id INT NOT NULL,
      -- Hansı professorun ID-si
      subject_id INT NOT NULL,
      -- Hansı fənnin ID-si
      FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
      -- Professor silinəndə onun bütün fənn əlaqələri də silinir
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      -- Fənn silinəndə onun bütün professor əlaqələri də silinir
      UNIQUE KEY unique_pair (professor_id, subject_id)
      -- Eyni professor-fənn cütü ikinci dəfə əlavə edilə bilməz
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      -- Şərhin özünəməxsus nömrəsi
      professor_id INT NOT NULL,
      -- Hansı professora yazılıb
      rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      -- 1-dən 5-ə qədər reytinq — başqa dəyər qəbul edilmir
      reviewer_name VARCHAR(255),
      -- Şərh yazanın adı — boş ola bilər
      comment TEXT,
      -- Şərh mətni
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      -- Yazılma tarixi — avtomatik əlavə olunur
      FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE
      -- Professor silinəndə onun bütün şərhləri də silinir
    )
  `);

  conn.release();
  // Bağlantını hovuza qaytarırıq ki, başqaları istifadə edə bilsin

  await initPool.end();
  // İlkin hovuzu bağlayırıq — artıq lazım deyil

  pool = mysql.createPool(dbConfig);
  // İndi artıq bazanı seçmiş vəziyyətdə yeni hovuz yaradırıq

  console.log('✅ Database initialized');

  await seedData();
  // Demo məlumatları əlavə edirik
}

async function seedData() {
  const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM professors');
  if (rows[0].cnt > 0) return;
  // Əgər artıq professor varsa, seed etmirik — ikinci dəfə çalışmasın deyə

  console.log('🌱 Seeding demo data...');

  // Demo professorlar siyahısı — [ad, universitet, fakültə, kafedra, bioqrafiya]
  const profs = [
    ['Dr. Elena Marchetti', 'University of Bologna', 'Engineering', 'Computer Science', 'Dr. Marchetti is a renowned expert in algorithms and data structures with over 15 years of teaching experience. She has published more than 40 papers in top-tier conferences and is known for her engaging teaching style.'],
    ['Prof. James Okonkwo', 'University of Bologna', 'Sciences', 'Mathematics', 'Professor Okonkwo specializes in applied mathematics and numerical analysis. He holds a PhD from MIT and has worked with several Fortune 500 companies before joining academia.'],
    ['Dr. Sofia Reyes', 'University of Bologna', 'Engineering', 'Computer Science', 'Dr. Reyes focuses on machine learning and artificial intelligence. She leads the AI Research Lab and mentors dozens of graduate students each year.'],
    ['Prof. Marco Bianchi', 'University of Bologna', 'Humanities', 'Philosophy', 'Professor Bianchi is a philosopher specializing in ethics and epistemology. He has authored three books and is a sought-after speaker at international conferences.'],
    ['Dr. Aisha Nkrumah', 'University of Bologna', 'Medicine', 'Biochemistry', 'Dr. Nkrumah is a biochemist with deep expertise in molecular biology and cellular mechanisms. Her research has been featured in Nature and Science journals.'],
    ['Prof. Lars Eriksson', 'University of Bologna', 'Engineering', 'Electrical Engineering', 'Professor Eriksson is an expert in signal processing and embedded systems. He has 20+ years in both industry and academia.'],
    ['Dr. Yuki Tanaka', 'University of Bologna', 'Sciences', 'Physics', 'Dr. Tanaka specializes in quantum mechanics and theoretical physics. She was a postdoctoral fellow at CERN before joining the university.'],
    ['Prof. Carlos Mendoza', 'University of Bologna', 'Economics', 'Finance', 'Professor Mendoza has extensive experience in financial markets and econometrics. He regularly consults for the European Central Bank.'],
  ];

  const profIds = [];
  for (const p of profs) {
    const [r] = await pool.query(
      'INSERT INTO professors (full_name, university, faculty, department, biography) VALUES (?,?,?,?,?)', p
    );
    profIds.push(r.insertId);
    // Hər professorun bazada aldığı ID-ni yadda saxlayırıq
  }

  // Demo fənlər siyahısı — [fənn adı, kafedra]
  const subjects = [
    ['Algorithms & Data Structures', 'Computer Science'],
    ['Database Systems', 'Computer Science'],
    ['Machine Learning', 'Computer Science'],
    ['Calculus I', 'Mathematics'],
    ['Linear Algebra', 'Mathematics'],
    ['Statistics & Probability', 'Mathematics'],
    ['Ethics in Technology', 'Philosophy'],
    ['Logic & Reasoning', 'Philosophy'],
    ['Biochemistry I', 'Biochemistry'],
    ['Molecular Biology', 'Biochemistry'],
    ['Signal Processing', 'Electrical Engineering'],
    ['Quantum Mechanics', 'Physics'],
    ['Financial Mathematics', 'Finance'],
    ['Web Development', 'Computer Science'],
    ['Operating Systems', 'Computer Science'],
  ];

  const subIds = [];
  for (const s of subjects) {
    const [r] = await pool.query('INSERT INTO subjects (subject_name, department) VALUES (?,?)', s);
    subIds.push(r.insertId);
    // Hər fənnin bazada aldığı ID-ni yadda saxlayırıq
  }

  // Hansı professor hansı fənni tədris edir — ID-lər ilə əlaqələndiririk
  const assignments = [
    [profIds[0], [subIds[0], subIds[1], subIds[14]]],   // Elena: Algorithms, DB, OS
    [profIds[1], [subIds[3], subIds[4], subIds[5]]],    // James: Calculus, LinAlg, Stats
    [profIds[2], [subIds[2], subIds[0], subIds[13]]],   // Sofia: ML, Algorithms, Web
    [profIds[3], [subIds[6], subIds[7]]],               // Marco: Ethics, Logic
    [profIds[4], [subIds[8], subIds[9]]],               // Aisha: Biochem, MolBio
    [profIds[5], [subIds[10], subIds[1]]],              // Lars: Signal, DB
    [profIds[6], [subIds[11], subIds[4]]],              // Yuki: Quantum, LinAlg
    [profIds[7], [subIds[12], subIds[5]]],              // Carlos: FinMath, Stats
  ];

  for (const [pid, sids] of assignments) {
    for (const sid of sids) {
      await pool.query('INSERT IGNORE INTO professor_subjects (professor_id, subject_id) VALUES (?,?)', [pid, sid]);
      // INSERT IGNORE — əgər artıq varsa xəta vermir, sadəcə keçir
    }
  }

  // Demo şərhlər — [mətn, reytinq]
  const comments = [
    ['Absolutely brilliant lectures. Complex topics explained with clarity and passion.', 5],
    ['Very knowledgeable but the exams are quite challenging.', 4],
    ['One of the best professors I have ever had. Truly inspiring.', 5],
    ['Good professor overall. Could improve feedback turnaround time.', 3],
    ['Exceptional command of the subject. Office hours are very helpful.', 5],
    ['Clear explanations and always available to help students.', 4],
    ['Demanding but fair. You learn a lot in this course.', 4],
    ['A bit difficult to follow sometimes, but very thorough.', 3],
    ['Highly recommended! Makes difficult concepts feel accessible.', 5],
    ['Great teacher with real-world examples from industry experience.', 4],
    ['Passionate about the subject and it shows in every lecture.', 5],
    ['The workload is heavy but the knowledge you gain is worth it.', 4],
    ['Amazing professor. Changed how I think about this field.', 5],
    ['Good course structure and very responsive to questions.', 4],
    ['Could use more practical assignments but theory is solid.', 3],
  ];

  for (const pid of profIds) {
    const numReviews = 3 + Math.floor(Math.random() * 5);
    // Hər professor üçün 3 ilə 7 arasında təsadüfi sayda şərh yaradırıq

    for (let i = 0; i < numReviews; i++) {
      const [c, r] = comments[Math.floor(Math.random() * comments.length)];
      // Siyahıdan təsadüfi bir şərh seçirik
      await pool.query(
        'INSERT INTO reviews (professor_id, rating, comment) VALUES (?,?,?)',
        [pid, r, c]
      );
    }
  }

  console.log('✅ Seed data inserted');
}

// ─── HELPER ─────────────────────────────────────────────────────────────────
function starsHTML(avg) {
  const full = Math.round(avg);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
  // Dolu ulduzlar + boş ulduzlar — cəmi 5 ulduz
}

// ─── API ROUTES ─────────────────────────────────────────────────────────────

// GET /api/professors — bütün professorların siyahısı
app.get('/api/professors', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        -- Ortalama reytinq — şərh yoxdursa 0 göstərir, 1 onluq yuvarlaqlaşdırılır
        COUNT(r.id) AS review_count,
        -- Ümumi şərh sayı
        GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', ') AS subjects
        -- Professorun bütün fənnlərini vergüllə birləşdirir
      FROM professors p
      LEFT JOIN reviews r ON r.professor_id = p.id
      -- Şərhlər cədvəlini qoşuruq (şərh yoxdursa da professor görünsün)
      LEFT JOIN professor_subjects ps ON ps.professor_id = p.id
      LEFT JOIN subjects s ON s.id = ps.subject_id
      -- Fənnlər cədvəlini qoşuruq
      GROUP BY p.id
      -- Hər professor üçün ayrıca sətir yaradırıq
      ORDER BY p.full_name
      -- Ada görə əlifba sırası ilə sıralayırıq
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
    // Server xətası baş verərsə 500 kodu və xəta mesajı qaytarırıq
  }
});

// GET /api/professors/top — ən yüksək reytinqli 6 professor
app.get('/api/professors/top', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count,
        GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', ') AS subjects
      FROM professors p
      LEFT JOIN reviews r ON r.professor_id = p.id
      LEFT JOIN professor_subjects ps ON ps.professor_id = p.id
      LEFT JOIN subjects s ON s.id = ps.subject_id
      GROUP BY p.id
      HAVING review_count > 0
      -- Heç şərhi olmayanları göstərmirik
      ORDER BY avg_rating DESC, review_count DESC
      -- Önce reytinqə, sonra şərh sayına görə sıralayırıq
      LIMIT 6
      -- Yalnız ilk 6-nı götürürük
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/professors/recent — ən son əlavə edilmiş 6 professor
app.get('/api/professors/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count,
        GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', ') AS subjects
      FROM professors p
      LEFT JOIN reviews r ON r.professor_id = p.id
      LEFT JOIN professor_subjects ps ON ps.professor_id = p.id
      LEFT JOIN subjects s ON s.id = ps.subject_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      -- Ən son əlavə edilənlər əvvəldə gəlir
      LIMIT 6
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/professors/:id — tək bir professorun tam məlumatı
app.get('/api/professors/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count
      FROM professors p
      LEFT JOIN reviews r ON r.professor_id = p.id
      WHERE p.id = ?
      -- URL-dən gələn ID-yə uyğun professoru tapırıq
      GROUP BY p.id
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Professor not found' });
    // Professor tapılmadısa 404 xətası qaytarırıq

    const prof = rows[0];

    const [subjects] = await pool.query(`
      SELECT s.* FROM subjects s
      JOIN professor_subjects ps ON ps.subject_id = s.id
      WHERE ps.professor_id = ?
      -- Bu professorun tədris etdiyi bütün fənnlər
    `, [req.params.id]);

    const [reviews] = await pool.query(`
      SELECT * FROM reviews WHERE professor_id = ? ORDER BY created_at DESC
      -- Bu professora yazılmış şərhlər — ən yeni əvvəldə
    `, [req.params.id]);

    res.json({ ...prof, subjects, reviews });
    // Professor məlumatı + fənnlər + şərhlər birlikdə qaytarılır
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/search?query= — professor və fənn axtarışı
app.get('/api/search', async (req, res) => {
  try {
    const q = `%${req.query.query || ''}%`;
    // Axtarış sözünü SQL LIKE formatına çeviririk — % hər iki tərəfdən uyğunluq axtarır

    const [professors] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count,
        GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', ') AS subjects
      FROM professors p
      LEFT JOIN reviews r ON r.professor_id = p.id
      LEFT JOIN professor_subjects ps ON ps.professor_id = p.id
      LEFT JOIN subjects s ON s.id = ps.subject_id
      WHERE p.full_name LIKE ? OR p.department LIKE ? OR p.faculty LIKE ?
      -- Ad, kafedra və ya fakültəyə görə axtarır
      GROUP BY p.id
    `, [q, q, q]);

    const [subjects] = await pool.query(`
      SELECT s.*,
        COUNT(DISTINCT ps.professor_id) AS professor_count
      FROM subjects s
      LEFT JOIN professor_subjects ps ON ps.subject_id = s.id
      WHERE s.subject_name LIKE ? OR s.department LIKE ?
      -- Fənn adı və ya kafedrasına görə axtarır
      GROUP BY s.id
    `, [q, q]);

    const [profsBySubject] = await pool.query(`
      SELECT DISTINCT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count,
        GROUP_CONCAT(DISTINCT s2.subject_name ORDER BY s2.subject_name SEPARATOR ', ') AS subjects
      FROM professors p
      JOIN professor_subjects ps ON ps.professor_id = p.id
      JOIN subjects s ON s.id = ps.subject_id
      LEFT JOIN reviews r ON r.professor_id = p.id
      LEFT JOIN professor_subjects ps2 ON ps2.professor_id = p.id
      LEFT JOIN subjects s2 ON s2.id = ps2.subject_id
      WHERE s.subject_name LIKE ?
      -- Axtarış sözünə uyğun fənni tədris edən professorları tapır
      GROUP BY p.id
    `, [q]);

    res.json({ professors, subjects, profsBySubject });
    // Üç ayrı nəticəni birlikdə qaytarırıq
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/subjects — bütün fənnlərin siyahısı
app.get('/api/subjects', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, COUNT(DISTINCT ps.professor_id) AS professor_count
      -- Hər fənni neçə professor tədris edir
      FROM subjects s
      LEFT JOIN professor_subjects ps ON ps.subject_id = s.id
      GROUP BY s.id
      ORDER BY s.subject_name
      -- Əlifba sırası ilə sıralayırıq
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/subjects/:id — tək bir fənnin tam məlumatı
app.get('/api/subjects/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM subjects WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
    // Fənn tapılmadısa 404 qaytarırıq

    const [professors] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count,
        GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', ') AS subjects
      FROM professors p
      JOIN professor_subjects ps ON ps.professor_id = p.id
      LEFT JOIN reviews r ON r.professor_id = p.id
      LEFT JOIN professor_subjects ps2 ON ps2.professor_id = p.id
      LEFT JOIN subjects s ON s.id = ps2.subject_id
      WHERE ps.subject_id = ?
      -- Bu fənni tədris edən professorları tapırıq
      GROUP BY p.id
      ORDER BY avg_rating DESC
      -- Ən yüksək reytinqli professor əvvəldə gəlir
    `, [req.params.id]);

    res.json({ ...rows[0], professors });
    // Fənn məlumatı + həmin fənni tədris edən professorlar
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reviews/:professorId — bir professorun bütün şərhləri
app.get('/api/reviews/:professorId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE professor_id = ? ORDER BY created_at DESC',
      // Ən yeni şərh əvvəldə gəlir
      [req.params.professorId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews — yeni şərh əlavə etmək
app.post('/api/reviews', async (req, res) => {
  try {
    const { professor_id, rating, comment, reviewer_name } = req.body;
    // Sorğunun gövdəsindən lazımlı məlumatları çıxarırıq

    if (!professor_id || !rating) return res.status(400).json({ error: 'professor_id and rating required' });
    // Məcburi sahələr yoxdursa 400 xətası qaytarırıq

    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    // Reytinq 1-5 arasında deyilsə xəta qaytarırıq

    if (!reviewer_name) return res.status(400).json({ error: 'Ad və soyad yazın' });
    // Ad yazılmayıbsa xəta qaytarırıq

    const [result] = await pool.query(
      'INSERT INTO reviews (professor_id, rating, comment, reviewer_name) VALUES (?,?,?,?)',
      [professor_id, rating, comment || '', reviewer_name]
      // Şərhi bazaya yazırıq — comment boşdursa boş string yazılır
    );

    const [avg] = await pool.query(
      'SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE professor_id = ?',
      [professor_id]
      // Yeni şərhdən sonra bu professorun güncəl ortalama reytinqini hesablayırıq
    );

    res.json({ id: result.insertId, ...avg[0] });
    // Yeni şərhin ID-si + güncəl reytinq məlumatı qaytarılır
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/professors — yeni professor əlavə etmək
app.post('/api/professors', async (req, res) => {
  try {
    const { full_name, university, faculty, department, biography } = req.body;
    // Formdakı məlumatları oxuyuruq

    if (!full_name || !university || !faculty || !department)
      return res.status(400).json({ error: 'full_name, university, faculty, department required' });
    // Məcburi sahələr boşdursa xəta qaytarırıq

    const [result] = await pool.query(
      'INSERT INTO professors (full_name, university, faculty, department, biography) VALUES (?,?,?,?,?)',
      [full_name, university, faculty, department, biography || '']
      // Yeni professoru bazaya yazırıq
    );
    res.json({ id: result.insertId, full_name, university, faculty, department, biography });
    // Yeni professorun ID-si ilə birlikdə məlumatları qaytarırıq
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/subjects — yeni fənn əlavə etmək
app.post('/api/subjects', async (req, res) => {
  try {
    const { subject_name, department } = req.body;

    if (!subject_name || !department)
      return res.status(400).json({ error: 'subject_name and department required' });
    // Məcburi sahələr boşdursa xəta

    const [result] = await pool.query(
      'INSERT INTO subjects (subject_name, department) VALUES (?,?)',
      [subject_name, department]
    );
    res.json({ id: result.insertId, subject_name, department });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/professor-subjects — professora fənn təyin etmək
app.post('/api/professor-subjects', async (req, res) => {
  try {
    const { professor_id, subject_id } = req.body;

    if (!professor_id || !subject_id)
      return res.status(400).json({ error: 'professor_id and subject_id required' });
    // Hər ikisi göndərilməyibsə xəta

    await pool.query(
      'INSERT IGNORE INTO professor_subjects (professor_id, subject_id) VALUES (?,?)',
      [professor_id, subject_id]
      // Artıq bu cüt varsa xəta vermir — sadəcə keçir
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/professors/:id — professor silmək
app.delete('/api/professors/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM professors WHERE id = ?', [req.params.id]);
    // URL-dən gələn ID-li professoru bazadan silir
    // CASCADE sayəsində onun şərhləri və fənn əlaqələri də avtomatik silinir
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/subjects/:id — fənn silmək
app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    // URL-dən gələn ID-li fənni bazadan silir
    // CASCADE sayəsində professor-fənn əlaqələri də avtomatik silinir
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
  // Baza hazır olduqdan sonra serveri başladırıq
}).catch(err => {
  console.error('❌ DB init failed:', err.message);
  process.exit(1);
  // Baza xətası olarsa proqramı dayandırırıq
});