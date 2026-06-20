import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const LOGO_URL =
  'https://bodyfuel-coaching.com/__l5e/assets-v1/c7ce7e8e-9165-4dbe-9ce5-41237bee1db9/bodyfuel-coaching-logo.png'

interface BodyfuelUpdateProps {
  name?: string
  siteName?: string
}

const BodyfuelUpdateEmail = ({ name = '', siteName = 'BodyFuel' }: BodyfuelUpdateProps) => {
  const greeting = name ? `Hey ${name} 👋` : 'Hey Fuel Crew 👋'

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>🚀 BodyFuel Update — Neue Features sind live!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ textAlign: 'center', margin: '0 0 16px' }}>
            <Img src={LOGO_URL} alt="BodyFuel Coaching" width="140" height="140" style={{ display: 'inline-block' }} />
          </Section>
          <Heading style={h1}>🚀 BodyFuel Update — Neue Features sind live! 🚀</Heading>

          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            In den letzten Tagen hat sich bei {siteName} einiges getan 🔥
          </Text>

          <Section style={card}>
            <Text style={cardText}>✅ Tagespunkte &amp; Levelsystem überarbeitet</Text>
            <Text style={cardText}>✅ Öffentliche Rangliste mit Nicknames</Text>
            <Text style={cardText}>✅ Kostenfreier Tracker für Freunde &amp; Familie verfügbar</Text>
            <Text style={cardText}>✅ Rezepte direkt in den Ernährungsplänen hinterlegt</Text>
            <Text style={cardText}>✅ Übungsvideos zu den Trainingsplänen verlinkt</Text>
            <Text style={cardText}>✅ Verbesserte Übersicht im Dashboard</Text>
            <Text style={cardText}>✅ Schnellere Ladezeiten &amp; kleinere Fehler behoben</Text>
          </Section>

          <Text style={highlight}>
            💡 Und das ist erst der Anfang. In den nächsten Wochen folgen weitere Features,
            die euch noch mehr Arbeit abnehmen und eure Fortschritte noch besser sichtbar machen.
          </Text>

          <Text style={text}>
            Wer regelmäßig eincheckt, sammelt nicht nur Punkte, sondern baut sich Schritt für Schritt
            bessere Gewohnheiten auf. 📈🔥
          </Text>

          <Text style={text}>
            Vielen Dank für euer Vertrauen und euer Feedback. Viele der neuen Funktionen sind
            direkt aus euren Vorschlägen entstanden. 🙌
          </Text>

          <Text style={signature}>
            Euer Manu 💚<br />
            BodyFuel Coaching
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BodyfuelUpdateEmail,
  subject: '🚀 BodyFuel Update — Neue Features sind live!',
  displayName: 'BodyFuel Update Newsletter',
  previewData: { name: 'Manu', siteName: 'BodyFuel' },
} satisfies TemplateEntry

export default BodyfuelUpdateEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0b0b0b',
  margin: '0 0 18px',
  lineHeight: '1.25',
  textAlign: 'center' as const,
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
  padding: '16px 18px',
  margin: '0 0 20px',
}
const cardText = {
  fontSize: '15px',
  color: '#3a3a40',
  lineHeight: '1.7',
  margin: '0 0 6px',
}
const highlight = {
  fontSize: '15px',
  color: '#404045',
  lineHeight: '1.6',
  margin: '0 0 16px',
  fontStyle: 'italic' as const,
}
const signature = {
  fontSize: '15px',
  color: '#0b0b0b',
  lineHeight: '1.6',
  margin: '24px 0 0',
}
