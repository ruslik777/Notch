import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPA_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPA_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:rusia25061996@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

// MSK = UTC+3
// 09:00 MSK = 06:00 UTC
// 20:00 MSK = 17:00 UTC
// 22:30 MSK = 19:30 UTC
const SLOTS = [
  { utcHour: 6,  utcMin: 0,  slot: 'morning',    title: 'Notch',    body: 'Доброе утро! Не забудь записать траты сегодня' },
  { utcHour: 17, utcMin: 0,  slot: 'evening',    title: 'Notch 🔥', body: 'Стрик в опасности — запиши трату до полуночи' },
  { utcHour: 19, utcMin: 30, slot: 'lastchance', title: 'Notch 🆘', body: 'Осталось 1.5 часа! Последний шанс сохранить стрик' },
];

Deno.serve(async () => {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();

  const slot = SLOTS.find(s => s.utcHour === h && Math.abs(s.utcMin - m) <= 10);
  if (!slot) {
    return new Response(`skip (UTC ${h}:${String(m).padStart(2,'0')})`, { status: 200 });
  }

  const supa = createClient(SUPA_URL, SUPA_KEY);
  const today = now.toISOString().slice(0, 10);

  const { data: subs, error: subsErr } = await supa
    .from('push_subscriptions')
    .select('user_id, subscription');

  if (subsErr || !subs?.length) {
    return new Response('no subscriptions', { status: 200 });
  }

  const userIds = subs.map(s => s.user_id);
  const { data: profiles } = await supa
    .from('profiles')
    .select('id, last_entry_date')
    .in('id', userIds);

  const lastEntryMap = new Map((profiles ?? []).map(p => [p.id, p.last_entry_date]));
  const toNotify = subs.filter(s => {
    const last = lastEntryMap.get(s.user_id);
    return !last || last < today;
  });

  if (!toNotify.length) {
    return new Response('all logged today', { status: 200 });
  }

  const payload = JSON.stringify({ title: slot.title, body: slot.body, tag: 'notch-' + slot.slot });

  const results = await Promise.allSettled(
    toNotify.map(s => webpush.sendNotification(s.subscription as webpush.PushSubscription, payload))
  );

  // Clean up expired subscriptions (HTTP 410 Gone)
  const expired = toNotify
    .filter((_, i) => {
      const r = results[i];
      return r.status === 'rejected' && (r.reason as any)?.statusCode === 410;
    })
    .map(s => s.user_id);

  if (expired.length) {
    await supa.from('push_subscriptions').delete().in('user_id', expired);
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return new Response(`sent ${sent}/${toNotify.length}, slot: ${slot.slot}`, { status: 200 });
});
