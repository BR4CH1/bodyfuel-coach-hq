## Minderjährigenschutz – Implementierungsplan

### 1. Datenbank (Migration)
Neue Felder auf `profiles`:
- `birthdate` (vorhanden) — bleibt
- `is_minor boolean` (abgeleitet, gesetzt bei Signup)
- `requires_guardian_consent boolean`
- `guardian_name text`
- `guardian_email text`
- `guardian_consent_at timestamptz`
- `guardian_consent_ip text`
- `guardian_consent_docs jsonb` (`{agb, datenschutz, gesundheitsdaten, widerruf}` mit Version+Zeitstempel)
- `account_status text` check in (`active`, `pending_guardian_consent`)

Neue Tabelle `guardian_consent_tokens`:
- `token` (UUID, primär), `user_id`, `guardian_email`, `expires_at`, `consumed_at`, `created_at`
- RLS: service_role only; öffentliche Token-Validierung läuft über server route.

Trigger: `account_status='pending_guardian_consent'` blockiert Stripe-Checkout-Server-Funktion.

### 2. Signup / Onboarding-Gate
- Komponente `AgeGate.tsx`: Frage „Bist du mindestens 18?" + Geburtsdatum.
- Bei <18: Hinweisbox + Formular (Eltern-Name, Eltern-E-Mail).
- Bei <16: zusätzliche explizite Pflichtkennzeichnung „Zustimmung zwingend erforderlich".
- Einbau in: `smart.signup.tsx`, `tracker.signup.tsx`, `welcome.tsx` (Self-Service), `onboarding.smart.tsx`.
- Bei Volljährigkeit: normal weiter.
- Bei minderjährig: Profile-Felder schreiben, Token erzeugen, Eltern-E-Mail anstoßen, Account auf `pending_guardian_consent`.

### 3. Eltern Double-Opt-In
- Server-Funktion `sendGuardianConsentEmail` (createServerFn, service-role nach Auth des Kindes oder offen bei Signup) → erstellt Token, ruft App-Email-Template `guardian-consent` auf.
- Auth-Template `guardian-consent.tsx` mit Link `/guardian-consent?token=...`.
- Route `/guardian-consent`: zeigt 4 Pflicht-Checkboxen (AGB, Datenschutz, Gesundheitsdaten-Einwilligung, Widerrufsbelehrung) + Eltern-Name + „Ich bin Erziehungsberechtigte/r".
- POST → server route `/api/public/guardian-consent` validiert Token, schreibt Zustimmung, setzt `account_status='active'`, Token konsumiert. IP wird mitgespeichert.

### 4. Checkout-Block
- Stripe-Checkout-Erstellung in `useStripeCheckout` / Backend: vor Session-Creation prüfen, ob `is_minor=true` UND `account_status<>'active'`. Wenn ja → Fehler „Eltern-Bestätigung ausstehend" + Hinweis.
- UI `UpgradeCard` zeigt für minderjährige, unbestätigte Accounts einen Sperr-Hinweis und CTA „Eltern-E-Mail erneut senden".
- Eltern werden im Stripe-Checkout-Customer als `email`/`name` eingetragen (Vertragspartner).

### 5. Public-Guard für Minderjährige
- Ranking-Funktion `get_ranking`: für `is_minor=true` → `display_name` durch `nickname` oder anonym („Athlet*in") ersetzen.
- Community / Bulls-Listen: gleiche Maskierung + `progress_photos` und `bulls_progress_photos` für Minderjährige niemals öffentlich ausgespielt (zusätzliches WHERE in den Public-Sichten/Komponenten).
- Vorher-Nachher-Komponenten (`ProgressPhotosCard`, `PhotoAssessmentCard` Public-Pfade): Upload erlaubt, Public-Share-Button für `is_minor` ausgeblendet.

### 6. Profil-Ansicht
- In `profile.tsx` und `coach.customers.$userId.tsx` Section „Minderjährigenschutz" mit allen gespeicherten Feldern (read-only).
- Coach kann Status sehen, aber Zustimmung nicht fälschen.

### Technische Details
- Migration in einem Step inkl. GRANTs + RLS.
- Token-Route: `src/routes/api/public/guardian-consent.ts` (GET validieren, POST konsumieren).
- E-Mail: nutzt vorhandene App-Email-Infra (`scaffold_transactional_email`-Template hinzufügen).
- Stripe-Block: in `src/lib/stripe.functions.ts` / Checkout-ServerFn vor `stripe.checkout.sessions.create`.

### Reihenfolge der Edits
1. DB-Migration (Felder + Tabelle + RLS + Grants)
2. Server-Fns & Public-Route für Token + Consent
3. App-Email-Template + Trigger
4. AgeGate-Komponente + Einbau in Signup-Flows
5. Stripe-Checkout-Gate
6. Profil-/Coach-Sichtbarkeit
7. Public-Guard (Ranking/Community/Photos)

Nach Approval implementiere ich Schritt 1–7 in dieser Reihenfolge.