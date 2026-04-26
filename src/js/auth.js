import { STATE, DB, AUTH, supa } from './api.js';
import { loadState } from './api.js';
import { toDay } from './format.js';
import { checkStreak } from './gamification.js';
import { generateNotchId } from './friends.js';
import { DAILY_QUEST_TEMPLATES, WEEKLY_QUEST } from './config.js';
import { getWeekStart } from './gamification.js';

/* ── Auth form ── */

let authMode = 'signin';

export function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tab-signin').classList.toggle('active', mode === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('auth-submit').textContent = mode === 'signin' ? 'Войти' : 'Зарегистрироваться';
  document.getElementById('auth-password').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  document.getElementById('auth-error').textContent = '';
}

function _authError(err) {
  const m = err?.message || '';
  if (m.includes('Invalid login credentials')) return 'Неверный email или пароль';
  if (m.includes('already registered') || m.includes('User already exists')) return 'Email уже зарегистрирован — войди';
  if (m.includes('Password should be') || m.includes('at least 6')) return 'Пароль — минимум 6 символов';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Введи корректный email';
  if (m.includes('Email not confirmed')) return 'Подтверди email (проверь почту)';
  return 'Что-то пошло не так. Попробуй ещё раз.';
}

export async function submitAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  const btn      = document.getElementById('auth-submit');

  if (!email || !password) { errEl.textContent = 'Заполни email и пароль'; return; }
  if (password.length < 6) { errEl.textContent = 'Пароль — минимум 6 символов'; return; }

  errEl.textContent = '';
  btn.disabled      = true;
  btn.textContent   = 'Загрузка...';

  try {
    let result;
    if (authMode === 'signup') {
      result = await supa.auth.signUp({ email, password });
    } else {
      result = await supa.auth.signInWithPassword({ email, password });
    }

    if (result.error) { errEl.textContent = _authError(result.error); return; }
    if (!result.data.session) { errEl.textContent = 'Подтверди email — ссылка отправлена на почту'; return; }

    AUTH.uid   = result.data.user.id;
    AUTH.email = result.data.user.email;

    if (result.data.session?.refresh_token && localStorage.getItem('bio_enabled') === '1') {
      localStorage.setItem('bio_refresh', result.data.session.refresh_token);
    }

    const hasProfile = await loadState();
    if (hasProfile && STATE.user?.onboardingDone) {
      const checked = checkStreak(STATE.user);
      DB.setUser(checked);
      window.showScreen('main');
      window.renderAll();
      window.loadLeague();
      window.scheduleStreakReminder();
      const urlAction = new URLSearchParams(location.search).get('action');
      if (urlAction === 'add-expense') setTimeout(window.openModal, 300);
      setTimeout(() => offerBioSetup(email), 1200);
    } else {
      document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
      document.getElementById('ob1').classList.add('active');
      window.showScreen('ob');
    }
  } catch(e) {
    errEl.textContent = 'Ошибка соединения. Попробуй ещё раз.';
    console.error('submitAuth', e);
  } finally {
    btn.disabled    = false;
    btn.textContent = authMode === 'signin' ? 'Войти' : 'Зарегистрироваться';
  }
}

export async function signOut() {
  await supa.auth.signOut();
  AUTH.uid   = null;
  AUTH.email = null;
  STATE.user = null; STATE.exps = []; STATE.incomes = []; STATE.quests = null; STATE.achievs = [];
  document.getElementById('auth-email').value    = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-error').textContent = '';
  switchAuthTab('signin');
  window.showScreen('auth');
}

export async function confirmReset() {
  if (!confirm('Сбросить все данные? Это нельзя отменить.')) return;
  if (!AUTH.uid) return;
  await supa.from('expenses').delete().eq('user_id', AUTH.uid);
  await supa.from('profiles').delete().eq('id', AUTH.uid);
  STATE.user = null; STATE.exps = []; STATE.incomes = []; STATE.quests = null; STATE.achievs = [];
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob1').classList.add('active');
  document.getElementById('ob-name').value = '';
  document.getElementById('ob-income').value = '';
  document.getElementById('ob-savings').value = '';
  window.showScreen('ob');
}

/* ── Onboarding ── */

export function obNext(step) {
  document.getElementById('ob' + step).classList.remove('active');
  document.getElementById('ob' + (step + 1)).classList.add('active');
  setTimeout(() => document.getElementById('ob' + (step + 1)).querySelector('.ob-input').focus(), 100);
}

export async function obFinish() {
  const name    = document.getElementById('ob-name').value.trim();
  const income  = parseFloat(document.getElementById('ob-income').value) || 0;
  const savings = parseFloat(document.getElementById('ob-savings').value) || 0;
  const budget  = Math.max(Math.round(income - savings), Math.round(income * 0.05));
  const btn     = document.getElementById('ob3-btn');
  btn.disabled = true;

  const td = toDay();
  const ws = getWeekStart();
  const quests = {
    daily:  DAILY_QUEST_TEMPLATES.map(t => ({ ...t, progress: 0, completed: false, date: td })),
    weekly: { ...WEEKLY_QUEST, target: Math.round(budget * 0.05), progress: 0, completed: false, weekStart: ws },
    lastReset: td, weekReset: ws,
  };

  const _newNotchId = generateNotchId();
  const { error } = await supa.from('profiles').upsert({
    id:               AUTH.uid,
    name,
    monthly_income:   income,
    monthly_budget:   budget,
    xp:               0, streak: 0, longest_streak: 0,
    last_entry_date:  null, freezes_available: 1,
    join_date:        td,
    onboarding_done:  true,
    quests_data:      quests,
    achievements:     [],
    currency:         'RUB',
    base_currency:    'RUB',
    fixed_expenses:   [],
    notch_id:         _newNotchId,
  });

  if (error) { console.error('obFinish', error); btn.disabled = false; return; }

  STATE.user    = { name, monthlyIncome: income, monthlyBudget: budget, xp: 0, streak: 0, longestStreak: 0, lastEntryDate: null, freezesAvailable: 1, joinDate: td, onboardingDone: true, currency: 'RUB', baseCurrency: 'RUB', fixedExps: [], savingsGoals: [], notchId: _newNotchId };
  STATE.quests  = quests;
  STATE.achievs = [];
  STATE.exps    = [];

  window.showScreen('main');
  window.renderAll();
  setTimeout(window.showTour, 400);
}

