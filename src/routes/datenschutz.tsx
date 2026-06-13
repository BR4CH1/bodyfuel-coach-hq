import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent";

export const Route = createFileRoute("/datenschutz")({
  component: DatenschutzPage,
  head: () => ({
    meta: [
      { title: "Datenschutzerklärung – BODYFUEL Coaching" },
      { name: "description", content: "Informationen zur Verarbeitung personenbezogener Daten bei BodyFuel Coaching gemäß DSGVO." },
    ],
  }),
});

function DatenschutzPage() {
  const { openSettings } = useConsent();
  return (
    <main className="min-h-screen bg-background py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Zurück</Link>
        <h1 className="mt-4 font-display text-4xl font-bold">Datenschutzerklärung</h1>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={openSettings}>Cookie-Einstellungen öffnen</Button>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <Section title="1. Verantwortlicher">
            <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
            <p>Manuel Schrader<br />BodyFuel Coaching<br />Preisstraße 31<br />45355 Essen<br />Deutschland</p>
            <p>E-Mail: <a href="mailto:kontakt@bodyfuel-coaching.com" className="text-gold hover:underline">kontakt@bodyfuel-coaching.com</a></p>
          </Section>

          <Section title="2. Erhebung und Speicherung personenbezogener Daten">
            <p>Beim Besuch dieser Website werden durch den Hosting-Anbieter automatisch Informationen erfasst und in Server-Logfiles gespeichert. Dies können insbesondere sein:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>IP-Adresse</li><li>Datum und Uhrzeit des Zugriffs</li><li>Browsertyp und Browserversion</li>
              <li>Betriebssystem</li><li>Referrer-URL</li><li>Besuchte Seiten</li>
            </ul>
            <p>Die Verarbeitung erfolgt zur Sicherstellung eines störungsfreien Betriebs der Website und zur Verbesserung unseres Angebots.</p>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</p>
          </Section>

          <Section title="3. Kontaktaufnahme">
            <p>Wenn Sie uns per E-Mail oder Kontaktformular kontaktieren, werden die von Ihnen übermittelten Daten gespeichert, um Ihre Anfrage zu bearbeiten.</p>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          </Section>

          <Section title="4. Nutzung der Coaching-Plattform">
            <p>Im Rahmen der Nutzung der BodyFuel Coaching Plattform können folgende personenbezogene Daten verarbeitet werden:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Name</li><li>E-Mail-Adresse</li><li>Körpergewicht</li><li>Ernährungsdaten</li>
              <li>Trainingsdaten</li><li>Fortschrittsbilder (freiwillig)</li><li>Sonstige vom Nutzer bereitgestellte Informationen</li>
            </ul>
            <p>Die Verarbeitung erfolgt ausschließlich zur Durchführung des Coachings und zur Bereitstellung der gebuchten Leistungen.</p>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          </Section>

          <Section title="5. Hosting und technische Bereitstellung">
            <p>Diese Website wird über Lovable bereitgestellt. Zur technischen Bereitstellung und zum Betrieb der Plattform können technische Nutzungsdaten verarbeitet werden.</p>
            <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.</p>
          </Section>

          <Section title="6. Nutzerkonten und Authentifizierung">
            <p>Für die Nutzung bestimmter Bereiche der Plattform ist die Erstellung eines Nutzerkontos erforderlich. Hierbei können insbesondere folgende Daten verarbeitet werden:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Name</li><li>E-Mail-Adresse</li><li>Passwort (verschlüsselt gespeichert)</li><li>Nutzungsdaten innerhalb der Plattform</li>
            </ul>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          </Section>

          <Section title="7. Zahlungsabwicklung über PayPal">
            <p>Für die Zahlungsabwicklung nutzen wir PayPal.</p>
            <p>Anbieter:<br />PayPal (Europe) S.à r.l. et Cie, S.C.A.<br />22-24 Boulevard Royal<br />L-2449 Luxemburg</p>
            <p>Bei Auswahl von PayPal werden die für die Zahlungsabwicklung erforderlichen Daten an PayPal übermittelt.</p>
            <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
            <p>Weitere Informationen: <a href="https://www.paypal.com/de/webapps/mpp/ua/privacy-full" target="_blank" rel="noreferrer" className="text-gold hover:underline">paypal.com/de/webapps/mpp/ua/privacy-full</a></p>
          </Section>

          <Section title="8. Cookies und Einwilligung">
            <p>Wir verwenden technisch notwendige Cookies sowie – nach Ihrer Einwilligung – Cookies für Analyse und Marketing. Sie können Ihre Einwilligung jederzeit über den Link „Cookie-Einstellungen" im Footer oder über den Button oben auf dieser Seite anpassen oder widerrufen. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 TTDSG.</p>
          </Section>

          <Section title="9. Speicherdauer">
            <p>Personenbezogene Daten werden nur so lange gespeichert, wie dies zur Erfüllung der jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.</p>
          </Section>

          <Section title="10. Weitergabe von Daten">
            <p>Eine Weitergabe personenbezogener Daten erfolgt nur, wenn dies gesetzlich vorgeschrieben ist, zur Vertragserfüllung erforderlich ist oder eine ausdrückliche Einwilligung vorliegt.</p>
          </Section>

          <Section title="11. Rechte der betroffenen Personen">
            <p>Sie haben das Recht auf:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Auskunft gemäß Art. 15 DSGVO</li>
              <li>Berichtigung gemäß Art. 16 DSGVO</li>
              <li>Löschung gemäß Art. 17 DSGVO</li>
              <li>Einschränkung der Verarbeitung gemäß Art. 18 DSGVO</li>
              <li>Datenübertragbarkeit gemäß Art. 20 DSGVO</li>
              <li>Widerspruch gemäß Art. 21 DSGVO</li>
            </ul>
          </Section>

          <Section title="12. Beschwerderecht">
            <p>Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.</p>
          </Section>

          <Section title="13. Datensicherheit">
            <p>Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen Verlust, Manipulation oder unbefugten Zugriff zu schützen.</p>
          </Section>

          <Section title="14. Änderungen dieser Datenschutzerklärung">
            <p>Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
