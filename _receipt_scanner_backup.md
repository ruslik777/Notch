# Receipt Scanner — Backup

Временно убрано из приложения. Чтобы вернуть — восстановить каждый раздел в соответствующий файл.

---

## 1. `api/scan-receipt.js` (полный файл)

```js
export const config = { runtime: 'edge' };

const PROMPT = `Ты читаешь фотографию или скриншот кассового чека.

КРИТИЧЕСКИ ВАЖНО: извлекай ТОЛЬКО те товары, которые ты РЕАЛЬНО ВИДИШЬ напечатанными в чеке. НЕ придумывай, НЕ угадывай, НЕ добавляй товары которых нет на изображении. Если текст нечёткий — пытайся прочитать, но не изобретай.

Верни ТОЛЬКО валидный JSON массив. Формат:
[{"name":"краткое название по-русски макс 28 символов","amount":число,"cat":"категория"}]

Категории:
food — продукты, напитки, молочное, мясо, овощи, фрукты, снеки
cafe — готовая еда, фастфуд, ресторан, суши, пицца
coffee — кофе, чай (кофейня/кафе)
transport — такси, каршеринг, заправка
clothing — одежда, обувь, аксессуары
health — аптека, витамины, спорт
entertain — кино, игры, развлечения
subscr — подписки, сервисы
other — бытовая химия, хозтовары, табак, товары для животных, всё остальное

Правила:
- Строки «Итого», «Сумма», «Доставка», «Скидка», «НДС», «ИТОГ» — ПРОПУСКАЙ
- amount — только итоговая цена позиции (число, без ₽)
- Если у позиции цена = количество × стоимость (напр. 255.00×2шт. = 510.00), бери итог (510)
- Если цена не читается — пропусти позицию
- Никаких выдуманных товаров. Только то что видишь.`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function bufToBase64(bytes) {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const authCheck = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: process.env.SUPABASE_ANON_KEY },
  }).catch(() => null);
  if (!authCheck?.ok) return json({ error: 'Unauthorized' }, 401);

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return json({ error: 'no_api_key' }, 500);

  let arrayBuffer;
  try { arrayBuffer = await req.arrayBuffer(); } catch {
    return json({ error: 'Ошибка чтения файла' }, 400);
  }
  if (!arrayBuffer.byteLength) return json({ error: 'Пустой файл' }, 400);

  const base64 = bufToBase64(new Uint8Array(arrayBuffer));
  const mimeType = (req.headers.get('content-type') || 'image/jpeg').split(';')[0];

  let aiResp;
  try {
    aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ]}],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });
  } catch (e) {
    return json({ error: 'ai_error', detail: e.message }, 502);
  }

  if (!aiResp.ok) {
    const detail = await aiResp.text();
    return json({ error: 'ai_error', detail }, 502);
  }

  const aiData = await aiResp.json();
  const raw = aiData.choices?.[0]?.message?.content ?? '';

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return json({ error: 'parse_error', detail: `raw: ${raw.slice(0, 400)}`, raw }, 422);

  let items;
  try { items = JSON.parse(match[0]); } catch (e) {
    return json({ error: 'parse_error', detail: `json err: ${e.message} | raw: ${raw.slice(0, 300)}`, raw }, 422);
  }

  const valid = (Array.isArray(items) ? items : []).filter(i => i && i.amount > 0 && i.name);
  return json({ items: valid });
}
```

---

## 2. `vercel.json` — добавить в `functions`

```json
"api/scan-receipt.js": { "maxDuration": 60 }
```

---

## 3. `app.html` — кнопка "Скрин чека" (внутри `.scan-btns-row`, после кнопки QR)

```html
<button class="scan-qr-btn" onclick="openReceiptSheet()">
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
  Скрин чека
</button>
```

## 3b. `app.html` — шит сканера (перед `<!-- ── STAT SHEETS ── -->`)

```html
<!-- ── RECEIPT SCANNER SHEET ── -->
<div id="receipt-overlay" class="fp-overlay" onclick="closeReceiptSheet()"></div>
<div id="receipt-sheet" class="fp-sheet rc-sheet">
  <div class="fp-handle"></div>
  <div class="rc-header">
    <div class="rc-title">Скан чека</div>
    <button class="fp-close" onclick="closeReceiptSheet()">✕</button>
  </div>
  <div id="receipt-body" class="rc-body"></div>
  <div id="receipt-footer" class="rc-footer" style="display:none"></div>
</div>
```

