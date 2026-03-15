const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// ─── DB CONFIG ──────────────────────────────────────────────────────────────
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sənin_şifrən',
  database: process.env.DB_NAME || 'profrate',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool;

async function initDB() {
  // First connect without a database to create it if needed
  const initPool = await mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await initPool.getConnection();

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  await conn.query(`USE \`${dbConfig.database}\``);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS professors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      university VARCHAR(255) NOT NULL,
      faculty VARCHAR(255) NOT NULL,
      department VARCHAR(255) NOT NULL,
      biography TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      subject_name VARCHAR(255) NOT NULL,
      department VARCHAR(255) NOT NULL
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS professor_subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      professor_id INT NOT NULL,
      subject_id INT NOT NULL,
      FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE KEY unique_pair (professor_id, subject_id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      professor_id INT NOT NULL,
      rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE
    )
  `);

  conn.release();
  await initPool.end();

  // Now create pool with the database selected
  pool = mysql.createPool(dbConfig);
  console.log('✅ Database initialized');

  await seedData();
}

async function seedData() {
  const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM professors');
  if (rows[0].cnt > 0) return;

  console.log('🌱 Seeding demo data...');

  // Professors
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
  }

  // Subjects
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
  }

  // Assign subjects to professors
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
    }
  }

  // Reviews
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
    for (let i = 0; i < numReviews; i++) {
      const [c, r] = comments[Math.floor(Math.random() * comments.length)];
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
}

// ─── API ROUTES ─────────────────────────────────────────────────────────────

// GET /api/professors
app.get('/api/professors', async (req, res) => {
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
      ORDER BY p.full_name
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/professors/top
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
      ORDER BY avg_rating DESC, review_count DESC
      LIMIT 6
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/professors/recent
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
      LIMIT 6
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/professors/:id
app.get('/api/professors/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
        ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating,
        COUNT(r.id) AS review_count
      FROM professors p
      LEFT JOIN reviews r ON r.professor_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Professor not found' });

    const prof = rows[0];

    const [subjects] = await pool.query(`
      SELECT s.* FROM subjects s
      JOIN professor_subjects ps ON ps.subject_id = s.id
      WHERE ps.professor_id = ?
    `, [req.params.id]);

    const [reviews] = await pool.query(`
      SELECT * FROM reviews WHERE professor_id = ? ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({ ...prof, subjects, reviews });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/search?query=
app.get('/api/search', async (req, res) => {
  try {
    const q = `%${req.query.query || ''}%`;

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
      GROUP BY p.id
    `, [q, q, q]);

    const [subjects] = await pool.query(`
      SELECT s.*,
        COUNT(DISTINCT ps.professor_id) AS professor_count
      FROM subjects s
      LEFT JOIN professor_subjects ps ON ps.subject_id = s.id
      WHERE s.subject_name LIKE ? OR s.department LIKE ?
      GROUP BY s.id
    `, [q, q]);

    // Also find professors teaching matching subjects
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
      GROUP BY p.id
    `, [q]);

    res.json({ professors, subjects, profsBySubject });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, COUNT(DISTINCT ps.professor_id) AS professor_count
      FROM subjects s
      LEFT JOIN professor_subjects ps ON ps.subject_id = s.id
      GROUP BY s.id
      ORDER BY s.subject_name
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/subjects/:id
app.get('/api/subjects/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM subjects WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Subject not found' });

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
      GROUP BY p.id
      ORDER BY avg_rating DESC
    `, [req.params.id]);

    res.json({ ...rows[0], professors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reviews/:professorId
app.get('/api/reviews/:professorId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM reviews WHERE professor_id = ? ORDER BY created_at DESC',
      [req.params.professorId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reviews
app.post('/api/reviews', async (req, res) => {
  try {
    const { professor_id, rating, comment } = req.body;
    if (!professor_id || !rating) return res.status(400).json({ error: 'professor_id and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const [result] = await pool.query(
      'INSERT INTO reviews (professor_id, rating, comment) VALUES (?,?,?)',
      [professor_id, rating, comment || '']
    );

    const [avg] = await pool.query(
      'SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE professor_id = ?',
      [professor_id]
    );

    res.json({ id: result.insertId, ...avg[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/professors
app.post('/api/professors', async (req, res) => {
  try {
    const { full_name, university, faculty, department, biography } = req.body;
    if (!full_name || !university || !faculty || !department)
      return res.status(400).json({ error: 'full_name, university, faculty, department required' });

    const [result] = await pool.query(
      'INSERT INTO professors (full_name, university, faculty, department, biography) VALUES (?,?,?,?,?)',
      [full_name, university, faculty, department, biography || '']
    );
    res.json({ id: result.insertId, full_name, university, faculty, department, biography });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/subjects
app.post('/api/subjects', async (req, res) => {
  try {
    const { subject_name, department } = req.body;
    if (!subject_name || !department)
      return res.status(400).json({ error: 'subject_name and department required' });

    const [result] = await pool.query(
      'INSERT INTO subjects (subject_name, department) VALUES (?,?)',
      [subject_name, department]
    );
    res.json({ id: result.insertId, subject_name, department });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/professor-subjects
app.post('/api/professor-subjects', async (req, res) => {
  try {
    const { professor_id, subject_id } = req.body;
    if (!professor_id || !subject_id)
      return res.status(400).json({ error: 'professor_id and subject_id required' });

    await pool.query(
      'INSERT IGNORE INTO professor_subjects (professor_id, subject_id) VALUES (?,?)',
      [professor_id, subject_id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/professors/:id
app.delete('/api/professors/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM professors WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/subjects/:id
app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('❌ DB init failed:', err.message);
  process.exit(1);
});
