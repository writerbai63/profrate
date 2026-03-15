/* shared.js — utilities shared across all pages */

const API = 'http://localhost:3001/api';

// ── API HELPERS ──────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const api = {
  getProfessors:  ()       => apiFetch('/professors'),
  getTopProfs:    ()       => apiFetch('/professors/top'),
  getRecentProfs: ()       => apiFetch('/professors/recent'),
  getProfessor:   (id)     => apiFetch(`/professors/${id}`),
  getSubjects:    ()       => apiFetch('/subjects'),
  getSubject:     (id)     => apiFetch(`/subjects/${id}`),
  search:         (q)      => apiFetch(`/search?query=${encodeURIComponent(q)}`),
  getReviews:     (pid)    => apiFetch(`/reviews/${pid}`),
  postReview:     (body)   => apiFetch('/reviews',   { method: 'POST', body: JSON.stringify(body) }),
  postProfessor:  (body)   => apiFetch('/professors', { method: 'POST', body: JSON.stringify(body) }),
  postSubject:    (body)   => apiFetch('/subjects',   { method: 'POST', body: JSON.stringify(body) }),
  assignSubject:  (body)   => apiFetch('/professor-subjects', { method: 'POST', body: JSON.stringify(body) }),
  deleteProfessor:(id)     => apiFetch(`/professors/${id}`, { method: 'DELETE' }),
  deleteSubject:  (id)     => apiFetch(`/subjects/${id}`,   { method: 'DELETE' }),
};

// ── STARS ────────────────────────────────────────────────────────────────────
function starsHTML(avg) {
  const n = Math.round(Number(avg) || 0);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function starsBar(avg, count) {
  const n = Number(avg) || 0;
  return `<span class="stars">${starsHTML(n)}</span>
          <span class="rating-num">${n.toFixed(1)}</span>
          <span class="rating-count">(${count} review${count !== 1 ? 's' : ''})</span>`;
}

// ── AVATAR INITIALS ───────────────────────────────────────────────────────────
function initials(name) {
  return name.split(' ').filter(w => /[A-Z]/.test(w[0])).slice(-2).map(w => w[0]).join('');
}

// ── CARD HTML ────────────────────────────────────────────────────────────────
function profCardHTML(p) {
  const subjectTags = p.subjects
    ? p.subjects.split(', ').slice(0, 3).map(s =>
        `<span class="subject-tag">${s}</span>`
      ).join('')
    : '';
  return `
    <div class="prof-card" onclick="goToProf(${p.id})" data-id="${p.id}">
      <div class="card-avatar">${initials(p.full_name)}</div>
      <div class="card-name">${p.full_name}</div>
      <div class="card-dept">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        ${p.department} · ${p.faculty}
      </div>
      <div class="card-rating">${starsBar(p.avg_rating, p.review_count)}</div>
      <div class="card-subjects">${subjectTags}</div>
    </div>`;
}

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function goToProf(id)    { location.href = `professor.html?id=${id}`; }
function goToSubject(id) { location.href = `subject.html?id=${id}`; }
function goToSearch(q)   { location.href = `search.html?q=${encodeURIComponent(q)}`; }

// ── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── GLOBAL MINI SEARCH (navbar) ───────────────────────────────────────────────
function initNavSearch() {
  const input = document.getElementById('nav-search-input');
  if (!input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) goToSearch(input.value.trim());
  });
}

// ── FORMAT DATE ──────────────────────────────────────────────────────────────
function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

// ── RUN NAV INIT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initNavSearch);
