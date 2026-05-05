import { NOTIF_CHARS, VAPID_PUBLIC_KEY } from './config.js';
import { STATE, DB, AUTH, supa } from './api.js';
import { toDay } from './format.js';

export async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('/sw.js'); } catch(e) { console.warn('SW', e); }
}

/* ── Push subscription ── */

function _urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function refreshPushSubscription() {
  if (localStorage.getItem('notif_enabled') !== '1') return;
  if (!('PushManager' in window) || !AUTH.uid) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    // Re-subscribe if VAPID key rotated — old sub won't accept pushes from new key
    if (sub && localStorage.getItem('vapid_key_used') !== VAPID_PUBLIC_KEY) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      localStorage.setItem('vapid_key_used', VAPID_PUBLIC_KEY);
    }
    if (sub) await _saveSub(sub);
  } catch(e) { console.warn('push refresh', e); }
}

function _tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'; } catch(e) { return 'Europe/Moscow'; } }

async function _saveSub(sub) {
  await supa.from('push_subscriptions').upsert(
    { user_id: AUTH.uid, subscription: sub.toJSON(), timezone: _tz(), updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

async function _subscribePush() {
  if (!('PushManager' in window) || !AUTH.uid) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    if (sub) await _saveSub(sub);
  } catch(e) { console.warn('push subscribe', e); }
}

async function _unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (AUTH.uid) await supa.from('push_subscriptions').delete().eq('user_id', AUTH.uid);
  } catch(e) { console.warn('push unsubscribe', e); }
}

/* ── Notif characters ── */

export function getNotifChar() { return localStorage.getItem('notif_char') || 'bro'; }

export function setNotifChar(id) {
  localStorage.setItem('notif_char', id);
  renderCharPicker();
}

export function renderCharPicker() {
  const row = document.getElementById('char-picker-row'); if (!row) return;
  const cur  = getNotifChar();
  const prem = window.isPremium ? window.isPremium() : false;
  const FREE_CHARS = ['bro', 'coach'];
  row.innerHTML = Object.entries(NOTIF_CHARS).map(([id, c]) => {
    const locked = !prem && !FREE_CHARS.includes(id);
    return `<div class="char-option${id===cur?' active':''}" onclick="${locked?'showPremiumScreen()':'setNotifChar(\''+id+'\')'}" style="${locked?'opacity:.5':''}">
      <div class="char-option-icon">${c.icon}</div>
      <div class="char-option-name">${c.name}${locked?' ✦':''}</div>
    </div>`;
  }).join('');
}

export function _notifMsg(slot) {
  const char = NOTIF_CHARS[getNotifChar()] || NOTIF_CHARS.bro;
  const pool = char[slot] || char.evening;
  return { title: char.icon + ' ' + char.name, body: pool[Math.floor(Math.random()*pool.length)] };
}

export function updateNotifToggle() {
  const btn = document.getElementById('notif-toggle-btn'); if (!btn) return;
  const on  = localStorage.getItem('notif_enabled') === '1';
  btn.textContent = on ? 'Включено' : 'Включить';
  btn.className   = 'notif-toggle-btn ' + (on ? 'on' : 'off');
}

export async function toggleNotifications() {
  const on = localStorage.getItem('notif_enabled') === '1';
  if (on) {
    localStorage.setItem('notif_enabled', '0');
    updateNotifToggle();
    await _unsubscribePush();
    return;
  }
  if (!('Notification' in window)) { alert('Уведомления не поддерживаются'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Разреши уведомления в настройках браузера'); return; }
  localStorage.setItem('notif_enabled', '1');
  updateNotifToggle();
  await _subscribePush();
  renderNotifBanner();
}

export function scheduleStreakReminder() { /* legacy — сервер теперь шлёт сам */ }

/* ── Notification prompt banner ── */

function _shouldShowNotifPrompt() {
  if (localStorage.getItem('notif_enabled') === '1') return false;
  if (!('Notification' in window) || !('PushManager' in window)) return false;
  if (Notification.permission === 'denied') return false;

  // Show on 2nd+ visit OR when streak >= 3 (something to protect)
  const opens  = parseInt(localStorage.getItem('app_opens') || '0');
  const streak = STATE.user?.streak || 0;
  if (opens < 2 && streak < 3) return false;

  // Re-prompt after 7 days if dismissed
  const dismissedAt = parseInt(localStorage.getItem('notif_dismissed_at') || '0');
  if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return false;

  return true;
}

export function dismissNotifPrompt() {
  localStorage.setItem('notif_dismissed_at', Date.now().toString());
  const slot = document.getElementById('notif-prompt-slot');
  if (!slot) return;
  slot.style.opacity   = '0';
  slot.style.transform = 'translateY(-6px)';
  setTimeout(() => { slot.innerHTML = ''; slot.style.cssText = ''; }, 250);
}

export function renderNotifBanner() {
  const slot = document.getElementById('notif-prompt-slot');
  if (!slot) return;
  if (!_shouldShowNotifPrompt()) { slot.innerHTML = ''; return; }

  slot.innerHTML = `<div class="notif-prompt">
    <div class="notif-prompt-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    </div>
    <div class="notif-prompt-text">
      <div class="notif-prompt-title">Не теряй стрик</div>
      <div class="notif-prompt-sub">Включи уведомления — напомним вовремя</div>
    </div>
    <div class="notif-prompt-actions">
      <button class="notif-prompt-btn" onclick="toggleNotifications()">Включить</button>
      <button class="notif-prompt-dismiss" onclick="dismissNotifPrompt()">&#xd7;</button>
    </div>
  </div>`;
  slot.style.opacity   = '0';
  slot.style.transform = 'translateY(-6px)';
  requestAnimationFrame(() => {
    slot.style.opacity   = '1';
    slot.style.transform = 'translateY(0)';
  });
}

/* ── Biometric toggle in settings ── */

export function _bioLabel() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Войти через Face ID / Touch ID';
  if (/Android/.test(ua))     return 'Войти отпечатком пальца';
  return 'Биометрический вход';
}

export function updateBioToggle() {
  const btn   = document.getElementById('bio-profile-btn');   if (!btn) return;
  const label = document.getElementById('bio-profile-label');
  const on    = localStorage.getItem('bio_enabled') === '1';
  btn.textContent = on ? 'Отключить' : 'Включить';
  btn.className   = 'notif-toggle-btn ' + (on ? 'on' : 'off');
  if (label) label.textContent = _bioLabel();
}

export async function toggleBioFromProfile() {
  if (localStorage.getItem('bio_enabled') === '1') {
    localStorage.removeItem('bio_enabled');
    localStorage.removeItem('bio_cred_id');
    localStorage.removeItem('bio_email');
    localStorage.removeItem('bio_declined');
    updateBioToggle();
    const wrap = document.getElementById('bio-auth-wrap');
    if (wrap) wrap.style.display = 'none';
  } else {
    if (!await window.isBioAvailable()) { alert('Биометрия недоступна на этом устройстве'); return; }
    localStorage.removeItem('bio_declined');
    await window.offerBioSetup(window.AUTH?.email || '');
    updateBioToggle();
  }
}
