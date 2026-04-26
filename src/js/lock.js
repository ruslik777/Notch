/* ── App Lock: PIN + Biometric ── */

let _lockPin = '';
let _lockCb  = null;

async function _hashPin(pin) {
  const data = new TextEncoder().encode(pin + '_notch_lock_v1');
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _b642buf(b64) {
  const bin = atob(b64); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function _dots(id, n) {
  document.querySelectorAll(`#${id} .lock-dot`).forEach((d, i) => d.classList.toggle('filled', i < n));
}

function _shake(id) {
  const el = document.getElementById(id);
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

/* ── Lock Screen ── */

export function hasPin() { return !!localStorage.getItem('app_pin_hash'); }

export function showLock(onUnlock) {
  _lockCb  = onUnlock;
  _lockPin = '';
  document.getElementById('lock-error').textContent = '';
  _dots('lock-dots', 0);

  const el = document.getElementById('lock-screen');
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('visible'));

  // Show bio button if available
  const bioBtn = document.getElementById('lp-bio-btn');
  if (bioBtn) {
    const hasBio = localStorage.getItem('bio_enabled') === '1' && localStorage.getItem('bio_cred_id');
    bioBtn.style.visibility = hasBio ? 'visible' : 'hidden';
    if (hasBio) setTimeout(() => lockBioTap(), 350);
  }
}

function _hideLock() {
  const el = document.getElementById('lock-screen');
  el.classList.remove('visible');
  setTimeout(() => { el.style.display = 'none'; }, 280);
}

export function lockPadTap(d) {
  if (_lockPin.length >= 4) return;
  _lockPin += d;
  _dots('lock-dots', _lockPin.length);
  document.getElementById('lock-error').textContent = '';
  if (_lockPin.length === 4) setTimeout(_verifyPin, 80);
}

export function lockPadDel() {
  if (!_lockPin.length) return;
  _lockPin = _lockPin.slice(0, -1);
  _dots('lock-dots', _lockPin.length);
}

async function _verifyPin() {
  const stored  = localStorage.getItem('app_pin_hash');
  const entered = await _hashPin(_lockPin);
  if (entered === stored) {
    _hideLock();
    if (_lockCb) _lockCb();
  } else {
    _lockPin = '';
    _dots('lock-dots', 0);
    _shake('lock-dots');
    document.getElementById('lock-error').textContent = 'Неверный PIN';
  }
}

export async function lockBioTap() {
  const credId = localStorage.getItem('bio_cred_id');
  if (!credId) return;
  const btn = document.getElementById('lp-bio-btn');
  if (btn) btn.style.opacity = '.5';
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        userVerification: 'required',
        allowCredentials: [{ id: _b642buf(credId), type: 'public-key' }],
        timeout: 60000,
      }
    });
    if (assertion) { _hideLock(); if (_lockCb) _lockCb(); }
  } catch(e) {
    if (e.name !== 'NotAllowedError') {
      document.getElementById('lock-error').textContent = 'Биометрия не прошла';
    }
  } finally {
    if (btn) btn.style.opacity = '';
  }
}

export function lockSignOut() {
  _hideLock();
  if (window.signOut) window.signOut();
}

/* ── PIN Setup ── */

let _setupStage = 1;
let _setupFirst = '';
let _setupPin   = '';
let _setupCb    = null;

export function startPinSetup(onDone) {
  _setupCb    = onDone;
  _setupStage = 1;
  _setupFirst = '';
  _setupPin   = '';
  _syncSetupUI();
  const el = document.getElementById('pin-setup-screen');
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('visible'));
}

function _syncSetupUI() {
  _setupPin = '';
  _dots('pin-setup-dots', 0);
  document.getElementById('pin-setup-error').textContent = '';
  document.getElementById('pin-setup-title').textContent =
    _setupStage === 1 ? 'Придумай PIN-код' : 'Повтори PIN-код';
  document.getElementById('pin-setup-sub').textContent =
    _setupStage === 1 ? 'Введи 4 цифры для защиты приложения' : 'Введи тот же PIN ещё раз';
}

function _hideSetup() {
  const el = document.getElementById('pin-setup-screen');
  el.classList.remove('visible');
  setTimeout(() => { el.style.display = 'none'; }, 280);
}

export function pinSetupTap(d) {
  if (_setupPin.length >= 4) return;
  _setupPin += d;
  _dots('pin-setup-dots', _setupPin.length);
  if (_setupPin.length === 4) setTimeout(_handleSetup, 80);
}

export function pinSetupDel() {
  if (!_setupPin.length) return;
  _setupPin = _setupPin.slice(0, -1);
  _dots('pin-setup-dots', _setupPin.length);
}

async function _handleSetup() {
  if (_setupStage === 1) {
    _setupFirst = _setupPin;
    _setupStage = 2;
    _syncSetupUI();
  } else {
    if (_setupPin === _setupFirst) {
      localStorage.setItem('app_pin_hash', await _hashPin(_setupPin));
      _hideSetup();
      if (_setupCb) _setupCb();
    } else {
      _shake('pin-setup-dots');
      document.getElementById('pin-setup-error').textContent = 'PIN не совпадает — попробуй снова';
      setTimeout(() => { _setupStage = 1; _setupFirst = ''; _syncSetupUI(); }, 1300);
    }
  }
}

export function pinSetupSkip() {
  localStorage.setItem('app_pin_skip', '1');
  _hideSetup();
  if (_setupCb) _setupCb();
}

export function openPinChange() {
  localStorage.removeItem('app_pin_skip');
  startPinSetup(() => {});
}

export function removePin() {
  localStorage.removeItem('app_pin_hash');
  localStorage.removeItem('app_pin_skip');
}
