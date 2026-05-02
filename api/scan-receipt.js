export const config = { runtime: 'edge' };

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

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });


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

  let base64, mimeType;
  try {
    const body = await req.json();
    base64 = body.image;
    mimeType = body.mimeType || 'image/jpeg';
  } catch {
    return json({ error: 'Ошибка чтения тела запроса' }, 400);
  }
  if (!base64) return json({ error: 'Пустой файл' }, 400);

  let aiResp;
  try {
    aiResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    });
  } catch (e) {
    return json({ error: 'ai_error', detail: e.message }, 502);
  }

  if (!aiResp.ok) {
    const detail = await aiResp.text();
    return json({ error: 'ai_error', detail }, 502);
  }

  const aiData = await aiResp.json();
  const raw = aiData.choices?.[0]?.message?.content ?? '[]';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let items;
  try { items = JSON.parse(cleaned); } catch {
    return json({ error: 'parse_error', raw }, 422);
  }

  const valid = (Array.isArray(items) ? items : []).filter(i => i && i.amount > 0 && i.name);
  return json({ items: valid });
}
