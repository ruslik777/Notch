#!/usr/bin/env python3
"""Patch: friends system - Notch ID, search, add/accept/remove."""

with open('app.html', 'r', encoding='utf-8') as f:
    src = f.read()
orig = src

# ── 1. CSS: friend styles ──────────────────────────────────────────────────
CSS_ANCHOR = '    .char-option.active .char-option-name { color:var(--ac); }'
assert CSS_ANCHOR in src, 'CSS anchor not found'

CSS_FRIENDS = CSS_ANCHOR + """
    /* ── FRIENDS ── */
    .notch-id-badge { display:flex; align-items:center; gap:12px; margin:16px 16px 8px; background:var(--s1); border:1px solid var(--brd); border-radius:14px; padding:14px 16px; }
    .notch-id-code { font-family:'Courier New',monospace; font-size:22px; font-weight:800; letter-spacing:.18em; color:var(--ac); flex:1; }
    .notch-id-copy { border:none; background:var(--a20); color:var(--ac); font-size:12px; font-weight:700; padding:8px 14px; border-radius:10px; cursor:pointer; font-family:'Archivo',sans-serif; flex-shrink:0; transition:opacity .15s; }
    .notch-id-copy:active { opacity:.6; }
    .friend-search-wrap { margin:0 16px 4px; display:flex; gap:8px; }
    .friend-search-input { flex:1; background:var(--s1); border:1px solid var(--brd); border-radius:12px; padding:12px 14px; color:var(--text); font-size:15px; font-family:'Archivo',sans-serif; outline:none; letter-spacing:.08em; font-weight:700; }
    .friend-search-input::placeholder { color:var(--t3); font-weight:400; letter-spacing:0; }
    .friend-search-input:focus { border-color:var(--ac); }
    .friend-search-btn { background:var(--ac); color:#0B0F14; border:none; border-radius:12px; padding:12px 20px; font-weight:700; font-size:13px; cursor:pointer; font-family:'Archivo',sans-serif; flex-shrink:0; }
    .friend-search-result { margin:8px 16px 0; background:var(--s1); border:1px solid var(--brd); border-radius:14px; padding:14px 16px; display:none; }
    .friend-card { display:flex; align-items:center; gap:12px; padding:12px 16px; margin:0 16px 8px; background:var(--s1); border:1px solid var(--brd); border-radius:14px; }
    .friend-card-av { width:40px; height:40px; border-radius:50%; background:var(--a20); color:var(--ac); font-size:16px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .friend-card-info { flex:1; min-width:0; }
    .friend-card-name { font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .friend-card-sub { font-size:11px; color:var(--t2); margin-top:2px; }
    .fcbtn { border:none; border-radius:10px; padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Archivo',sans-serif; flex-shrink:0; }
    .fcbtn.add  { background:var(--ac); color:#0B0F14; }
    .fcbtn.pend { background:var(--s2); color:var(--t2); pointer-events:none; }
    .fcbtn.deny { background:var(--s2); color:var(--t3); font-size:14px; padding:8px 10px; }
    .friends-section-lbl { font-size:11px; font-weight:700; color:var(--t2); text-transform:uppercase; letter-spacing:.06em; margin:14px 16px 6px; }
    .friends-empty { font-size:13px; color:var(--t2); margin:6px 16px 12px; line-height:1.5; }"""

src = src.replace(CSS_ANCHOR, CSS_FRIENDS, 1)

# ── 2. Profile tabs: add Друзья (4th tab) ────────────────────────────────
OLD_TABS = """        <div class="profile-tabs">
          <button class="profile-tab active" id="ptab-btn-me" onclick="switchProfileTab('me')">Я</button>
          <button class="profile-tab" id="ptab-btn-settings" onclick="switchProfileTab('settings')">Настройки</button>
          <button class="profile-tab" id="ptab-btn-data" onclick="switchProfileTab('data')">Данные</button>
        </div>"""

NEW_TABS = """        <div class="profile-tabs" style="font-size:11.5px">
          <button class="profile-tab active" id="ptab-btn-me" onclick="switchProfileTab('me')">Я</button>
          <button class="profile-tab" id="ptab-btn-friends" onclick="switchProfileTab('friends')">Друзья</button>
          <button class="profile-tab" id="ptab-btn-settings" onclick="switchProfileTab('settings')">Настройки</button>
          <button class="profile-tab" id="ptab-btn-data" onclick="switchProfileTab('data')">Данные</button>
        </div>"""

assert OLD_TABS in src, 'OLD_TABS not found'
src = src.replace(OLD_TABS, NEW_TABS, 1)

