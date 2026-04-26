import { STATE, DB, AUTH, supa } from './api.js';
import { getLevelNum } from './gamification.js';

export let _friendsCache = [];

export function generateNotchId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function copyNotchId() {
  const id = STATE.user?.notchId || '';
  if (!id) return;
  navigator.clipboard?.writeText(id).catch(() => {});
  const btn = document.querySelector('.notch-id-copy');
  if (btn) { btn.textContent = 'Скопировано!'; setTimeout(() => { btn.textContent = 'Скопировать'; }, 1800); }
}

export async function loadFriendsData() {
  if (!AUTH.uid) return;
  const { data: rows, error } = await supa.from('friendships').select('*');
  if (error || !rows || rows.length === 0) { _friendsCache = []; return; }
  const friendUids = rows.map(r => r.user_id === AUTH.uid ? r.friend_id : r.user_id);
  const { data: profs } = await supa.rpc('get_profiles_for_ids', { uids: friendUids });
  const pm = {};
  (profs || []).forEach(p => { pm[p.id] = p; });
  _friendsCache = rows.map(r => {
    const fuid = r.user_id === AUTH.uid ? r.friend_id : r.user_id;
    const p = pm[fuid] || {};
    return {
      id:         r.id,
      friendUid:  fuid,
      name:       p.uname      || '—',
      notchId:    p.notch_id   || '',
      xp:         p.uxp        || 0,
      xpThisWeek: p.uxp_week   || 0,
      streak:     p.ustreak    || 0,
      status:     r.status,
      isSender:   r.user_id === AUTH.uid,
    };
  });
}

export function renderFriendsTab() {
  const user = STATE.user; if (!user) return;
  const el = document.getElementById('my-notch-id');
  if (el) el.textContent = user.notchId || '——';
  loadFriendsData().then(() => { _renderFriendsList(); renderWeeklyRace(); });
}

export function _renderFriendsList() {
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
          <div class="friend-card-name">${_fesc(f.name)}</div>
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
          <div class="friend-card-name">${_fesc(f.name)}</div>
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
          <div class="friend-card-name">${_fesc(f.name)}</div>
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

export function _fesc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function renderWeeklyRace() {
  const wrap = document.getElementById('race-wrap'); if (!wrap) return;
  const user = STATE.user; if (!user) { wrap.innerHTML = ''; return; }
  const accepted = _friendsCache.filter(f => f.status === 'accepted');
  if (accepted.length === 0) { wrap.innerHTML = ''; return; }
  const entries = [
    { name: user.name, xpW: user.xpThisWeek || 0, isMe: true },
    ...accepted.map(f => ({ name: f.name, xpW: f.xpThisWeek || 0, isMe: false })),
  ].sort((a, b) => b.xpW - a.xpW);
  const rows = entries.map((e, i) => `
    <div class="race-row${e.isMe ? ' race-you' : ''}">
      <span class="race-pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
      <span class="race-name">${_fesc(e.name)}${e.isMe ? ' (ты)' : ''}</span>
      <span class="race-xp">${(e.xpW || 0).toLocaleString('ru')} XP</span>
    </div>`).join('');
  wrap.innerHTML = `<div class="race-card"><div class="race-title">Забег недели</div>${rows}</div>`;
}

export async function searchFriend() {
  const input  = document.getElementById('friend-search-input');
  const result = document.getElementById('friend-search-result');
  const id     = (input?.value || '').trim().toUpperCase();
  result.style.display = 'block';
  if (id.length < 6) { result.innerHTML = '<span style="color:var(--t2);font-size:13px">Notch ID — 6 символов</span>'; return; }
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
      <div class="friend-card-av">${(found.uname || '?').charAt(0).toUpperCase()}</div>
      <div class="friend-card-info">
        <div class="friend-card-name">${_fesc(found.uname || '—')}</div>
        <div class="friend-card-sub">${found.notch_id} · Ур.${getLevelNum(found.uxp || 0)} · 🔥${found.ustreak || 0}</div>
      </div>
      ${actionBtn}
    </div>`;
}

export async function sendFriendReq(friendUid) {
  const { error } = await supa.from('friendships').insert({ user_id: AUTH.uid, friend_id: friendUid, status: 'pending' });
  if (error) { alert('Ошибка: ' + (error.message || 'попробуй ещё раз')); return; }
  document.getElementById('friend-search-input').value = '';
  document.getElementById('friend-search-result').style.display = 'none';
  renderFriendsTab();
}

export async function acceptFriendReq(friendshipId) {
  await supa.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  renderFriendsTab();
}

export async function declineFriendReq(friendshipId) {
  await supa.from('friendships').delete().eq('id', friendshipId);
  renderFriendsTab();
}

export async function cancelFriendReq(friendshipId) {
  await supa.from('friendships').delete().eq('id', friendshipId);
  renderFriendsTab();
}

export async function removeFriend(friendshipId) {
  if (!confirm('Удалить из друзей?')) return;
  await supa.from('friendships').delete().eq('id', friendshipId);
  renderFriendsTab();
}
