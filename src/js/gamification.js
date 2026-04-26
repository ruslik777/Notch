import { LEVELS, ACHIEVEMENTS, DAILY_QUEST_TEMPLATES, WEEKLY_QUEST } from './config.js';
import { STATE, DB, AUTH, supa } from './api.js';
import { toDay, fmt } from './format.js';

export function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) {
      const lvl = LEVELS[i];
      const range = lvl.max === Infinity ? 10000 : lvl.max - lvl.min;
      const progress = Math.min((xp - lvl.min) / range, 1);
      return { name: lvl.name, progress, next: lvl.max, current: lvl.min, xp };
    }
  }
  return { name: 'Новичок', progress: 0, next: 800, current: 0, xp };
}

export function getLevelNum(xp) {
  let total = 0;
  for (const lvl of LEVELS) {
    const size = lvl.max === Infinity ? 10000 : lvl.max - lvl.min;
    if (xp < (lvl.max === Infinity ? Infinity : lvl.max)) {
      return total + Math.floor((xp - lvl.min) / (size / lvl.steps)) + 1;
    }
    total += lvl.steps;
  }
  return total;
}

export function getFinancialAge(user, exps, incomes = []) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthInc   = incomes.filter(i => i.date >= monthStart).reduce((s, i) => s + i.amount, 0);
  const effectiveIncome = monthInc > 0 ? monthInc : (user.monthlyIncome || 0);
  if (!effectiveIncome) return { days: 0, pct: 0, nextTarget: 30, nextName: 'Подушка' };

  const monthExps   = exps.filter(e => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);
  const fixedTotal  = (user.fixedExps || []).reduce((s, e) => s + e.amount, 0);
  const saved       = Math.max(0, effectiveIncome - monthExps - fixedTotal);

  const monthlySpend = (user.monthlyBudget > 0) ? user.monthlyBudget : effectiveIncome * 0.8;
  const dailySpend   = monthlySpend / 30;
  const days         = Math.min(Math.round(saved / dailySpend), 365);

  const thresholds = [
    { days: 30,  name: 'Подушка'  },
    { days: 90,  name: 'Свободен' },
    { days: 180, name: 'Крепость' },
  ];
  const next = thresholds.find(t => t.days > days) || thresholds[thresholds.length - 1];
  return { days, pct: Math.min((days / next.days) * 100, 100), nextTarget: next.days, nextName: next.name };
}

export function checkStreak(user) {
  const td = toDay();
  if (user.lastEntryDate === td) return user;
  const yd = toDay(new Date(Date.now() - 86400000));
  if (user.lastEntryDate === yd) return user;
  if (user.lastEntryDate && user.lastEntryDate < yd) {
    if (user.freezesAvailable > 0) return { ...user, freezesAvailable: user.freezesAvailable - 1 };
    return { ...user, streak: 0 };
  }
  return user;
}

export function incrementStreak(user) {
  const td = toDay();
  if (user.lastEntryDate === td) return user;
  const streak = user.streak + 1;
  return { ...user, streak, longestStreak: Math.max(user.longestStreak || 0, streak), lastEntryDate: td };
}

/* ── XP ── */

export function addXP(amount) {
  let user = DB.getUser();
  const prevLevel = getLevel(user.xp);
  user.xp = (user.xp || 0) + amount;
  DB.setUser(user);
  showXPToast(amount);
  const newLevel = getLevel(user.xp);
  if (newLevel.name !== prevLevel.name) {
    setTimeout(() => showLevelUp(newLevel), 600);
  }
  updateLeagueXP(amount);
}

