import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function LandingReviews() {
  const { data: reviews = [] } = useQuery({
    queryKey: ["landing-public-reviews"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("public_app_reviews").select("id,rating,comment,first_name").order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return (data ?? []).filter(r => r.first_name?.trim() && r.rating !== null);
    },
  });
  if (!reviews.length) return null;
  return <section className="border-b border-border py-16 sm:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><p className="text-xs font-semibold text-primary">Erfahrungen mit BodyFuel</p><h2 className="mt-4 text-4xl font-semibold sm:text-5xl">Von euch bewertet.</h2><div className="mt-10 grid gap-6 md:grid-cols-3">{reviews.map(r=><figure key={r.id} className="rounded-lg border border-border bg-card p-6"><div className="flex gap-1 text-primary" aria-label={`${r.rating ?? 0} von 5 Sternen`}>{Array.from({length:Math.min(5,Math.max(0,Math.floor(r.rating ?? 0)))},(_,i)=><Star key={i} className="h-4 w-4 fill-current" />)}</div>{r.comment?.trim() ? <blockquote className="mt-5 whitespace-pre-line break-words text-sm leading-7">„{r.comment}“</blockquote> : <p className="mt-5 text-sm text-muted-foreground">{r.rating} von 5 Sternen</p>}<figcaption className="mt-6 border-t border-border pt-4 text-sm font-semibold">{r.first_name}</figcaption></figure>)}</div></div></section>;
}