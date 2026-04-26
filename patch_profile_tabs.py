#!/usr/bin/env python3
"""Patch: profile tabs (Я / Настройки / Данные) + notification characters."""
import re

with open('app.html', 'r', encoding='utf-8') as f:
    src = f.read()
orig = src

# ── 1. CSS: profile tabs + char picker ────────────────────────────────────
CSS_ANCHOR = '    .notif-toggle-btn.on  { background: var(--a20); color: var(--ac); }'
assert CSS_ANCHOR in src, "CSS anchor not found"

CSS_NEW = CSS_ANCHOR + """

    /* ── PROFILE TABS ── */
    .profile-tabs { display:flex; gap:4px; margin:10px 16px 0; background:var(--s1); border-radius:14px; padding:4px; }
    .profile-tab { flex:1; border:none; background:transparent; color:var(--t2); font-size:13px; font-weight:700; padding:8px 4px; border-radius:10px; cursor:pointer; transition:background .18s,color .18s,box-shadow .18s; font-family:'Archivo',sans-serif; }
    .profile-tab.active { background:var(--s2); color:var(--text); box-shadow:0 1px 5px rgba(0,0,0,.22); }
    .profile-tab-pane { }
    /* ── CHAR PICKER ── */
    .char-picker-row { display:flex; gap:8px; padding:0 16px 4px; overflow-x:auto; scrollbar-width:none; }
    .char-picker-row::-webkit-scrollbar { display:none; }
    .char-option { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px 16px; background:var(--s1); border-radius:14px; border:2px solid transparent; cursor:pointer; transition:all .18s; }
    .char-option.active { border-color:var(--ac); background:var(--a10); }
    .char-option-icon { font-size:26px; line-height:1; }
    .char-option-name { font-size:10px; font-weight:700; color:var(--t2); letter-spacing:.04em; text-transform:uppercase; }
    .char-option.active .char-option-name { color:var(--ac); }"""
src = src.replace(CSS_ANCHOR, CSS_NEW, 1)

# ── 2. HTML: replace pane-profile ─────────────────────────────────────────
OLD_PROFILE = """      <!-- PROFILE -->
      <div class="tab-pane" id="pane-profile">
        <div class="profile-header">
          <div class="profile-avatar" id="p-avatar">?</div>
          <div class="profile-name" id="p-name">—</div>
          <div class="profile-level" id="p-level-txt">Уровень 1 · Новичок</div>
          <div class="profile-email" id="p-email"></div>
          <button class="profile-settings-btn" onclick="openSettings()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Изменить
          </button>
        </div>
        <div class="profile-xp">
          <div class="profile-xp-row">
            <span id="p-level-name">Новичок</span>
            <span id="p-xp-txt">0 / 800 XP</span>
          </div>
          <div class="pbar"><div class="pbar-fill" id="p-xp-bar" style="transform:scaleX(0)"></div></div>
        </div>

        <div class="stat-grid" id="p-stats"></div>

        <div class="achiev-section">
          <div class="achiev-title">Достижения</div>
          <div id="p-achievements"></div>
        </div>

        <div style="margin: 0 16px 10px">
          <div class="achiev-title">Напоминания</div>
        </div>
        <div class="notif-row">
          <div>
            <div class="notif-row-title">Напоминание о стрике</div>
            <div class="notif-row-sub">Каждый день в 20:00</div>
          </div>
          <button class="notif-toggle-btn off" id="notif-toggle-btn" onclick="toggleNotifications()">Включить</button>
        </div>

        <div style="margin: 0 16px 10px">
          <div class="achiev-title">Обязательные траты</div>
        </div>
        <div id="fixed-exps-list" style="margin: 0 16px 12px"></div>
        <div class="fixed-add-row" id="fixed-add-row">
          <input class="fixed-name-input" id="fexp-name" type="text" placeholder="Название (Аренда...)" maxlength="30">
          <input class="fixed-amt-input" id="fexp-amount" type="number" inputmode="decimal" placeholder="Сумма">
          <button class="fixed-add-btn" onclick="addFixedExp()">+</button>
        </div>

        <div style="margin: 16px 16px 10px">
          <div class="achiev-title">Цели накоплений</div>
        </div>
        <div id="goals-list" style="margin: 0 16px 8px"></div>
        <div class="goal-new-row">
          <input class="goal-new-name" id="goal-name" type="text" placeholder="Название цели" maxlength="30">
          <input class="goal-new-amt" id="goal-target" type="number" inputmode="decimal" placeholder="Сумма">
          <button class="goal-new-btn" onclick="addSavingsGoal()">+</button>
        </div>

        <div style="margin: 4px 16px 10px">
          <div class="achiev-title">Валюта</div>
        </div>
        <div class="currency-grid" id="currency-grid"></div>

        <div style="margin: 0 16px 10px">
          <div class="achiev-title">Биометрия</div>
        </div>
        <div class="notif-row" style="margin-bottom:8px">
          <div>
            <div class="notif-row-title" id="bio-profile-label">Face ID / Touch ID</div>
            <div class="notif-row-sub">Быстрый вход без пароля</div>
          </div>
          <button class="notif-toggle-btn" id="bio-profile-btn" onclick="toggleBioFromProfile()">Включить</button>
        </div>

        <div class="profile-actions">
          <div class="profile-action" onclick="exportCSV()">Экспорт данных (CSV)</div>
          <div class="profile-action" onclick="signOut()">Выйти из аккаунта</div>
          <div class="profile-action danger" onclick="confirmReset()">Сбросить все данные</div>
        </div>
      </div>"""

