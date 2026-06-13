import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, BarChart3, Megaphone, X } from "lucide-react";
import { useConsent, type ConsentState } from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function CookieConsent() {
  const { decided, consent, acceptAll, rejectAll, save, isSettingsOpen, openSettings, closeSettings } = useConsent();
  const [details, setDetails] = useState(false);
  const [draft, setDraft] = useState<ConsentState>({ necessary: true, analytics: false, marketing: false });

  useEffect(() => {
    if (consent) setDraft(consent);
  }, [consent]);

  const showBanner = !decided;
  const showModal = isSettingsOpen;

  if (!showBanner && !showModal) return null;

  if (showModal) {
    return (
      <Modal onClose={closeSettings}>
        <Settings draft={draft} setDraft={setDraft} onSave={() => save(draft)} onAcceptAll={acceptAll} onRejectAll={rejectAll} />
      </Modal>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="border-l-4 border-gold p-5 sm:p-6">
          {!details ? (
            <>
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-gold text-primary-foreground">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-base font-bold">Deine Privatsphäre</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Wir verwenden Cookies und ähnliche Technologien, um den sicheren Betrieb unserer Website zu gewährleisten, die Nutzung zu analysieren und unser Angebot zu verbessern. Sie können selbst entscheiden, welche Kategorien Sie zulassen möchten. Weitere Informationen in unserer{" "}
                    <Link to="/datenschutz" className="text-gold underline-offset-4 hover:underline">Datenschutzerklärung</Link>.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDetails(true)}>Einstellungen</Button>
                <Button variant="outline" size="sm" onClick={rejectAll}>Alle ablehnen</Button>
                <Button size="sm" className="bg-gradient-gold text-primary-foreground hover:opacity-90" onClick={acceptAll}>Alle akzeptieren</Button>
              </div>
            </>
          ) : (
            <Settings draft={draft} setDraft={setDraft} onSave={() => save(draft)} onAcceptAll={acceptAll} onRejectAll={rejectAll} />
          )}
        </div>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Schließen">
          <X className="h-4 w-4" />
        </button>
        <div className="border-l-4 border-gold p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Settings({
  draft,
  setDraft,
  onSave,
  onAcceptAll,
  onRejectAll,
}: {
  draft: ConsentState;
  setDraft: (c: ConsentState) => void;
  onSave: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  return (
    <div>
      <div className="font-display text-lg font-bold">Cookie-Einstellungen</div>
      <p className="mt-1 text-sm text-muted-foreground">
        Wähle, welche Kategorien du zulassen möchtest. Mehr Infos in der{" "}
        <Link to="/datenschutz" className="text-gold underline-offset-4 hover:underline">Datenschutzerklärung</Link> und im{" "}
        <Link to="/impressum" className="text-gold underline-offset-4 hover:underline">Impressum</Link>.
      </p>

      <div className="mt-4 space-y-3">
        <Category
          icon={<Shield className="h-4 w-4" />}
          title="Notwendig"
          desc="Diese Cookies sind für den Betrieb der Website erforderlich und können nicht deaktiviert werden."
          checked
          disabled
        />
        <Category
          icon={<BarChart3 className="h-4 w-4" />}
          title="Analyse"
          desc="Helfen uns zu verstehen, wie Besucher unsere Website nutzen, um die Plattform kontinuierlich zu verbessern."
          checked={draft.analytics}
          onChange={(v) => setDraft({ ...draft, analytics: v })}
        />
        <Category
          icon={<Megaphone className="h-4 w-4" />}
          title="Marketing"
          desc="Werden verwendet, um relevante Inhalte und Werbung anzuzeigen."
          checked={draft.marketing}
          onChange={(v) => setDraft({ ...draft, marketing: v })}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onRejectAll}>Alle ablehnen</Button>
        <Button variant="outline" size="sm" onClick={onSave}>Auswahl speichern</Button>
        <Button size="sm" className="bg-gradient-gold text-primary-foreground hover:opacity-90" onClick={onAcceptAll}>Alle akzeptieren</Button>
      </div>
    </div>
  );
}

function Category({
  icon, title, desc, checked, disabled, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-gold">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-sm font-bold">{title}</div>
          <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
