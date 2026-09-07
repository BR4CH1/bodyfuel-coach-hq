/**
 * E-Mail-Adressen liegen ausschließlich in auth.users, nicht in public.profiles.
 * Dieser Helper liest sie serverseitig über die Auth-Admin-API nach.
 */
export async function loadUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return map;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wanted = new Set(ids);
    for (let page = 1; page <= 5 && wanted.size > 0; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.email && wanted.has(u.id)) {
          map.set(u.id, u.email);
          wanted.delete(u.id);
        }
      }
      if (data.users.length < 200) break;
    }
  } catch {
    /* E-Mails sind optional — Listen dürfen daran nicht scheitern */
  }
  return map;
}
