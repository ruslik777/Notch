import { STREAK_SVG, CURRENCIES, ACHIEVEMENTS, PRESET_AVATARS } from './config.js';
import { STATE, DB, AUTH, RATES } from './api.js';
import { toDay, fmt, greet, getCur } from './format.js';
import {
  getLevel, getLevelNum, getFinancialAge,
  checkAchievements, getOrInitQuests, generatePersonalQuest,
  _analyticsPeriod, getWeekStart, renderInsights,
} from './gamification.js';

export function renderAvatarEl() {
  const user  = DB.getUser(); if (!user) return;
  const type  = user.avatarType  || 'color';
  const value = user.avatarValue || '#4ECCA3';
  const prem  = window.isPremium ? window.isPremium() : false;
  const frame = (prem ? user.avatarFrame : 'none') || 'none';
  const wrap  = document.getElementById('p-avatar-wrap');
  const el    = document.getElementById('p-avatar');
  if (!wrap || !el) return;
  wrap.className = 'av-ring-wrap frame-' + frame;
  if (type === 'photo' && value) {
    el.innerHTML = `<img src="${value}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    el.style.background  = 'var(--s2)';
    el.style.borderColor = 'transparent';
    el.style.color       = '';
  } else if (type === 'preset') {
    const p = PRESET_AVATARS.find(a => a.id === value);
    el.innerHTML = p ? p.svg : user.name.charAt(0).toUpperCase();
    el.style.background  = 'var(--s2)';
    el.style.borderColor = 'var(--brd)';
    el.style.color       = 'var(--ac)';
  } else {
    el.innerHTML         = user.name.charAt(0).toUpperCase();
    el.style.background  = value + '22';
    el.style.borderColor = value + '44';
    el.style.color       = value;
  }
}

export function renderSavingsGoals() {
  const user = DB.getUser();
  const el   = document.getElementById('goals-list');
  if (!el || !user) return;
  const goals = user.savingsGoals || [];
  if (goals.length === 0) {
    el.innerHTML = '<div class="goal-empty">Добавь цель — например, ноутбук или отпуск</div>';
    return;
  }
  el.innerHTML = goals.map(g => {
    const pct  = Math.min((g.saved || 0) / g.target, 1);
    const left = Math.max(g.target - (g.saved || 0), 0);
    return `
      <div class="goal-card">
        <div class="goal-card-top">
          <span class="goal-card-name">${g.name}</span>
          <button class="goal-card-del" onclick="removeSavingsGoal('${g.id}')">×</button>
        </div>
        <div class="goal-card-nums">
          <span>Накоплено: <strong>${fmt(g.saved || 0)}</strong></span>
          <span>Осталось: <strong>${fmt(left)}</strong></span>
        </div>
        <div class="goal-bar-track">
          <div class="goal-bar-fill" style="transform:scaleX(${pct})"></div>
        </div>
        <div class="goal-deposit-row">
          <input class="goal-deposit-input" type="number" inputmode="decimal"
                 placeholder="Пополнить..." id="gdep-${g.id}">
          <button class="goal-deposit-btn" onclick="depositSavingsGoal('${g.id}')">+ Добавить</button>
        </div>
      </div>`;
  }).join('');
}

export function renderFixedExps() {
  const user = DB.getUser();
  const list = document.getElementById('fixed-exps-list');
  if (!list || !user) return;
  const items = user.fixedExps || [];
  if (items.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">Добавь постоянные расходы: аренда, кредит, подписки...</div>';
    return;
  }
  list.innerHTML = items.map(e => `
    <div class="fixed-item">
      <span class="fixed-item-name">${e.name}</span>
      <span class="fixed-item-amt">${fmt(e.amount)}</span>
      <button class="fixed-item-del" onclick="removeFixedExp('${e.id}')">×</button>
    </div>`).join('');
}

export function renderHome() {
  const user = DB.getUser();
  if (!user) return;
  const exps = DB.getExps();
  const td   = toDay();

  document.getElementById('h-greeting').textContent = greet();
  document.getElementById('h-name').textContent     = user.name;
  document.getElementById('h-streak').innerHTML     = `${STREAK_SVG}${user.streak || 0}`;

  const incomes = DB.getIncomes();
  const now2    = new Date();
  const mStart  = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0];
  const monthIncome = incomes.filter(i => i.date >= mStart).reduce((s, i) => s + i.amount, 0);
  const monthExp    = exps.filter(e => e.date >= mStart).reduce((s, e) => s + e.amount, 0);
  const effectiveInc = monthIncome > 0 ? monthIncome : (user.monthlyIncome || 0);
  const fixedTotal   = (user.fixedExps || []).reduce((s, e) => s + e.amount, 0);
  const balance = effectiveInc - monthExp - fixedTotal;

  const budget    = user.monthlyBudget || 0;
  const alertEl   = document.getElementById('h-budget-alert');
  const totalSpent = monthExp + fixedTotal;
  if (budget > 0 && totalSpent > 0) {
    const pct = totalSpent / budget;
    if (pct >= 1) {
      alertEl.style.display = ''; alertEl.className = 'budget-alert danger';
      document.getElementById('h-budget-alert-text').textContent = 'Бюджет исчерпан — потрачено ' + fmt(totalSpent) + ' из ' + fmt(budget);
    } else if (pct >= 0.8) {
      alertEl.style.display = ''; alertEl.className = 'budget-alert warn';
      document.getElementById('h-budget-alert-text').textContent = Math.round(pct * 100) + '% бюджета — осталось ' + fmt(budget - totalSpent);
    } else { alertEl.style.display = 'none'; }
  } else { alertEl.style.display = 'none'; }

  const balEl = document.getElementById('h-bal-amount');
  balEl.textContent = (balance >= 0 ? '' : '−') + fmt(Math.abs(balance));
  balEl.className   = 'balance-amount' + (balance < 0 ? ' negative' : ' positive');
  document.getElementById('h-bal-month').textContent = now2.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  document.getElementById('h-bal-inc').textContent   = fmt(effectiveInc);
  document.getElementById('h-bal-exp').textContent   = fmt(monthExp);
  const fixedWrap = document.getElementById('h-bal-fixed-wrap');
  if (fixedTotal > 0) {
    fixedWrap.style.display = '';
    document.getElementById('h-bal-fixed').textContent = fmt(fixedTotal);
  } else {
    fixedWrap.style.display = 'none';
  }

  const fa     = getFinancialAge(user, exps, incomes);
  const lvl    = getLevel(user.xp || 0);
  const lvlNum = getLevelNum(user.xp || 0);
  document.getElementById('h-level-num').textContent  = `Ур. ${lvlNum}`;
  document.getElementById('h-level-name').textContent = lvl.name;

  const RING_C    = 490.09;
  const ringFill  = document.getElementById('h-ring-fill');
  if (ringFill) ringFill.style.strokeDashoffset = RING_C * (1 - lvl.progress);
  const xpPtsRing = document.getElementById('h-xp-pts-ring');
  if (xpPtsRing) xpPtsRing.textContent = `${(user.xp || 0).toLocaleString('ru')} XP`;
  const xpNextText = document.getElementById('h-xp-next-text');
  if (xpNextText) {
    const toNext = lvl.next === Infinity ? 0 : lvl.next - (user.xp || 0);
    xpNextText.textContent = lvl.next === Infinity
      ? 'Макс. уровень'
      : `ещё ${toNext.toLocaleString('ru')} до ур. ${lvlNum + 1}`;
  }

  const budgetPct  = budget > 0 ? Math.round(totalSpent / budget * 100) : 0;
  const chipBudget = document.getElementById('h-chip-budget');
  if (chipBudget) {
    chipBudget.textContent = budget > 0 ? budgetPct + '%' : '—';
    chipBudget.style.color = budgetPct >= 100 ? 'var(--red)' : budgetPct >= 80 ? 'var(--gold)' : 'var(--ac)';
  }
  const chipDays = document.getElementById('h-chip-days');
  if (chipDays) chipDays.textContent = fa.days > 0 ? fa.days + ' дн' : '—';
  const goals      = user.savingsGoals || [];
  const doneGoals  = goals.filter(g => (g.saved || 0) >= g.target).length;
  const chipGoals  = document.getElementById('h-chip-goals');
  if (chipGoals) chipGoals.textContent = goals.length > 0 ? `${doneGoals}/${goals.length}` : '—';

  const todayExps  = exps.filter(e => e.date === td);
  const todaySpent = todayExps.reduce((s, e) => s + e.amount, 0);
  const dailyLimit = (user.monthlyBudget || 0) / 30;
  const todayLeft  = dailyLimit - todaySpent;
  document.getElementById('h-today-spent').textContent = fmt(todaySpent);
  const leftEl = document.getElementById('h-today-left');
  const subEl  = document.getElementById('h-today-sub');
  if (dailyLimit > 0) {
    if (todayLeft >= 0) {
      leftEl.textContent = fmt(todayLeft);
      leftEl.className   = 'today-amt positive';
      subEl.textContent  = 'осталось на день';
    } else {
      leftEl.textContent = '−' + fmt(Math.abs(todayLeft));
      leftEl.className   = 'today-amt';
      subEl.textContent  = 'перерасход';
    }
  } else {
    leftEl.textContent = '—'; leftEl.className = 'today-amt positive';
    subEl.textContent  = 'осталось на день';
  }

  const quests = getOrInitQuests();
  const shownQ = quests.daily.slice(0, 2);
  document.getElementById('h-quests').innerHTML = shownQ.map(q => `
    <div class="q-item">
      <div class="q-check ${q.completed ? 'done' : ''}">${q.completed ? '✓' : ''}</div>
      <div class="q-text">
        <div class="q-name">${q.title}</div>
        <div class="q-prog">${q.completed ? 'Выполнено' : q.desc}</div>
      </div>
      <div class="q-xp">+${q.xp}</div>
    </div>
  `).join('');

  const sorted = [...todayExps].reverse().slice(0, 5);
  document.getElementById('h-txs').innerHTML = sorted.length === 0
    ? '<div class="empty-txs">Записей пока нет.<br>Нажми + чтобы добавить.</div>'
    : sorted.map(e => `
        <div class="tx">
          <div class="tx-ico">${e.icon}</div>
          <div>
            <div class="tx-name">${e.catName}</div>
            <div class="tx-cat">${e.note || e.date}</div>
          </div>
          <div class="tx-amt">−${fmt(e.amount)}</div>
          <button class="tx-del" onclick="deleteExpense('${e.id}')">×</button>
        </div>
      `).join('');

  const analyticsCard = document.getElementById('analytics-card');
  const analyticsEl   = document.getElementById('h-analytics');
  const now3 = new Date();
  let aStart, aEnd;
  if (_analyticsPeriod === 'week') {
    aStart = getWeekStart(); aEnd = toDay();
  } else if (_analyticsPeriod === 'prevmonth') {
    const pm   = new Date(now3.getFullYear(), now3.getMonth() - 1, 1);
    aStart     = pm.toISOString().split('T')[0];
    const pmEnd = new Date(now3.getFullYear(), now3.getMonth(), 0);
    aEnd       = pmEnd.toISOString().split('T')[0];
  } else {
    aStart = mStart; aEnd = toDay();
  }
  const periodExps = exps.filter(e => e.date >= aStart && e.date <= aEnd);
  if (exps.length === 0) {
    analyticsCard.style.display = 'none';
  } else {
    analyticsCard.style.display = '';
    if (periodExps.length === 0) {
      analyticsEl.innerHTML = '<div style="font-size:13px;color:var(--t2);padding:6px 0 2px">Нет трат за этот период</div>';
    } else {
      const catMap = {};
      periodExps.forEach(e => {
        if (!catMap[e.catId]) catMap[e.catId] = { name: e.catName, icon: e.icon, total: 0 };
        catMap[e.catId].total += e.amount;
      });
      const cats   = Object.values(catMap).sort((a, b) => b.total - a.total);
      const maxVal = cats[0].total || 1;
      analyticsEl.innerHTML = cats.map(cat => `
        <div class="cat-bar-row">
          <div class="cat-bar-icon">${cat.icon}</div>
          <div class="cat-bar-info">
            <div class="cat-bar-name">${cat.name}</div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="transform:scaleX(${cat.total / maxVal})"></div>
            </div>
          </div>
          <div class="cat-bar-amt">−${fmt(cat.total)}</div>
        </div>`).join('');
    }
  }
  renderInsights();
}

export function renderQuests() {
  const quests = getOrInitQuests();

  document.getElementById('quests-daily').innerHTML = quests.daily.map(q => {
    const pct = q.completed ? 100 : (q.progress / q.target) * 100;
    return `
      <div class="q-card">
        <div class="q-card-top">
          <div class="q-card-name">${q.title}</div>
          <div class="q-card-xp">+${q.xp} XP</div>
        </div>
        <div class="q-card-desc">${q.desc}</div>
        <div class="q-card-foot">
          ${q.completed
            ? '<span class="q-done-badge">✓ Выполнено</span>'
            : `<div class="q-card-bar"><div class="q-card-fill" style="transform:scaleX(${pct / 100})"></div></div>
               <span class="q-card-lbl">${q.progress}/${q.target}</span>`
          }
        </div>
      </div>`;
  }).join('');

  const pq     = generatePersonalQuest(DB.getUser(), DB.getExps());
  const pqSect = document.getElementById('quests-personal-section');
  if (pq) {
    pqSect.style.display = '';
    const pPct = pq.completed ? 100 : (pq.progress / pq.target) * 100;
    document.getElementById('quests-personal').innerHTML = `
      <div class="q-card personal">
        <div class="q-personal-tag">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Персональный
        </div>
        <div class="q-card-top">
          <div class="q-card-name">${pq.title}</div>
          <div class="q-card-xp">+${pq.xp} XP</div>
        </div>
        <div class="q-card-desc">${pq.desc}</div>
        <div class="q-card-foot">
          ${pq.completed
            ? '<span class="q-done-badge">✓ Выполнено</span>'
            : '<div class="q-card-bar"><div class="q-card-fill" style="transform:scaleX(' + (pPct / 100) + ')"></div></div><span class="q-card-lbl">' + pq.progress + '/' + pq.target + '</span>'
          }
        </div>
      </div>`;
  } else { pqSect.style.display = 'none'; }

  const wq   = quests.weekly;
  const wPct = Math.min((wq.progress / wq.target) * 100, 100);
  document.getElementById('quests-weekly').innerHTML = `
    <div class="q-card">
      <div class="q-card-top">
        <div class="q-card-name">${wq.title}</div>
        <div class="q-card-xp">+${wq.xp} XP</div>
      </div>
      <div class="q-card-desc">Потрать не больше ${fmt(wq.target)} на развлечения за неделю</div>
      <div class="q-card-foot">
        <div class="q-card-bar"><div class="q-card-fill" style="transform:scaleX(${wPct / 100})"></div></div>
        <span class="q-card-lbl">${fmt(wq.progress)} / ${fmt(wq.target)}</span>
      </div>
    </div>`;
}

export function renderHistory() {
  const exps = DB.getExps();
  const el   = document.getElementById('hist-content');
  if (!el) return;

  if (exps.length === 0) {
    el.innerHTML = '<div class="hist-empty">Записей пока нет.<br>Нажми + чтобы добавить первую трату.</div>';
    return;
  }

  const groups = {};
  [...exps].reverse().forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  const fmtDate = str => {
    const d  = new Date(str + 'T12:00:00');
    const td2 = toDay();
    const yd  = toDay(new Date(Date.now() - 86400000));
    if (str === td2) return 'Сегодня';
    if (str === yd)  return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  el.innerHTML = Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const total = items.reduce((s, e) => s + e.amount, 0);
      return `
        <div class="hist-group">
          <div class="hist-date-row">
            <span class="hist-date">${fmtDate(date)}</span>
            <span class="hist-total">−${fmt(total)}</span>
          </div>
          <div class="hist-card">
            ${items.map(e => `
              <div class="tx">
                <div class="tx-ico">${e.icon}</div>
                <div>
                  <div class="tx-name">${e.catName}</div>
                  <div class="tx-cat">${e.note || ''}</div>
                </div>
                <div class="tx-amt">−${fmt(e.amount)}</div>
                <button class="tx-edit" onclick="openEditById('${e.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="tx-del" onclick="deleteExpense('${e.id}')">×</button>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
}

export function renderCurrencyGrid() {
  const user = DB.getUser(); if (!user) return;
  const el = document.getElementById('currency-grid'); if (!el) return;
  const activeCur  = user.currency     || 'RUB';
  const baseCurId  = user.baseCurrency || 'RUB';
  const baseCurDef = CURRENCIES.find(c => c.id === baseCurId) || CURRENCIES[0];
  el.innerHTML = CURRENCIES.map(c => {
    let rateStr;
    if (c.id === baseCurId) {
      rateStr = 'базовая';
    } else {
      const basePerOne = (RATES[baseCurId] || 1) / (RATES[c.id] || 1);
      if (basePerOne >= 1) {
        rateStr = `1 ${c.symbol} ≈ ${Math.round(basePerOne)} ${baseCurDef.symbol}`;
      } else {
        const onePerBase = (RATES[c.id] || 1) / (RATES[baseCurId] || 1);
        rateStr = `1 ${baseCurDef.symbol} ≈ ${onePerBase.toFixed(1)} ${c.symbol}`;
      }
    }
    return `<div class="currency-btn ${activeCur === c.id ? 'selected' : ''}" onclick="setCurrency('${c.id}')">
      <span class="currency-sym">${c.symbol}</span>
      <span class="currency-name">${c.name}</span>
      <span class="currency-rate">${rateStr}</span>
    </div>`;
  }).join('');
}

export function renderProfile() {
  const user = DB.getUser();
  if (!user) return;
  const exps     = DB.getExps();
  const achieved = checkAchievements();

  renderAvatarEl();
  document.getElementById('p-name').textContent = user.name;
  const badgeEl = document.getElementById('p-premium-badge');
  if (badgeEl) badgeEl.style.display = user.premium ? '' : 'none';

  const lvl    = getLevel(user.xp || 0);
  const lvlNum = getLevelNum(user.xp || 0);
  const xp     = user.xp || 0;

  const joinDate  = user.joinDate ? new Date(user.joinDate) : new Date();
  const joinYear  = joinDate.getFullYear();
  const daysInApp = Math.floor((Date.now() - joinDate.getTime()) / 86400000) + 1;

  const metaEl = document.getElementById('p-hero-meta');
  if (metaEl) metaEl.textContent = `${user.notchId || ''} · В Notch с ${joinYear} года`;

  const _set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  _set('p-hstat-streak', user.streak || 0);
  _set('p-hstat-xp',     xp.toLocaleString('ru'));
  _set('p-hstat-level',  lvlNum);
  _set('p-ov-streak',    `${user.streak || 0} дн.`);
  _set('p-ov-longest',   `${user.longestStreak || 0} дн.`);
  _set('p-ov-days',      daysInApp);
  _set('p-ov-records',   exps.length);

  const lvlLblEl = document.getElementById('p-ov-level-lbl');
  if (lvlLblEl) lvlLblEl.textContent = `УРОВЕНЬ ${lvlNum} · ${lvl.name.toUpperCase()}`;
  _set('p-xp-txt',  `${xp.toLocaleString('ru')} XP`);
  _set('p-xp-next', lvl.next === Infinity ? 'Макс. уровень' : `ещё ${(lvl.next - xp).toLocaleString('ru')} XP`);
  document.getElementById('p-xp-bar').style.transform = `scaleX(${lvl.progress})`;

  document.getElementById('p-achievements').innerHTML = ACHIEVEMENTS.map(a => {
    const done = achieved.includes(a.id);
    return `<div class="p-ach-card ${done ? 'done' : 'locked'}" ${done ? `onclick="shareAchievement('${a.id}')" style="cursor:pointer"` : ''}>
      <div class="p-ach-badge">${a.icon}</div>
      <div class="p-ach-card-name">${a.name}</div>
      <div class="p-ach-card-desc">${done ? a.desc : 'Заблокировано'}</div>
    </div>`;
  }).join('');
}

export function renderAll() {
  renderHome();
  renderQuests();
  renderHistory();
  renderProfile();
}
