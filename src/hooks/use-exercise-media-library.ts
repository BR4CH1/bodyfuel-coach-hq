import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeExerciseMedia, type ExerciseMedia } from "@/lib/exercise-media";

type Row = {
  name: string;
  thumbnail_url: string | null;
  animation_url: string | null;
  media_type: string | null;
  media_source: string | null;
  technique_hint: string | null;
};

const EMPTY: ExerciseMedia = normalizeExerciseMedia({});

/**
 * Liest die Medienfelder der Übungsbibliothek (nur lesend, RLS-gedeckt) und
 * mappt sie per normalisiertem Übungsnamen. Kund:innen können nichts ändern.
 */
export function useExerciseMediaLibrary() {
  const { data } = useQuery({
    queryKey: ["exercise-media-library"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_exercise_library" as any)
        .select("name, thumbnail_url, animation_url, media_type, media_source, technique_hint")
        .eq("is_active", true);
      if (error) throw error;
      const map = new Map<string, ExerciseMedia>();
      for (const row of ((data ?? []) as unknown as Row[])) {
        map.set(row.name.trim().toLowerCase(), normalizeExerciseMedia(row));
      }
      return map;
    },
  });

  return (name: string | null | undefined): ExerciseMedia => {
    const key = (name ?? "").trim().toLowerCase();
    if (!key || !data) return EMPTY;
    return data.get(key) ?? EMPTY;
  };
}
