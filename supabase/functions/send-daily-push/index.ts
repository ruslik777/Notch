import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPA_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:rusia25061996@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

const SLOTS = [
  { id: 'morning',    hour: 9,  min: 0,  title: 'Notch',    body: 'Доброе утро! Не забудь записать траты сегодня' },
  { id: 'evening',    hour: 20, min: 0,  title: 'Notch 🔥', body: 'Стрик в опасности — запиши трату до полуночи' },
  { id: 'lastchance', hour: 22, min: 30, title: 'Notch 🆘', body: 'Осталось 1.5 часа! Последний шанс сохранить стрик' },
] as const;

type SlotId = typeof SLOTS[number]['id'];

function localHourMin(date: Date, tz: string): { h: number; m: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0');
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
    return { h, m };
  } catch {
    return { h: date.getUTCHours(), m: date.getUTCMinutes() };
  }
}

function localDateStr(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date); // YYYY-MM-DD
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function whichSlot(h: number, m: number): SlotId | null {
  for (const s of SLOTS) {
    const diff = (h * 60 + m) - (s.hour * 60 + s.min);
    if (diff >= 0 && diff < 30) return s.id;
  }
  return null;
}

Deno.serve(async () => {
  const now  = new Date();
  const supa = createClient(SUPA_URL, SUPA_KEY);

  const { data: subs, error } = await supa
    .from('push_subscriptions')
    .select('user_id, subscription, timezone, sent_morning, sent_evening, sent_lastchance');

  if (error || !subs?.length) return new Response('no subs', { status: 200 });

  const userIds = subs.map(s => s.user_id);
  const { data: profiles } = await supa
    .from('profiles')
    .select('id, last_entry_date')
    .in('id', userIds);
  const lastEntry = new Map((profiles ?? []).map(p => [p.id, p.last_entry_date as string | null]));

  const sends: Promise<unknown>[] = [];
  const updates: Promise<unknown>[] = [];

  for (const sub of subs) {
    const tz       = sub.timezone || 'Europe/Moscow';
    const today    = localDateStr(now, tz);
    const { h, m } = localHourMin(now, tz);
    const slot     = whichSlot(h, m);
    if (!slot) continue;

    // Skip if already sent this slot today
    const sentKey = `sent_${slot}` as keyof typeof sub;
    if (sub[sentKey] === today) continue;

    // Skip if user already logged today
    const last = lastEntry.get(sub.user_id);
    if (last && last >= today) continue;

    const info    = SLOTS.find(s => s.id === slot)!;
    const payload = JSON.stringify({ title: info.title, body: info.body, tag: 'notch-' + slot });

    sends.push(
      webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload)
        .then(() => {
          updates.push(
            supa.from('push_subscriptions')
              .update({ [sentKey]: today })
              .eq('user_id', sub.user_id)
          );
        })
        .catch(async (err) => {
          if (err?.statusCode === 410) {
            await supa.from('push_subscriptions').delete().eq('user_id', sub.user_id);
          }
        })
    );
  }

  await Promise.allSettled(sends);
  await Promise.allSettled(updates);

  return new Response(`done, checked ${subs.length} subs`, { status: 200 });
});
