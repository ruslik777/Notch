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
    el.innerHTML = `<div class="empty-state">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      <div class="empty-state-title">Целей пока нет</div>
      <div class="empty-state-sub">Добавь что-то конкретное — ноутбук, отпуск, подушка безопасности</div>
    </div>`;
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

function _renderMonthSummary() {
  const slot = document.getElementById('month-summary-slot'); if (!slot) return;

  const now = new Date();
  // Only show in first 5 days of month
  if (now.getDate() > 5) { slot.innerHTML = ''; return; }

  // Dismissed this month?
  const curMonth = toDay().substring(0, 7);
  if (localStorage.getItem('month_summary_dismissed') === curMonth) { slot.innerHTML = ''; return; }

  // Calc previous month stats
  const pm      = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pmEnd   = new Date(now.getFullYear(), now.getMonth(), 0);
  const pmStart = pm.toISOString().split('T')[0];
  const pmEndS  = pmEnd.toISOString().split('T')[0];
  const pmName  = pm.toLocaleDateString('ru-RU', { month: 'long' });

  const exps    = DB.getExps();
  const incomes = DB.getIncomes();
  const user    = DB.getUser();

  const pmExps    = exps.filter(e => e.date >= pmStart && e.date <= pmEndS);
  const pmIncs    = incomes.filter(i => i.date >= pmStart && i.date <= pmEndS);
  const pmSpent   = pmExps.reduce((s, e) => s + e.amount, 0);
  const pmIncome  = pmIncs.reduce((s, i) => s + i.amount, 0) || (user?.monthlyIncome || 0);
  const pmFixed   = (user?.fixedExps || []).reduce((s, e) => s + e.amount, 0);
  const pmSaved   = Math.max(0, pmIncome - pmSpent - pmFixed);

  // Don't show if no data for previous month
  if (pmSpent === 0 && pmIncome === 0) { slot.innerHTML = ''; return; }

  const savedColor = pmSaved > 0 ? 'var(--green)' : 'var(--t2)';

  slot.innerHTML = `
    <div class="month-summary" id="month-summary">
      <div class="month-summary-hdr">
        <span class="month-summary-title">Итог — ${pmName}</span>
        <button class="month-summary-close" onclick="dismissMonthSummary()">&#xd7;</button>
      </div>
      <div class="month-summary-stats">
        <div class="month-summary-stat">
          <div class="month-summary-val" style="color:var(--red)">−${fmt(pmSpent)}</div>
          <div class="month-summary-lbl">потрачено</div>
        </div>
        ${pmIncome > 0 ? `<div class="month-summary-stat">
          <div class="month-summary-val" style="color:var(--gold)">${fmt(pmIncome)}</div>
          <div class="month-summary-lbl">получено</div>
        </div>` : ''}
        <div class="month-summary-stat">
          <div class="month-summary-val" style="color:${savedColor}">${pmSaved > 0 ? '+' + fmt(pmSaved) : '—'}</div>
          <div class="month-summary-lbl">сэкономлено</div>
        </div>
      </div>
    </div>`;

  const card = document.getElementById('month-summary');
  if (card) {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(-6px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }));
  }
}

function _shouldShowIncomeBanner() {
  const user = DB.getUser(); if (!user) return false;
  const now    = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today  = toDay();

  const incomes = DB.getIncomes();
  const monthIncome = incomes.filter(i => i.date >= mStart).reduce((s, i) => s + i.amount, 0);
  if (monthIncome > 0) return false;

  const snoozedUntil = localStorage.getItem('income_banner_snooze');
  if (snoozedUntil) {
    const snoozeMonth = snoozedUntil.substring(0, 7);
    const curMonth    = today.substring(0, 7);
    if (snoozeMonth < curMonth) {
      // Snooze from a past month — clear it, fall through to day check
      localStorage.removeItem('income_banner_snooze');
    } else {
      // Snooze in current month — wait until that date
      return today >= snoozedUntil;
    }
  }

  // No active snooze — show in first 5 days of month
  return now.getDate() <= 5;
}