/* ── Biometric (WebAuthn) ── */

function _buf2b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _b642buf(b64) {
  const bin = atob(b64); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export async function isBioAvailable() {
  if (!window.PublicKeyCredential) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch(e) { return false; }
}

export async function initBioButton() {
  if (localStorage.getItem('bio_enabled') !== '1') return;
  if (!await isBioAvailable()) return;
  const wrap  = document.getElementById('bio-auth-wrap');
  const label = document.getElementById('bio-auth-label');
  if (wrap)  wrap.style.display = '';
  if (label) label.textContent  = window._bioLabel ? window._bioLabel() : 'Войти биометрией';
}

export async function loginWithBiometric() {
  const credIdB64 = localStorage.getItem('bio_cred_id');
  if (!credIdB64) { showBioError(); return; }
  const btn = document.getElementById('bio-auth-btn');
  if (btn) { btn.style.opacity = '.5'; btn.style.pointerEvents = 'none'; }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        userVerification: 'required',
        allowCredentials: [{ id: _b642buf(credIdB64), type: 'public-key' }],
        timeout: 60000,
      }
    });
    if (!assertion) throw new Error('no assertion');

    // Try to restore session via stored refresh token (rotated on every use)
    const storedRefresh = localStorage.getItem('bio_refresh');
    let session = null;
    if (storedRefresh) {
      const { data: refreshData, error: refreshErr } = await supa.auth.refreshSession({ refresh_token: storedRefresh });
      if (!refreshErr && refreshData.session) {
        session = refreshData.session;
        localStorage.setItem('bio_refresh', session.refresh_token);
      }
    }
    if (!session) {
      const { data: sessData } = await supa.auth.getSession();
      session = sessData.session;
    }

    if (session) {
      AUTH.uid   = session.user.id;
      AUTH.email = session.user.email;
      const hasProfile = await loadState();
      if (hasProfile && STATE.user?.onboardingDone) {
        const checked = checkStreak(STATE.user);
        DB.setUser(checked);
        window.showScreen('main');
        window.renderAll();
        window.loadLeague();
        window.scheduleStreakReminder();
        const urlAction = new URLSearchParams(location.search).get('action');
        if (urlAction === 'add-expense') setTimeout(window.openModal, 300);
        return;
      }
    }
    document.getElementById('auth-error').textContent = 'Сессия истекла. Войди с паролем один раз.';
  } catch(e) {
    if (e.name !== 'NotAllowedError') {
      document.getElementById('auth-error').textContent = 'Биометрия не прошла. Попробуй с паролем.';
    }
  } finally {
    if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
  }
}

export function showBioError() {
  localStorage.removeItem('bio_enabled');
  localStorage.removeItem('bio_cred_id');
  localStorage.removeItem('bio_email');
  const wrap = document.getElementById('bio-auth-wrap');
  if (wrap) wrap.style.display = 'none';
}

export async function offerBioSetup(email) {
  if (localStorage.getItem('bio_declined') === '1') return;
  if (localStorage.getItem('bio_enabled')  === '1') return;
  if (!await isBioAvailable()) return;
  const title = document.getElementById('bio-setup-title');
  if (title) {
    const ua = navigator.userAgent;
    title.textContent = /iPhone|iPad/.test(ua) ? 'Включить Face ID / Touch ID?' :
                        /Android/.test(ua)      ? 'Включить вход по отпечатку?' : 'Включить биометрию?';
  }
  localStorage.setItem('bio_pending_email', email);
  document.getElementById('bio-setup-overlay').classList.add('show');
}

export async function enableBiometric() {
  const email = localStorage.getItem('bio_pending_email') || AUTH.email;
  if (!email) { dismissBioSetup(); return; }
  const overlay = document.getElementById('bio-setup-overlay');
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const uid  = new TextEncoder().encode(email);
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Notch', id: location.hostname },
        user: { id: uid, name: email, displayName: email },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
      }
    });
    if (cred) {
      localStorage.setItem('bio_enabled', '1');
      localStorage.setItem('bio_cred_id', _buf2b64(cred.rawId));
      localStorage.setItem('bio_email', email);
      localStorage.removeItem('bio_pending_email');
      const { data: { session: bioSess } } = await supa.auth.getSession();
      if (bioSess?.refresh_token) localStorage.setItem('bio_refresh', bioSess.refresh_token);
    }
  } catch(e) { console.warn('bio setup', e); }
  if (overlay) overlay.classList.remove('show');
}

export function dismissBioSetup() {
  localStorage.setItem('bio_declined', '1');
  localStorage.removeItem('bio_pending_email');
  const overlay = document.getElementById('bio-setup-overlay');
  if (overlay) overlay.classList.remove('show');
}