---

## 4. `src/js/modals.js` — весь блок (добавить перед последней строкой файла)

```js
/* ── Receipt scanner ── */

let _receiptItems = [];

export function openReceiptSheet() {
  closeModal();
  document.getElementById('receipt-overlay').classList.add('open');
  document.getElementById('receipt-sheet').classList.add('open');
  _setReceiptState('idle');
}

export function closeReceiptSheet() {
  document.getElementById('receipt-overlay').classList.remove('open');
  document.getElementById('receipt-sheet').classList.remove('open');
  _receiptItems = [];
}

function _resc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _setReceiptState(state, errMsg) {
  const body = document.getElementById('receipt-body');
  if (!body) return;

  if (state === 'idle') {
    body.innerHTML = `
      <div class="rc-idle">
        <div class="rc-idle-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/><path d="M15 15l-2-2-2 2"/></svg>
        </div>
        <div class="rc-idle-title">Сканировать чек</div>
        <div class="rc-idle-sub">AI распознает товары и расставит категории автоматически</div>
        <div class="rc-idle-btns">
          <button class="rc-upload-btn rc-cam-btn" onclick="openReceiptCamera()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Камера
          </button>
          <label class="rc-upload-btn" for="receipt-file-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Скриншот
          </label>
        </div>
        <input type="file" id="receipt-file-input" accept="image/*" style="display:none" onchange="processReceiptImage(this)">
      </div>`;
  } else if (state === 'loading') {
    body.innerHTML = `
      <div class="rc-loading">
        <div class="rc-spinner"></div>
        <div class="rc-loading-title rc-loading-text">Читаю файл…</div>
        <div class="rc-loading-sub">AI читает позиции и определяет категории</div>
      </div>`;
  } else if (state === 'error') {
    body.innerHTML = `
      <div class="rc-idle">
        <div class="rc-idle-icon" style="color:var(--red)">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="rc-idle-title">Не удалось распознать</div>
        <div class="rc-idle-sub">${_resc(errMsg || 'Попробуй ещё раз')}</div>
        <div class="rc-idle-btns">
          <button class="rc-upload-btn rc-cam-btn" onclick="openReceiptCamera()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Камера
          </button>
          <label class="rc-upload-btn" for="receipt-file-input2">Скриншот</label>
        </div>
        <input type="file" id="receipt-file-input2" accept="image/*" style="display:none" onchange="processReceiptImage(this)">
      </div>`;
  } else if (state === 'results') {
    _renderReceiptResults();
  }
}

function _catOptions(selected) {
  return CATS.map(c =>
    `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.name}</option>`
  ).join('');
}

function _renderReceiptResults() {
  const body = document.getElementById('receipt-body');
  if (!body) return;
  const total = _receiptItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const rows = _receiptItems.map((item, idx) => `
    <div class="rc-item" id="rc-item-${idx}">
      <select class="rc-cat-sel" onchange="updateReceiptCat(${idx},this.value)">
        ${_catOptions(item.cat)}
      </select>
      <div class="rc-item-mid">
        <div class="rc-item-name">${_resc(item.name)}</div>
        <div class="rc-item-amt">${fmt(item.amount)}</div>
      </div>
      <button class="rc-item-del" onclick="removeReceiptItem(${idx})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  body.innerHTML = `
    <div class="rc-results">
      <div class="rc-count">${_receiptItems.length} позиций · итого ${fmt(total)}</div>
      <div class="rc-list">${rows}</div>
    </div>`;

  const footer = document.getElementById('receipt-footer');
  if (footer) {
    footer.style.display = '';
    footer.innerHTML = `
      <label class="rc-rescan-btn" for="receipt-file-input3">Другой скрин</label>
      <input type="file" id="receipt-file-input3" accept="image/*" style="display:none" onchange="processReceiptImage(this)">
      <button class="rc-save-btn" onclick="saveReceiptItems()">
        Сохранить ${_receiptItems.length} ${_receiptItems.length === 1 ? 'трату' : _receiptItems.length < 5 ? 'траты' : 'трат'}
      </button>`;
  }
}

function _setReceiptLoadingText(text) {
  const el = document.querySelector('.rc-loading-text');
  if (el) el.textContent = text;
}

async function _sendFileToGemini(file) {
  _setReceiptLoadingText(`Читаю файл (${Math.round(file.size / 1024)} КБ)…`);
  const bytes = await file.arrayBuffer();

  const { data: { session } } = await supa.auth.getSession();
  if (!session) throw new Error('Не авторизован');

  _setReceiptLoadingText('Анализирую чек…');
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 55000);
  let resp;
  try {
    resp = await fetch('/api/scan-receipt', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: bytes,
    });
  } finally { clearTimeout(tid); }

  let data;
  try { data = await resp.json(); } catch {
    throw new Error(`Сервер вернул ошибку (${resp.status})`);
  }
  if (!resp.ok || data.error) throw new Error(data.detail || data.error || `HTTP ${resp.status}`);
  _receiptItems = (data.items || []).filter(i => i && i.amount > 0);
  if (!_receiptItems.length) throw new Error('Позиции не найдены — попробуй другой скрин');
  _setReceiptState('results');
}

export async function processReceiptImage(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    _setReceiptState('error', 'Файл слишком большой — используй кнопку Камера');
    return;
  }
  _setReceiptState('loading');
  document.getElementById('receipt-footer')?.style.setProperty('display', 'none');
  try {
    await _sendFileToGemini(file);
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Превышено время ожидания — попробуй через камеру' : err.message;
    _setReceiptState('error', msg);
  }
}

let _camStream = null;

export async function openReceiptCamera() {
  const body = document.getElementById('receipt-body');
  if (!body) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    document.getElementById('receipt-file-input')?.click();
    return;
  }
  try {
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    body.innerHTML = `
      <div class="rc-camera">
        <video id="rc-video" autoplay playsinline muted></video>
        <div class="rc-cam-actions">
          <button class="rc-rescan-btn" onclick="closeReceiptCamera()">Отмена</button>
          <button class="rc-capture-btn" onclick="captureReceiptPhoto()">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
          </button>
          <div style="width:72px"></div>
        </div>
      </div>`;
    document.getElementById('rc-video').srcObject = _camStream;
  } catch {
    _setReceiptState('error', 'Нет доступа к камере — разреши в настройках');
  }
}

export function closeReceiptCamera() {
  _camStream?.getTracks().forEach(t => t.stop());
  _camStream = null;
  _setReceiptState('idle');
}

export function captureReceiptPhoto() {
  const video = document.getElementById('rc-video');
  if (!video) return;

  const MAX = 900;
  let w = video.videoWidth || 640;
  let h = video.videoHeight || 480;
  if (w > MAX || h > MAX) {
    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
    else        { w = Math.round(w * MAX / h); h = MAX; }
  }

  _camStream?.getTracks().forEach(t => t.stop());
  _camStream = null;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);

  _setReceiptState('loading');
  document.getElementById('receipt-footer')?.style.setProperty('display', 'none');

  canvas.toBlob(async (blob) => {
    if (!blob) { _setReceiptState('error', 'Не удалось сделать снимок'); return; }
    try {
      await _sendFileToGemini(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Превышено время ожидания — попробуй ещё раз' : err.message;
      _setReceiptState('error', msg);
    }
  }, 'image/jpeg', 0.82);
}

export function updateReceiptCat(idx, cat) {
  if (_receiptItems[idx]) _receiptItems[idx].cat = cat;
}

export function removeReceiptItem(idx) {
  _receiptItems.splice(idx, 1);
  if (!_receiptItems.length) {
    _setReceiptState('idle');
    const footer = document.getElementById('receipt-footer');
    if (footer) footer.style.display = 'none';
  } else {
    _renderReceiptResults();
  }
}

export async function saveReceiptItems() {
  if (!_receiptItems.length) return;
  const btn = document.querySelector('.rc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Сохраняем...'; }

  const today = toDay();
  for (const item of _receiptItems) {
    const amt = parseFloat(item.amount);
    if (!amt || amt <= 0) continue;
    const exp = {
      id:     Date.now() + Math.random(),
      cat:    item.cat || 'other',
      amount: amt,
      note:   item.name || '',
      date:   today,
    };
    DB.addExp(exp);
    addXP(5);
    await _insertExpense(exp);
  }

  await checkQuestCompletion();
  checkAchievements();
  renderAll();
  closeReceiptSheet();
  setTimeout(showPostExpenseNudge, 600);
}
```