NEW_PROFILE = """      <!-- PROFILE -->
      <div class="tab-pane" id="pane-profile">
        <div class="profile-header">
          <div class="profile-avatar" id="p-avatar">?</div>
          <div class="profile-name" id="p-name">—</div>
          <div class="profile-level" id="p-level-txt">Уровень 1 · Новичок</div>
          <div class="profile-email" id="p-email"></div>
          <button class="profile-settings-btn" onclick="openSettings()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Изменить
          </button>
        </div>

        <div class="profile-tabs">
          <button class="profile-tab active" id="ptab-btn-me" onclick="switchProfileTab('me')">Я</button>
          <button class="profile-tab" id="ptab-btn-settings" onclick="switchProfileTab('settings')">Настройки</button>
          <button class="profile-tab" id="ptab-btn-data" onclick="switchProfileTab('data')">Данные</button>
        </div>

        <!-- TAB: Я -->
        <div class="profile-tab-pane" id="ptab-me">
          <div class="profile-xp">
            <div class="profile-xp-row">
              <span id="p-level-name">Новичок</span>
              <span id="p-xp-txt">0 / 800 XP</span>
            </div>
            <div class="pbar"><div class="pbar-fill" id="p-xp-bar" style="transform:scaleX(0)"></div></div>
          </div>
          <div class="stat-grid" id="p-stats"></div>
          <div class="achiev-section">
            <div class="achiev-title">Достижения</div>
            <div id="p-achievements"></div>
          </div>
        </div>

        <!-- TAB: Настройки -->
        <div class="profile-tab-pane" id="ptab-settings" style="display:none">
          <div style="margin:16px 16px 10px"><div class="achiev-title">Голос напоминаний</div></div>
          <div class="char-picker-row" id="char-picker-row"></div>

          <div style="margin:16px 16px 10px"><div class="achiev-title">Напоминания</div></div>
          <div class="notif-row">
            <div>
              <div class="notif-row-title">Напоминание о стрике</div>
              <div class="notif-row-sub" id="notif-row-sub">Утро, вечер и последний шанс</div>
            </div>
            <button class="notif-toggle-btn off" id="notif-toggle-btn" onclick="toggleNotifications()">Включить</button>
          </div>

          <div style="margin:16px 16px 10px"><div class="achiev-title">Биометрия</div></div>
          <div class="notif-row" style="margin-bottom:8px">
            <div>
              <div class="notif-row-title" id="bio-profile-label">Face ID / Touch ID</div>
              <div class="notif-row-sub">Быстрый вход без пароля</div>
            </div>
            <button class="notif-toggle-btn" id="bio-profile-btn" onclick="toggleBioFromProfile()">Включить</button>
          </div>

          <div style="margin:16px 16px 10px"><div class="achiev-title">Обязательные траты</div></div>
          <div id="fixed-exps-list" style="margin:0 16px 12px"></div>
          <div class="fixed-add-row" id="fixed-add-row">
            <input class="fixed-name-input" id="fexp-name" type="text" placeholder="Название (Аренда...)" maxlength="30">
            <input class="fixed-amt-input" id="fexp-amount" type="number" inputmode="decimal" placeholder="Сумма">
            <button class="fixed-add-btn" onclick="addFixedExp()">+</button>
          </div>

          <div style="margin:16px 16px 10px"><div class="achiev-title">Цели накоплений</div></div>
          <div id="goals-list" style="margin:0 16px 8px"></div>
          <div class="goal-new-row">
            <input class="goal-new-name" id="goal-name" type="text" placeholder="Название цели" maxlength="30">
            <input class="goal-new-amt" id="goal-target" type="number" inputmode="decimal" placeholder="Сумма">
            <button class="goal-new-btn" onclick="addSavingsGoal()">+</button>
          </div>

          <div style="margin:16px 16px 10px"><div class="achiev-title">Валюта</div></div>
          <div class="currency-grid" id="currency-grid"></div>
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

assert OLD_PROFILE in src, "OLD_PROFILE not found"
src = src.replace(OLD_PROFILE, NEW_PROFILE, 1)

# ── 3. JS: replace scheduleStreakReminder + add new functions ──────────────
OLD_NOTIF_JS = """function scheduleStreakReminder() {
  if (localStorage.getItem('notif_enabled') !== '1') return;
  if (!('serviceWorker' in navigator)) return;
  const user = DB.getUser(); if (!user) return;
  if (user.lastEntryDate === toDay()) return;
  const now = new Date(), target = new Date(now);
  target.setHours(20,0,0,0);
  if (now >= target) target.setDate(target.getDate() + 1);
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ type:'SCHEDULE_STREAK_REMINDER', delay:target.getTime()-Date.now(),
      title:'Notch — стрик под угрозой!',
      body:'Твой стрик ' + (user.streak||0) + ' дн. сгорит сегодня. Запиши хотя бы одну трату.' });
  });
}"""

NEW_NOTIF_JS = """/* ─── NOTIFICATION CHARACTERS ─── */
const NOTIF_CHARS = {
  bro: {
    name:'Бро', icon:'🤙',
    morning:   ['Бро, траты сами себя не запишут 🤙','Йоу! Что потратил вчера — зафиксируй','Доброе утро, богач! Открывай давай','Санёк, стрик поддерживаешь? Записывай','Проснулся — значит время записать трату'],
    evening:   ['Бро, стрик горит 🔥 Записал уже?','Слушай, ты сегодня вообще тратил? Зафиксируй','Стрик в опасности. Буквально 10 секунд','Эй! Не сливай стрик из-за лени. Открывай','Давай-давай, запись за 5 секунд'],
    lastchance:['БРО. 22:30. СТРИК. СЕЙЧАС ИЛИ НИКОГДА 🆘','Это твой последний шанс, братик','Полночь скоро. Стрик сгорит. Спаси его','Ты серьёзно хочешь потерять стрик из-за этого?','Последний вагон уходит, бро!'],
  },
  coach: {
    name:'Тренер', icon:'💪',
    morning:   ['Подъём! Финансовая дисциплина начинается утром!','Чемпионы ведут учёт каждый день. Начни!','Утро — лучшее время для финансовой гигиены','Вставай и зафиксируй вчерашние траты. Марш!','Нет оправданий! Открывай и записывай'],
    evening:   ['Стрик — это мышца. Качай её каждый день!','До конца дня мало времени. Не сломай серию!','Дисциплина строится день за днём. Запиши!','Финансовый чемпион не пропускает тренировки!','Тренировка окончена — пора записать траты!'],
    lastchance:['Последний сет! Записывай трату — и победа!','Нет боли — нет стрика! Давай, осталось чуть!','22:30 — последний шанс. Не сдавайся!','Чемпионы не сдаются в последнюю секунду!','Финишная прямая! Записывай сейчас!'],
  },
  papa: {
    name:'Папа', icon:'😤',
    morning:   ['Сынок, деньги учитываешь? Я в твои годы...','Доброе утро. Стрик не сам себя поддержит','Ну что, записал вчерашние траты? Я жду','Вставай уже. Деньги на дороге не валяются','В нашей семье принято вести учёт. Записывай'],
    evening:   ['Сынок, вечер уже. Стрик не сломал ещё?','Тратил сегодня? Запиши. Я потом проверю','В твои годы я всё в тетрадке вёл. Записывай','Не заставляй меня напоминать дважды','Стрик — это как домашнее задание. Сделал?'],
    lastchance:['Сынок, уже половина одиннадцатого! ЗАПИСЫВАЙ','Последнее предупреждение. Открывай приложение','Я не сержусь. Я просто разочарован. Записывай','Это твой последний шанс, я сказал','Ладно, это последний раз напоминаю. Запиши.'],
  },
  philosopher: {
    name:'Философ', icon:'🧘',
    morning:   ['Каждый рубль — это мгновение жизни. Фиксируй','Осознанность начинается с малого. Запиши трату','Утро — лучшее время для финансовой рефлексии','Деньги — это энергия. Веди её учёт с уважением','Новый день — новая возможность быть осознанным'],
    evening:   ['День клонится к закату. Успел ли ты осознать траты?','Стрик — отражение дисциплины духа. Сохрани его','В тишине вечера запиши то, что было сегодня','Финансовая осознанность — путь к внутреннему покою','Запиши трату и отпусти этот день с лёгкостью'],
    lastchance:['Полночь близко. Путь осознанности не прерывается','Последний момент дня. Сделай его осознанным','Стрик — это форма практики. Не прерывай её','Тишина ночи спрашивает: записал ли ты сегодня?','Один маленький шаг сейчас сохранит большой путь'],
  },
  collector: {
    name:'Коллектор', icon:'💼',
    morning:   ['Доброе утро. Ваш стрик ещё не просрочен. Пока.','Мы отслеживаем вашу активность. Запишите трату.','Уведомление №1 из 3. Зафиксируйте расход.','Наш отдел напоминает: стрик требует обслуживания','Ваш аккаунт активен. Подтвердите это записью.'],
    evening:   ['Вечернее уведомление. Стрик истекает в полночь.','У вас осталось несколько часов. Не усугубляйте.','Мы вынуждены напомнить о задолженности по стрику.','Ваш стрик под угрозой. Сделайте запись сейчас.','Это не угроза. Это напоминание. Но стрик сгорит.'],
    lastchance:['КРИТИЧНО. 22:30. Стрик истекает через 90 минут.','Последнее уведомление перед сгоранием стрика.','Ваша задолженность критическая. Запишите немедленно.','Отдел взыскания: стрик сгорает в 00:00.','Это ваш последний шанс. Мы настроены серьёзно.'],
  },
};