# ── 3. HTML: friends tab pane (before Данные tab) ─────────────────────────
OLD_DATA_PANE = """        <!-- TAB: Данные -->
        <div class="profile-tab-pane" id="ptab-data" style="display:none">
          <div class="profile-actions">
            <div class="profile-action" onclick="exportCSV()">Экспорт данных (CSV)</div>
            <div class="profile-action" onclick="signOut()">Выйти из аккаунта</div>
            <div class="profile-action danger" onclick="confirmReset()">Сбросить все данные</div>
          </div>
        </div>
      </div>"""

NEW_DATA_PANE = """        <!-- TAB: Друзья -->
        <div class="profile-tab-pane" id="ptab-friends" style="display:none">
          <div class="notch-id-badge">
            <div>
              <div style="font-size:10px;color:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Твой Notch ID</div>
              <div class="notch-id-code" id="my-notch-id">——</div>
            </div>
            <button class="notch-id-copy" onclick="copyNotchId()">Скопировать</button>
          </div>
          <div style="margin:14px 16px 8px"><div class="achiev-title">Найти друга по ID</div></div>
          <div class="friend-search-wrap">
            <input class="friend-search-input" id="friend-search-input" type="text"
              placeholder="ABC123" maxlength="6"
              oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')">
            <button class="friend-search-btn" onclick="searchFriend()">Найти</button>
          </div>
          <div class="friend-search-result" id="friend-search-result"></div>
          <div id="friends-list-wrap"></div>
          <div style="height:32px"></div>
        </div>

        <!-- TAB: Данные -->
        <div class="profile-tab-pane" id="ptab-data" style="display:none">
          <div class="profile-actions">
            <div class="profile-action" onclick="exportCSV()">Экспорт данных (CSV)</div>
            <div class="profile-action" onclick="signOut()">Выйти из аккаунта</div>
            <div class="profile-action danger" onclick="confirmReset()">Сбросить все данные</div>
          </div>
        </div>
      </div>"""

assert OLD_DATA_PANE in src, 'OLD_DATA_PANE not found'
src = src.replace(OLD_DATA_PANE, NEW_DATA_PANE, 1)

# ── 4. loadState: add notchId ─────────────────────────────────────────────
OLD_LOAD = """    savingsGoals:     p.savings_goals     || [],
  };"""
NEW_LOAD = """    savingsGoals:     p.savings_goals     || [],
    notchId:          p.notch_id          || '',
  };"""
assert OLD_LOAD in src, 'OLD_LOAD not found'
src = src.replace(OLD_LOAD, NEW_LOAD, 1)

# ── 5. obFinish: generate notchId + add to upsert + STATE.user ────────────
OLD_OB_UPSERT = """  const { error } = await supa.from('profiles').upsert({
    id:               currentUID,
    name,"""
NEW_OB_UPSERT = """  const _newNotchId = generateNotchId();
  const { error } = await supa.from('profiles').upsert({
    id:               currentUID,
    name,"""
assert OLD_OB_UPSERT in src, 'OLD_OB_UPSERT not found'
src = src.replace(OLD_OB_UPSERT, NEW_OB_UPSERT, 1)

OLD_OB_FIXED = """    fixed_expenses:   [],
  });

  if (error) { console.error('obFinish', error); btn.disabled = false; return; }"""
NEW_OB_FIXED = """    fixed_expenses:   [],
    notch_id:         _newNotchId,
  });

  if (error) { console.error('obFinish', error); btn.disabled = false; return; }"""
assert OLD_OB_FIXED in src, 'OLD_OB_FIXED not found'
src = src.replace(OLD_OB_FIXED, NEW_OB_FIXED, 1)

OLD_OB_STATE = """  STATE.user    = { name, monthlyIncome: income, monthlyBudget: budget, xp: 0, streak: 0, longestStreak: 0, lastEntryDate: null, freezesAvailable: 1, joinDate: toDay(), onboardingDone: true, currency: 'RUB', baseCurrency: 'RUB', fixedExps: [], savingsGoals: [], notchId: _newNotchId };"""
# This was already updated; check if old version exists first
if OLD_OB_STATE not in src:
    OLD_OB_STATE = """  STATE.user    = { name, monthlyIncome: income, monthlyBudget: budget, xp: 0, streak: 0, longestStreak: 0, lastEntryDate: null, freezesAvailable: 1, joinDate: toDay(), onboardingDone: true, currency: 'RUB', baseCurrency: 'RUB', fixedExps: [], savingsGoals: [] };"""
    NEW_OB_STATE = """  STATE.user    = { name, monthlyIncome: income, monthlyBudget: budget, xp: 0, streak: 0, longestStreak: 0, lastEntryDate: null, freezesAvailable: 1, joinDate: toDay(), onboardingDone: true, currency: 'RUB', baseCurrency: 'RUB', fixedExps: [], savingsGoals: [], notchId: _newNotchId };"""
    assert OLD_OB_STATE in src, 'OLD_OB_STATE not found'
    src = src.replace(OLD_OB_STATE, NEW_OB_STATE, 1)

