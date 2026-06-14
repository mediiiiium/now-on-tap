import { type Env, createToken, json } from './_auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { pin?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!body.pin || body.pin !== context.env.ADMIN_PIN) {
    return json({ error: 'Invalid PIN' }, 401);
  }

  const token = await createToken(context.env.SESSION_SECRET);

  return json({ ok: true }, 200, {
    'Set-Cookie': `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`,
  });
};
