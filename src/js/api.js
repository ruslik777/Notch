import { SUPABASE_URL, SUPABASE_ANON_KEY, CAT_SVG } from './config.js';

export const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});

/* mutable auth context — mutate properties, never reassign the object */
export const AUTH = { uid: null, email: null };

export const STATE = {
  user:    null,
  exps:    [],
  incomes: [],
  quests:  null,
  achievs: [],
};

export const DB = {
  getUser:    ()  => STATE.user,
  setUser:    (u) => { STATE.user = u; _syncUser(u); },
  getExps:    ()  => STATE.exps,
  setExps:    ()  => {},
  getQuests:  ()  => STATE.quests,
  setQuests:  (q) => { STATE.quests = q; _syncQuests(q); },
  getAchievs: ()  => STATE.achievs,
  setAchievs: (a) => { STATE.achievs = a; _syncAchievs(a); },
  getIncomes: ()  => STATE.incomes,
};

/* exchange rates — properties mutated by _applyRates */
export const RATES = {
  RUB: 1,
  USD: 0.0114,
  EUR: 0.0104,
  KZT: 5.40,
  GBP: 0.0088,
  TRY: 0.375,
};

/* ── Sync helpers ── */

export async function _syncUser(u) {
  if (!AUTH.uid) return;
  try {
    await supa.from('profiles').update({
      name:              u.name,
      monthly_income:    u.monthlyIncome,
      monthly_budget:    u.monthlyBudget,
      xp:                u.xp || 0,
      streak:            u.streak || 0,
      longest_streak:    u.longestStreak || 0,
      last_entry_date:   u.lastEntryDate || null,
      freezes_available: u.freezesAvailable ?? 1,
      currency:          u.currency || 'RUB',
      base_currency:     u.baseCurrency || 'RUB',
      fixed_expenses:    u.fixedExps    || [],
      xp_this_week:      u.xpThisWeek   || 0,
      league_week:       u.leagueWeek   || '',
      savings_goals:     u.savingsGoals || [],
      avatar_type:       u.avatarType   || 'color',
      avatar_value:      u.avatarValue  || '#4ECCA3',
      avatar_frame:      u.avatarFrame  || 'none',
    }).eq('id', AUTH.uid);
  } catch(e) { console.error('syncUser', e); }
}

export async function _syncQuests(q) {
  if (!AUTH.uid) return;
  try {
    await supa.from('profiles').update({ quests_data: q }).eq('id', AUTH.uid);
  } catch(e) { console.error('syncQuests', e); }
}

export async function _syncAchievs(a) {
  if (!AUTH.uid) return;
  try {
    await supa.from('profiles').update({ achievements: a }).eq('id', AUTH.uid);
  } catch(e) { console.error('syncAchievs', e); }
}

export async function _insertIncome(inc) {
  if (!AUTH.uid) return;
  try {
    await supa.from('incomes').insert({
      user_id:   AUTH.uid,
      amount:    inc.amount,
      type:      inc.type,
      type_name: inc.typeName,
      note:      inc.note || '',
      date:      inc.date,
    });
  } catch(e) { console.error('insertIncome', e); }
}

export async function _insertExpense(exp) {
  if (!AUTH.uid) return;
  try {
    const { data } = await supa.from('expenses').insert({
      user_id:  AUTH.uid,
      amount:   exp.amount,
      cat_id:   exp.catId,
      cat_name: exp.catName,
      icon:     exp.icon,
      note:     exp.note || '',
      date:     exp.date,
    }).select('id').single();
    if (data?.id) {
      const local = STATE.exps.find(e => e.id === exp.id);
      if (local) local.id = data.id;
    }
  } catch(e) { console.error('insertExpense', e); }
}

export async function loadState() {
  const [profRes, expRes, incRes] = await Promise.all([
    supa.from('profiles').select('*').eq('id', AUTH.uid).maybeSingle(),
    supa.from('expenses').select('*').eq('user_id', AUTH.uid).order('created_at'),
    supa.from('incomes').select('*').eq('user_id', AUTH.uid).order('created_at'),
  ]);

  if (!profRes.data) return false;

  const p = profRes.data;
  STATE.user = {
    name:             p.name,
    monthlyIncome:    p.monthly_income,
    monthlyBudget:    p.monthly_budget,
    xp:               p.xp || 0,
    streak:           p.streak || 0,
    longestStreak:    p.longest_streak || 0,
    lastEntryDate:    p.last_entry_date,
    freezesAvailable: p.freezes_available ?? 1,
    joinDate:         p.join_date,
    onboardingDone:   p.onboarding_done,
    currency:         p.currency || 'RUB',
    baseCurrency:     p.base_currency || p.currency || 'RUB',
    fixedExps:        p.fixed_expenses    || [],
    xpThisWeek:       p.xp_this_week      || 0,
    leagueWeek:       p.league_week       || '',
    savingsGoals:     p.savings_goals     || [],
    notchId:          p.notch_id          || '',
    premium:          p.is_premium        || false,
    avatarType:       p.avatar_type       || 'color',
    avatarValue:      p.avatar_value      || '#4ECCA3',
    avatarFrame:      p.avatar_frame      || 'none',
  };
  STATE.quests  = p.quests_data || null;
  STATE.achievs = p.achievements || [];
  STATE.exps    = (expRes.data || []).map(r => ({
    id:      r.id,
    amount:  r.amount,
    catId:   r.cat_id,
    catName: r.cat_name,
    icon:    CAT_SVG[r.cat_id] || '',
    note:    r.note || '',
    date:    r.date,
  }));
  STATE.incomes = (incRes.data || []).map(r => ({
    id:       r.id,
    amount:   r.amount,
    type:     r.type,
    typeName: r.type_name,
    note:     r.note || '',
    date:     r.date,
  }));

  return true;
}

/* ── Exchange rates ── */

export async function updateExchangeRates() {
  const CACHE_KEY = 'er_rates';
  const TIME_KEY  = 'er_time';
  const TTL       = 86400000;

  const cached   = localStorage.getItem(CACHE_KEY);
  const cachedAt = parseInt(localStorage.getItem(TIME_KEY) || '0');

  if (cached && Date.now() - cachedAt < TTL) {
    _applyRates(JSON.parse(cached));
    return;
  }

  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result === 'success' && data.rates) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.rates));
      localStorage.setItem(TIME_KEY, String(Date.now()));
      _applyRates(data.rates);
    }
  } catch(e) {
    console.warn('exchange rates fetch failed, using fallback', e);
    if (cached) _applyRates(JSON.parse(cached));
  }
}

function _applyRates(usdRates) {
  const rub = usdRates.RUB || 88;
  RATES.RUB = 1;
  RATES.USD = 1 / rub;
  RATES.EUR = (usdRates.EUR || 0.93) / rub;
  RATES.GBP = (usdRates.GBP || 0.79) / rub;
  RATES.KZT = (usdRates.KZT || 450)  / rub;
  RATES.TRY = (usdRates.TRY || 32)   / rub;
  if (STATE.user && typeof window.renderAll === 'function') window.renderAll();
}