# ── 6. switchProfileTab: add 'friends' to tab list + handler ──────────────
OLD_FOREACH = """  ['me','settings','data'].forEach(t => {"""
NEW_FOREACH = """  ['me','friends','settings','data'].forEach(t => {"""
assert OLD_FOREACH in src, 'OLD_FOREACH not found'
src = src.replace(OLD_FOREACH, NEW_FOREACH, 1)

OLD_SETTINGS_HANDLER = """  if (tab === 'settings') { renderCharPicker(); updateNotifToggle(); updateBioToggle(); renderFixedExps(); renderSavingsGoals(); }
}"""
NEW_SETTINGS_HANDLER = """  if (tab === 'settings') { renderCharPicker(); updateNotifToggle(); updateBioToggle(); renderFixedExps(); renderSavingsGoals(); }
  if (tab === 'friends')  { renderFriendsTab(); }
}"""
assert OLD_SETTINGS_HANDLER in src, 'OLD_SETTINGS_HANDLER not found'
src = src.replace(OLD_SETTINGS_HANDLER, NEW_SETTINGS_HANDLER, 1)

# ── 7. JS: friends functions ──────────────────────────────────────────────
JS_ANCHOR = """/* ─────────────── FIXED EXPENSES ─────────────── */"""
assert JS_ANCHOR in src, 'JS_ANCHOR not found'

