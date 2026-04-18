/* ============================================================
   feedback.js — Feedback Submission & Management (User View)
   ============================================================ */

const API   = '/api';
const token = localStorage.getItem('fb_token');
const user  = JSON.parse(localStorage.getItem('fb_user') || 'null');

// ── Auth guard — stop ALL script execution if not logged in ──
if (!token || !user) {
  location.href = '/login.html';
  throw new Error('Not authorized'); // stops script execution immediately
}

// ── Set user badge ───────────────────────────────────────────
document.getElementById('userBadge').textContent = `👤 ${user.name}`;

function logout() {
  localStorage.removeItem('fb_token');
  localStorage.removeItem('fb_user');
  location.href = '/login.html';
}

// ── Auth headers ─────────────────────────────────────────────
const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

// ── Utilities ─────────────────────────────────────────────────
function showAlert(msg, type = 'error') {
  const box  = document.getElementById('alertBox');
  const icon = type === 'success' ? '✅' : '❌';
  box.className = `alert alert-${type === 'error' ? 'error' : 'success'}`;
  box.innerHTML = `${icon} ${msg}`;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4000);
}

function starsHTML(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

function updateCounter(inputId, counterId, max) {
  const len  = document.getElementById(inputId).value.length;
  const el   = document.getElementById(counterId);
  el.textContent = `${len} / ${max}`;
  el.className   = len > max * 0.9 ? 'char-counter warn' : len >= max ? 'char-counter over' : 'char-counter';
}

// ── Category chip selector ────────────────────────────────────
function selectChip(btn) {
  document.querySelectorAll('#chipGroup .chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('hiddenCategory').value = btn.dataset.val;
  document.getElementById('catError').classList.add('hidden');
}

// ── Star rating label ─────────────────────────────────────────
const labels = { '1': '😞 Terrible', '2': '😕 Poor', '3': '😐 Average', '4': '😊 Good', '5': '🤩 Excellent' };
document.querySelectorAll('.star-rating-interactive input').forEach(radio => {
  radio.addEventListener('change', () => {
    document.getElementById('ratingValue').textContent = labels[radio.value] || '';
    document.getElementById('ratingError').classList.add('hidden');
  });
});

// ── Pagination state ──────────────────────────────────────────
let currentPage = 1;
const PAGE_SIZE = 8;
let deleteTargetId = null;

// ── LOAD MY FEEDBACK ─────────────────────────────────────────
async function loadMyFeedback(page = 1) {
  currentPage = page;
  const status   = document.getElementById('filterStatus').value;
  const category = document.getElementById('filterCategory').value;

  const params = new URLSearchParams({ page, limit: PAGE_SIZE });
  if (status)   params.append('status',   status);
  if (category) params.append('category', category);

  const list = document.getElementById('feedbackList');
  list.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);"><div class="spinner" style="margin:0 auto 1rem;"></div>Loading...</div>`;

  try {
    const res  = await fetch(`${API}/feedback?${params}`, { headers: authHeaders });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const { data: items, pagination } = data;
    document.getElementById('feedbackCount').textContent =
      `${pagination.total} total feedback entr${pagination.total !== 1 ? 'ies' : 'y'}`;

    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <h3>No feedback yet</h3>
          <p>Submit your first feedback using the form on the left.</p>
        </div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    list.innerHTML = items.map(fb => `
      <div class="fb-item status-${fb.status}" id="fbitem-${fb.id}">
        <div class="fb-header">
          <div>
            <div class="fb-title">${escapeHtml(fb.title)}</div>
            <div class="fb-meta">
              <span style="color:var(--warning);">${starsHTML(fb.rating)}</span>
              <span class="cat-pill">${fb.category}</span>
              <span>${formatDate(fb.created_at)}</span>
            </div>
          </div>
          <span class="badge badge-${fb.status}">${capitalize(fb.status)}</span>
        </div>
        <div class="fb-body">${escapeHtml(fb.comment)}</div>
        ${fb.admin_note ? `<div class="fb-note">💬 Admin: ${escapeHtml(fb.admin_note)}</div>` : ''}
        ${fb.status === 'pending' ? `
        <div class="fb-actions">
          <button class="btn btn-secondary btn-sm" onclick="editFeedback(${fb.id})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${fb.id})">🗑️ Delete</button>
        </div>` : ''}
      </div>
    `).join('');

    renderPagination(pagination);
  } catch (err) {
    list.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
  }
}

// ── Pagination renderer ────────────────────────────────────────
function renderPagination({ pages, page }) {
  const pag = document.getElementById('pagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${page===1?'disabled':''} onclick="loadMyFeedback(${page-1})">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i===page?'active':''}" onclick="loadMyFeedback(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${page===pages?'disabled':''} onclick="loadMyFeedback(${page+1})">›</button>`;
  pag.innerHTML = html;
}

// ── SUBMIT / UPDATE FEEDBACK ──────────────────────────────────
document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validate
  let valid = true;
  const category = document.getElementById('hiddenCategory').value;
  const rating   = document.querySelector('input[name="rating"]:checked')?.value;
  const title    = document.getElementById('fbTitle').value.trim();
  const comment  = document.getElementById('fbComment').value.trim();
  const editId   = document.getElementById('editId').value;

  if (!category) { document.getElementById('catError').classList.remove('hidden'); valid = false; }
  if (!rating)   { document.getElementById('ratingError').classList.remove('hidden'); valid = false; }
  if (title.length < 3)  { document.getElementById('titleError').classList.remove('hidden'); valid = false; }
  if (comment.length < 10) { document.getElementById('commentError').classList.remove('hidden'); valid = false; }
  if (!valid) return;

  const btn  = document.getElementById('submitBtn');
  const isEdit = !!editId;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    const url    = isEdit ? `${API}/feedback/${editId}` : `${API}/feedback`;
    const method = isEdit ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify({ category, rating: parseInt(rating), title, comment }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.errors ? data.errors[0].msg : data.message;
      showAlert(msg);
    } else {
      showAlert(isEdit ? '✏️ Feedback updated successfully!' : '🎉 Feedback submitted successfully!', 'success');
      resetForm();
      loadMyFeedback();
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📤 Submit Feedback';
  }
});

