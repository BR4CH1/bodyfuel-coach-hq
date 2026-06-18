import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Lock, Database, Cookie, Mail, FileText } from "lucide-react";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Vertrauen & Sicherheit — BODYFUEL Coaching" },
      {
        name: "description",
        content:
          "Wie BODYFUEL Coaching mit deinen Daten umgeht: Authentifizierung, Datenschutz, Speicherung und Subprozessoren.",
      },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" className="font-display text-lg font-bold text-gradient-gold">
            BODYFUEL Coaching
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Startseite
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
            <Shield className="h-3.5 w-3.5" /> Trust & Security
          </div>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            Vertrauen & Sicherheit
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Diese Seite wird von BODYFUEL Coaching gepflegt und beantwortet
            häufige Fragen rund um Sicherheit, Datenschutz und den Umgang mit
            deinen Daten in unserer App. Sie ist <strong>keine unabhängige
            Zertifizierung</strong> und wird laufend aktualisiert.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Section
            icon={Lock}
            title="Anmeldung & Zugriff"
            body={
              <>
                Die Anmeldung erfolgt über E-Mail/Passwort sowie optional über
                Google. Zugriffsrechte werden serverseitig anhand deiner Rolle
                geprüft. Nur du selbst (und ggf. dein Coach, sofern du das
                Coaching-Programm nutzt) kannst auf deine persönlichen Daten
                zugreifen.
              </>
            }
          />
          <Section
            icon={Database}
            title="Plattform & Hosting"
            body={
              <>
                Die App wird auf der Lovable-Plattform mit verwalteter Cloud-
                Infrastruktur (Datenbank, Auth, Storage) betrieben. Daten werden
                bei der Übertragung per HTTPS verschlüsselt, der Datenbank-
                zugriff ist über Row-Level-Security pro Nutzer abgesichert.
              </>
            }
          />
          <Section
            icon={FileText}
            title="Welche Daten wir verarbeiten"
            body={
              <>
                Account-Daten (E-Mail, Anzeigename), Trainings- und Ernährungs-
                eingaben, Gewichts- und Maßdaten, optional Fortschrittsfotos.
                Diese Daten dienen ausschließlich der Bereitstellung der App-
                funktionen.
              </>
            }
          />
          <Section
            icon={Cookie}
            title="Cookies & Analytics"
            body={
              <>
                Wir verwenden technisch notwendige Cookies für die Anmeldung.
                Optionale Analyse-Cookies kannst du im Cookie-Banner aktivieren
                oder ablehnen. Deine Auswahl kannst du jederzeit ändern.
              </>
            }
          />
          <Section
            icon={Shield}
            title="Aufbewahrung & Löschung"
            body={
              <>
                Deine Daten bleiben gespeichert, solange dein Account besteht.
                Auf Wunsch löschen wir deinen Account und die zugehörigen
                Daten. Schreib uns dazu einfach eine kurze Nachricht (siehe
                Kontakt).
              </>
            }
          />
          <Section
            icon={Mail}
            title="Kontakt für Sicherheit & Datenschutz"
            body={
              <>
                Hast du Fragen, Hinweise auf Sicherheitslücken oder
                Datenschutzanliegen? Melde dich gerne über das Kontaktformular
                auf der Startseite. Wir kümmern uns zeitnah darum.
              </>
            }
          />
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Geteilte Verantwortung</p>
          <p className="mt-2">
            Lovable stellt die zugrunde liegende Plattform und ihre
            Sicherheits- funktionen bereit. BODYFUEL Coaching als App-Betreiber
            verantwortet die Konfiguration, Inhalte und Zugriffsregeln innerhalb
            der App. Du als Nutzer:in trägst durch ein starkes Passwort und den
            sorgsamen Umgang mit deinem Account zur Sicherheit bei.
          </p>
          <p className="mt-3 text-xs">
            Diese Seite enthält keine Zusicherungen über Zertifizierungen wie
            SOC 2, ISO 27001, HIPAA oder PCI. Konkrete rechtliche Fragen
            beantworten dir unsere Datenschutzerklärung und das Impressum.
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}
