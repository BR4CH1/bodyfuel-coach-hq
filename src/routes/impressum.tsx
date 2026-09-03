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
            <h2 className="font-display text-lg font-bold">Angaben gemäß § 5 DDG</h2>
            <p className="mt-2">
              BodyFuel Coaching<br />
              Manuel Schrader<br />
              Preisstraße 31<br />
              45355 Essen<br />
              Deutschland
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold">Kooperationspartner</h2>
            <p className="mt-2">
              Für die Kooperation „Continentale × BodyFuel – 30 Tage Challenge“ arbeiten wir mit folgendem Partner zusammen:
            </p>
            <p className="mt-2">
              Woltering-Sonntag &amp; Holt Versicherungsvermittlungs GmbH<br />
              Schorlemerstraße 7<br />
              48683 Ahaus<br />
              Telefon: <a href="tel:+492561934800" className="text-gold hover:underline">02561 93480</a><br />
              E-Mail:{" "}
              <a href="mailto:info.woltering-sonntag-holt@continentale.de" className="text-gold hover:underline">
                info.woltering-sonntag-holt@continentale.de
              </a>
            </p>
            <p className="mt-2">
              Offizielle Rechtliches-Seite des Partners:{" "}
              <a
                href="https://www.continentale.de/web/woltering-sonntag-holt/rechtliches"
                target="_blank"
                rel="noreferrer"
                className="text-gold hover:underline"
              >
                continentale.de/web/woltering-sonntag-holt/rechtliches
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold">Kontakt</h2>
            <p className="mt-2">E-Mail: <a href="mailto:info@bodyfuel-coaching.com" className="text-gold hover:underline">info@bodyfuel-coaching.com</a></p>
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
