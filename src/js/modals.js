import { CATS, CAT_SVG, INCOME_TYPES, ACHIEVEMENTS } from './config.js';
import { STATE, DB, AUTH, supa } from './api.js';
import { _syncUser, _insertIncome, _insertExpense } from './api.js';
import { toDay, fmt, getCur } from './format.js';
import { addXP, incrementStreak, checkQuestCompletion, checkAchievements, getFinancialAge } from './gamification.js';
import { showPostExpenseNudge } from './friends.js';
import { renderSavingsGoals, renderFixedExps, renderAll } from './render.js';
import { SUPABASE_URL } from './config.js';

/* ── Expense modal ── */

export let selectedCat  = null;
export let editingExpId = null;

export function openModal() {
  selectedCat  = null;
  editingExpId = null;
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-note').value   = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('save-btn').disabled = true;
  document.getElementById('exp-currency-sym').textContent = getCur().symbol;
  document.querySelector('#modal .modal-title').textContent = 'Записать трату';
  buildQuickTemplates();
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('exp-amount').focus(), 400);
}

export function closeModal() {
  document.getElementById('modal').classList.remove('open');
  if (editingExpId !== null) {
    editingExpId = null;
    document.getElementById('save-btn').textContent = 'Записать';
    document.querySelector('#modal .modal-title').textContent = 'Записать трату';
    selectedCat = null;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  }
}

export function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

export function selectCat(id) {
  selectedCat = id;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('selected', b.dataset.cat === id));
  validateForm();
}

export function validateForm() {
  const amt = parseFloat(document.getElementById('exp-amount').value);
  document.getElementById('save-btn').disabled = !(amt > 0 && selectedCat);
}

export function buildCatGrid() {
  document.getElementById('cat-grid').innerHTML = CATS.map(c => `
    <div class="cat-btn" data-cat="${c.id}" onclick="selectCat('${c.id}')">
      <span class="cat-btn-ico">${CAT_SVG[c.id]}</span>
      <span class="cat-btn-name">${c.name}</span>
    </div>
  `).join('');
}

export function openEditById(id) {
  const exp = STATE.exps.find(e => String(e.id) === String(id));
  if (exp) openEditModal(exp);
}

export function openEditModal(exp) {
  editingExpId = exp.id;
  document.getElementById('exp-amount').value = Number.isInteger(exp.amount) ? exp.amount : exp.amount.toFixed(2);
  document.getElementById('exp-note').value   = exp.note || '';
  document.getElementById('exp-currency-sym').textContent = getCur().symbol;
  selectedCat = exp.catId;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('selected', b.dataset.cat === exp.catId));
  document.getElementById('save-btn').disabled = false;
  document.getElementById('save-btn').textContent = 'Сохранить';
  document.querySelector('#modal .modal-title').textContent = 'Редактировать';
  document.getElementById('modal').classList.add('open');
}

export async function saveExpense() {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const note   = document.getElementById('exp-note').value.trim();
  if (!amount || !selectedCat) return;

  const cat = CATS.find(c => c.id === selectedCat);
  const btn = document.getElementById('save-btn');

  if (editingExpId !== null) {
    btn.disabled = true;
    const idx = STATE.exps.findIndex(e => e.id === editingExpId);
    if (idx !== -1) {
      STATE.exps[idx] = { ...STATE.exps[idx], amount, catId: selectedCat, catName: cat.name, icon: CAT_SVG[selectedCat] || '', note };
      try {
        await supa.from('expenses').update({ amount, cat_id: selectedCat, cat_name: cat.name, icon: CAT_SVG[selectedCat] || '', note })
          .eq('id', editingExpId).eq('user_id', AUTH.uid);
      } catch(e) { console.error('updateExpense', e); }
    }
    editingExpId = null;
    closeModal();
    renderAll();
    return;
  }

  const expense = {
    id:      Date.now(),
    amount,
    catId:   selectedCat,
    catName: cat.name,
    icon:    CAT_SVG[selectedCat] || '',
    note,
    date:    toDay(),
  };

  btn.disabled = true;

  STATE.exps.push(expense);
  _insertExpense(expense);

  let user = DB.getUser();
  user = incrementStreak(user);
  DB.setUser(user);

  addXP(10);

  const wasFirstToday = STATE.exps.filter(e => e.date === toDay()).length === 1;
  if (wasFirstToday && user.streak > 0) {
    setTimeout(() => addXP(15), 800);
  }

  checkQuestCompletion(expense);
  checkAchievements();

  closeModal();
  renderAll();
  setTimeout(showPostExpenseNudge, 600);
}

