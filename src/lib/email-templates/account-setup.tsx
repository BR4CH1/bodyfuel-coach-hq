import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

type Kind = 'invite' | 'smart' | 'coaching' | 'reset'
interface Props { firstName?: string; setupUrl: string; kind?: Kind }

const COPY: Record<Kind, { subject: string; heading: (n: string) => string; body: string; cta: string }> = {
  invite: { subject: 'Dein BODYFUEL-Zugang ist bereit', heading: (n) => `Willkommen bei BODYFUEL${n}!`, body: 'Dein Zugang ist eingerichtet. Lege jetzt dein Passwort fest, um loszulegen.', cta: 'Zugang einrichten' },
  smart: { subject: 'Dein BODYFUEL Smart-Zugang ist bereit', heading: (n) => `Willkommen bei BODYFUEL${n}!`, body: 'Dein Smart-Zugang ist eingerichtet. Lege jetzt dein Passwort fest und starte dein Onboarding.', cta: 'Zugang einrichten' },
  coaching: { subject: 'Dein BODYFUEL Coaching-Zugang ist bereit', heading: (n) => `Willkommen im BODYFUEL Coaching${n}!`, body: 'Dein Coaching-Zugang ist eingerichtet. Lege jetzt dein Passwort fest und starte dein Onboarding.', cta: 'Zugang einrichten' },
  reset: { subject: 'Neues Passwort für deinen BODYFUEL-Zugang', heading: (n) => `Hallo${n}!`, body: 'Du hast ein neues Passwort angefordert. Über den Button legst du es fest. Falls du das nicht warst, kannst du diese E-Mail ignorieren.', cta: 'Passwort festlegen' },
}
export const accountSetupCopy = (kind?: Kind) => COPY[kind ?? 'invite'] ?? COPY.invite

export const AccountSetupEmail = ({ firstName, setupUrl, kind }: Props) => { const c = accountSetupCopy(kind); return (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>{c.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>{c.heading(firstName ? `, ${firstName}` : '')}</Heading>
          <Text style={text}>{c.body}</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={setupUrl}>{c.cta}</Button>
          </Section>
          <Text style={small}>Falls der Button nicht funktioniert, öffne diesen Link:<br /><span style={{ wordBreak: 'break-all', color: GREEN }}>{setupUrl}</span></Text>
          <Text style={small}>Dieser Link läuft nicht ab.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)}

export const template: TemplateEntry = {
  component: AccountSetupEmail,
  subject: (d: Record<string, any>) => accountSetupCopy(d?.kind).subject,
  displayName: 'Account Setup',
  previewData: { firstName: 'Gabriela', setupUrl: 'https://bodyfuel-coaching.com/zugang/demo' },
}
export default AccountSetupEmail

const GREEN = '#1F4D2E'
const main = { backgroundColor: '#F5F4EF', fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif", margin: 0 }
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }
const card = { backgroundColor: '#FFFFFF', border: '1px solid #E2E0D7', borderRadius: '16px', padding: '32px 28px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: GREEN, margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1A1A1A', lineHeight: '1.6' }
const small = { fontSize: '13px', color: '#6B6B6B', lineHeight: '1.6' }
const button = { backgroundColor: GREEN, color: '#FFFFFF', fontSize: '15px', fontWeight: 700, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
