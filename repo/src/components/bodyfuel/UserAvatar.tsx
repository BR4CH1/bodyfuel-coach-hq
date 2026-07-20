import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Zentraler Avatar für BodyFuel Performance.
 *
 * - Ein User = ein Profilbild (siehe profiles.avatar_url).
 * - Speicherbucket: privates `avatars` Bucket, Pfad = "<user_id>/<file>".
 * - Fallback: Initialen aus Name (max. 2 Zeichen).
 * - Signed URLs werden 45min gecacht, damit Listen mit vielen Athleten nicht
 *   pro Zeile einen Storage-Roundtrip machen.
 */

const CACHE = new Map<string, { url: string; expires: number }>();
const TTL_MS = 45 * 60 * 1000;

async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const cached = CACHE.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  CACHE.set(path, { url: data.signedUrl, expires: Date.now() + TTL_MS });
  return data.signedUrl;
}

export function invalidateAvatarCache(path?: string | null) {
  if (path) CACHE.delete(path);
  else CACHE.clear();
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "•";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type UserAvatarProps = {
  /** storage path in `avatars` bucket (e.g. "<user_id>/avatar.jpg") */
  path?: string | null;
  /** display name for initials fallback */
  name?: string | null;
  size?: number;
  className?: string;
};

export function UserAvatar({ path, name, size = 40, className }: UserAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    resolveAvatarUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);

  const initials = initialsOf(name);
  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-label={name ?? "Profilbild"}
    >
      {url ? (
        <img
          src={url}
          alt={name ?? "Profilbild"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => { invalidateAvatarCache(path); setUrl(null); }}
        />
      ) : (
        <span className="font-semibold tracking-wide">{initials}</span>
      )}
    </div>
  );
}