export async function deleteExpense(id) {
  if (!confirm('Удалить эту запись?')) return;
  STATE.exps = STATE.exps.filter(e => e.id !== id);
  renderAll();
  try {
    await supa.from('expenses').delete().eq('id', id).eq('user_id', AUTH.uid);
  } catch(e) { console.error('deleteExpense', e); }
}

/* ── Income modal ── */

export let selectedIncomeType = null;

export function buildIncomeTypeGrid() {
  document.getElementById('income-type-grid').innerHTML = INCOME_TYPES.map(t => `
    <div class="cat-btn" data-type="${t.id}" onclick="selectIncomeType('${t.id}')">
      <span class="cat-btn-ico">${t.svg}</span>
      <span class="cat-btn-name">${t.name}</span>
    </div>
  `).join('');
}

export function selectIncomeType(id) {
  selectedIncomeType = id;
  document.querySelectorAll('#income-type-grid .cat-btn').forEach(b => b.classList.toggle('selected', b.dataset.type === id));
  validateIncomeForm();
}

export function validateIncomeForm() {
  const amt = parseFloat(document.getElementById('inc-amount').value);
  document.getElementById('inc-save-btn').disabled = !(amt > 0 && selectedIncomeType);
}

export function openIncomeModal() {
  selectedIncomeType = null;
  document.getElementById('inc-amount').value = '';
  document.getElementById('inc-note').value   = '';
  document.querySelectorAll('#income-type-grid .cat-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('inc-save-btn').disabled = true;
  document.getElementById('inc-currency-sym').textContent = getCur().symbol;
  document.getElementById('income-modal').classList.add('open');
  setTimeout(() => document.getElementById('inc-amount').focus(), 400);
}

export function closeIncomeModal() {
  document.getElementById('income-modal').classList.remove('open');
}

export function handleIncomeOverlayClick(e) {
  if (e.target === document.getElementById('income-modal')) closeIncomeModal();
}

export async function saveIncome() {
  const amount = parseFloat(document.getElementById('inc-amount').value);
  const note   = document.getElementById('inc-note').value.trim();
  if (!amount || !selectedIncomeType) return;

  const type = INCOME_TYPES.find(t => t.id === selectedIncomeType);
  const inc = {
    id:       Date.now(),
    amount,
    type:     selectedIncomeType,
    typeName: type.name,
    note,
    date:     toDay(),
  };

  const btn = document.getElementById('inc-save-btn');
  btn.disabled = true;

  STATE.incomes.push(inc);
  _insertIncome(inc);

  addXP(10);
  closeIncomeModal();
  renderAll();
}

/* ── Settings modal ── */

export function openSettings() {
  const user = DB.getUser(); if (!user) return;
  document.getElementById('s-name').value    = user.name || '';
  document.getElementById('s-income').value  = user.monthlyIncome || '';
  const savings = Math.max(0, (user.monthlyIncome || 0) - (user.monthlyBudget || 0));
  document.getElementById('s-savings').value = savings || '';
  const t = localStorage.getItem('notch-theme') || 'system';
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.t === t));
  document.getElementById('settings-modal').classList.add('open');
  setTimeout(() => document.getElementById('s-name').focus(), 350);
}

export function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

export function handleSettingsOverlay(e) {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
}

export async function saveSettings() {
  const name    = document.getElementById('s-name').value.trim();
  const income  = parseFloat(document.getElementById('s-income').value) || 0;
  const savings = parseFloat(document.getElementById('s-savings').value) || 0;
  if (!name || !income) return;
  const budget = Math.max(Math.round(income - savings), Math.round(income * 0.05));
  const btn = document.getElementById('settings-save-btn');
  btn.disabled = true;
  const user = DB.getUser();
  user.name          = name;
  user.monthlyIncome = income;
  user.monthlyBudget = budget;
  DB.setUser(user);
  await _syncUser(user);
  btn.disabled = false;
  closeSettings();
  renderAll();
}

/* ── Currency ── */

export function setCurrency(id) {
  const user = DB.getUser(); if (!user) return;
  user.currency = id;
  DB.setUser(user);
  renderAll();
}

/* ── Savings goals ── */

