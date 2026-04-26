import { CURRENCIES } from './config.js';
import { STATE, RATES } from './api.js';

export const toDay = d => {
  const dt = d ? new Date(d) : new Date();
  return dt.toISOString().split('T')[0];
};

export function getCur() {
  return CURRENCIES.find(c => c.id === (STATE.user?.currency || 'RUB')) || CURRENCIES[0];
}

export function getDisplayRate() {
  const user = STATE.user;
  if (!user) return 1;
  const base    = RATES[user.baseCurrency || 'RUB'] || 1;
  const display = RATES[user.currency     || 'RUB'] || 1;
  return display / base;
}

export function fmt(n) {
  const cur  = getCur();
  const rate = getDisplayRate();
  const abs  = Math.abs(n) * rate;
  const val  = cur.decimals > 0
    ? abs.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(abs).toLocaleString('ru-RU');
  return cur.pos === 'before' ? cur.symbol + val : val + ' ' + cur.symbol;
}

export const greet = () => {
  const h = new Date().getHours();
  if (h < 6)  return 'Доброй ночи,';
  if (h < 12) return 'Доброе утро,';
  if (h < 18) return 'Добрый день,';
  return 'Добрый вечер,';
};

export function pluralDays(n) {
  const a = Math.abs(n);
  if (a % 10 === 1 && a % 100 !== 11) return 'день';
  if ([2,3,4].includes(a % 10) && ![12,13,14].includes(a % 100)) return 'дня';
  return 'дней';
}
