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

interface TrialReminderProps {
  name?: string
  daysLeft?: number // 3, 1, oder 0 (Ablauftag)
  activateUrl?: string
  siteName?: string
}

const SUBJECT_BY_DAYS: Record<number, string> = {
  3: 'Noch 3 Tage in deinem BODYFUEL-Test 🔥',
  1: 'Letzter Tag morgen — sichere dir deine Mitgliedschaft',
  0: 'Dein BODYFUEL-Test endet heute',
}

const HEAD_BY_DAYS: Record<number, string> = {
  3: 'Noch 3 Tage kostenlos testen',
  1: 'Nur noch 1 Tag — dann endet dein Test',
  0: 'Dein Testzeitraum endet heute',
}

const INTRO_BY_DAYS: Record<number, string> = {
  3: 'Du bist mitten drin in deinem 7-Tage-Test. Bisher hast du den Starterplan & das Tracking kennengelernt — jetzt kommt der spannendste Teil:',
  1: 'Morgen endet dein 7-Tage-Test. Damit du nahtlos mit deinem individuellen Plan weitermachen kannst, aktiviere jetzt deine Mitgliedschaft.',
  0: 'Heute ist der letzte Tag deines kostenlosen Tests. Verlier nicht den Schwung — aktiviere deine Mitgliedschaft und mach mit deinem persönlichen Plan weiter.',
}

const TrialReminderEmail = ({
  name = '',
  daysLeft = 3,
  activateUrl = 'https://bodyfuel-coaching.com/profile',
  siteName = 'BODYFUEL',
}: TrialReminderProps) => {
  const head = HEAD_BY_DAYS[daysLeft] ?? HEAD_BY_DAYS[3]
  const intro = INTRO_BY_DAYS[daysLeft] ?? INTRO_BY_DAYS[3]
  const greeting = name ? `Hey ${name},` : 'Hey,'

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{head}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>🔥 {siteName} Trial</Text>
          <Heading style={h1}>{head}</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>{intro}</Text>

          <Section style={card}>
            <Text style={cardTitle}>Mit deiner Mitgliedschaft bekommst du:</Text>
            <Text style={item}>✓ Individueller Ernährungsplan auf dein Ziel</Text>
            <Text style={item}>✓ Individueller Trainingsplan</Text>
            <Text style={item}>✓ Wöchentliche Check-Ins & KI-Anpassungen</Text>
            <Text style={item}>✓ Persönlicher WhatsApp-Support</Text>
            <Text style={item}>✓ Alle Premium-Funktionen freigeschaltet</Text>
          </Section>

          <Button style={button} href={activateUrl}>
            Mitgliedschaft aktivieren
          </Button>

          <Text style={footer}>
            Du erhältst diese E-Mail, weil du dich für den kostenlosen 7-Tage-Test
            von {siteName} angemeldet hast.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TrialReminderEmail,
  subject: (data: Record<string, any>) => {
    const d = typeof data.daysLeft === 'number' ? data.daysLeft : 3
    return SUBJECT_BY_DAYS[d] ?? SUBJECT_BY_DAYS[3]
  },
  displayName: 'Trial Reminder',
  previewData: { name: 'Andreas', daysLeft: 3, activateUrl: 'https://bodyfuel-coaching.com/profile', siteName: 'BODYFUEL' },
} satisfies TemplateEntry

export default TrialReminderEmail

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