export function addSavingsGoal() {
  const nameEl   = document.getElementById('goal-name');
  const targetEl = document.getElementById('goal-target');
  const name     = nameEl.value.trim();
  const target   = parseFloat(targetEl.value);
  if (!name || !target || target <= 0) return;
  const user = DB.getUser(); if (!user) return;
  const prem = window.isPremium ? window.isPremium() : false;
  if (!prem && (user.savingsGoals || []).length >= 3) { if (window.showPremiumScreen) window.showPremiumScreen(); return; }
  const entry = { id: Date.now().toString(36), name, target, saved: 0 };
  user.savingsGoals = [...(user.savingsGoals || []), entry];
  DB.setUser(user); nameEl.value = ''; targetEl.value = '';
  _syncUser(user); renderSavingsGoals();
}

export function removeSavingsGoal(id) {
  const user = DB.getUser(); if (!user) return;
  user.savingsGoals = (user.savingsGoals || []).filter(g => g.id !== id);
  DB.setUser(user); _syncUser(user); renderSavingsGoals();
}

export function depositSavingsGoal(id) {
  const inp = document.getElementById('gdep-' + id); if (!inp) return;
  const amount = parseFloat(inp.value); if (!amount || amount <= 0) return;
  const user = DB.getUser(); if (!user) return;
  const goal = (user.savingsGoals || []).find(g => g.id === id); if (!goal) return;
  goal.saved = (goal.saved || 0) + amount;
  DB.setUser(user); _syncUser(user); renderSavingsGoals();
}

/* ── Fixed expenses ── */

export function addFixedExp() {
  const nameEl = document.getElementById('fexp-name');
  const amtEl  = document.getElementById('fexp-amount');
  const name   = nameEl.value.trim();
  const amount = parseFloat(amtEl.value);
  if (!name || !amount || amount <= 0) return;
  const user = DB.getUser(); if (!user) return;
  const entry = { id: Date.now().toString(36), name, amount };
  user.fixedExps = [...(user.fixedExps || []), entry];
  DB.setUser(user);
  nameEl.value = ''; amtEl.value = '';
  _syncUser(user); renderFixedExps();
  if (typeof window.renderHome === 'function') window.renderHome();
}

export function removeFixedExp(id) {
  const user = DB.getUser(); if (!user) return;
  user.fixedExps = (user.fixedExps || []).filter(e => e.id !== id);
  DB.setUser(user); _syncUser(user); renderFixedExps();
  if (typeof window.renderHome === 'function') window.renderHome();
}

/* ── Quick templates ── */

export function buildQuickTemplates() {
  const wrap = document.getElementById('quick-templates'); if (!wrap) return;
  const exps = DB.getExps();
  if (!exps.length) { wrap.style.display = 'none'; return; }
  const seen = new Set(); const templates = [];
  for (let i = exps.length - 1; i >= 0 && templates.length < 5; i--) {
    const e = exps[i];
    if (!seen.has(e.catId)) { seen.add(e.catId); templates.push(e); }
  }
  if (!templates.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = templates.map(e => `
    <div class="quick-tpl" onclick="applyQuickTemplate('${e.catId}',${e.amount})">
      <span class="quick-tpl-ico">${e.icon}</span>
      <span class="quick-tpl-amt">${fmt(e.amount)}</span>
      <span class="quick-tpl-name">${e.catName}</span>
    </div>`).join('');
}

export function applyQuickTemplate(catId, amount) {
  document.getElementById('exp-amount').value = Number.isInteger(amount) ? amount : amount.toFixed(2);
  selectCat(catId);
  validateForm();
}

/* ── Export CSV ── */

export function exportCSV() {
  const prem = window.isPremium ? window.isPremium() : false;
  if (!prem) { if (window.showPremiumScreen) window.showPremiumScreen(); return; }
  const exps = DB.getExps();
  if (!exps.length) { alert('Нет данных для экспорта'); return; }
  const rows = [['Дата', 'Категория', 'Сумма', 'Комментарий']];
  [...exps].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
    rows.push([e.date, e.catName, String(e.amount), e.note || '']);
  });
  const csv  = rows.map(r => r.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'notch-' + toDay() + '.csv' });
  a.click(); URL.revokeObjectURL(url);
}

/* ── Info overlay ── */