FRIENDS_JS = """/* ─────────────── FRIENDS ─────────────── */

function generateNotchId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function copyNotchId() {
  const id = STATE.user?.notchId || '';
  if (!id) return;
  navigator.clipboard?.writeText(id).catch(() => {});
  const btn = document.querySelector('.notch-id-copy');
  if (btn) { btn.textContent = 'Скопировано!'; setTimeout(() => { btn.textContent = 'Скопировать'; }, 1800); }
}

let _friendsCache = [];

async function loadFriendsData() {
  if (!currentUID) return;
  const { data: rows, error } = await supa.from('friendships').select('*');
  if (error || !rows || rows.length === 0) { _friendsCache = []; return; }
  const friendUids = rows.map(r => r.user_id === currentUID ? r.friend_id : r.user_id);
  const { data: profs } = await supa.rpc('get_profiles_for_ids', { uids: friendUids });
  const pm = {};
  (profs || []).forEach(p => { pm[p.id] = p; });
  _friendsCache = rows.map(r => {
    const fuid = r.user_id === currentUID ? r.friend_id : r.user_id;
    const p = pm[fuid] || {};
    return {
      id:        r.id,
      friendUid: fuid,
      name:      p.uname    || '—',
      notchId:   p.notch_id || '',
      xp:        p.uxp      || 0,
      streak:    p.ustreak  || 0,
      status:    r.status,
      isSender:  r.user_id === currentUID,
    };
  });
}

function renderFriendsTab() {
  const user = STATE.user; if (!user) return;
  const el = document.getElementById('my-notch-id');
  if (el) el.textContent = user.notchId || '——';
  loadFriendsData().then(() => _renderFriendsList());
}

function _renderFriendsList() {
  const wrap = document.getElementById('friends-list-wrap'); if (!wrap) return;
  const accepted = _friendsCache.filter(f => f.status === 'accepted');
  const incoming = _friendsCache.filter(f => f.status === 'pending' && !f.isSender);
  const outgoing = _friendsCache.filter(f => f.status === 'pending' &&  f.isSender);
  let html = '';

  if (incoming.length > 0) {
    html += `<div class="friends-section-lbl">Заявки (${incoming.length})</div>`;
    html += incoming.map(f => `
      <div class="friend-card">
        <div class="friend-card-av">${f.name.charAt(0).toUpperCase()}</div>
        <div class="friend-card-info">
          <div class="friend-card-name">${_esc(f.name)}</div>
          <div class="friend-card-sub">${f.notchId} · Ур.${getLevelNum(f.xp)} · 🔥${f.streak}</div>
        </div>
        <button class="fcbtn add" onclick="acceptFriendReq('${f.id}')">Принять</button>
        <button class="fcbtn deny" onclick="declineFriendReq('${f.id}')" style="margin-left:6px">✕</button>
      </div>`).join('');
  }

  if (outgoing.length > 0) {
    html += `<div class="friends-section-lbl">Исходящие</div>`;
    html += outgoing.map(f => `
      <div class="friend-card">
        <div class="friend-card-av">${f.name.charAt(0).toUpperCase()}</div>
        <div class="friend-card-info">
          <div class="friend-card-name">${_esc(f.name)}</div>
          <div class="friend-card-sub">${f.notchId} · Ур.${getLevelNum(f.xp)}</div>
        </div>
        <button class="fcbtn pend">Ожидание</button>
        <button class="fcbtn deny" onclick="cancelFriendReq('${f.id}')" style="margin-left:6px">✕</button>
      </div>`).join('');
  }

  if (accepted.length > 0) {
    html += `<div class="friends-section-lbl">Друзья (${accepted.length})</div>`;
    html += accepted.map(f => `
      <div class="friend-card">
        <div class="friend-card-av">${f.name.charAt(0).toUpperCase()}</div>
        <div class="friend-card-info">
          <div class="friend-card-name">${_esc(f.name)}</div>
          <div class="friend-card-sub">${f.notchId} · Ур.${getLevelNum(f.xp)} · 🔥${f.streak}</div>
        </div>
        <button class="fcbtn deny" onclick="removeFriend('${f.id}')" title="Удалить">✕</button>
      </div>`).join('');
  }

  if (!html) {
    html = '<div class="friends-empty">Пока нет друзей.<br>Поделись своим Notch ID или введи чужой — и вперёд!</div>';
  }
  wrap.innerHTML = html;
}

function _esc(s) { return (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function searchFriend() {
  const input  = document.getElementById('friend-search-input');
  const result = document.getElementById('friend-search-result');
  const id     = (input?.value || '').trim().toUpperCase();
  result.style.display = 'block';
  if (id.length < 6) { result.innerHTML = '<span style="color:var(--t2);font-size:13px">Notch ID состоит из 6 символов</span>'; return; }
  if (id === (STATE.user?.notchId || '').toUpperCase()) { result.innerHTML = '<span style="color:var(--t2);font-size:13px">Это твой собственный ID</span>'; return; }
  result.innerHTML = '<span style="color:var(--t2);font-size:13px">Ищем...</span>';
  const { data, error } = await supa.rpc('find_by_notch_id', { search_id: id });
  const found = Array.isArray(data) ? data[0] : data;
  if (error || !found) { result.innerHTML = '<span style="color:var(--t2);font-size:13px">Пользователь не найден</span>'; return; }
  const existing = _friendsCache.find(f => f.friendUid === found.id);
  let actionBtn = '';
  if (existing) {
    actionBtn = existing.status === 'accepted'
      ? `<span style="font-size:12px;color:var(--t2);font-weight:600">Уже друзья</span>`
      : `<span style="font-size:12px;color:var(--t2);font-weight:600">Заявка отправлена</span>`;
  } else {
    actionBtn = `<button class="fcbtn add" onclick="sendFriendReq('${found.id}')">Добавить</button>`;
  }
  result.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div class="friend-card-av">${(found.uname||'?').charAt(0).toUpperCase()}</div>
      <div class="friend-card-info">
        <div class="friend-card-name">${_esc(found.uname||'—')}</div>
        <div class="friend-card-sub">${found.notch_id} · Ур.${getLevelNum(found.uxp||0)} · 🔥${found.ustreak||0}</div>
      </div>
      ${actionBtn}
    </div>`;
}

async function sendFriendReq(friendUid) {
  const { error } = await supa.from('friendships').insert({ user_id: currentUID, friend_id: friendUid, status: 'pending' });
  if (error) { alert('Ошибка: ' + (error.message || 'попробуй ещё раз')); return; }
  document.getElementById('friend-search-input').value = '';
  document.getElementById('friend-search-result').style.display = 'none';
  renderFriendsTab();
}

async function acceptFriendReq(friendshipId) {
  await supa.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  renderFriendsTab();
}

async function declineFriendReq(friendshipId) {
  await supa.from('friendships').delete().eq('id', friendshipId);
  renderFriendsTab();
}

async function cancelFriendReq(friendshipId) {
  await supa.from('friendships').delete().eq('id', friendshipId);
  renderFriendsTab();
}

async function removeFriend(friendshipId) {
  if (!confirm('Удалить из друзей?')) return;
  await supa.from('friendships').delete().eq('id', friendshipId);
  renderFriendsTab();
}

/* ─────────────── FIXED EXPENSES ─────────────── */"""

src = src.replace(JS_ANCHOR, FRIENDS_JS, 1)

# ── verify ────────────────────────────────────────────────────────────────
assert src != orig, 'No changes made'
assert src.count('ptab-btn-friends') >= 1, 'ptab-btn-friends missing'
assert src.count('id="ptab-friends"') >= 1, 'ptab-friends pane missing'
assert src.count('generateNotchId') >= 3, 'generateNotchId missing'
assert src.count('find_by_notch_id') >= 1, 'find_by_notch_id missing'
assert src.count('get_profiles_for_ids') >= 1, 'get_profiles_for_ids missing'
assert src.count('renderFriendsTab') >= 3, 'renderFriendsTab missing'

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(src)
print("✓ patch_friends.py applied")
print(f"  File: {len(src):,} bytes")
