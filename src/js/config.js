/* ── Supabase credentials — replaced by vercel build at deploy time ── */
export const SUPABASE_URL      = '__SUPABASE_URL__';
export const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
export const VAPID_PUBLIC_KEY  = '__VAPID_PUBLIC_KEY__';

/* ── Expense categories ── */
export const CATS = [
  { id:'food',      icon:'[food]',  name:'Продукты'  },
  { id:'transport', icon:'[trs]',   name:'Транспорт' },
  { id:'coffee',    icon:'[cof]',   name:'Кофе'      },
  { id:'cafe',      icon:'[cafe]',  name:'Кафе'      },
  { id:'delivery',  icon:'[del]',   name:'Доставка'  },
  { id:'entertain', icon:'[ent]',   name:'Развлеч.'  },
  { id:'clothing',  icon:'[clo]',   name:'Одежда'    },
  { id:'health',    icon:'[hlt]',   name:'Здоровье'  },
  { id:'subscr',    icon:'[sub]',   name:'Подписки'  },
  { id:'other',     icon:'[oth]',   name:'Другое'    },
];

export const CAT_SVG = {
  food:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H3.5L2 8h20l-1.5-6H6z"/><path d="M2 8l1.5 9a2 2 0 002 1.5h9a2 2 0 002-1.5L18 8"/><circle cx="9" cy="21" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="21" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  transport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 9h18"/><path d="M8 17v3m8-3v3"/><circle cx="8" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  coffee:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a3 3 0 010 6h-1"/><path d="M4 8h13v7a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"/><path d="M7 3c0 1.5 1.5 1.5 1.5 3m3-3c0 1.5 1.5 1.5 1.5 3"/></svg>`,
  cafe:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6a3 3 0 006 0V2"/><path d="M6 2v20"/><path d="M21 15V2h-2a3 3 0 000 6h2"/><path d="M18 22v-4"/></svg>`,
  delivery:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="12" rx="1"/><path d="M15 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="19" r="2"/><circle cx="18.5" cy="19" r="2"/></svg>`,
  entertain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>`,
  clothing:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8l-4-5a3 3 0 01-8 0L4 8l3 2v11h10V10l3-2z"/></svg>`,
  health:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C12 21 3 14 3 8a5 5 0 019-3 5 5 0 019 3c0 6-9 13-9 13z"/></svg>`,
  subscr:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6m-6 4h6m-4 4h2"/></svg>`,
  other:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
};

export const STREAK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:2px"><path d="M8.5 14.5c0-2 2-4 2-7 1 2 4 4.5 4 7a5 5 0 01-10 0c0-2 1.5-3.5 2-4.5.5 1.5 2 4.5 2 4.5z"/></svg>`;

export const LEVELS = [
  { min:0,     max:800,      name:'Новичок',       steps:5  },
  { min:800,   max:2500,     name:'Копилка',        steps:5  },
  { min:2500,  max:6000,     name:'Экономист',      steps:10 },
  { min:6000,  max:15000,    name:'Финансист',      steps:15 },
  { min:15000, max:30000,    name:'Мастер бюджета', steps:15 },
  { min:30000, max:Infinity, name:'Фин. гуру',      steps:1  },
];

export const ACHIEVEMENTS = [
  { id:'first',    icon:'✦', name:'Первый шаг',   desc:'Первая запись',          check: s => s.totalExpenses >= 1 },
  { id:'week',     icon:'◉', name:'Неделька',     desc:'7-дневный стрик',        check: s => s.streak >= 7 },
  { id:'month',    icon:'▣', name:'Плановик',     desc:'30 дней в приложении',   check: s => s.daysInApp >= 30 },
  { id:'saver',    icon:'◈', name:'Копилка',      desc:'Потратил меньше дохода', check: s => s.savedThisMonth > 0 },
  { id:'streak30', icon:'⬡', name:'Месяц подряд', desc:'30-дневный стрик',       check: s => s.streak >= 30 },
  { id:'guru',     icon:'◆', name:'Экономист',    desc:'Достиг уровня Экономист',check: s => s.xp >= 2500 },
];

export const DAILY_QUEST_TEMPLATES = [
  { id:'dq_record',   title:'Запиши хотя бы одну трату', desc:'Любая категория',                                xp:50, type:'daily', target:1 },
  { id:'dq_delivery', title:'Без доставки еды сегодня',  desc:'Не заказывай доставку в течение дня',            xp:50, type:'daily', target:1 },
  { id:'dq_budget',   title:'Уложись в дневной лимит',   desc:'Потрать меньше дневного лимита по бюджету',      xp:50, type:'daily', target:1 },
];