export function showInfo(key) {
  const INFO = {
    fa: {
      title: 'Запас дней',
      body: `Сколько дней ты проживёшь, если завтра не будет зарплаты.\n\n30 дней — есть подушка\n90 дней — можно спать спокойно\n180 дней — полная свобода`,
    },
    xp: {
      title: 'Уровни и XP',
      body: `Записываешь траты — получаешь XP. Набираешь XP — растёт уровень.\n\nЗапись траты → +10 XP\nПервая запись за день → +25 XP\nВыполнил квест → +50–200 XP\n\nЧем регулярнее ведёшь учёт, тем быстрее растёшь.`,
    },
  };
  const item = INFO[key]; if (!item) return;
  document.getElementById('info-title').textContent = item.title;
  document.getElementById('info-body').textContent  = item.body;
  document.getElementById('info-overlay').classList.add('open');
}

export function closeInfo() {
  document.getElementById('info-overlay').classList.remove('open');
}

/* ── Tour ── */

export function showTour() {
  if (localStorage.getItem('tour_done')) return;
  document.getElementById('tour-overlay').classList.add('show');
}

export function closeTour() {
  localStorage.setItem('tour_done', '1');
  document.getElementById('tour-overlay').classList.remove('show');
}

/* ── Share achievement ── */

export function shareAchievement(achievId) {
  const a    = ACHIEVEMENTS.find(x => x.id === achievId);
  const user = DB.getUser(); if (!a || !user) return;
  const canvas = document.getElementById('share-canvas');
  const ctx    = canvas.getContext('2d');
  const W = 320, H = 320;
  ctx.fillStyle = '#0B0F14';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 20); ctx.fill();
  const grd = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, W*0.45);
  grd.addColorStop(0, 'rgba(78,204,163,0.18)'); grd.addColorStop(1, 'rgba(78,204,163,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 20); ctx.fill();
  ctx.fillStyle = '#4ECCA3'; _shareRoundRect(ctx, W/2 - 16, 28, 32, 32, 9); ctx.fill();
  ctx.fillStyle = '#0B0F14'; ctx.font = 'bold 20px Arial Black, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('N', W/2, 52);
  ctx.fillStyle = 'rgba(78,204,163,0.12)'; _shareRoundRect(ctx, W/2 - 36, 90, 72, 72, 18); ctx.fill();
  ctx.fillStyle = '#4ECCA3'; ctx.font = 'bold 36px serif';
  ctx.textAlign = 'center'; ctx.fillText(a.icon, W/2, 143);
  ctx.fillStyle = '#E6EDF8'; ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText(a.name, W/2, 198);
  ctx.fillStyle = '#667796'; ctx.font = '14px Arial, sans-serif'; ctx.fillText(a.desc, W/2, 222);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; _shareRoundRect(ctx, W/2 - 70, 246, 140, 28, 8); ctx.fill();
  ctx.fillStyle = '#4ECCA3'; ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillText(user.name || 'Игрок', W/2, 265);
  ctx.fillStyle = 'rgba(102,119,150,0.5)'; ctx.font = '11px Arial, sans-serif';
  ctx.fillText('notch.app', W/2, 300);
  const overlay  = document.getElementById('share-overlay');
  const hint     = document.getElementById('share-hint');
  const canShare = 'share' in navigator;
  hint.textContent = canShare ? 'Нажми Поделиться для отправки в Stories' : 'Нажми Сохранить для скачивания';
  document.getElementById('share-btn-do').textContent = canShare ? 'Поделиться' : 'Сохранить';
  document.getElementById('share-btn-do').onclick = () => _doShare(achievId);
  overlay.classList.add('show');
}

function _shareRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

async function _doShare(achievId) {
  const canvas = document.getElementById('share-canvas');
  const a = ACHIEVEMENTS.find(x => x.id === achievId);
  if ('share' in navigator) {
    canvas.toBlob(async blob => {
      const file = new File([blob], 'notch-achievement.png', { type: 'image/png' });
      const data = { title: 'Notch: ' + (a?.name || 'Достижение'), text: 'Получил достижение в Notch!', files: [file] };
      if (navigator.canShare && navigator.canShare(data)) {
        try { await navigator.share(data); } catch(e) {}
      } else { _downloadCanvas(canvas); }
    }, 'image/png');
  } else { _downloadCanvas(canvas); }
}

function _downloadCanvas(canvas) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png'); a.download = 'notch-achievement.png'; a.click();
}

