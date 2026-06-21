import * as React from 'react'
import { Body, Container, Head, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

const BodyfuelUpdateEmail = () => (
  <Html lang="de" dir="ltr">
    <Head />
    <Preview>🚀 BodyFuel Update – Neue Features sind live! 🚀</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={text}>🚀 BodyFuel Update – Neue Features sind live! 🚀</Text>
        <Text style={text}></Text>
        <Text style={text}>Hey Fuel Crew 👋</Text>
        <Text style={text}></Text>
        <Text style={text}>In den letzten Tagen hat sich bei BodyFuel einiges getan 🔥</Text>
        <Text style={text}></Text>
        <Text style={text}>✅ Tagespunkte &amp; Levelsystem überarbeitet</Text>
        <Text style={text}>✅ Öffentliche Rangliste mit Nicknames</Text>
        <Text style={text}>✅ Kostenfreier Tracker für Freunde &amp; Familie verfügbar</Text>
        <Text style={text}>✅ Rezepte direkt in den Ernährungsplänen hinterlegt</Text>
        <Text style={text}>✅ Übungsvideos zu den Trainingsplänen verlinkt</Text>
        <Text style={text}>✅ Verbesserte Übersicht im Dashboard</Text>
        <Text style={text}>✅ Schnellere Ladezeiten &amp; kleinere Fehler behoben</Text>
        <Text style={text}></Text>
        <Text style={text}>
          💡 Und das ist erst der Anfang. In den nächsten Wochen folgen weitere Features, die euch noch mehr Arbeit abnehmen und eure Fortschritte noch besser sichtbar machen.
        </Text>
        <Text style={text}></Text>
        <Text style={text}>
          Wer regelmäßig eincheckt, sammelt nicht nur Punkte, sondern baut sich Schritt für Schritt bessere Gewohnheiten auf. 📈🔥
        </Text>
        <Text style={text}></Text>
        <Text style={text}>
          Vielen Dank für euer Vertrauen und euer Feedback. Viele der neuen Funktionen sind direkt aus euren Vorschlägen entstanden. 🙌
        </Text>
        <Text style={text}></Text>
        <Text style={text}>
          Euer Manu 💚{'\n'}BodyFuel Coaching
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BodyfuelUpdateEmail,
  subject: '🚀 BodyFuel Update – Neue Features sind live! 🚀',
  displayName: 'BodyFuel Update Newsletter',
} satisfies TemplateEntry

export default BodyfuelUpdateEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px', maxWidth: '600px' }
const text = {
  fontSize: '15px',
  color: '#000000',
  lineHeight: '1.5',
  margin: '0 0 4px',
  whiteSpace: 'pre-line' as const,
}