export const INCOME_TYPES = [
  { id:'salary',   name:'Зарплата',  svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>` },
  { id:'bonus',    name:'Премия',    svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` },
  { id:'freelance',name:'Подработка',svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>` },
  { id:'gift',     name:'Подарок',   svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7m0 0H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>` },
  { id:'other',    name:'Другое',    svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>` },
];

export const CURRENCIES = [
  { id:'RUB', symbol:'₽', name:'Рубль',   decimals:0, pos:'after'  },
  { id:'USD', symbol:'$', name:'Доллар',  decimals:2, pos:'before' },
  { id:'EUR', symbol:'€', name:'Евро',    decimals:2, pos:'before' },
  { id:'KZT', symbol:'₸', name:'Тенге',   decimals:0, pos:'after'  },
  { id:'GBP', symbol:'£', name:'Фунт',    decimals:2, pos:'before' },
  { id:'TRY', symbol:'₺', name:'Лира',    decimals:0, pos:'after'  },
];

export const WEEKLY_QUEST = {
  id:'wq_entertain', title:'Умеренные развлечения',
  desc:'Не больше 20% бюджета на развлечения за неделю',
  xp:200, type:'weekly'
};

export const PRESET_AVATARS = [
  { id:'bolt',     svg:`<svg viewBox="0 0 40 40"><polygon points="23,4 11,22 19,22 17,36 29,18 21,18" fill="currentColor"/></svg>` },
  { id:'star',     svg:`<svg viewBox="0 0 40 40"><polygon points="20,4 23.5,15 35,15 26,22 29,33 20,26 11,33 14,22 5,15 16.5,15" fill="currentColor"/></svg>` },
  { id:'diamond',  svg:`<svg viewBox="0 0 40 40"><polygon points="20,4 34,20 20,36 6,20" fill="currentColor"/></svg>` },
  { id:'crown',    svg:`<svg viewBox="0 0 40 40"><path d="M6 28V15l6 8 8-11 8 11 6-8v13H6z" fill="currentColor"/></svg>` },
  { id:'flame',    svg:`<svg viewBox="0 0 40 40"><path d="M20 4c0 0-10 9-10 18a10 10 0 0020 0c0-4-2-7-2-7s0 5-4 6c1-6-4-10-4-17z" fill="currentColor"/></svg>` },
  { id:'moon',     svg:`<svg viewBox="0 0 40 40"><path d="M27 20a13 13 0 01-15.6 12.7A15 15 0 1027 8.5 13 13 0 0127 20z" fill="currentColor"/></svg>` },
  { id:'shield',   svg:`<svg viewBox="0 0 40 40"><path d="M20 4l13 5v11c0 8-6 13-13 16-7-3-13-8-13-16V9z" fill="currentColor"/></svg>` },
  { id:'rocket',   svg:`<svg viewBox="0 0 40 40"><path d="M20 5c-5 5-8 13-8 19h3l-3 7h16l-3-7h3c0-6-3-14-8-19zm-3 15a3 3 0 116 0 3 3 0 01-6 0z" fill="currentColor"/></svg>` },
  { id:'heart',    svg:`<svg viewBox="0 0 40 40"><path d="M20 34s-14-8-14-17a8 8 0 0114-5.3A8 8 0 0134 17c0 9-14 17-14 17z" fill="currentColor"/></svg>` },
  { id:'eye',      svg:`<svg viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="13" ry="8" fill="currentColor" opacity=".2"/><ellipse cx="20" cy="20" rx="13" ry="8" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="20" cy="20" r="4.5" fill="currentColor"/></svg>` },
  { id:'infinity', svg:`<svg viewBox="0 0 40 40"><path d="M8 20c0-4 3-7 7-7s9 7 5 7c4 0 9-7 5-7 4 0 7 3 7 7s-3 7-7 7-9-7-5-7c-4 0-9 7-5 7-4 0-7-3-7-7z" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` },
  { id:'zap',      svg:`<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" stroke="currentColor" stroke-width="2.5" fill="none"/><polygon points="23,10 14,22 19,22 17,30 26,18 21,18" fill="currentColor"/></svg>` },
];

export const AVATAR_FRAMES = [
  { id:'none',   name:'Нет',    premium:false },
  { id:'gold',   name:'Золото', premium:true  },
  { id:'neon',   name:'Неон',   premium:true  },
  { id:'fire',   name:'Огонь',  premium:true  },
  { id:'cosmic', name:'Космос', premium:true  },
  { id:'ice',    name:'Лёд',    premium:true  },
];

export const COLOR_SWATCHES = ['#4ECCA3','#F7B32B','#F05D5E','#7C3AED','#3B82F6','#EC4899','#10B981','#F97316','#06B6D4','#EF4444','#E2C07A','#94A3B8'];

export const NOTIF_CHARS = {
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

export const INFO = {
  fa: {
    title: 'Запас дней',
    body: `Сколько дней ты проживёшь, если завтра не будет зарплаты.

30 дней — есть подушка
90 дней — можно спать спокойно
180 дней — полная свобода`,
  },
  xp: {
    title: 'Уровни и XP',
    body: `Записываешь траты — получаешь XP. Набираешь XP — растёт уровень.

Запись траты → +10 XP
Первая запись за день → +25 XP
Выполнил квест → +50–200 XP

Чем регулярнее ведёшь учёт, тем быстрее растёшь.`,
  },
};
