/* ============================================================
   auth.js — Login & Registration Logic
   ============================================================ */

const API = '/api';

// ── Utils ────────────────────────────────────────────────────
function showMessage(msg, type = 'error') {
  const box = document.getElementById('msgBox');
  const icon = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❌';
  box.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  box.innerHTML = `${icon} ${msg}`;
  box.classList.remove('hidden');
  if (type === 'success') {
    setTimeout(() => box.classList.add('hidden'), 4000);
  }
}

function setLoading(btn, loading, text) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = text;
  }
}

// ── Tab Switcher ─────────────────────────────────────────────
function switchTab(tab) {
  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLogin     = document.getElementById('tabLogin');
  const tabRegister  = document.getElementById('tabRegister');
  const heading      = document.getElementById('authHeading');
  const sub          = document.getElementById('authSub');
  const switchText   = document.getElementById('authSwitchText');
  const switchLink   = document.getElementById('authSwitchLink');
  const msgBox       = document.getElementById('msgBox');

  msgBox.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    heading.textContent = 'Welcome back!';
    sub.textContent     = 'Sign in to your account to continue.';
    switchText.textContent = "Don't have an account? ";
    switchLink.textContent = 'Register here';
    switchLink.onclick     = () => { switchTab('register'); return false; };
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    heading.textContent = 'Create account';
    sub.textContent     = 'Join FeedbackHub and start sharing your thoughts.';
    switchText.textContent = 'Already have an account? ';
    switchLink.textContent = 'Sign in';
    switchLink.onclick     = () => { switchTab('login'); return false; };
  }
}

// ── Password Toggle ───────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// ── Password Strength ─────────────────────────────────────────
function checkStrength(pw) {
  const fill = document.getElementById('pwFill');
  const text = document.getElementById('pwText');
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw))    score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { label: '',         color: 'transparent', pct: '0%'   },
    { label: 'Weak',     color: '#ef4444',     pct: '20%'  },
    { label: 'Fair',     color: '#f59e0b',     pct: '40%'  },
    { label: 'Good',     color: '#06b6d4',     pct: '65%'  },
    { label: 'Strong',   color: '#10b981',     pct: '85%'  },
    { label: 'Very Strong', color: '#6366f1',  pct: '100%' },
  ];

  const level = levels[score] || levels[0];
  fill.style.width      = level.pct;
  fill.style.background = level.color;
  text.textContent      = score > 0 ? `Strength: ${level.label}` : '';
  text.style.color      = level.color;
}

// ── Redirect if already logged in ────────────────────────────
function checkAuthAndRedirect() {
  try {
    const storedToken = localStorage.getItem('fb_token');
    const storedUser  = JSON.parse(localStorage.getItem('fb_user') || 'null');
    if (storedToken && storedUser) {
      location.href = storedUser.role === 'admin' ? '/admin.html' : '/feedback.html';
      return true;
    }
  } catch (e) {
    localStorage.removeItem('fb_token');
    localStorage.removeItem('fb_user');
  }
  return false;
}

// ── Initialization ──────────────────────────────────────────
function init() {
  // Attach listeners
  const lForm = document.getElementById('loginForm');
  const rForm = document.getElementById('registerForm');

  if (lForm) {
    lForm.addEventListener('submit', handleLogin);
  }
  if (rForm) {
    rForm.addEventListener('submit', handleRegister);
  }

  // Check auth
  checkAuthAndRedirect();
}

// ── Login Handler ─────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn   = document.getElementById('loginBtn');
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;

  setLoading(btn, true, 'Signing in...');

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.message || 'Login failed');
    } else {
      localStorage.setItem('fb_token', data.token);
      localStorage.setItem('fb_user',  JSON.stringify(data.user));
      showMessage('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        location.href = data.user.role === 'admin' ? '/admin.html' : '/feedback.html';
      }, 800);
    }
  } catch (err) {
    showMessage('Network error. Is the server running?');
  } finally {
    setLoading(btn, false, 'Sign In');
  }
}

// ── Register Handler ──────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const btn      = document.getElementById('registerBtn');
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  // Client-side validation
  if (name.length < 2) {
    return showMessage('Name must be at least 2 characters');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showMessage('Please enter a valid email address');
  }
  if (password.length < 6) {
    return showMessage('Password must be at least 6 characters');
  }
  if (!/[A-Z]/.test(password)) {
    return showMessage('Password must contain at least one uppercase letter');
  }
  if (!/\d/.test(password)) {
    return showMessage('Password must contain at least one number');
  }

  setLoading(btn, true, 'Creating account...');

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.errors ? data.errors[0].msg : (data.message || 'Registration failed');
      showMessage(errMsg);
    } else {
      localStorage.setItem('fb_token', data.token);
      localStorage.setItem('fb_user',  JSON.stringify(data.user));
      showMessage('Account created! Redirecting...', 'success');
      setTimeout(() => { location.href = '/feedback.html'; }, 800);
    }
  } catch (err) {
    showMessage('Network error. Is the server running?');
  } finally {
    setLoading(btn, false, 'Create Account');
  }
}

// Run init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
