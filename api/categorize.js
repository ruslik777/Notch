export const config = { runtime: 'edge' };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
  });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const authCheck = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: process.env.SUPABASE_ANON_KEY },
  }).catch(() => null);
  if (!authCheck?.ok) return json({ error: 'Unauthorized' }, 401);

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) return json({ error: 'no_api_key' }, 500);

  let body;
  try { body = await req.json(); } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { note, past = [] } = body;
  if (!note) return json({ error: 'no_note' }, 400);

  const pastContext = past.length
    ? `Прошлые записи пользователя: ${JSON.stringify(past.slice(0, 10))}.`
    : '';

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
        max_tokens: 60,
        messages: [{
          role: 'user',
          content: `${pastContext} Пользователь вводит трату: "${note}". Определи категорию. Доступные категории: food, transport, coffee, cafe, delivery, entertain, clothing, health, subscr, other. Ответь ТОЛЬКО JSON без markdown: {"cat":"категория"}`,
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

  let result;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : { cat: 'other' };
  } catch {
    result = { cat: 'other' };
  }

  const validCats = ['food','transport','coffee','cafe','delivery','entertain','clothing','health','subscr','other'];
  if (!validCats.includes(result.cat)) result.cat = 'other';

  return json(result);
}
