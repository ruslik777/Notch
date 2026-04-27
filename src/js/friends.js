import { STATE, DB, AUTH, supa } from './api.js';
import { getLevelNum, getLevel } from './gamification.js';
import { SUPABASE_URL, ACHIEVEMENTS } from './config.js';

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

let _nudgedSet = new Set();

async function _loadNudged() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supa.from('nudges').select('to_uid').eq('from_uid', AUTH.uid).eq('date', today);
  _nudgedSet = new Set((data || []).map(n => n.to_uid));
}

export async function loadFriendsData() {
  if (!AUTH.uid) return;
  await _loadNudged();
  const { data: rows, error } = await supa.from('friendships').select('*');
  if (error || !rows || rows.length === 0) {
    _friendsCache = [];
    const cntEl = document.getElementById('p-friends-count');
    if (cntEl) cntEl.textContent = '';
    return;
  }
  const friendUids = rows.map(r => r.user_id === AUTH.uid ? r.friend_id : r.user_id);
  const { data: profs } = await supa.rpc('get_profiles_for_ids', { uids: friendUids });
  const pm = {};
  (profs || []).forEach(p => { pm[p.id] = p; });
  _friendsCache = rows.map(r => {
    const fuid = r.user_id === AUTH.uid ? r.friend_id : r.user_id;
    const p = pm[fuid] || {};
    return {
      id:            r.id,
      friendUid:     fuid,
      name:          p.uname          || '—',
      notchId:       p.notch_id       || '',
      xp:            p.uxp            || 0,
      xpThisWeek:    p.uxp_week       || 0,
      streak:        p.ustreak        || 0,
      lastEntryDate: p.last_entry_date || null,
      status:        r.status,
      isSender:      r.user_id === AUTH.uid,
    };
  });
  const cntEl = document.getElementById('p-friends-count');
  if (cntEl) {
    const n = _friendsCache.filter(f => f.status === 'accepted').length;
    cntEl.textContent = n > 0 ? n : '';
  }
}

