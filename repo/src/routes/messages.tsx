import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppLayout } from "@/components/bodyfuel/AppLayout";
import { FreeAppLayout } from "@/components/bodyfuel/FreeAppLayout";
import { useSession } from "@/lib/bodyfuel/session";
import { CoachMessageThread } from "@/components/bodyfuel/CoachMessageThread";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Nachrichten — BODYFUEL" }] }),
  component: MessagesRoute,
});

function MessagesRoute() {
  const { isFreeUser } = useSession();
  const Layout = isFreeUser ? FreeAppLayout : AppLayout;
  return (
    <Layout>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Coaching</p>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
            <MessageCircle className="h-7 w-7 text-gold" />
            Nachricht an den Coach
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Frage, Feedback oder ein Erfolg? Schreib direkt — dein Coach meldet sich so schnell wie möglich.
          </p>
        </div>
        <CoachMessageThread mode="client" />
      </div>
    </Layout>
  );
}
