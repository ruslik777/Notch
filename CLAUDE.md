# Notch — Architecture

## Stack
- Vanilla JS ES6 modules, no bundler
- Supabase (auth + DB) via UMD CDN build
- PWA: `sw.js` + `manifest.json` (do not modify these)
- Hosted on Netlify, deploy via git push

## File layout

```
app.html              — thin HTML shell (~5KB, no JS logic)
src/
  styles/app.css      — all CSS (dark theme default, light via @media prefers-color-scheme)
  js/
    config.js         — constants + credential PLACEHOLDERS (__SUPABASE_URL__ etc)
    api.js            — supa client, AUTH, STATE, DB, RATES, loadState(), syncUser()
    format.js         — toDay(), fmt(), getCur(), greet(), pluralDays()
    gamification.js   — XP, levels, streaks, quests, achievements, leagues, insights
    render.js         — renderHome/Quests/History/Profile/All + renderAvatarEl
    friends.js        — friends list, weekly race, notch ID search/add/remove
    notifications.js  — SW init, push scheduling, notif chars, biometric toggle helpers
    avatar.js         — avatar picker (color / preset SVG / photo upload)
    modals.js         — expense/income modals, settings, savings goals, QR scanner, share
    auth.js           — sign in/up, onboarding, biometric (WebAuthn), sign out/reset
    app.js            — entry point: init(), navigation, window.* exports for onclick attrs
```

## Key patterns

### AUTH object (not reassignable exports)
```js
// api.js
export const AUTH = { uid: null, email: null };
// mutate properties from any module — never reassign AUTH itself
AUTH.uid   = session.user.id;
AUTH.email = session.user.email;
```

### Window globals for onclick= attrs
All functions referenced in HTML `onclick=` are exposed in `app.js`:
```js
Object.assign(window, { openModal, saveExpense, ... });
```
Never add new `onclick=` functions in HTML without also adding them here.

### Circular dependency avoidance
`api.js` → `render.js` would be circular. Instead `api.js` uses:
```js
if (STATE.user && typeof window.renderAll === 'function') window.renderAll();
```
Same pattern for `gamification.js` calling `renderHome`, `showPremiumScreen`.

### Supabase credentials
`src/js/config.js` contains only placeholders:
```js
export const SUPABASE_URL      = '__SUPABASE_URL__';
export const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
```
Netlify build command replaces these with env vars. **Never hardcode real values.**

## Netlify build
```toml
command = "sed -i 's|__SUPABASE_URL__|...|g' src/js/config.js && ..."
```
Env vars to set in Netlify dashboard: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

## CSS variables
`--bg`, `--s1`–`--s3`, `--ac`, `--text`, `--t2`, `--t3`, `--brd`, `--b2`, `--gold`, `--red`, `--green`, `--ease`, `--ease-drawer`

Dark theme by default. Light overrides in `@media (prefers-color-scheme: light)`.

## Fonts
- Body: `Archivo` (400/500/600/700/800)
- Display: `Barlow Condensed` (700/800)
- Loaded via `<link>` in `app.html` head

## Do NOT touch
- `sw.js` — service worker for push notifications
- `manifest.json` — PWA manifest
