import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/impressum")({
  component: ImpressumPage,
  head: () => ({
    meta: [
      { title: "Impressum – BODYFUEL Coaching" },
      { name: "description", content: "Impressum und Anbieterkennzeichnung von BodyFuel Coaching, Manuel Schrader." },
    ],
  }),
});

function ImpressumPage() {
  return (
    <main className="min-h-screen bg-background py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Zurück</Link>
        <h1 className="mt-4 font-display text-4xl font-bold">Impressum</h1>
        <div className="prose-bf mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-bold">Angaben gemäß § 5 TMG</h2>
            <p className="mt-2">
              BodyFuel Coaching<br />
              Manuel Schrader<br />
              Preisstraße 31<br />
              45355 Essen<br />
              Deutschland
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Kontakt</h2>
            <p className="mt-2">E-Mail: <a href="mailto:kontakt@bodyfuel-coaching.com" className="text-gold hover:underline">kontakt@bodyfuel-coaching.com</a></p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p className="mt-2">Manuel Schrader<br />Preisstraße 31<br />45355 Essen<br />Deutschland</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Hinweis zur Kleinunternehmerregelung</h2>
            <p className="mt-2">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Haftung für Inhalte</h2>
            <p className="mt-2">Als Diensteanbieter sind wir gemäß den allgemeinen Gesetzen für eigene Inhalte auf diesen Seiten verantwortlich. Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Gewähr für die Aktualität, Vollständigkeit und Richtigkeit der bereitgestellten Inhalte.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Haftung für Links</h2>
            <p className="mt-2">Diese Website enthält Links zu externen Websites Dritter. Auf deren Inhalte haben wir keinen Einfluss. Deshalb können wir für diese fremden Inhalte keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Urheberrecht</h2>
            <p className="mt-2">Die durch den Seitenbetreiber erstellten Inhalte und Werke auf dieser Website unterliegen dem deutschen Urheberrecht. Jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedarf der vorherigen schriftlichen Zustimmung des jeweiligen Rechteinhabers.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