export function closeShareOverlay() {
  document.getElementById('share-overlay').classList.remove('show');
}

/* ── QR Scanner ── */

let _scannerStream = null;
let _scannerRAF    = null;
let _scannerActive = false;

export async function openScanner() {
  if (!window.jsQR) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  try {
    _scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } }
    });
  } catch(e) {
    const statusEl = document.getElementById('scan-status');
    document.getElementById('qr-scanner').classList.add('open');
    if (statusEl) { statusEl.textContent = 'Нет доступа к камере. Разреши в настройках.'; statusEl.classList.add('found'); }
    setTimeout(closeScanner, 2500);
    return;
  }
  const video = document.getElementById('qr-video');
  video.srcObject = _scannerStream;
  await video.play().catch(() => {});
  document.getElementById('qr-scanner').classList.add('open');
  const statusEl = document.getElementById('scan-status');
  if (statusEl) { statusEl.textContent = 'Ищем QR-код...'; statusEl.classList.remove('found'); }
  _scannerActive = true;
  _scanFrame();
}

function _scanFrame() {
  if (!_scannerActive) return;
  const video  = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  if (!video || !canvas) return;
  if (video.readyState >= 2) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const d    = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
    if (code) {
      const amount = _parseReceiptQR(code.data);
      if (amount && amount > 0) {
        const statusEl = document.getElementById('scan-status');
        if (statusEl) { statusEl.textContent = 'Сумма найдена: ' + amount + ' ' + getCur().symbol; statusEl.classList.add('found'); }
        setTimeout(() => {
          closeScanner();
          document.getElementById('exp-amount').value = Number.isInteger(amount) ? amount : amount.toFixed(2);
          validateForm();
        }, 600);
        return;
      }
    }
  }
  _scannerRAF = requestAnimationFrame(_scanFrame);
}

function _parseReceiptQR(str) {
  const m = str.match(/(?:^|[?&])s=(\d+(?:[.,]\d{1,2})?)/i);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

export function closeScanner() {
  _scannerActive = false;
  if (_scannerRAF)    { cancelAnimationFrame(_scannerRAF); _scannerRAF = null; }
  if (_scannerStream) { _scannerStream.getTracks().forEach(t => t.stop()); _scannerStream = null; }
  document.getElementById('qr-scanner').classList.remove('open');
}

/* ── Stat sheets (budget / days / goals) ── */

function _openStatSheet(html) {
  document.getElementById('ss-content').innerHTML = html;
  document.getElementById('ss-overlay').classList.add('open');
  document.getElementById('ss-sheet').classList.add('open');
}

export function closeStatSheet() {
  document.getElementById('ss-overlay')?.classList.remove('open');
  document.getElementById('ss-sheet')?.classList.remove('open');
}

export function openBudgetSheet() {
  const user       = STATE.user; if (!user) return;
  const now        = new Date();
  const mStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const exps       = STATE.exps || [];
  const monthExp   = exps.filter(e => e.date >= mStart).reduce((s, e) => s + e.amount, 0);
  const fixedTotal = (user.fixedExps || []).reduce((s, e) => s + e.amount, 0);
  const totalSpent = monthExp + fixedTotal;
  const budget     = user.monthlyBudget || 0;
  const remaining  = budget - totalSpent;
  const pct        = budget > 0 ? Math.min(Math.round(totalSpent / budget * 100), 100) : 0;
  const color      = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--gold)' : 'var(--ac)';
  const dailyLimit = budget > 0 ? budget / 30 : 0;
  const month      = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  _openStatSheet(`
    <div class="ss-hero">
      <div class="ss-title">Бюджет</div>
      <div class="ss-sub">${month}</div>
      <div class="ss-big" style="color:${color}">${budget > 0 ? pct + '%' : '—'}</div>
      <div class="ss-sub">${budget > 0 ? 'потрачено из ' + fmt(budget) : 'бюджет не задан'}</div>
    </div>
    ${budget > 0 ? `
    <div class="ss-bar-wrap">
      <div class="fp-xp-bar-wrap"><div class="fp-xp-bar" style="width:${pct}%;background:${color}"></div></div>
      <div class="fp-xp-labels"><span>${fmt(totalSpent)}</span><span>${fmt(budget)}</span></div>
    </div>` : ''}
    <div class="ss-rows">
      <div class="ss-row"><span>Переменные</span><span>${fmt(monthExp)}</span></div>
      ${fixedTotal > 0 ? `<div class="ss-row"><span>Постоянные</span><span>${fmt(fixedTotal)}</span></div>` : ''}
      ${budget > 0 ? `
      <div class="ss-row"><span>Осталось</span><b style="color:${remaining >= 0 ? 'var(--green)' : 'var(--red)'}">${remaining >= 0 ? fmt(remaining) : '−' + fmt(-remaining)}</b></div>
      <div class="ss-row"><span>Суточный лимит</span><span>${fmt(dailyLimit)}/день</span></div>` : ''}
    </div>
    <div class="ss-footer">
      <button class="ss-btn" onclick="closeStatSheet();openSettingsPage()">Изменить бюджет</button>
    </div>`);
}

