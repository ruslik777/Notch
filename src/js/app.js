import { STATE, DB, AUTH, supa, loadState, updateExchangeRates } from './api.js';
import { renderAll, renderHome, renderProfile, renderFixedExps, renderSavingsGoals } from './render.js';
import { renderFriendsTab } from './friends.js';
import {
  checkStreak, loadLeague,
  setAnalyticsPeriod, renderInsights,
} from './gamification.js';
import {
  initSW, scheduleStreakReminder,
  updateNotifToggle, toggleNotifications,
  renderCharPicker, setNotifChar,
  updateBioToggle, toggleBioFromProfile,
} from './notifications.js';
import {
  openModal, closeModal, handleOverlayClick, selectCat, validateForm, buildCatGrid,
  openEditById, saveExpense, deleteExpense,
  openIncomeModal, closeIncomeModal, handleIncomeOverlayClick, buildIncomeTypeGrid,
  selectIncomeType, validateIncomeForm, saveIncome,
  openSettings, closeSettings, handleSettingsOverlay, saveSettings,
  setCurrency,
  addSavingsGoal, removeSavingsGoal, depositSavingsGoal,
  addFixedExp, removeFixedExp,
  buildQuickTemplates, applyQuickTemplate,
  exportCSV,
  showInfo, closeInfo,
  showTour, closeTour,
  shareAchievement, closeShareOverlay,
  openScanner, closeScanner,
} from './modals.js';
import {
  submitAuth, signOut, confirmReset, switchAuthTab,
  obNext, obFinish,
  isBioAvailable, initBioButton, loginWithBiometric,
  offerBioSetup, enableBiometric, dismissBioSetup,
} from './auth.js';
import {
  hasPin, showLock, lockPadTap, lockPadDel, lockBioTap, lockSignOut,
  startPinSetup, pinSetupTap, pinSetupDel, pinSetupSkip,
  openPinChange, removePin,
} from './lock.js';
import {
  openAvatarPicker, closeAvatarPicker, switchAvatarTab,
  selectAvatarColor, selectPresetAvatar, selectAvatarFrame,
  handleAvatarPhotoUpload, saveAvatar,
} from './avatar.js';
import {
  copyNotchId, searchFriend, sendFriendReq,
  acceptFriendReq, declineFriendReq, cancelFriendReq, removeFriend,
} from './friends.js';
import { _bioLabel } from './notifications.js';

/* ── Navigation ── */

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

export function switchTab(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pane-' + tab).classList.add('active');
  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');
  document.getElementById('tab-content').scrollTop = 0;
  renderAll();
  if (tab === 'quests')  loadLeague();
  if (tab === 'profile') { updateNotifToggle(); updateBioToggle(); renderCharPicker(); }
}

export function switchProfileTab(tab) {
  ['me', 'friends', 'settings', 'data'].forEach(t => {
    const pane = document.getElementById('ptab-' + t);
    const btn  = document.getElementById('ptab-btn-' + t);
    if (!pane || !btn) return;
    const active = t === tab;
    pane.style.display = active ? '' : 'none';
    btn.classList.toggle('active', active);
  });
  if (tab === 'settings') {
    renderCharPicker(); updateNotifToggle(); updateBioToggle(); renderFixedExps(); renderSavingsGoals();
    const t = localStorage.getItem('notch-theme') || 'system';
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.t === t));
    const pinBtn = document.getElementById('pin-mgmt-btn');
    const pinSub = document.getElementById('pin-status-sub');
    if (pinBtn) pinBtn.textContent = hasPin() ? 'Изменить' : 'Установить';
    if (pinSub) pinSub.textContent = hasPin() ? 'Установлен — нажми чтобы изменить' : 'Защита при каждом входе';
  }
  if (tab === 'friends')  { renderFriendsTab(); }
}

/* ── Theme ── */

export function setTheme(pref) {
  localStorage.setItem('notch-theme', pref);
  const isDark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.t === pref);
  });
}

/* ── Premium ── */

export function isPremium() { return !!(STATE.user?.premium); }

export function showPremiumScreen()  { document.getElementById('premium-overlay').classList.add('open'); }
export function closePremiumScreen() { document.getElementById('premium-overlay').classList.remove('open'); }

/* ── Init ── */

