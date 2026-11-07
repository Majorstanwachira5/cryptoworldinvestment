export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lwsybancxxqwrmxneyui.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_S6vgt2hh2EkC9WeBer8jRw_5gy2Fj_R';

export const supabase = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  from(table: string) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };
    return {
      async select(columns = '*') {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}`, {
          headers,
          cache: 'no-store',
        });
        const data = res.ok ? await res.json() : null;
        return { data, error: res.ok ? null : { status: res.status, message: res.statusText } };
      },
      async insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(payload),
        });
        return { error: res.ok ? null : { status: res.status, message: res.statusText } };
      },
      async upsert(
        payload: Record<string, unknown> | Record<string, unknown>[],
        options?: string | { onConflict?: string }
      ) {
        const conflictCol = typeof options === 'string' ? options : options?.onConflict;
        const query = conflictCol ? `?on_conflict=${encodeURIComponent(conflictCol)}` : '';
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(payload),
        });
        return { error: res.ok ? null : { status: res.status, message: res.statusText } };
      },
    };
  },
};