export function openDaysSheet() {
  const user = STATE.user; if (!user) return;
  const exps = STATE.exps || [];
  const fa   = getFinancialAge(user, exps, STATE.incomes || []);
  const tiers = [
    { days: 30,  name: 'Подушка',  desc: '1 месяц запаса' },
    { days: 90,  name: 'Свободен', desc: '3 месяца запаса' },
    { days: 180, name: 'Крепость', desc: '6 месяцев запаса' },
  ];
  const tiersHtml = tiers.map(t => {
    const done = fa.days >= t.days;
    const pct  = Math.min(Math.round(fa.days / t.days * 100), 100);
    return `<div class="ss-tier ${done ? 'done' : ''}">
      <div class="ss-tier-head">
        <span class="ss-tier-name">${t.name}</span>
        <span class="ss-tier-desc">${t.desc}</span>
        ${done ? '<span class="ss-tier-badge">✓</span>' : `<span class="ss-tier-pct">${pct}%</span>`}
      </div>
      <div class="fp-xp-bar-wrap" style="margin-top:6px">
        <div class="fp-xp-bar" style="width:${pct}%;${done ? 'background:var(--green)' : ''}"></div>
      </div>
    </div>`;
  }).join('');

  _openStatSheet(`
    <div class="ss-hero">
      <div class="ss-title">Запас дней</div>
      <div class="ss-big" style="color:var(--gold)">${fa.days > 0 ? fa.days : '—'}</div>
      <div class="ss-sub">${fa.days > 0 ? 'дней финансового буфера' : 'недостаточно данных'}</div>
    </div>
    <div class="ss-rows">
      <div class="ss-row ss-row-hint">Сколько дней ты можешь прожить на свои текущие сбережения при обычных расходах</div>
    </div>
    <div class="ss-section-title">Цели запаса</div>
    <div class="ss-tiers">${tiersHtml}</div>`);
}

export function openGoalsSheet() {
  const user  = STATE.user; if (!user) return;
  const goals = user.savingsGoals || [];

  const goalsHtml = goals.length === 0
    ? '<div class="ss-empty">Нет целей накопления.<br>Добавь первую!</div>'
    : goals.map(g => {
        const pct  = Math.min(Math.round((g.saved || 0) / g.target * 100), 100);
        const done = (g.saved || 0) >= g.target;
        return `<div class="ss-goal ${done ? 'done' : ''}">
          <div class="ss-goal-head">
            <span class="ss-goal-name">${g.name}</span>
            <span class="ss-goal-pct ${done ? 'done' : ''}">${done ? '✓ Готово' : pct + '%'}</span>
          </div>
          <div class="fp-xp-bar-wrap" style="margin:6px 0 4px">
            <div class="fp-xp-bar" style="width:${pct}%;${done ? 'background:var(--green)' : ''}"></div>
          </div>
          <div class="ss-goal-amounts">
            <span>${fmt(g.saved || 0)}</span><span>${fmt(g.target)}</span>
          </div>
          ${!done ? `<button class="ss-deposit-btn" onclick="depositSavingsGoal('${g.id}')">+ Пополнить</button>` : ''}
        </div>`;
      }).join('');

  _openStatSheet(`
    <div class="ss-hero">
      <div class="ss-title">Цели накопления</div>
      <div class="ss-big" style="color:var(--ac)">${goals.length}</div>
      <div class="ss-sub">${goals.filter(g => (g.saved||0) >= g.target).length} из ${goals.length} выполнено</div>
    </div>
    <div class="ss-goals-list">${goalsHtml}</div>
    <div class="ss-footer">
      <button class="ss-btn" onclick="closeStatSheet();addSavingsGoal()">+ Добавить цель</button>
    </div>`);
}

