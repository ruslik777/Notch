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

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) return json({ error: 'no_api_key' }, 500);

  let arrayBuffer;
  try { arrayBuffer = await req.arrayBuffer(); } catch {
    return json({ error: 'Ошибка чтения файла' }, 400);
  }
  if (!arrayBuffer.byteLength) return json({ error: 'Пустой файл' }, 400);

  const base64 = bufToBase64(new Uint8Array(arrayBuffer));
  const mimeType = (req.headers.get('content-type') || 'image/jpeg').split(';')[0];
  // Claude supports: image/jpeg, image/png, image/gif, image/webp
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mediaType = allowedMimes.includes(mimeType) ? mimeType : 'image/jpeg';

  let aiResp;
  try {
    aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        }],
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
  const raw = aiData.content?.[0]?.text ?? '';

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return json({ error: 'parse_error', detail: `raw: ${raw.slice(0, 400)}`, raw }, 422);

  let items;
  try { items = JSON.parse(match[0]); } catch (e) {
    return json({ error: 'parse_error', detail: `json err: ${e.message} | raw: ${raw.slice(0, 300)}`, raw }, 422);
  }

  const valid = (Array.isArray(items) ? items : []).filter(i => i && i.amount > 0 && i.name);
  return json({ items: valid });
}