export function renderFriendsTab() {
  const user = STATE.user; if (!user) return;
  const el = document.getElementById('my-notch-id');
  if (el) el.textContent = user.notchId || '——';
  loadFriendsData().then(() => {
    _renderFriendsList();
    renderWeeklyRace();
    loadActivityFeed();
  });
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
        <div class="friend-card-av" onclick="openFriendProfile('${f.friendUid}')" style="cursor:pointer">${f.name.charAt(0).toUpperCase()}</div>
        <div class="friend-card-info" onclick="openFriendProfile('${f.friendUid}')" style="cursor:pointer">
          <div class="friend-card-name">${_fesc(f.name)}</div>
          <div class="friend-card-sub">${f.notchId} · Ур.${getLevelNum(f.xp)} · 🔥${f.streak}</div>
        </div>
        ${_nudgedSet.has(f.friendUid)
          ? `<button class="fcbtn nudge done" disabled>
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
               Напомнено
             </button>`
          : `<button class="fcbtn nudge" id="nudge-${f.friendUid}" onclick="sendNudge('${f.friendUid}','${_fesc(f.name)}')">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
               Напомнить
             </button>`
        }
        <button class="fcbtn deny"  onclick="removeFriend('${f.id}')" title="Удалить" style="margin-left:6px">✕</button>
      </div>`).join('');
  }

  if (!html) {
    html = '<div class="friends-empty">Пока нет друзей.<br>Поделись своим Notch ID или введи чужой — и вперёд!</div>';
  }
  wrap.innerHTML = html;
}

/* ── Nudge ── */

const _DONE_BTN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg> Напомнено`;
const _BELL_BTN = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> Напомнить`;

function _allNudgeBtns(friendUid) {
  return [
    document.getElementById('nudge-'  + friendUid),
    document.getElementById('pnudge-' + friendUid),
  ].filter(Boolean);
}

export async function sendNudge(friendUid, friendName) {
  const btns = _allNudgeBtns(friendUid);
  btns.forEach(b => { b.disabled = true; b.textContent = '...'; });
  try {
    const { data: { session } } = await supa.auth.getSession();
    const resp = await fetch(SUPABASE_URL + '/functions/v1/send-nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ to_uid: friendUid, from_name: STATE.user?.name || 'Друг' }),
    });
    if (resp.status === 429 || resp.ok || resp.status === 200) {
      _nudgedSet.add(friendUid);
      btns.forEach(b => { b.innerHTML = _DONE_BTN; b.classList.add('done'); });
    } else {
      btns.forEach(b => { b.innerHTML = _BELL_BTN; b.disabled = false; });
    }
  } catch(e) {
    btns.forEach(b => { b.innerHTML = _BELL_BTN; b.disabled = false; });
  }
}

/* ── Post-expense nudge prompt ── */

let _nudgePromptTimer = null;

export function closeNudgePrompt() {
  const el = document.getElementById('nudge-prompt');
  if (el) el.classList.remove('open');
  if (_nudgePromptTimer) { clearTimeout(_nudgePromptTimer); _nudgePromptTimer = null; }
}

export function showPostExpenseNudge() {
  const today = new Date().toISOString().slice(0, 10);
  const toNudge = _friendsCache.filter(f =>
    f.status === 'accepted' &&
    !_nudgedSet.has(f.friendUid) &&
    f.lastEntryDate !== today
  );
  if (!toNudge.length) return;

  const list = document.getElementById('nudge-prompt-list');
  const el   = document.getElementById('nudge-prompt');
  if (!list || !el) return;

  list.innerHTML = toNudge.slice(0, 4).map(f => `
    <div class="nudge-prompt-row">
      <span class="nudge-prompt-name">${_fesc(f.name)}</span>
      <button class="fcbtn nudge" id="pnudge-${f.friendUid}"
              onclick="sendNudge('${f.friendUid}','${_fesc(f.name)}')">
        ${_BELL_BTN}
      </button>
    </div>`).join('');

  el.classList.add('open');
  _nudgePromptTimer = setTimeout(closeNudgePrompt, 10000);
}

/* ── Activity feed ── */

function _timeAgo(dateStr) {
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1)  return 'только что';
  if (m < 60) return m + ' мин. назад';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ч. назад';
  return Math.floor(h / 24) + ' дн. назад';
}

function _renderFeedItem(item) {
  const reactions  = item.feed_reactions || [];
  const myReaction = reactions.find(r => r.user_id === AUTH.uid)?.emoji || null;
  const counts     = {};
  reactions.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
  const EMOJIS = ['🔥', '❤️', '👏'];
  const btns = EMOJIS.map(e =>
    `<button class="feed-reaction-btn${myReaction === e ? ' active' : ''}" onclick="toggleReaction('${item.id}','${e}')">${e}${counts[e] ? ' ' + counts[e] : ''}</button>`
  ).join('');
  const friend = _friendsCache.find(f => f.friendUid === item.user_id);
  const displayName = item.payload?.user_name || friend?.name || 'Друг';

  if (item.type === 'achievement') {
    return `<div class="feed-item">
      <div class="feed-item-av">${displayName.charAt(0).toUpperCase()}</div>
      <div class="feed-item-body">
        <div class="feed-item-text"><b>${_fesc(displayName)}</b> разблокировал <b>${item.payload.icon} ${item.payload.name}</b></div>
        <div class="feed-item-time">${_timeAgo(item.created_at)}</div>
        <div class="feed-reactions">${btns}</div>
      </div>
    </div>`;
  }
  return '';
}

export async function loadActivityFeed() {
  const wrap = document.getElementById('activity-feed-wrap'); if (!wrap) return;
  const friendUids = _friendsCache.filter(f => f.status === 'accepted').map(f => f.friendUid);
  if (!friendUids.length) { wrap.innerHTML = '<div class="feed-empty">Добавь друзей, чтобы видеть их активность</div>'; return; }

  const { data, error } = await supa.from('feed_items')
    .select('id, user_id, type, payload, created_at, feed_reactions(item_id, user_id, emoji)')
    .in('user_id', friendUids)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) { wrap.innerHTML = '<div class="feed-empty">Пока нет активности</div>'; return; }
  wrap.innerHTML = data.map(_renderFeedItem).filter(Boolean).join('') || '<div class="feed-empty">Пока нет активности</div>';
}

export async function toggleReaction(itemId, emoji) {
  const { data: existing } = await supa.from('feed_reactions')
    .select('item_id')
    .eq('item_id', itemId)
    .eq('user_id', AUTH.uid)
    .single();

  if (existing) {
    await supa.from('feed_reactions').delete().eq('item_id', itemId).eq('user_id', AUTH.uid);
  } else {
    await supa.from('feed_reactions').upsert({ item_id: itemId, user_id: AUTH.uid, emoji });
  }
  loadActivityFeed();
}

/* ── Weekly race ── */

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

/* ── Friends sheet ── */

export function openFriendsSheet() {
  document.getElementById('friends-overlay')?.classList.add('open');
  document.getElementById('friends-sheet')?.classList.add('open');
  renderFriendsTab();
}

export function closeFriendsSheet() {
  document.getElementById('friends-overlay')?.classList.remove('open');
  document.getElementById('friends-sheet')?.classList.remove('open');
}

/* ── Friend profile sheet ── */

export function closeFriendProfile() {
  document.getElementById('fp-overlay')?.classList.remove('open');
  document.getElementById('fp-sheet')?.classList.remove('open');
}

export async function openFriendProfile(friendUid) {
  const overlay = document.getElementById('fp-overlay');
  const sheet   = document.getElementById('fp-sheet');
  const content = document.getElementById('fp-content');
  if (!overlay || !sheet || !content) return;

  content.innerHTML = '<div class="fp-loading">Загрузка...</div>';
  overlay.classList.add('open');
  sheet.classList.add('open');

  const cached = _friendsCache.find(f => f.friendUid === friendUid);

  let ach = [];
  try {
    const { data } = await supa.rpc('get_friend_public_profile', { friend_uid: friendUid });
    const prof = Array.isArray(data) ? data[0] : data;
    if (prof?.achievements) {
      ach = Array.isArray(prof.achievements) ? prof.achievements : Object.keys(prof.achievements);
    }
  } catch(e) {}

  const xp      = cached?.xp || 0;
  const lvl     = getLevel(xp);
  const lvlNum  = getLevelNum(xp);
  const pct     = Math.round(lvl.progress * 100);
  const name    = cached?.name || '—';
  const notchId = cached?.notchId || '';
  const streak  = cached?.streak || 0;
  const xpW     = cached?.xpThisWeek || 0;

  const achHtml = ACHIEVEMENTS.map(a => {
    const unlocked = ach.includes(a.id);
    return `<div class="fp-ach ${unlocked ? 'unlocked' : 'locked'}">
      <div class="fp-ach-icon">${a.icon}</div>
      <div class="fp-ach-name">${a.name}</div>
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="fp-hero">
      <div class="fp-av">${name.charAt(0).toUpperCase()}</div>
      <div class="fp-name">${_fesc(name)}</div>
      <div class="fp-notch">${notchId}</div>
    </div>
    <div class="fp-stats">
      <div class="fp-stat">
        <div class="fp-stat-val">${lvlNum}</div>
        <div class="fp-stat-lbl">Уровень</div>
      </div>
      <div class="fp-stat">
        <div class="fp-stat-val">🔥${streak}</div>
        <div class="fp-stat-lbl">Стрик</div>
      </div>
      <div class="fp-stat">
        <div class="fp-stat-val">${xpW.toLocaleString('ru')}</div>
        <div class="fp-stat-lbl">XP за неделю</div>
      </div>
    </div>
    <div class="fp-section">
      <div class="fp-section-title">${lvl.name} · ${pct}% к следующему</div>
      <div class="fp-xp-bar-wrap"><div class="fp-xp-bar" style="width:${pct}%"></div></div>
      <div class="fp-xp-labels"><span>${xp.toLocaleString('ru')} XP</span><span>${lvl.next === Infinity ? '∞' : lvl.next.toLocaleString('ru')} XP</span></div>
    </div>
    <div class="fp-section" style="padding-bottom:8px">
      <div class="fp-section-title">Достижения</div>
      <div class="fp-ach-grid">${achHtml}</div>
    </div>`;
}

/* ── Friend actions ── */

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
