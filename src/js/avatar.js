import { COLOR_SWATCHES, PRESET_AVATARS, AVATAR_FRAMES } from './config.js';
import { DB, AUTH, supa } from './api.js';
import { _syncUser } from './api.js';
import { renderAvatarEl } from './render.js';

let _avatarPickerTab = 'color';
let _avatarDraft     = { type: 'color', value: '#4ECCA3', frame: 'none' };
let _photoUploadFile = null;

export function openAvatarPicker() {
  const user = DB.getUser(); if (!user) return;
  _avatarDraft     = { type: user.avatarType || 'color', value: user.avatarValue || '#4ECCA3', frame: user.avatarFrame || 'none' };
  _photoUploadFile = null;
  const startTab = user.avatarType === 'preset' ? 'style' : user.avatarType === 'photo' ? 'photo' : 'color';
  switchAvatarTab(startTab);
  _renderAvatarPickerContent();
  document.getElementById('av-picker-overlay').classList.add('open');
}

export function closeAvatarPicker() {
  document.getElementById('av-picker-overlay').classList.remove('open');
}

export function switchAvatarTab(tab) {
  _avatarPickerTab = tab;
  ['color', 'style', 'photo'].forEach(t => {
    document.getElementById('avt-btn-' + t)?.classList.toggle('active', t === tab);
    document.getElementById('avt-pane-' + t)?.classList.toggle('active', t === tab);
  });
}

function _renderAvatarPickerContent() {
  _renderColorSwatches();
  _renderPresetGrid();
  _renderFramePicker();
  _renderPickerPhotoPreview();
}

function _renderColorSwatches() {
  const wrap = document.getElementById('av-color-swatches'); if (!wrap) return;
  const cur = (_avatarDraft.type === 'color') ? _avatarDraft.value : '';
  wrap.innerHTML = COLOR_SWATCHES.map(c =>
    `<div class="color-swatch${c === cur ? ' selected' : ''}" style="background:${c}" onclick="selectAvatarColor('${c}')"></div>`
  ).join('') + `<div class="av-custom-color-row"><span>Другой:</span><input type="color" value="${cur || '#4ECCA3'}" oninput="selectAvatarColor(this.value)"></div>`;
}

export function selectAvatarColor(hex) {
  _avatarDraft = { ..._avatarDraft, type: 'color', value: hex };
  _renderColorSwatches();
}

function _renderPresetGrid() {
  const wrap = document.getElementById('av-preset-grid'); if (!wrap) return;
  wrap.innerHTML = PRESET_AVATARS.map(p =>
    `<div class="preset-item${_avatarDraft.type === 'preset' && _avatarDraft.value === p.id ? ' selected' : ''}" onclick="selectPresetAvatar('${p.id}')">${p.svg}</div>`
  ).join('');
}

export function selectPresetAvatar(id) {
  _avatarDraft = { ..._avatarDraft, type: 'preset', value: id };
  _renderPresetGrid();
}

function _renderPickerPhotoPreview() {
  const wrap = document.getElementById('av-photo-preview'); if (!wrap) return;
  if (_avatarDraft.type === 'photo' && _avatarDraft.value && !_photoUploadFile) {
    wrap.innerHTML = `<img src="${_avatarDraft.value}" alt="">`;
  } else {
    const user = DB.getUser();
    wrap.innerHTML = `<span style="font-size:28px;font-weight:800;color:var(--ac)">${(user?.name || '?').charAt(0).toUpperCase()}</span>`;
  }
}

export async function handleAvatarPhotoUpload(input) {
  const file = input.files?.[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Файл слишком большой (макс. 5 МБ)'); return; }
  _photoUploadFile = file;
  _avatarDraft = { ..._avatarDraft, type: 'photo' };
  const wrap = document.getElementById('av-photo-preview');
  if (wrap) wrap.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
}

function _renderFramePicker() {
  const wrap = document.getElementById('av-frame-grid'); if (!wrap) return;
  const prem = window.isPremium ? window.isPremium() : false;
  wrap.innerHTML = AVATAR_FRAMES.map(f => {
    const locked = f.premium && !prem;
    const sel    = _avatarDraft.frame === f.id;
    return `<div class="frame-item${sel ? ' selected' : ''}" onclick="${locked ? 'showPremiumScreen()' : 'selectAvatarFrame(\'' + f.id + '\')'}">
      <div class="frame-demo frame-${f.id}" style="position:relative">
        <div class="frame-demo-inner">${sel ? '✓' : ''}</div>
        ${locked ? '<div class="frame-lock-badge">✦</div>' : ''}
      </div>
      <span class="frame-item-lbl">${f.name}</span>
    </div>`;
  }).join('');
}

export function selectAvatarFrame(id) {
  _avatarDraft = { ..._avatarDraft, frame: id };
  _renderFramePicker();
}

export async function saveAvatar() {
  const user = DB.getUser(); if (!user) return;
  const btn = document.getElementById('av-save-btn');
  if (btn) { btn.textContent = 'Сохраняю...'; btn.disabled = true; }
  let finalValue = _avatarDraft.value;
  if (_avatarDraft.type === 'photo' && _photoUploadFile) {
    try {
      const ext  = _photoUploadFile.name.split('.').pop() || 'jpg';
      const path = `${AUTH.uid}/avatar.${ext}`;
      const { error: upErr } = await supa.storage.from('avatars').upload(path, _photoUploadFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supa.storage.from('avatars').getPublicUrl(path);
      finalValue = urlData.publicUrl + '?t=' + Date.now();
    } catch(e) {
      alert('Ошибка загрузки: ' + (e.message || 'попробуй ещё раз'));
      if (btn) { btn.textContent = 'Сохранить'; btn.disabled = false; }
      return;
    }
  }
  const prem = window.isPremium ? window.isPremium() : false;
  user.avatarType  = _avatarDraft.type;
  user.avatarValue = finalValue;
  user.avatarFrame = prem ? _avatarDraft.frame : 'none';
  DB.setUser(user);
  await _syncUser(user);
  renderAvatarEl();
  closeAvatarPicker();
  if (btn) { btn.textContent = 'Сохранить'; btn.disabled = false; }
}