export function showXPToast(amount) {
  const el = document.getElementById('xp-toast');
  document.getElementById('xp-toast-text').textContent = `+${amount} XP`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

export function showLevelUp(levelInfo) {
  const lvlNum = getLevelNum(DB.getUser()?.xp || 0);
  document.getElementById('lu-level').textContent = levelInfo.name;
  document.getElementById('lu-sub').textContent   = `Уровень ${lvlNum} · ${levelInfo.xp.toLocaleString('ru')} XP`;
  document.getElementById('levelup-overlay').classList.add('show');
  setTimeout(closeLevelUp, 5000);
}

export function closeLevelUp() {
  document.getElementById('levelup-overlay').classList.remove('show');
}

/* ── Quests ── */

export function getWeekStart() {
  const d = new Date();
  const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function generateQuests() {
  const td   = toDay();
  const user = DB.getUser();
  return {
    daily: DAILY_QUEST_TEMPLATES.map(t => ({ ...t, progress: 0, completed: false, date: td })),
    weekly: {
      ...WEEKLY_QUEST,
      target: Math.round((user?.monthlyBudget || 10000) * 0.05),
      progress: 0, completed: false, weekStart: getWeekStart(),
    },
    lastReset: td,
    weekReset: getWeekStart(),
  };
}

export function getOrInitQuests() {
  const td        = toDay();
  const weekStart = getWeekStart();
  let q = DB.getQuests();
  if (!q) { q = generateQuests(); DB.setQuests(q); return q; }
  if (q.lastReset !== td) {
    q.daily     = DAILY_QUEST_TEMPLATES.map(t => ({ ...t, progress: 0, completed: false, date: td }));
    q.lastReset = td;
  }
  if (q.weekReset !== weekStart) {
    const user = DB.getUser();
    q.weekly    = { ...WEEKLY_QUEST, target: Math.round((user?.monthlyBudget || 10000) * 0.05), progress: 0, completed: false, weekStart };
    q.weekReset = weekStart;
  }
  DB.setQuests(q);
  return q;
}

export function checkQuestCompletion(expense) {
  const quests = getOrInitQuests();
  const exps   = DB.getExps();
  const td     = toDay();
  const user   = DB.getUser();
  let xpEarned = 0;

  quests.daily.forEach(q => {
    if (q.completed) return;
    if (q.id === 'dq_record') { q.progress = 1; q.completed = true; xpEarned += q.xp; }
    if (q.id === 'dq_budget') {
      const todayTotal = exps.filter(e => e.date === td).reduce((s,e) => s + e.amount, 0);
      if (todayTotal <= (user.monthlyBudget || 30000) / 30) { q.progress = 1; q.completed = true; xpEarned += q.xp; }
    }
  });

  if (!quests.weekly.completed) {
    const weekSpent = exps.filter(e => e.date >= quests.weekReset && e.catId === 'entertain').reduce((s,e) => s + e.amount, 0);
    quests.weekly.progress = weekSpent;
  }

  DB.setQuests(quests);
  if (xpEarned > 0) setTimeout(() => addXP(xpEarned), 400);
}

/* ── Achievements ── */

export function checkAchievements() {
  const user     = DB.getUser();
  const exps     = DB.getExps();
  const achieved = DB.getAchievs();
  const now      = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthExps  = exps.filter(e => e.date >= monthStart).reduce((s,e) => s + e.amount, 0);
  const joinDate   = user.joinDate ? new Date(user.joinDate) : new Date();
  const daysInApp  = Math.floor((Date.now() - joinDate.getTime()) / 86400000) + 1;

  const stats = {
    totalExpenses:  exps.length,
    streak:         user.streak || 0,
    daysInApp,
    savedThisMonth: Math.max(0, (user.monthlyIncome || 0) - monthExps),
    xp:             user.xp || 0,
  };

  let changed = false;
  ACHIEVEMENTS.forEach(a => {
    if (!achieved.includes(a.id) && a.check(stats)) { achieved.push(a.id); changed = true; }
  });

  if (changed) DB.setAchievs(achieved);
  return achieved;
}

/* ── Personal quest ── */

export function generatePersonalQuest(user, exps) {
  if (!user) return null;
  const td        = toDay();
  const weekStart = getWeekStart();
  const weekExps  = exps.filter(e => e.date >= weekStart);
  const catCounts = {};
  weekExps.forEach(e => { catCounts[e.catName] = (catCounts[e.catName]||0) + 1; });
  const topEntry = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
  if (topEntry && topEntry[1] >= 3) {
    const todayCat = exps.filter(e => e.date === td && e.catName === topEntry[0]).length;
    return {
      id:'pq_top', title:'Сегодня без "' + topEntry[0] + '"',
      desc:'На этой неделе ' + topEntry[1] + ' раз — твоя главная статья расходов',
      xp:75, target:1,
      progress: todayCat === 0 ? 1 : 0,
      completed: todayCat === 0 && exps.filter(e=>e.date===td).length > 0,
    };
  }
  const todayCount = exps.filter(e => e.date === td).length;
  return {
    id:'pq_3x', title:'Запиши 3 траты сегодня',
    desc:'Полная картина дня помогает планировать',
    xp:75, target:3, progress: Math.min(todayCount,3), completed: todayCount >= 3,
  };
}

/* ── Leagues ── */

export function getLeagueTier(xp) {
  if (xp >= 15000) return { id:'diamond', name:'Бриллиант' };
  if (xp >= 5000)  return { id:'gold',    name:'Золото' };
  if (xp >= 2000)  return { id:'silver',  name:'Серебро' };
  return { id:'bronze', name:'Бронза' };
}

export async function loadLeague() {
  const user = DB.getUser();
  if (!user || !AUTH.uid) return;
  const tier  = getLeagueTier(user.xp || 0);
  const badge = document.getElementById('league-tier-badge');
  if (badge) { badge.textContent = tier.name; badge.className = 'league-tier-badge ' + tier.id; }
  const ws = getWeekStart();
  if (user.leagueWeek !== ws) { user.xpThisWeek = 0; user.leagueWeek = ws; DB.setUser(user); }
  await supa.from('league_entries').upsert({
    user_id:AUTH.uid, display_name:user.name,
    xp_this_week:user.xpThisWeek||0, total_xp:user.xp||0,
    league:tier.id, week_start:ws,
  }, { onConflict:'user_id' });
  const { data } = await supa.from('league_entries')
    .select('user_id,display_name,xp_this_week')
    .eq('league', tier.id).order('xp_this_week',{ascending:false}).limit(15);
  const board = document.getElementById('league-board');
  if (!board) return;
  if (!data || !data.length) { board.innerHTML = '<div class="league-loading">Ты первый в лиге — пригласи друзей!</div>'; return; }
  const medals = ['★','✦','◆'];
  board.innerHTML = data.map((row,i) => {
    const isMe = row.user_id === AUTH.uid;
    return '<div class="league-row ' + (isMe?'me':'') + '">' +
      '<div class="league-rank">' + (medals[i]||String(i+1)) + '</div>' +
      '<div class="league-avatar">' + row.display_name.charAt(0).toUpperCase() + '</div>' +
      '<div class="league-name">' + row.display_name + (isMe?' (ты)':'') + '</div>' +
      '<div class="league-xp">' + (row.xp_this_week||0).toLocaleString('ru') + ' XP</div>' +
      '</div>';
  }).join('');
}

export async function updateLeagueXP(xpGained) {
  if (!AUTH.uid) return;
  const user = DB.getUser(); if (!user) return;
  user.xpThisWeek = (user.xpThisWeek||0) + xpGained;
  DB.setUser(user);
  try {
    await supa.from('league_entries').upsert({
      user_id:AUTH.uid, display_name:user.name,
      xp_this_week:user.xpThisWeek, total_xp:user.xp||0,
      league:getLeagueTier(user.xp||0).id, week_start:getWeekStart(),
    }, { onConflict:'user_id' });
  } catch(e) { console.error('updateLeagueXP',e); }
}

/* ── Analytics period state ── */

export let _analyticsPeriod = 'week';

export function setAnalyticsPeriod(p) {
  if ((p === 'month' || p === 'prevmonth') && !window.isPremium()) {
    window.showPremiumScreen(); return;
  }
  _analyticsPeriod = p;
  ['month','week','prevmonth'].forEach(id => {
    const el = document.getElementById('ap-' + id);
    if (el) el.classList.toggle('active', id === p);
  });
  if (typeof window.renderHome === 'function') window.renderHome();
}

/* ── Insights ── */

export function computeInsights() {
  const exps = DB.getExps();
  const user = DB.getUser(); if (!user || !exps.length) return [];
  const now  = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const thisM = exps.filter(e => e.date.startsWith(thisMonth));
  const lastM = exps.filter(e => e.date.startsWith(lastMonth));
  const insights = [];

  const catTotals = {};
  thisM.forEach(e => { catTotals[e.catName] = (catTotals[e.catName] || 0) + e.amount; });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  if (topCat) insights.push({ icon:'📊', title:`Главная категория: ${topCat[0]}`, sub:`${fmt(topCat[1])} за этот месяц` });

  const sumThis = thisM.reduce((s, e) => s + e.amount, 0);
  const sumLast = lastM.reduce((s, e) => s + e.amount, 0);
  if (sumLast > 0 && sumThis > 0) {
    const diff = Math.round((sumThis - sumLast) / sumLast * 100);
    insights.push({ icon: diff > 0 ? '📈' : '📉', title:`Расходы ${diff > 0 ? '+' + diff : diff}% к прошлому месяцу`, sub:`${fmt(sumThis)} vs ${fmt(sumLast)}` });
  }

  if (user.monthlyBudget && sumThis > 0) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayNow  = now.getDate();
    const daysLeft = daysInMonth - dayNow;
    const remaining = user.monthlyBudget - sumThis;
    if (remaining > 0 && daysLeft > 0) {
      insights.push({ icon:'💡', title:'Дневной лимит до конца месяца', sub:`${fmt(Math.round(remaining / daysLeft))}/день` });
    } else if (remaining <= 0) {
      insights.push({ icon:'⚠️', title:'Бюджет исчерпан', sub:`Превышение на ${fmt(Math.abs(remaining))}` });
    }
  }

  const biggest = [...thisM].sort((a, b) => b.amount - a.amount)[0];
  if (biggest) insights.push({ icon:'💸', title:`Крупнейшая трата: ${biggest.catName}`, sub:`${fmt(biggest.amount)}${biggest.note ? ' — ' + biggest.note : ''}` });

  return insights.slice(0, 4);
}

export function renderInsights() {
  const card = document.getElementById('insights-card');
  const wrap = document.getElementById('insights-list');
  if (!card || !wrap) return;
  if (!window.isPremium()) {
    card.style.display = 'none'; return;
  }
  const items = computeInsights();
  if (!items.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  wrap.innerHTML = items.map(i => `
    <div class="insight-item">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-body"><strong>${i.title}</strong><span>${i.sub}</span></div>
    </div>`).join('');
}