/* ── Receipt scanner ── */

let _receiptItems = [];

export function openReceiptSheet() {
  closeModal();
  document.getElementById('receipt-overlay').classList.add('open');
  document.getElementById('receipt-sheet').classList.add('open');
  _setReceiptState('idle');
}

export function closeReceiptSheet() {
  document.getElementById('receipt-overlay').classList.remove('open');
  document.getElementById('receipt-sheet').classList.remove('open');
  _receiptItems = [];
}

function _resc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _setReceiptState(state, errMsg) {
  const body = document.getElementById('receipt-body');
  if (!body) return;

  if (state === 'idle') {
    body.innerHTML = `
      <div class="rc-idle">
        <div class="rc-idle-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/><path d="M15 15l-2-2-2 2"/></svg>
        </div>
        <div class="rc-idle-title">Сканировать чек</div>
        <div class="rc-idle-sub">AI распознает товары и расставит категории автоматически</div>
        <div class="rc-idle-btns">
          <button class="rc-upload-btn rc-cam-btn" onclick="openReceiptCamera()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Камера
          </button>
          <label class="rc-upload-btn" for="receipt-file-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Скриншот
          </label>
        </div>
        <input type="file" id="receipt-file-input" accept="image/*" style="display:none" onchange="processReceiptImage(this)">
      </div>`;
  } else if (state === 'loading') {
    body.innerHTML = `
      <div class="rc-loading">
        <div class="rc-spinner"></div>
        <div class="rc-loading-title rc-loading-text">Читаю файл…</div>
        <div class="rc-loading-sub">Gemini AI читает позиции и определяет категории</div>
      </div>`;
  } else if (state === 'error') {
    body.innerHTML = `
      <div class="rc-idle">
        <div class="rc-idle-icon" style="color:var(--red)">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="rc-idle-title">Не удалось распознать</div>
        <div class="rc-idle-sub">${_resc(errMsg || 'Попробуй ещё раз')}</div>
        <div class="rc-idle-btns">
          <button class="rc-upload-btn rc-cam-btn" onclick="openReceiptCamera()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Камера
          </button>
          <label class="rc-upload-btn" for="receipt-file-input2">Скриншот</label>
        </div>
        <input type="file" id="receipt-file-input2" accept="image/*" style="display:none" onchange="processReceiptImage(this)">
      </div>`;
  } else if (state === 'results') {
    _renderReceiptResults();
  }
}

function _catOptions(selected) {
  return CATS.map(c =>
    `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.name}</option>`
  ).join('');
}

