import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPA_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPA_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPA_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:rusia25061996@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return new Response('unauthorized', { status: 401 });

  const { to_uid, from_name } = await req.json();
  if (!to_uid || !from_name) return new Response('bad request', { status: 400 });

  const svc = createClient(SUPA_URL, SUPA_SERVICE);

  // Once per day: insert fails if already nudged today
  const today = new Date().toISOString().slice(0, 10);
  const { error: rateErr } = await svc.from('nudges').insert({
    from_uid: user.id, to_uid, date: today,
  });
  if (rateErr) return new Response('already_nudged', { status: 429 });

  // Get target's push subscription
  const { data: sub } = await svc
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', to_uid)
    .single();

  if (!sub) return new Response('no_subscription', { status: 200 });

  const payload = JSON.stringify({
    title: '👋 Нюдж!',
    body: `${from_name} говорит: не забудь записать трату сегодня!`,
    tag: 'notch-nudge',
  });

  try {
    await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload);
    return new Response('sent', { status: 200 });
  } catch (e: any) {
    if (e?.statusCode === 410) {
      await svc.from('push_subscriptions').delete().eq('user_id', to_uid);
    }
    return new Response('push_failed', { status: 200 });
  }
});