function _renderIncomeBanner() {
  const slot = document.getElementById('income-banner-slot'); if (!slot) return;
  if (!_shouldShowIncomeBanner()) { slot.innerHTML = ''; return; }

  const now      = new Date();
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayDay = now.getDate();
  const sym      = getCur().sym;

  const snoozeDates = [5, 10, 15, 20, 25].filter(d => d > todayDay);
  if (todayDay < lastDay) snoozeDates.push(lastDay);

  slot.innerHTML = `
    <div class="income-banner" id="income-banner">
      <div class="income-banner-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        <span class="income-banner-title">Новый месяц — запиши доход</span>
      </div>
      <div class="income-banner-row">
        <input class="income-banner-input" id="ib-amount" type="number" inputmode="decimal" placeholder="0" min="1">
        <span class="income-banner-sym">${sym}</span>
        <button class="income-banner-save-btn" id="ib-save-btn" onclick="saveIncomeBanner()" disabled>Записать</button>
      </div>
      ${snoozeDates.length > 0 ? `<div class="income-banner-snooze">
        <span class="income-banner-snooze-lbl">Отложить до:</span>
        ${snoozeDates.map(d => `<button class="snooze-date-chip" onclick="snoozeIncomeBanner(${d})">${d}-го</button>`).join('')}
      </div>` : ''}
    </div>`;

  const input = document.getElementById('ib-amount');
  const btn   = document.getElementById('ib-save-btn');
  if (input && btn) input.addEventListener('input', () => { btn.disabled = !parseFloat(input.value); });

  const banner = document.getElementById('income-banner');
  if (banner) {
    banner.style.opacity   = '0';
    banner.style.transform = 'translateY(-6px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      banner.style.opacity    = '1';
      banner.style.transform  = 'translateY(0)';
    }));
  }
}

function _renderStreakDanger(exps) {
  const slot = document.getElementById('streak-danger-slot'); if (!slot) return;
  const user = DB.getUser(); if (!user || !user.streak) { slot.innerHTML = ''; return; }

  const hour = new Date().getHours();
  if (hour < 19) { slot.innerHTML = ''; return; }

  const todayExps = exps.filter(e => e.date === toDay());
  if (todayExps.length > 0) { slot.innerHTML = ''; return; }

  // Already dismissed today
  const dismissed = localStorage.getItem('streak_danger_dismissed');
  if (dismissed === toDay()) { slot.innerHTML = ''; return; }

  slot.innerHTML = `
    <div class="streak-danger-banner" id="streak-danger-banner">
      <div class="streak-danger-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      <div class="streak-danger-body">
        <div class="streak-danger-title">Стрик под угрозой</div>
        <div class="streak-danger-sub">${user.streak} дн. серия — запиши хоть одну трату сегодня</div>
      </div>
      <button class="streak-danger-dismiss" onclick="dismissStreakDanger()">&#xd7;</button>
    </div>`;

  const banner = document.getElementById('streak-danger-banner');
  if (banner) {
    banner.style.opacity   = '0';
    banner.style.transform = 'translateY(-6px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      banner.style.opacity    = '1';
      banner.style.transform  = 'translateY(0)';
    }));
  }
}

