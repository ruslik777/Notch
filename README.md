# Notch — Gamified Personal Finance PWA

> Turn budgeting into a game. XP, streaks, achievements, AI coach.

Built with Vanilla JS · Supabase · Netlify · Claude AI · MIT License

## Live Demo

**[notch-app.netlify.app](https://notch-app.netlify.app)**

## Claude AI Integration

Notch uses Claude in 3 core features:

### 📸 Receipt Scanner
Point your camera or upload a screenshot — Claude Vision (`claude-haiku-4-5`) extracts every line item, assigns categories, and adds them all as expenses in one tap.

### 🤖 AI Financial Coach
Ask anything about your finances. The coach has access to your real spending history and gives personalized, non-judgmental advice. Powered by `claude-haiku-4-5`.

### ⚡ Smart Auto-Categorization  
Type a note like "шаверма" or "Яндекс Плюс" — Claude auto-suggests the right category in under 2 seconds, so you never have to think about it.

## Setup

### Local development

```bash
git clone https://github.com/ruslik777/Notch
cd Notch
cp .env.example .env
# Fill in your keys in .env
open app.html   # or serve with any static server
```

### Deploy to Netlify

1. Fork this repo
2. Connect to Netlify
3. Add environment variables in Netlify → Site Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_ANON_KEY` — your Supabase anon key
4. Deploy

## Features

- 🎮 **Gamification** — XP points, streaks, levels, achievements, daily quests
- 📊 **Analytics** — Spending by category, budget tracking, financial runway
- 👥 **Friends** — Compare streaks, send nudges, leaderboards
- 📸 **Receipt Scanner** — Claude Vision extracts all items from photos
- 🤖 **AI Coach** — Personalized financial advice powered by Claude
- ⚡ **Smart Categorization** — Auto-classifies expenses as you type
- 🔐 **PIN + Biometric lock**
- 🌍 **Multi-currency** — RUB, USD, EUR, KZT, GBP, TRY
- 💾 **PWA** — Works offline, installable on iOS and Android

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS (ES modules) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| AI | Anthropic Claude API (Haiku 4.5) |
| Deploy | Netlify Edge Functions |
| Push | Web Push API |

## License

MIT