function _renderReceiptResults() {
  const body = document.getElementById('receipt-body');
  if (!body) return;
  const total = _receiptItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const rows = _receiptItems.map((item, idx) => `
    <div class="rc-item" id="rc-item-${idx}">
      <select class="rc-cat-sel" onchange="updateReceiptCat(${idx},this.value)">
        ${_catOptions(item.cat)}
      </select>
      <div class="rc-item-mid">
        <div class="rc-item-name">${_resc(item.name)}</div>
        <div class="rc-item-amt">${fmt(item.amount)}</div>
      </div>
      <button class="rc-item-del" onclick="removeReceiptItem(${idx})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  body.innerHTML = `
    <div class="rc-results">
      <div class="rc-count">${_receiptItems.length} позиций · итого ${fmt(total)}</div>
      <div class="rc-list">${rows}</div>
    </div>`;

  const footer = document.getElementById('receipt-footer');
  if (footer) {
    footer.style.display = '';
    footer.innerHTML = `
      <label class="rc-rescan-btn" for="receipt-file-input3">Другой скрин</label>
      <input type="file" id="receipt-file-input3" accept="image/*" style="display:none" onchange="processReceiptImage(this)">
      <button class="rc-save-btn" onclick="saveReceiptItems()">
        Сохранить ${_receiptItems.length} ${_receiptItems.length === 1 ? 'трату' : _receiptItems.length < 5 ? 'траты' : 'трат'}
      </button>`;
  }
}

function _setReceiptLoadingText(text) {
  const el = document.querySelector('.rc-loading-text');
  if (el) el.textContent = text;
}

function _fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Ошибка чтения файла'));
    r.readAsDataURL(file);
  });
}

async function _sendFileToGemini(file) {
  _setReceiptLoadingText(`Читаю файл (${Math.round(file.size / 1024)} КБ)…`);
  const base64 = await _fileToBase64(file);

  const { data: { session } } = await supa.auth.getSession();
  if (!session) throw new Error('Не авторизован');

  _setReceiptLoadingText('Анализирую чек…');
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 55000);
  let resp;
  try {
    resp = await fetch('/api/scan-receipt', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({ image: base64, mimeType: file.type || 'image/jpeg' }),
    });
  } finally { clearTimeout(tid); }

  let data;
  try { data = await resp.json(); } catch {
    throw new Error(`Сервер вернул ошибку (${resp.status})`);
  }
  if (!resp.ok || data.error) throw new Error(data.detail || data.error || `HTTP ${resp.status}`);
  _receiptItems = (data.items || []).filter(i => i && i.amount > 0);
  if (!_receiptItems.length) throw new Error('Позиции не найдены — попробуй другой скрин');
  _setReceiptState('results');
}

export async function processReceiptImage(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    _setReceiptState('error', 'Файл слишком большой — используй кнопку Камера');
    return;
  }
  _setReceiptState('loading');
  document.getElementById('receipt-footer')?.style.setProperty('display', 'none');
  try {
    await _sendFileToGemini(file);
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Превышено время ожидания — попробуй через камеру' : err.message;
    _setReceiptState('error', msg);
  }
}

let _camStream = null;

export async function openReceiptCamera() {
  const body = document.getElementById('receipt-body');
  if (!body) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    // No camera API — fall back to file input
    document.getElementById('receipt-file-input')?.click();
    return;
  }
  try {
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    body.innerHTML = `
      <div class="rc-camera">
        <video id="rc-video" autoplay playsinline muted></video>
        <div class="rc-cam-actions">
          <button class="rc-rescan-btn" onclick="closeReceiptCamera()">Отмена</button>
          <button class="rc-capture-btn" onclick="captureReceiptPhoto()">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
          </button>
          <div style="width:72px"></div>
        </div>
      </div>`;
    document.getElementById('rc-video').srcObject = _camStream;
  } catch {
    _setReceiptState('error', 'Нет доступа к камере — разреши в настройках');
  }
}

export function closeReceiptCamera() {
  _camStream?.getTracks().forEach(t => t.stop());
  _camStream = null;
  _setReceiptState('idle');
}

export function captureReceiptPhoto() {
  const video = document.getElementById('rc-video');
  if (!video) return;

  const MAX = 900;
  let w = video.videoWidth || 640;
  let h = video.videoHeight || 480;
  if (w > MAX || h > MAX) {
    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
    else        { w = Math.round(w * MAX / h); h = MAX; }
  }

  _camStream?.getTracks().forEach(t => t.stop());
  _camStream = null;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);

  _setReceiptState('loading');
  document.getElementById('receipt-footer')?.style.setProperty('display', 'none');

  canvas.toBlob(async (blob) => {
    if (!blob) { _setReceiptState('error', 'Не удалось сделать снимок'); return; }
    try {
      await _sendFileToGemini(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Превышено время ожидания — попробуй ещё раз' : err.message;
      _setReceiptState('error', msg);
    }
  }, 'image/jpeg', 0.82);
}

export function updateReceiptCat(idx, cat) {
  if (_receiptItems[idx]) _receiptItems[idx].cat = cat;
}

export function removeReceiptItem(idx) {
  _receiptItems.splice(idx, 1);
  if (!_receiptItems.length) {
    _setReceiptState('idle');
    const footer = document.getElementById('receipt-footer');
    if (footer) footer.style.display = 'none';
  } else {
    _renderReceiptResults();
  }
}

export async function saveReceiptItems() {
  if (!_receiptItems.length) return;
  const btn = document.querySelector('.rc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Сохраняем...'; }

  const today = toDay();
  for (const item of _receiptItems) {
    const amt = parseFloat(item.amount);
    if (!amt || amt <= 0) continue;
    const exp = {
      id:     Date.now() + Math.random(),
      cat:    item.cat || 'other',
      amount: amt,
      note:   item.name || '',
      date:   today,
    };
    DB.addExp(exp);
    addXP(5);
    await _insertExpense(exp);
  }

  await checkQuestCompletion();
  checkAchievements();
  renderAll();
  closeReceiptSheet();
  setTimeout(showPostExpenseNudge, 600);
}
