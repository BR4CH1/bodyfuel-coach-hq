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

interface CoachDailySummaryProps {
  name?: string
  date?: string
  openCheckins?: number
  expiringPlans?: number
  inactiveClients?: number
  redClients?: number
  newLeads?: number
  topCriticalNames?: string[]
  dashboardUrl?: string
  siteName?: string
}

const CoachDailySummaryEmail = ({
  name = '',
  date = new Date().toLocaleDateString('de-DE'),
  openCheckins = 0,
  expiringPlans = 0,
  inactiveClients = 0,
  redClients = 0,
  newLeads = 0,
  topCriticalNames = [],
  dashboardUrl = 'https://bodyfuel-coaching.com/coach',
  siteName = 'BODYFUEL',
}: CoachDailySummaryProps) => {
  const total = openCheckins + expiringPlans + inactiveClients + redClients + newLeads
  const greeting = name ? `Guten Morgen ${name},` : 'Guten Morgen,'
  const head =
    total === 0
      ? 'Alles unter Kontrolle 🎉'
      : `${total} Aufgabe${total === 1 ? '' : 'n'} warten auf dich`

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{head} — {date}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>🔥 {siteName} Coach Daily</Text>
          <Heading style={h1}>{head}</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Hier ist deine Zusammenfassung für <strong>{date}</strong>.
          </Text>

          {total > 0 ? (
            <Section style={card}>
              {openCheckins > 0 && (
                <Text style={item}>
                  ⏰ <strong>{openCheckins}</strong> offene Check-ins diese Woche
                </Text>
              )}
              {expiringPlans > 0 && (
                <Text style={item}>
                  📅 <strong>{expiringPlans}</strong> Pläne laufen in ≤ 5 Tagen aus
                </Text>
              )}
              {redClients > 0 && (
                <Text style={item}>
                  🔴 <strong>{redClients}</strong> Kunden brauchen akut Aufmerksamkeit
                </Text>
              )}
              {inactiveClients > 0 && (
                <Text style={item}>
                  💤 <strong>{inactiveClients}</strong> Kunden seit &gt; 14 Tagen inaktiv
                </Text>
              )}
              {newLeads > 0 && (
                <Text style={item}>
                  ✉️ <strong>{newLeads}</strong> neue Leads im Posteingang
                </Text>
              )}
            </Section>
          ) : (
            <Section style={cardCalm}>
              <Text style={item}>
                Keine kritischen Aufgaben offen. Genieße den Tag — alles im grünen Bereich.
              </Text>
            </Section>
          )}

          {topCriticalNames.length > 0 && (
            <Section style={card}>
              <Text style={cardTitle}>Akut handeln:</Text>
              {topCriticalNames.slice(0, 5).map((n, i) => (
                <Text key={i} style={item}>• {n}</Text>
              ))}
            </Section>
          )}

          <Button style={button} href={dashboardUrl}>
            Coach-Dashboard öffnen
          </Button>

          <Text style={footer}>
            Du erhältst diese E-Mail, weil du als Coach bei {siteName} registriert bist.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CoachDailySummaryEmail,
  subject: (data: Record<string, any>) => {
    const total =
      (data.openCheckins ?? 0) +
      (data.expiringPlans ?? 0) +
      (data.inactiveClients ?? 0) +
      (data.redClients ?? 0) +
      (data.newLeads ?? 0)
    const date = data.date ?? new Date().toLocaleDateString('de-DE')
    if (total === 0) return `BODYFUEL Coach Daily — alles im grünen Bereich (${date})`
    return `BODYFUEL Coach Daily — ${total} offene Aufgabe${total === 1 ? '' : 'n'} (${date})`
  },
  displayName: 'Coach Daily Summary',
  previewData: {
    name: 'Andreas',
    date: new Date().toLocaleDateString('de-DE'),
    openCheckins: 3,
    expiringPlans: 2,
    inactiveClients: 1,
    redClients: 2,
    newLeads: 1,
    topCriticalNames: ['Max Mustermann', 'Anna Schmidt'],
    dashboardUrl: 'https://bodyfuel-coaching.com/coach',
    siteName: 'BODYFUEL',
  },
} satisfies TemplateEntry

export default CoachDailySummaryEmail

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
  margin: '12px 0 18px',
}
const cardCalm = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '12px 0 18px',
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
  lineHeight: '1.7',
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
