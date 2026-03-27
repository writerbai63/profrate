/* shared.js — bütün səhifələrdə ortaq istifadə olunan funksiyalar */

const API = 'https://profrate-production.up.railway.app/api';
// Bütün API sorğuları bu bazaya ünvanlanır — Railway platformasındakı server

// ── API HELPERS ──────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    // Serverə JSON formatında danışırıq
    ...opts,
  });
  const data = await res.json();
  // Cavabı JSON olaraq oxuyuruq

  if (!res.ok) throw new Error(data.error || 'Request failed');
  // Sorğu uğursuz olubsa xəta atırıq — catch bloku tuta bilsin deyə

  return data;
}

const api = {
  // Bütün API sorğularını bir yerdə toplayan obyekt — hər yerdən api.xxx() ilə çağırılır

  getProfessors:  ()       => apiFetch('/professors'),
  // Bütün professorların siyahısı

  getTopProfs:    ()       => apiFetch('/professors/top'),
  // Ən yüksək reytinqli professorlar

  getRecentProfs: ()       => apiFetch('/professors/recent'),
  // Ən son əlavə edilmiş professorlar

  getProfessor:   (id)     => apiFetch(`/professors/${id}`),
  // ID-yə görə tək professor — fənnlər və şərhlər də daxil

  getSubjects:    ()       => apiFetch('/subjects'),
  // Bütün fənnlərin siyahısı

  getSubject:     (id)     => apiFetch(`/subjects/${id}`),
  // ID-yə görə tək fənn — həmin fənni tədris edən professorlar da daxil

  search:         (q)      => apiFetch(`/search?query=${encodeURIComponent(q)}`),
  // Axtarış — professor adı, kafedra, fənn adına görə

  getReviews:     (pid)    => apiFetch(`/reviews/${pid}`),
  // Bir professorun bütün şərhləri

  postReview:     (body)   => apiFetch('/reviews',   { method: 'POST', body: JSON.stringify(body) }),
  // Yeni şərh əlavə etmək

  postProfessor:  (body)   => apiFetch('/professors', { method: 'POST', body: JSON.stringify(body) }),
  // Yeni professor əlavə etmək

  postSubject:    (body)   => apiFetch('/subjects',   { method: 'POST', body: JSON.stringify(body) }),
  // Yeni fənn əlavə etmək

  assignSubject:  (body)   => apiFetch('/professor-subjects', { method: 'POST', body: JSON.stringify(body) }),
  // Professora fənn təyin etmək

  deleteProfessor:(id)     => apiFetch(`/professors/${id}`, { method: 'DELETE' }),
  // Professoru silmək

  deleteSubject:  (id)     => apiFetch(`/subjects/${id}`,   { method: 'DELETE' }),
  // Fənni silmək
};

// ── STARS ────────────────────────────────────────────────────────────────────
function starsHTML(avg) {
  const n = Math.round(Number(avg) || 0);
  // Ortalama reytinqi tam ədədə yuvarlaqlaşdırırıq
  return '★'.repeat(n) + '☆'.repeat(5 - n);
  // Dolu ulduzlar + boş ulduzlar — cəmi həmişə 5 ulduz
}

function starsBar(avg, count) {
  const n = Number(avg) || 0;
  return `<span class="stars">${starsHTML(n)}</span>
          <span class="rating-num">${n.toFixed(1)}</span>
          <span class="rating-count">(${count} review${count !== 1 ? 's' : ''})</span>`;
  // Ulduzlar + rəqəmsal bal + şərh sayı — kart altında görünən reytinq
}

// ── AVATAR INITIALS ───────────────────────────────────────────────────────────
function initials(name) {
  return name.split(' ').filter(w => /[A-Z]/.test(w[0])).slice(-2).map(w => w[0]).join('');
  // Professorun adının baş hərflərini götürürük — məsələn: "Dr. Jane Smith" → "JS"
}

// ── CARD HTML ────────────────────────────────────────────────────────────────
function profCardHTML(p) {
  const subjectTags = p.subjects
    ? p.subjects.split(', ').slice(0, 3).map(s =>
        `<span class="subject-tag">${s}</span>`
      ).join('')
    : '';
  // Professorun fənnlərini etiket şəklində göstəririk — maksimum 3 fənn

  return `
    <div class="prof-card" onclick="goToProf(${p.id})" data-id="${p.id}">
    <!-- Karta klik edəndə professorun profil səhifəsinə keçir -->

      <div class="card-avatar">${initials(p.full_name)}</div>
      <!-- Professorun baş hərfləri -->

      <div class="card-name">${p.full_name}</div>
      <!-- Professorun tam adı -->

      <div class="card-dept">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <!-- Ev ikonu — kafedra məlumatının yanında -->
        ${p.department} · ${p.faculty}
        <!-- Kafedra və fakültə adı -->
      </div>

      <div class="card-rating">${starsBar(p.avg_rating, p.review_count)}</div>
      <!-- Ulduz reytinqi, bal və şərh sayı -->

      <div class="card-subjects">${subjectTags}</div>
      <!-- Tədris etdiyi fənnlərin etiketləri -->
    </div>`;
}

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function goToProf(id)    { location.href = `professor.html?id=${id}`; }
// Professor profil səhifəsinə keçid — ID URL-ə əlavə olunur

function goToSubject(id) { location.href = `subject.html?id=${id}`; }
// Fənn səhifəsinə keçid

function goToSearch(q)   { location.href = `search.html?q=${encodeURIComponent(q)}`; }
// Axtarış səhifəsinə keçid — axtarış sözü URL-ə əlavə olunur

// ── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    // Toast konteynerini ilk dəfə yaradırıq — sonrakı toastlar da buraya əlavə olunur
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  // "success" → yaşıl, "error" → qırmızı kənar xətt
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
  // 3 saniyə sonra toast özü yox olur
}

// ── GLOBAL MINI SEARCH (navbar) ───────────────────────────────────────────────
function initNavSearch() {
  const input = document.getElementById('nav-search-input');
  if (!input) return;
  // Əgər bu səhifədə nav axtarış qutusu yoxdursa, dayandırırıq

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) goToSearch(input.value.trim());
    // Enter basılanda axtarış səhifəsinə yönləndirir
  });
}

// ── FORMAT DATE ──────────────────────────────────────────────────────────────
function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  // Tarix formatını oxunaqlı hala gətiririk — məsələn: "Jan 15, 2024"
}

// ── RUN NAV INIT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initNavSearch);
// Səhifə tam yüklənəndən sonra nav axtarışını aktiv edirik