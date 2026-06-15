import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = (scope: string) => `complaints-last-seen:${scope}`;

export function getLastSeen(scope: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(KEY(scope)) ?? 0);
}

export function markSeen(scope: string, ts: number = Date.now()) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(scope), String(ts));
  window.dispatchEvent(new CustomEvent("complaints-seen", { detail: { scope, ts } }));
}

/**
 * Returns the count of complaints updated/created after the last "seen" time.
 * scope = "admin" → all complaints; scope = `resident-<uid>` → just that user's.
 */
export function useUnreadComplaints(scope: string, userId?: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const seen = getLastSeen(scope);
      let q = supabase.from("complaints").select("created_at,updated_at", { count: "exact", head: false });
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      if (!mounted) return;
      const n = (data ?? []).filter((r: { created_at: string; updated_at?: string | null }) => {
        const t = new Date(r.updated_at ?? r.created_at).getTime();
        return t > seen;
      }).length;
      setCount(n);
    };
    load();
    const ch = supabase
      .channel(`unread-${scope}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, load)
      .subscribe();
    const onSeen = (e: Event) => {
      const ev = e as CustomEvent<{ scope: string }>;
      if (ev.detail?.scope === scope) setCount(0);
    };
    window.addEventListener("complaints-seen", onSeen);
    return () => { mounted = false; supabase.removeChannel(ch); window.removeEventListener("complaints-seen", onSeen); };
  }, [scope, userId]);

  return count;
}