function getNotifChar() { return localStorage.getItem('notif_char') || 'bro'; }
function setNotifChar(id) {
  localStorage.setItem('notif_char', id);
  renderCharPicker();
}

function renderCharPicker() {
  const row = document.getElementById('char-picker-row'); if (!row) return;
  const cur = getNotifChar();
  row.innerHTML = Object.entries(NOTIF_CHARS).map(([id, c]) =>
    `<div class="char-option${id===cur?' active':''}" onclick="setNotifChar('${id}')">
      <div class="char-option-icon">${c.icon}</div>
      <div class="char-option-name">${c.name}</div>
    </div>`
  ).join('');
}

function _notifMsg(slot) {
  const char = NOTIF_CHARS[getNotifChar()] || NOTIF_CHARS.bro;
  const pool = char[slot] || char.evening;
  return { title: char.icon + ' ' + char.name, body: pool[Math.floor(Math.random()*pool.length)] };
}

function scheduleStreakReminder() { scheduleAllNotifications(); }

function scheduleAllNotifications() {
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
}"""

assert OLD_NOTIF_JS in src, "OLD_NOTIF_JS not found"
src = src.replace(OLD_NOTIF_JS, NEW_NOTIF_JS, 1)

# ── 4. Add switchProfileTab function after scheduleAllNotifications ────────
SWITCHTAB_ANCHOR = """/* ─────────────── FIXED EXPENSES ─────────────── */"""
assert SWITCHTAB_ANCHOR in src, "SWITCHTAB_ANCHOR not found"

SWITCHTAB_NEW = """function switchProfileTab(tab) {
  ['me','settings','data'].forEach(t => {
    const pane = document.getElementById('ptab-' + t);
    const btn  = document.getElementById('ptab-btn-' + t);
    if (!pane || !btn) return;
    const active = t === tab;
    pane.style.display = active ? '' : 'none';
    btn.classList.toggle('active', active);
  });
  if (tab === 'settings') { renderCharPicker(); updateNotifToggle(); updateBioToggle(); renderFixedExps(); renderSavingsGoals(); renderCurrencyGrid(); }
}

