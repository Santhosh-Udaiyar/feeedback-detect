/* ============================================================
   admin.js — Admin Dashboard Logic
   ============================================================ */

const API   = '/api';
const token = localStorage.getItem('fb_token');
const user  = JSON.parse(localStorage.getItem('fb_user') || 'null');

// ── Auth guard — stop ALL script execution if not admin ──────
if (!token || !user || user.role !== 'admin') {
  alert('Access denied. Admin only.');
  location.href = '/login.html';
  throw new Error('Not authorized'); // stops script execution immediately
}

document.getElementById('adminBadge').textContent = `👤 ${user.name}`;

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

// ── Utils ─────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
function starsHTML(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showAlert(msg, type = 'error') {
  const box  = document.getElementById('alertBox');
  const icon = type === 'success' ? '✅' : '❌';
  box.className = `alert alert-${type === 'error' ? 'error' : 'success'}`;
  box.innerHTML = `${icon} ${msg}`;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4000);
}

// ── Section Navigation ─────────────────────────────────────────
let currentSection = 'overview';

function showSection(name, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`sec-${name}`).classList.add('active');

  // Sidebar
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const sbLink = document.getElementById(`sb-${name}`);
  if (sbLink) sbLink.classList.add('active');

  // Mobile tabs
  document.querySelectorAll('.mobile-tabs button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  currentSection = name;
  if (name === 'overview')  loadAnalytics();
  if (name === 'feedback')  loadAllFeedback();
  if (name === 'users')     loadUsers();
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════
let trendChart, categoryChart, statusChart;

async function loadAnalytics() {
  try {
    const res  = await fetch(`${API}/admin/analytics`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const { summary, category_breakdown, monthly_trend } = data.data;
    document.getElementById('lastUpdated').textContent =
      `Last updated: ${new Date().toLocaleTimeString()}`;

    renderStats(summary);
    renderRatingBars(summary);
    renderTrendChart(monthly_trend);
    renderCategoryChart(category_breakdown);
    renderStatusChart(summary);
  } catch (err) {
    showAlert(`Analytics error: ${err.message}`);
  }
}

function renderStats(s) {
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">💬</div>
      <div class="stat-value">${s.total_feedback || 0}</div>
      <div class="stat-label">Total Feedback</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⭐</div>
      <div class="stat-value">${s.avg_rating || '—'}</div>
      <div class="stat-label">Avg Rating</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">👥</div>
      <div class="stat-value">${s.total_users || 0}</div>
      <div class="stat-label">Registered Users</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${s.resolved || 0}</div>
      <div class="stat-label">Resolved</div>
      <div class="stat-delta">${s.pending || 0} pending · ${s.reviewed || 0} reviewed</div>
    </div>
  `;
}

function renderRatingBars(s) {
  const total = parseInt(s.total_feedback) || 1;
  const bars  = [
    [5, s.five_star,  '#6366f1'],
    [4, s.four_star,  '#06b6d4'],
    [3, s.three_star, '#f59e0b'],
    [2, s.two_star,   '#f97316'],
    [1, s.one_star,   '#ef4444'],
  ];
  document.getElementById('ratingBars').innerHTML = bars.map(([star, cnt, color]) => {
    const pct = Math.round(((parseInt(cnt) || 0) / total) * 100);
    return `
      <div class="rating-bar-row">
        <div class="rating-bar-label">${star}★</div>
        <div class="rating-bar-wrap">
          <div class="progress"><div class="progress-bar" style="width:${pct}%;background:${color};"></div></div>
        </div>
        <div style="width:36px;font-size:0.78rem;color:var(--text-muted);text-align:right;">${cnt || 0}</div>
      </div>`;
  }).join('');
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();

  const labels = trend.map(t => t.month);
  const counts = trend.map(t => t.count);
  const avgs   = trend.map(t => t.avg_rating);

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Submissions',
          data: counts,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          fill: true, tension: 0.4, pointRadius: 4,
          pointBackgroundColor: '#6366f1',
          yAxisID: 'y',
        },
        {
          label: 'Avg Rating',
          data: avgs,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          fill: false, tension: 0.4, pointRadius: 4,
          pointBackgroundColor: '#f59e0b',
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
      scales: {
        x:  { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y:  { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' }, position: 'left' },
        y1: { ticks: { color: '#f59e0b' }, grid: { display: false }, position: 'right', min: 0, max: 5 },
      },
    },
  });
}

function renderCategoryChart(cats) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChart) categoryChart.destroy();

  const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#f97316'];
  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cats.map(c => capitalize(c.category)),
      datasets: [{
        label: 'Count',
        data: cats.map(c => c.count),
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { display: false } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

function renderStatusChart(s) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  if (statusChart) statusChart.destroy();

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Reviewed', 'Resolved'],
      datasets: [{
        data: [s.pending || 0, s.reviewed || 0, s.resolved || 0],
        backgroundColor: ['rgba(245,158,11,0.8)', 'rgba(6,182,212,0.8)', 'rgba(16,185,129,0.8)'],
        borderColor:     ['#f59e0b', '#06b6d4', '#10b981'],
        borderWidth: 2, hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
      },
      cutout: '65%',
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// ALL FEEDBACK
// ═══════════════════════════════════════════════════════════════
let fbPage = 1;
const FB_LIMIT = 15;
let deleteTargetId = null;
let statusTargetId = null;
let searchTimer    = null;

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadAllFeedback, 400);
}

async function loadAllFeedback(page = 1) {
  fbPage = page;
  const search   = document.getElementById('fbSearch').value.trim();
  const category = document.getElementById('fbFilterCategory').value;
  const status   = document.getElementById('fbFilterStatus').value;
  const rating   = document.getElementById('fbFilterRating').value;

  const params = new URLSearchParams({ page, limit: FB_LIMIT });
  if (search)   params.append('search',   search);
  if (category) params.append('category', category);
  if (status)   params.append('status',   status);
  if (rating)   params.append('rating',   rating);

  const tbody = document.getElementById('feedbackTbody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  try {
    const res  = await fetch(`${API}/admin/feedback?${params}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const { data: items, pagination } = data;
    document.getElementById('fbCount').textContent =
      `${pagination.total} total entr${pagination.total !== 1 ? 'ies' : 'y'}`;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8">
        <div class="empty-state"><div class="empty-icon">💬</div><h3>No feedback found</h3><p>Try adjusting your filters.</p></div>
      </td></tr>`;
      document.getElementById('fbPagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = items.map(fb => `
      <tr>
        <td>#${fb.id}</td>
        <td>
          <div style="font-weight:600;font-size:0.85rem;">${escapeHtml(fb.user_name)}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);">${escapeHtml(fb.user_email)}</div>
        </td>
        <td><span class="cat-pill">${fb.category}</span></td>
        <td><span style="color:var(--warning);">${starsHTML(fb.rating)}</span></td>
        <td style="max-width:200px;">
          <div style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fb.title)}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fb.comment)}</div>
        </td>
        <td><span class="badge badge-${fb.status}">${capitalize(fb.status)}</span></td>
        <td style="white-space:nowrap;font-size:0.8rem;">${formatDate(fb.created_at)}</td>
        <td>
          <div class="action-wrap">
            <button class="btn btn-secondary btn-sm" onclick="openViewModal(${fb.id})" title="View">👁</button>
            <button class="btn btn-primary btn-sm" onclick="openStatusModal(${fb.id}, '${fb.status}', '${escapeHtml(fb.admin_note || '')}')" title="Update Status">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${fb.id})" title="Delete">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderFbPagination(pagination);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="alert alert-error">❌ ${err.message}</div></td></tr>`;
  }
}