async function init() {
  buildCatGrid();
  buildIncomeTypeGrid();

  document.getElementById('ob-name').addEventListener('input', e => {
    document.getElementById('ob1-btn').disabled = e.target.value.trim().length < 2;
  });
  document.getElementById('ob-income').addEventListener('input', e => {
    document.getElementById('ob2-btn').disabled = !parseFloat(e.target.value);
  });
  document.getElementById('ob-savings').addEventListener('input', () => {
    document.getElementById('ob3-btn').disabled = false;
  });
  document.getElementById('exp-amount').addEventListener('input', validateForm);
  document.getElementById('inc-amount').addEventListener('input', validateIncomeForm);

  document.getElementById('ob-name').addEventListener('keydown', e => { if (e.key === 'Enter' && !document.getElementById('ob1-btn').disabled) obNext(1); });
  document.getElementById('ob-income').addEventListener('keydown', e => { if (e.key === 'Enter' && !document.getElementById('ob2-btn').disabled) obNext(2); });
  document.getElementById('ob-savings').addEventListener('keydown', e => { if (e.key === 'Enter') obFinish(); });
  document.getElementById('auth-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('auth-password').focus(); });
  document.getElementById('auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });

  initSW();
  initBioButton();
  updateNotifToggle();
  updateExchangeRates();

  // sync system theme changes when in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('notch-theme') || 'system') === 'system') setTheme('system');
  });

  // re-lock when app comes back to foreground
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !AUTH.uid || !hasPin()) return;
    const lockEl = document.getElementById('lock-screen');
    if (lockEl && lockEl.style.display !== 'none') return;
    showLock(() => {});
  });

  const urlAction = new URLSearchParams(location.search).get('action');
  const { data: { session } } = await supa.auth.getSession();

  if (session) {
    AUTH.uid   = session.user.id;
    AUTH.email = session.user.email;
    const hasProfile = await loadState();
    if (hasProfile && STATE.user?.onboardingDone) {
      const checked = checkStreak(STATE.user);
      DB.setUser(checked);
      const goMain = () => {
        showScreen('main');
        renderAll();
        loadLeague();
        scheduleStreakReminder();
        if (urlAction === 'add-expense') setTimeout(openModal, 300);
      };
      if (hasPin()) {
        showScreen('main'); // render behind lock
        renderAll();
        showLock(goMain);
      } else if (!localStorage.getItem('app_pin_skip')) {
        goMain();
        setTimeout(() => startPinSetup(() => {}), 600);
      } else {
        goMain();
      }
    } else {
      showScreen('ob');
    }
  } else {
    showScreen('auth');
  }

  const splash = document.getElementById('splash');
  splash.style.opacity       = '0';
  splash.style.pointerEvents = 'none';
  setTimeout(() => splash.remove(), 300);
}

document.addEventListener('DOMContentLoaded', init);

/* ── Expose all functions called from HTML onclick attributes ── */

Object.assign(window, {
  // navigation
  showScreen, switchTab, switchProfileTab,

  // premium
  isPremium, showPremiumScreen, closePremiumScreen,

  // expense modal
  openModal, closeModal, handleOverlayClick,
  selectCat, validateForm,
  openEditById, saveExpense, deleteExpense,
  openScanner, closeScanner,

  // income modal
  openIncomeModal, closeIncomeModal, handleIncomeOverlayClick,
  selectIncomeType, validateIncomeForm, saveIncome,

  // settings
  openSettings, closeSettings, handleSettingsOverlay, saveSettings,
  setTheme,

  // currency
  setCurrency,

  // savings goals
  addSavingsGoal, removeSavingsGoal, depositSavingsGoal,

  // fixed expenses
  addFixedExp, removeFixedExp,

  // quick templates
  applyQuickTemplate,

  // export
  exportCSV,

  // info
  showInfo, closeInfo,

  // tour
  showTour, closeTour,

  // share
  shareAchievement, closeShareOverlay,

  // auth
  submitAuth, signOut, confirmReset, switchAuthTab,
  obNext, obFinish,
  loginWithBiometric, enableBiometric, dismissBioSetup,

  // avatar
  openAvatarPicker, closeAvatarPicker, switchAvatarTab,
  selectAvatarColor, selectPresetAvatar, selectAvatarFrame,
  handleAvatarPhotoUpload, saveAvatar,

  // friends
  copyNotchId, searchFriend, sendFriendReq,
  acceptFriendReq, declineFriendReq, cancelFriendReq, removeFriend,

  // notifications
  toggleNotifications, setNotifChar,
  updateNotifToggle, updateBioToggle,

  // biometric (used by notifications.js toggleBioFromProfile via window)
  isBioAvailable, offerBioSetup,
  toggleBioFromProfile,

  // lock screen
  lockPadTap, lockPadDel, lockBioTap, lockSignOut,
  pinSetupTap, pinSetupDel, pinSetupSkip,
  openPinChange, removePin,

  // analytics
  setAnalyticsPeriod,

  // render (used by api.js _applyRates, modals addFixedExp/removeFixedExp)
  renderAll, renderHome,

  // league
  loadLeague, scheduleStreakReminder,

  // helpers used by notifications.js
  _bioLabel,
});
