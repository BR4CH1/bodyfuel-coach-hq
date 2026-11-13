import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { firstName?: string; setupUrl: string }

export const AccountSetupEmail = ({ firstName, setupUrl }: Props) => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>Dein BODYFUEL Smart-Zugang ist bereit</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Willkommen bei BODYFUEL{firstName ? `, ${firstName}` : ''}!</Heading>
          <Text style={text}>Dein Smart-Zugang ist eingerichtet. Lege jetzt dein Passwort fest und starte dein Onboarding.</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button style={button} href={setupUrl}>Zugang einrichten</Button>
          </Section>
          <Text style={small}>Falls der Button nicht funktioniert, öffne diesen Link:<br /><span style={{ wordBreak: 'break-all', color: GREEN }}>{setupUrl}</span></Text>
          <Text style={small}>Dieser Link läuft nicht ab.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: AccountSetupEmail,
  subject: 'Dein BODYFUEL Smart-Zugang ist bereit',
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
