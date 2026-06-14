import { createClient } from '@supabase/supabase-js';
import { type Env, verifyToken, getCookie, json } from './_auth';

function sanitize(input: string): string {
  return input.replace(/[,()]/g, '').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const token = getCookie(context.request, 'admin_session');
  if (!token || !(await verifyToken(token, context.env.SESSION_SECRET))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const route = (context.params.route as string[]).join('/');

  if (context.request.method === 'GET' && route === 'session') {
    return json({ ok: true });
  }

  if (context.request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const sb = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_KEY);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  switch (route) {
    // ── Brewery ──────────────────────────────────────────────────────────
    case 'brewery/update': {
      const { id, oldName, fields } = body as {
        id: number; oldName: string;
        fields: { name?: string; name_ja?: string; prefecture?: string; country?: string; website_url?: string; untappd_url?: string };
      };
      if (fields.name && fields.name !== oldName) {
        await sb.from('brewery_aliases').upsert({ brewery_id: id, alias: oldName }, { onConflict: 'alias' });
        await sb.from('beers').update({ brewery: fields.name }).eq('brewery', oldName);
      }
      const { error } = await sb.from('breweries').update(fields).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'brewery/approve': {
      const { id } = body as { id: number };
      const { error } = await sb.from('breweries').update({ needs_review: false }).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'brewery/delete': {
      const { id } = body as { id: number };
      await sb.from('beers').update({ brewery: null, brewery_id: null }).eq('brewery_id', id);
      const { error } = await sb.from('breweries').delete().eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'brewery/collab': {
      const { id, is_collab } = body as { id: number; is_collab: boolean };
      const { error } = await sb.from('breweries').update({ is_collab, needs_review: false }).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'brewery/count-beers': {
      const { id } = body as { id: number };
      const { count } = await sb.from('beers').select('id', { count: 'exact', head: true }).eq('brewery_id', id);
      return json({ count: count ?? 0 });
    }

    case 'brewery/samples': {
      const { id } = body as { id: number };
      const { data } = await sb.from('beers').select('name, instagram_username').eq('brewery_id', id).limit(3);
      return json((data ?? []).map((b: { name: string; instagram_username: string }) => ({
        beer_name: b.name,
        instagram_username: b.instagram_username,
      })));
    }

    // ── Style ────────────────────────────────────────────────────────────
    case 'style/update': {
      const { id, fields } = body as { id: number; fields: { name?: string; category?: string } };
      if (fields.name) {
        const { data: old } = await sb.from('styles').select('name').eq('id', id).single();
        if (old && old.name !== fields.name) {
          await sb.from('beers').update({ style: fields.name }).eq('style', old.name);
        }
      }
      const { error } = await sb.from('styles').update(fields).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'style/approve': {
      const { id } = body as { id: number };
      const { error } = await sb.from('styles').update({ needs_review: false }).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'style/delete': {
      const { id } = body as { id: number };
      const { error } = await sb.from('styles').delete().eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ── Bar ──────────────────────────────────────────────────────────────
    case 'bar/add': {
      const { bar } = body as { bar: { name: string; name_en: string | null; instagram: string; type?: string | null } };
      const { error } = await sb.from('bars').insert({
        instagram_username: bar.instagram,
        name: bar.name,
        name_en: bar.name_en ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'bar/exclude': {
      const { instagram } = body as { instagram: string };
      const { error } = await sb.from('bars').insert({ instagram_username: instagram, status: 'excluded' });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'bar/snooze': {
      const { instagram_username } = body as { instagram_username: string };
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: bar } = await sb.from('bars').select('snooze_count').eq('instagram_username', instagram_username).single();
      const { error } = await sb.from('bars').update({
        alert_snoozed_until: until,
        snooze_count: (bar?.snooze_count ?? 0) + 1,
      }).eq('instagram_username', instagram_username);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'bar/status': {
      const { instagram_username, status } = body as { instagram_username: string; status: 'inactive' | 'closed' };
      const { error } = await sb.from('bars').update({ status }).eq('instagram_username', instagram_username);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ── Beer ─────────────────────────────────────────────────────────────
    case 'beer/search': {
      const q = sanitize(String(body.query ?? '').trim());
      if (!q) return json([]);
      const { data, error } = await sb
        .from('beers')
        .select('id, name, name_ja, name_en, brewery, style, abv, notes, instagram_username, posts(posted_at)')
        .or(`name.ilike.%${q}%,brewery.ilike.%${q}%,instagram_username.ilike.%${q}%`)
        .order('id', { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 500);
      return json((data ?? []).map((b: Record<string, unknown>) => ({
        id: b.id,
        name: b.name,
        name_ja: b.name_ja,
        name_en: b.name_en,
        brewery: b.brewery,
        style: b.style,
        abv: b.abv,
        notes: b.notes,
        instagram_username: b.instagram_username,
        posted_at: (b.posts as { posted_at: string } | null)?.posted_at ?? '',
      })));
    }

    case 'beer/update': {
      const { id, fields } = body as {
        id: number;
        fields: { name?: string; name_ja?: string; name_en?: string; brewery?: string; style?: string; abv?: string; notes?: string };
      };
      const { error } = await sb.from('beers').update(fields).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'beer/delete': {
      const { id } = body as { id: number };
      const { error } = await sb.from('beers').delete().eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    default:
      return json({ error: 'Not found' }, 404);
  }
};
