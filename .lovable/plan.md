
# Affiliate-Programm für Partner

Partner bekommen einen persönlichen Link, du siehst wer wen geworben hat und 10% der Erstzahlung des Geworbenen geht automatisch an den Partner — bei allen bezahlten Paketen außer Smart-Gift (0 €).

## Phase 1 — Tracking & Provisions-Übersicht (sofort)

### 1. Datenmodell
- **`affiliate_partners`**: name, email, slug (z.B. `manu-2026`), commission_pct (default 10), is_active, stripe_connect_account_id (für Phase 2), created_by (Coach), notes
- **`affiliate_referrals`**: partner_id, referred_user_id, signup_at, source_slug, first_payment_id, commission_amount_eur, commission_status (`pending` / `payable` / `paid` / `void`)
- **`profiles.referred_by_partner_id`**: neue Spalte zur dauerhaften Zuordnung
- RLS: nur Coaches lesen/schreiben Partner & Referrals; Partner sehen ihren eigenen Slug & Stats nur über öffentliche Tracking-Seite (kein Login nötig in Phase 1)

### 2. Referral-Tracking
- Öffentliche Landingpages (`/`, `/smart`, `/bulls`, `/coaching`, `/smart/gift/:code` …) lesen `?ref=slug` und legen ihn in `localStorage` ab (30 Tage TTL)
- Bei Signup (sowohl regulärer als auch Gift-Code-Flow) wird der Slug serverseitig in `profiles.referred_by_partner_id` gespeichert
- Gift-Redemption (0 €) erzeugt **kein** Commission-Event (deine Vorgabe „außer Smart-Gift")

### 3. Provisions-Erfassung
- Nach erfolgreichem `payment_history`-Eintrag (status=`confirmed`) prüft ein DB-Trigger: 
  - Hat der User `referred_by_partner_id`? 
  - Gibt es noch keine Provision für diesen User? (Erstzahlung) 
  - Paket ≠ Smart-Gift?
- Wenn ja → Insert in `affiliate_referrals` mit 10% des Zahlungsbetrags und `commission_status='payable'`

### 4. Coach-UI
- Neue Route `/coach/affiliates`:
  - Liste der Partner (anlegen/bearbeiten/deaktivieren, Slug-Generator, individuellen %-Satz überschreiben)
  - Pro Partner: geworbene Kunden, offene/ausgezahlte Provisionen, Link zum Kopieren (`bodyfuel-coaching.com/?ref=slug`)
  - Globale Tabelle aller fälligen Provisionen mit Filter (offen / ausgezahlt)
  - Manuell "Als ausgezahlt markieren" als Übergang bis Phase 2 live ist

## Phase 2 — Stripe Connect Auto-Payout

Stripe Connect ist eigenständig und braucht ein paar Voraussetzungen, deshalb getrennt:

### 1. Voraussetzungen
- Stripe Connect (Express-Accounts) muss in deinem Stripe-Dashboard aktiviert sein (du gehst einmal in dein Stripe → Connect → Get Started, Plattform-Profil ausfüllen). Ich kann das nicht für dich tun.
- Partner brauchen ein Onboarding (Stripe sammelt Steuer-/Bankdaten direkt von ihnen)

### 2. Flow
- Im Coach-UI: Button „Stripe-Onboarding-Link für Partner generieren" → erzeugt `AccountLink` über Gateway → URL geht per Mail an den Partner
- Partner verifiziert sich bei Stripe → wir speichern `stripe_connect_account_id` und `payouts_enabled`
- Bei jeder fälligen Provision (commission_status=`payable` und Partner hat verifizierten Connect-Account): automatischer `Transfer` an Connect-Account → `commission_status='paid'`, `paid_at`, `stripe_transfer_id` gespeichert
- Cron-Route `/api/public/hooks/payout-affiliates` (täglich) cleared den Backlog

### 3. Compliance
- Provisionen werden aus deinem Stripe-Balance an die Partner-Connect-Accounts transferiert. Stripe schickt den Partnern automatisch ihre Auszahlung auf ihr Bankkonto.
- Die Partner sind selbst für ihre Steuer verantwortlich; Stripe stellt ihnen die Belege.

---

## Was ich jetzt baue (Phase 1)
1. Migration: Tabellen + RLS + Trigger
2. Server-Functions: Partner CRUD, Referral-Stats, Slug-Validierung, Commission-Generation-Trigger
3. Coach-UI: `/coach/affiliates` mit Liste, Detail, Provisions-Tabelle
4. Referral-Tracking: localStorage-Hook + Speichern bei Signup (Smart-Gift- und Standard-Flow)
5. Link in Coach-Navigation

## Phase 2 starte ich erst auf dein "Ja"
- Erfordert manuellen Schritt von dir: Stripe Connect im Stripe-Dashboard aktivieren
- Ohne Connect bleibst du in „manuell auszahlen + abhaken"-Modus (Phase 1 funktioniert komplett ohne Connect)

**Soll ich mit Phase 1 starten?**
