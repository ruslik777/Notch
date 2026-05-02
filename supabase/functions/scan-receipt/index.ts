const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPA_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPA_ANON      = Deno.env.get('SUPABASE_ANON_KEY')!;

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  try {
    const { image_base64, mime_type } = await req.json();
    if (!image_base64) return new Response('no image', { status: 400, headers: cors });

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mime_type || 'image/jpeg', data: image_base64 } },
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const detail = await geminiResp.text();
      return new Response(JSON.stringify({ error: 'gemini_error', detail }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResp.json();
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let items;
    try {
      items = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: 'parse_error', raw }), {
        status: 422, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const valid = (Array.isArray(items) ? items : [])
      .filter((i: any) => i && typeof i.amount === 'number' && i.amount > 0 && i.name);

    return new Response(JSON.stringify({ items: valid }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