function renderFbPagination({ pages, page }) {
  const pag = document.getElementById('fbPagination');
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let html = `<button class="page-btn" ${page===1?'disabled':''} onclick="loadAllFeedback(${page-1})">‹</button>`;
  const start = Math.max(1, page - 2);
  const end   = Math.min(pages, page + 2);
  if (start > 1) html += `<button class="page-btn" onclick="loadAllFeedback(1)">1</button><span style="color:var(--text-dim);padding:0 4px;">…</span>`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i===page?'active':''}" onclick="loadAllFeedback(${i})">${i}</button>`;
  }
  if (end < pages) html += `<span style="color:var(--text-dim);padding:0 4px;">…</span><button class="page-btn" onclick="loadAllFeedback(${pages})">${pages}</button>`;
  html += `<button class="page-btn" ${page===pages?'disabled':''} onclick="loadAllFeedback(${page+1})">›</button>`;
  pag.innerHTML = html;
}

// ── VIEW MODAL ────────────────────────────────────────────────
async function openViewModal(id) {
  document.getElementById('viewModal').classList.remove('hidden');
  document.getElementById('viewModalBody').innerHTML = '<div class="spinner" style="margin:0 auto;"></div>';

  try {
    const res  = await fetch(`${API}/admin/feedback?search=&limit=1000`, { headers: authHeaders });
    const data = await res.json();
    const fb   = data.data.find(f => f.id === id);
    if (!fb) throw new Error('Not found');

    document.getElementById('viewModalBody').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.25rem;">
        <span class="badge badge-${fb.status}">${capitalize(fb.status)}</span>
        <span class="cat-pill">${fb.category}</span>
        <span style="color:var(--warning);font-size:1.1rem;">${starsHTML(fb.rating)} <span style="color:var(--text-muted);font-size:0.8rem;"> (${fb.rating}/5)</span></span>
      </div>
      <h3 style="margin-bottom:0.75rem;">${escapeHtml(fb.title)}</h3>
      <p style="color:var(--text-muted);font-size:0.875rem;line-height:1.7;margin-bottom:1.25rem;">${escapeHtml(fb.comment)}</p>
      ${fb.admin_note ? `<div style="background:rgba(6,182,212,0.07);border-left:3px solid var(--secondary);padding:0.75rem 1rem;border-radius:0 var(--radius) var(--radius) 0;font-size:0.85rem;color:var(--secondary);margin-bottom:1rem;">
        💬 <strong>Admin Note:</strong> ${escapeHtml(fb.admin_note)}
      </div>` : ''}
      <hr class="divider" />
      <div style="display:flex;gap:2rem;font-size:0.8rem;color:var(--text-muted);">
        <div><strong>User:</strong> ${escapeHtml(fb.user_name)} (${escapeHtml(fb.user_email)})</div>
        <div><strong>Date:</strong> ${formatDate(fb.created_at)}</div>
      </div>
    `;
  } catch (err) {
    document.getElementById('viewModalBody').innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
  }
}
function closeViewModal() { document.getElementById('viewModal').classList.add('hidden'); }

// ── STATUS MODAL ──────────────────────────────────────────────
function openStatusModal(id, currentStatus, adminNote) {
  statusTargetId = id;
  document.getElementById('statusSelect').value = currentStatus;
  document.getElementById('adminNote').value    = adminNote || '';
  document.getElementById('statusModalInfo').innerHTML =
    `Updating feedback #${id} — current status: <strong>${capitalize(currentStatus)}</strong>`;
  document.getElementById('statusModal').classList.remove('hidden');
}
function closeStatusModal() {
  statusTargetId = null;
  document.getElementById('statusModal').classList.add('hidden');
}

document.getElementById('saveStatusBtn').addEventListener('click', async () => {
  if (!statusTargetId) return;
  const status    = document.getElementById('statusSelect').value;
  const adminNote = document.getElementById('adminNote').value.trim();
  const btn       = document.getElementById('saveStatusBtn');
  btn.disabled    = true;
  btn.innerHTML   = '<span class="spinner"></span> Saving...';

  try {
    const res  = await fetch(`${API}/admin/feedback/${statusTargetId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status, admin_note: adminNote }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showAlert('Status updated successfully!', 'success');
    closeStatusModal();
    loadAllFeedback(fbPage);
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = 'Save Changes';
  }
});

// ── DELETE MODAL ──────────────────────────────────────────────
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
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res  = await fetch(`${API}/admin/feedback/${deleteTargetId}`, {
      method: 'DELETE', headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showAlert('Feedback deleted!', 'success');
    closeDeleteModal();
    loadAllFeedback(fbPage);
    loadAnalytics();
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = 'Delete';
  }
});

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════
async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  try {
    const res  = await fetch(`${API}/admin/users`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const users = data.data;
    document.getElementById('userCount').textContent =
      `${users.length} registered user${users.length !== 1 ? 's' : ''}`;

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h3>No users yet</h3></div></td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>#${u.id}</td>
        <td style="font-weight:600;">${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>
          <span class="status-dot ${u.is_active ? 'active' : 'inactive'}"></span>
          ${u.is_active ? 'Active' : 'Inactive'}
        </td>
        <td>${u.feedback_count}</td>
        <td style="font-size:0.8rem;">${formatDate(u.created_at)}</td>
        <td>
          <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}"
                  onclick="toggleUser(${u.id}, this)">
            ${u.is_active ? '🚫 Deactivate' : '✅ Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="alert alert-error">❌ ${err.message}</div></td></tr>`;
  }
}

async function toggleUser(id, btn) {
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const res  = await fetch(`${API}/admin/users/${id}/toggle`, {
      method: 'PATCH', headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showAlert('User status updated!', 'success');
    loadUsers();
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// ── Close modals on overlay click ─────────────────────────────
['statusModal','deleteModal','viewModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.id === id) {
      if (id === 'statusModal') closeStatusModal();
      if (id === 'deleteModal') closeDeleteModal();
      if (id === 'viewModal')   closeViewModal();
    }
  });
});

// ── Init ──────────────────────────────────────────────────────
loadAnalytics();
