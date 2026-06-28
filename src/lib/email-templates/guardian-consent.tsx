import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  minorName?: string
  guardianName?: string
  consentUrl?: string
  siteName?: string
}

const GuardianConsentEmail = ({
  minorName = 'Ihr Kind',
  guardianName = '',
  consentUrl = 'https://bodyfuel-coaching.com/guardian-consent',
  siteName = 'BODYFUEL',
}: Props) => {
  const greeting = guardianName ? `Hallo ${guardianName},` : 'Hallo,'
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Zustimmung erforderlich für {minorName} bei {siteName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>🔥 {siteName} · Eltern-Einwilligung</Text>
          <Heading style={h1}>Zustimmung erforderlich</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            <strong>{minorName}</strong> möchte {siteName} nutzen. Da er/sie noch
            minderjährig ist, benötigen wir Ihre Zustimmung als
            erziehungsberechtigte Person.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>Mit Ihrer Bestätigung erklären Sie:</Text>
            <Text style={item}>✓ Sie sind erziehungsberechtigt</Text>
            <Text style={item}>✓ Sie stimmen den AGB zu</Text>
            <Text style={item}>✓ Sie stimmen der Datenschutzerklärung zu</Text>
            <Text style={item}>✓ Sie willigen in die Verarbeitung von Gesundheitsdaten ein</Text>
            <Text style={item}>✓ Sie haben die Widerrufsbelehrung zur Kenntnis genommen</Text>
            <Text style={item}>
              ✓ Sie werden Vertragspartner — eigenständige kostenpflichtige
              Buchungen durch den/die Minderjährige(n) sind ausgeschlossen.
            </Text>
          </Section>

          <Button style={button} href={consentUrl}>
            Zustimmung bestätigen
          </Button>

          <Text style={footer}>
            Dieser Link ist 14 Tage gültig. Wenn Sie nicht angefragt wurden,
            ignorieren Sie diese E-Mail einfach — es passiert dann nichts.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: GuardianConsentEmail,
  subject: (data: Record<string, any>) =>
    `Zustimmung erforderlich: ${data.minorName ?? 'Ihr Kind'} möchte ${data.siteName ?? 'BODYFUEL'} nutzen`,
  displayName: 'Guardian Consent',
  previewData: {
    minorName: 'Max',
    guardianName: 'Frau Müller',
    consentUrl: 'https://bodyfuel-coaching.com/guardian-consent?token=demo',
    siteName: 'BODYFUEL',
  },
} satisfies TemplateEntry

export default GuardianConsentEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const badge = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 'bold' as const,
  color: '#b8893d',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  margin: '0 0 12px',
}
const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#0b0b0b',
  margin: '0 0 18px',
  lineHeight: '1.25',
}
const text = {
  fontSize: '15px',
  color: '#404045',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const card = {
  backgroundColor: '#faf6ef',
  border: '1px solid #efe0c2',
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '12px 0 24px',
}
const cardTitle = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  color: '#0b0b0b',
  margin: '0 0 10px',
}
const item = {
  fontSize: '14px',
  color: '#3a3a40',
  lineHeight: '1.6',
  margin: '0 0 4px',
}
const button = {
  backgroundColor: '#b8893d',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '14px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#888888', margin: '32px 0 0', lineHeight: '1.5' }