---

## 5. `src/styles/app.css` — добавить в конец (или к другим `.rc-` стилям)

```css
/* Receipt scanner */
.scan-btns-row { display: flex; gap: 8px; margin: 0 0 4px; }
.scan-btns-row .scan-qr-btn { flex: 1; }
.rc-sheet { display: flex; flex-direction: column; }
.rc-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; border-bottom: 1px solid var(--brd); flex-shrink: 0; }
.rc-title { font-family: 'Unbounded', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); }
.rc-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.rc-footer { display: flex; gap: 8px; padding: 12px 16px calc(env(safe-area-inset-bottom,0px) + 12px); border-top: 1px solid var(--brd); flex-shrink: 0; align-items: center; }
.rc-save-btn { flex: 1; background: var(--ac); color: #fff; border: none; border-radius: 14px; padding: 14px; font-size: 15px; font-weight: 700; font-family: 'Archivo', sans-serif; cursor: pointer; transition: opacity .15s; }
.rc-save-btn:active { opacity: .8; }
.rc-save-btn:disabled { opacity: .5; }
.rc-rescan-btn { padding: 10px 14px; background: var(--s1); border: 1.5px solid var(--brd); border-radius: 12px; font-size: 13px; font-weight: 600; color: var(--t2); cursor: pointer; white-space: nowrap; display: flex; align-items: center; }
.rc-idle { display: flex; flex-direction: column; align-items: center; padding: 48px 24px 32px; gap: 12px; text-align: center; }
.rc-idle-btns { display: flex; gap: 10px; margin-top: 4px; }
.rc-cam-btn { background: var(--ac) !important; color: #fff !important; border-color: transparent !important; }
.rc-camera { display: flex; flex-direction: column; height: 100%; min-height: 320px; }
.rc-camera video { width: 100%; flex: 1; min-height: 0; object-fit: cover; border-radius: 14px; background: #000; }
.rc-cam-actions { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px 8px; }
.rc-capture-btn { width: 64px; height: 64px; border-radius: 50%; background: #fff; border: 4px solid var(--ac); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ac); transition: transform 0.15s; }
.rc-capture-btn:active { transform: scale(0.92); }
.rc-idle-icon { color: var(--t3); }
.rc-idle-title { font-size: 17px; font-weight: 800; color: var(--text); }
.rc-idle-sub { font-size: 13px; color: var(--t2); line-height: 1.5; max-width: 260px; }
.rc-upload-btn { margin-top: 8px; display: flex; align-items: center; gap: 8px; background: var(--ac); color: #fff; border-radius: 14px; padding: 14px 28px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Archivo', sans-serif; transition: opacity .15s; }
.rc-upload-btn:active { opacity: .8; }
.rc-loading { display: flex; flex-direction: column; align-items: center; padding: 64px 24px; gap: 20px; }
.rc-spinner { width: 40px; height: 40px; border: 3px solid var(--brd); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.rc-loading-title { font-size: 16px; font-weight: 700; color: var(--text); }
.rc-loading-sub { font-size: 13px; color: var(--t2); text-align: center; }
.rc-results { padding: 12px 0; }
.rc-count { font-size: 12px; color: var(--t2); font-weight: 600; padding: 0 16px 10px; text-transform: uppercase; letter-spacing: .04em; }
.rc-list { display: flex; flex-direction: column; gap: 1px; }
.rc-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--bg); transition: background .12s; }
.rc-item:active { background: var(--s1); }
.rc-cat-sel { background: var(--s1); border: 1.5px solid var(--brd); border-radius: 10px; padding: 6px 8px; font-size: 12px; font-weight: 600; color: var(--text); font-family: 'Archivo', sans-serif; cursor: pointer; flex-shrink: 0; max-width: 110px; }
.rc-item-mid { flex: 1; min-width: 0; }
.rc-item-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-item-amt { font-size: 13px; color: var(--t2); margin-top: 2px; }
.rc-item-del { background: none; border: none; color: var(--t3); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .12s, color .12s; }
.rc-item-del:active { background: var(--s2); color: var(--red); }
```

---

## 6. `src/js/app.js` — импорты (добавить в блок импорта из `./modals.js`)

```js
openReceiptSheet, closeReceiptSheet, processReceiptImage,
openReceiptCamera, closeReceiptCamera, captureReceiptPhoto,
updateReceiptCat, removeReceiptItem, saveReceiptItems,
```

## 6b. `src/js/app.js` — window exports (добавить в `Object.assign(window, {...})`)

```js
// receipt scanner
openReceiptSheet, closeReceiptSheet, processReceiptImage,
openReceiptCamera, closeReceiptCamera, captureReceiptPhoto,
updateReceiptCat, removeReceiptItem, saveReceiptItems,
```
