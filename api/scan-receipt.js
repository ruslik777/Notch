export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

const PROMPT = `Ты анализируешь скриншот чека или заказа из магазина/доставки.
Извлеки все товарные позиции с их ценами.

Верни ТОЛЬКО валидный JSON массив без лишних слов. Формат:
[{"name":"краткое название по-русски макс 28 символов","amount":число,"cat":"категория"}]

Категории — выбирай одну из списка:
food — продукты питания, овощи, фрукты, молочное, мясо, крупы, напитки
cafe — готовая еда, фастфуд, ресторан, суши, пицца
delivery — доставка товаров (не еды)
coffee — кофе, чай в кофейне
transport — такси, каршеринг, транспорт, заправка
clothing — одежда, обувь, аксессуары
health — аптека, медицина, витамины, спорт
entertain — кино, игры, развлечения
subscr — подписки, приложения, сервисы
other — бытовая химия, хозтовары, товары для животных, всё остальное

Правила:
- Строки «Итого», «Доставка», «Товары», «Скидка» — ПРОПУСКАЙ
- amount — только число (цена), без символов валюты
- Если цена не видна — пропусти позицию
- name — короткое, понятное название`;

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const authHeader = req.headers['authorization'];
  if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const authCheck = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: process.env.SUPABASE_ANON_KEY },
  }).catch(() => null);
  if (!authCheck?.ok) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) { res.status(500).json({ error: 'no_api_key' }); return; }

  let buffer;
  try { buffer = await readBody(req); } catch {
    res.status(400).json({ error: 'Ошибка чтения файла' }); return;
  }
  if (!buffer.length) { res.status(400).json({ error: 'Пустой файл' }); return; }

  const base64 = buffer.toString('base64');
  const mimeType = (req.headers['content-type'] || 'image/jpeg').split(';')[0];

  const aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [{ role: 'user', content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ]}],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  }).catch(e => { throw new Error(`AI: ${e.message}`); });

  if (!aiResp.ok) {
    const detail = await aiResp.text();
    res.status(502).json({ error: 'ai_error', detail }); return;
  }

  const aiData = await aiResp.json();
  const raw = aiData.choices?.[0]?.message?.content ?? '[]';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let items;
  try { items = JSON.parse(cleaned); } catch {
    res.status(422).json({ error: 'parse_error', raw }); return;
  }

  const valid = (Array.isArray(items) ? items : []).filter(i => i && i.amount > 0 && i.name);
  res.status(200).json({ items: valid });
}