function _renderSparkline(exps) {
  const svg = document.getElementById('h-sparkline');
  if (!svg) return;

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    days.push(exps.filter(e => e.date === ds).reduce((s, e) => s + e.amount, 0));
  }

  const max = Math.max(...days, 1);
  const W = 280, H = 40, PX = 6, PY = 5;
  const pts = days.map((v, i) => ({
    x: (i / 6) * (W - PX * 2) + PX,
    y: H - PY - ((v / max) * (H - PY * 2)),
  }));

  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    line += ` C ${cx} ${pts[i-1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const area = `${line} L ${pts[6].x} ${H + 2} L ${pts[0].x} ${H + 2} Z`;
  const tail = pts[6];

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const strokeC = isDark ? 'rgba(255,107,0,0.9)' : 'rgba(229,96,26,0.6)';
  const fillC   = isDark ? 'rgba(255,107,0,0.15)' : 'rgba(229,96,26,0.07)';
  const dotC    = isDark ? '#FF6B00' : '#E5601A';
  const glow    = isDark
    ? `<filter id="sg"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
       <filter id="dg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : '';

  svg.innerHTML = `<defs>${glow}</defs>
    <path class="spark-area" d="${area}" fill="${fillC}"/>
    <path id="spark-line" d="${line}" fill="none" stroke="${strokeC}" stroke-width="1.5" stroke-linecap="round" ${isDark ? 'filter="url(#sg)"' : ''}/>
    <circle class="spark-dot" cx="${tail.x}" cy="${tail.y}" r="3" fill="${dotC}" ${isDark ? 'filter="url(#dg)"' : ''}/>`;

  // Animate line drawing from left to right
  const pathEl = svg.querySelector('#spark-line');
  if (pathEl) {
    const len = pathEl.getTotalLength();
    pathEl.style.strokeDasharray  = len;
    pathEl.style.strokeDashoffset = len;
    pathEl.style.transition = 'none';
    // Double rAF — let browser paint the initial hidden state first
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pathEl.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.23,1,0.32,1)';
      pathEl.style.strokeDashoffset = '0';
    }));
  }

  // Fade in area and dot
  const areaEl = svg.querySelector('.spark-area');
  const dotEl  = svg.querySelector('.spark-dot');
  [areaEl, dotEl].forEach(el => {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'opacity 1s ease';
      el.style.opacity = '1';
    }));
  });
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

  _renderSparkline(exps);

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
    ? `<div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
        <div class="empty-state-title">Трат за сегодня нет</div>
        <div class="empty-state-sub">Запиши первую — получишь XP и поддержишь стрик</div>
        <button class="empty-state-btn" onclick="openModal()">Записать трату</button>
      </div>`
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
      const cats      = Object.values(catMap).sort((a, b) => b.total - a.total);
      const maxVal    = cats[0].total || 1;
      const totalSpent = periodExps.reduce((s, e) => s + e.amount, 0);
      analyticsEl.innerHTML = cats.slice(0, 6).map((cat, i) => {
        const pct = Math.round(cat.total / totalSpent * 100);
        return `<div class="cat-bar-row">
          <div class="cat-bar-icon">${cat.icon}</div>
          <div class="cat-bar-info">
            <div class="cat-bar-top">
              <span class="cat-bar-name">${cat.name}</span>
              <span class="cat-bar-pct">${pct}%</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill${i === 0 ? ' cat-bar-fill-top' : ''}" data-scale="${(cat.total / maxVal).toFixed(3)}"></div>
            </div>
          </div>
          <div class="cat-bar-amt">−${fmt(cat.total)}</div>
        </div>`;
      }).join('');
      // Animate bars after DOM paint
      requestAnimationFrame(() => requestAnimationFrame(() => {
        analyticsEl.querySelectorAll('.cat-bar-fill').forEach(el => {
          el.style.transform = `scaleX(${el.dataset.scale})`;
        });
      }));
    }
  }
  renderInsights();
  if (typeof window.renderNotifBanner === 'function') window.renderNotifBanner();
  _renderMonthSummary();
  _renderIncomeBanner();
  _renderStreakDanger(exps);
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
    el.innerHTML = `<div class="empty-state empty-state-lg">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <div class="empty-state-title">История пуста</div>
      <div class="empty-state-sub">Начни записывать траты — здесь появится твоя финансовая история</div>
      <button class="empty-state-btn" onclick="openModal()">Записать первую трату</button>
    </div>`;
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