/* ─────────────── FIXED EXPENSES ─────────────── */"""
src = src.replace(SWITCHTAB_ANCHOR, SWITCHTAB_NEW, 1)

# ── 5. switchTab: also call renderCharPicker when profile tab opens ────────
OLD_SWITCHTAB = """  if (tab === 'profile') updateNotifToggle();"""
NEW_SWITCHTAB = """  if (tab === 'profile') { updateNotifToggle(); updateBioToggle(); renderCharPicker(); }"""
assert OLD_SWITCHTAB in src, "OLD_SWITCHTAB not found"
src = src.replace(OLD_SWITCHTAB, NEW_SWITCHTAB, 1)

# ── 6. Three callers of scheduleStreakReminder in init/submitAuth ─────────
# They still work because scheduleStreakReminder() is now an alias
# No change needed — but verify they exist
assert 'scheduleStreakReminder()' in src, "scheduleStreakReminder callers not found"

# ── verify no double-replacement ──────────────────────────────────────────
assert src != orig, "No changes made — something went wrong"
assert src.count('id="ptab-me"') == 1, "ptab-me should appear exactly once"
assert src.count('NOTIF_CHARS') >= 2, "NOTIF_CHARS definition missing"
assert src.count('switchProfileTab') >= 3, "switchProfileTab should appear in def + 3 onclick"

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(src)
print("✓ patch_profile_tabs.py applied successfully")
print(f"  File size: {len(src):,} bytes")
