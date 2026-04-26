import { NOTIF_CHARS } from './config.js';
import { STATE, DB } from './api.js';
import { toDay } from './format.js';

export async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('/sw.js'); } catch(e) { console.warn('SW',e); }
}

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
  if (on) { localStorage.setItem('notif_enabled','0'); updateNotifToggle(); return; }
  if (!('Notification' in window)) { alert('Уведомления не поддерживаются'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { alert('Разреши уведомления в настройках браузера'); return; }
  localStorage.setItem('notif_enabled','1');
  scheduleStreakReminder();
  updateNotifToggle();
}

export function scheduleStreakReminder() { scheduleAllNotifications(); }

export function scheduleAllNotifications() {
  if (localStorage.getItem('notif_enabled') !== '1') return;
  if (!('serviceWorker' in navigator)) return;
  const user = DB.getUser(); if (!user) return;
  const alreadyDone = user.lastEntryDate === toDay();
  const now = new Date();
  const items = [];
  if (!alreadyDone) {
    const slots = [
      { h:9,  m:0,  slot:'morning' },
      { h:20, m:0,  slot:'evening' },
      { h:22, m:30, slot:'lastchance' },
    ];
    slots.forEach(({ h, m, slot }) => {
      const t = new Date(now); t.setHours(h, m, 0, 0);
      if (now < t) {
        const msg = _notifMsg(slot);
        items.push({ delay: t.getTime()-Date.now(), title: msg.title, body: msg.body, tag: 'notch-' + slot });
      }
    });
  }
  if (items.length === 0) return;
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ type:'SCHEDULE_NOTIFS_V2', items });
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