// ── EDIT FEEDBACK (populate form) ────────────────────────────
async function editFeedback(id) {
  try {
    const res  = await fetch(`${API}/feedback/${id}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) return showAlert(data.message);

    const fb = data.data;
    document.getElementById('editId').value = fb.id;

    // Category chip
    document.querySelectorAll('#chipGroup .chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.val === fb.category);
    });
    document.getElementById('hiddenCategory').value = fb.category;

    // Rating
    const radioEl = document.querySelector(`input[name="rating"][value="${fb.rating}"]`);
    if (radioEl) { radioEl.checked = true; }
    document.getElementById('ratingValue').textContent = labels[fb.rating] || '';

    // Text fields
    document.getElementById('fbTitle').value   = fb.title;
    document.getElementById('fbComment').value = fb.comment;
    updateCounter('fbTitle',   'titleCounter',   200);
    updateCounter('fbComment', 'commentCounter', 2000);

    // UI
    document.getElementById('submitBtn').innerHTML = '💾 Update Feedback';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    document.querySelector('.form-title').innerHTML = '<span>✏️</span> Edit Feedback';
    document.getElementById('submitCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showAlert('Failed to load feedback');
  }
}

function cancelEdit() { resetForm(); }

function resetForm() {
  document.getElementById('feedbackForm').reset();
  document.getElementById('editId').value = '';
  document.querySelectorAll('#chipGroup .chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('hiddenCategory').value = '';
  document.getElementById('ratingValue').textContent = 'Click to rate';
  document.getElementById('titleCounter').textContent   = '0 / 200';
  document.getElementById('commentCounter').textContent = '0 / 2000';
  document.getElementById('submitBtn').innerHTML = '📤 Submit Feedback';
  document.getElementById('cancelEditBtn').classList.add('hidden');
  document.querySelector('.form-title').innerHTML = '<span>✏️</span> Submit New Feedback';
  ['catError','ratingError','titleError','commentError'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
}

// ── DELETE FEEDBACK ───────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}
function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res  = await fetch(`${API}/feedback/${deleteTargetId}`, { method: 'DELETE', headers: authHeaders });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.message);
    } else {
      showAlert('Feedback deleted', 'success');
      closeDeleteModal();
      loadMyFeedback(currentPage);
    }
  } catch (err) {
    showAlert('Delete failed');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Delete';
  }
});

// ── XSS protection ───────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Close modal on overlay click ──────────────────────────────
document.getElementById('deleteModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

// ── Init ─────────────────────────────────────────────────────
loadMyFeedback();
