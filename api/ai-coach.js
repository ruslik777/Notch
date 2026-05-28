export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Ты — AI финансовый советник приложения Notch. Помогаешь пользователям управлять личными финансами.

Правила:
- Отвечай коротко и конкретно (2-4 предложения максимум)
- Используй данные о реальных расходах пользователя для персональных советов
- Не осуждай. Не читай лекции. Только полезные советы
- Если данных о расходах нет — давай общие советы
- Отвечай по-русски
- Используй числа из реальных данных расходов когда возможно`;

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

  const { message, history = [], expenses = [] } = body;
  if (!message) return json({ error: 'no_message' }, 400);

  // Build expense summary for context
  const expSummary = expenses.length
    ? `Расходы пользователя за последние 30 дней: ${JSON.stringify(expenses.slice(0, 30))}`
    : 'Данные о расходах пока отсутствуют.';

  // Build messages array (keep last 8 messages for context)
  const messages = [
    ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
    {
      role: 'user',
      content: `${expSummary}\n\nВопрос: ${message}`,
    },
  ];

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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages,
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
  const reply = aiData.content?.[0]?.text ?? '';

  return json({ reply });
}
