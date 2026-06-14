import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface FeatureNewsProps {
  name?: string
  siteName?: string
}

const FeatureNewsEmail = ({ name = '', siteName = 'BodyFuel' }: FeatureNewsProps) => {
  const greeting = name ? `Hallo ${name},` : 'Hallo,'

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Neue Funktionen in {siteName} — exklusiv für die FuelCrew 💚</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>💚 FUELCREW UPDATE</Text>
          <Heading style={h1}>Neue Funktionen für deinen Alltag</Heading>

          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            als Teil der FuelCrew gehörst du zu den Ersten, die die neuesten Funktionen
            und Verbesserungen von {siteName} nutzen können. 💚
          </Text>
          <Text style={text}>
            Mein Ziel ist es, Ernährung nicht komplizierter zu machen, sondern einfacher.
            Deshalb gibt es wieder einige neue Funktionen, die deinen Alltag erleichtern sollen.
          </Text>

          <Section style={card}>
            <Heading as="h3" style={h3}>🍽️ Rezepte direkt im Ernährungsplan</Heading>
            <Text style={cardText}>
              Jede Mahlzeit enthält jetzt das passende Rezept inklusive Zutaten, Zubereitung
              und Makros. So weißt du jederzeit genau, was auf den Teller kommt.
            </Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>⭐ Favoriten &amp; Bewertungen</Heading>
            <Text style={cardText}>
              Du kannst Rezepte bewerten und deine Lieblingsgerichte als Favoriten speichern.
              Dadurch findest du besonders beliebte Mahlzeiten schneller wieder und deine
              Ernährung wird noch persönlicher.
            </Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>🏋️ Trainingstag &amp; Restday werden berücksichtigt</Heading>
            <Text style={cardText}>
              {siteName} berücksichtigt jetzt, an welchen Tagen du trainierst und an welchen nicht.
              Dadurch unterscheiden sich Trainingstage und Restdays nicht nur bei den Kalorien
              und Makros, sondern auch bei den geplanten Mahlzeiten und den benötigten Lebensmitteln.
            </Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>🛒 Plan &amp; Einkauf greifen jetzt ineinander</Heading>
            <Text style={cardText}>
              Dein Ernährungsplan kann passend zu deinem Einkaufsrhythmus starten. So wird
              die Planung deutlich einfacher und du hast immer genau die Lebensmittel zuhause,
              die du für die kommende Woche benötigst.
            </Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>📅 Automatische Planaktivierung</Heading>
            <Text style={cardText}>
              Sobald ein neuer Ernährungsplan aktiv wird, werden die dazugehörigen Kalorienziele
              und Mahlzeiten automatisch übernommen. Kein manuelles Umstellen mehr nötig.
            </Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>🛍️ Intelligente Einkaufslisten</Heading>
            <Text style={cardText}>
              Die Einkaufsliste wird automatisch auf Basis deines Ernährungsplans erstellt und
              berücksichtigt dabei auch deine Trainingstage und Restdays.
            </Text>
            <Text style={cardText}>Zusätzlich kannst du die Einkaufsliste:</Text>
            <Text style={item}>✅ direkt in der App abhaken</Text>
            <Text style={item}>🖨️ oder bequem ausdrucken und zum Einkaufen mitnehmen.</Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>👥 Neuer Partner-Modus</Heading>
            <Text style={cardText}>
              Perfekt für Paare, Freunde oder Familienmitglieder, die häufig zusammen essen.
              Ihr könnt gemeinsam die gleichen Gerichte essen, während Portionsgrößen, Kalorien
              und Makros weiterhin individuell auf eure persönlichen Ziele abgestimmt bleiben.
            </Text>
          </Section>

          <Section style={card}>
            <Heading as="h3" style={h3}>🛍️ Gemeinsame Einkaufsliste</Heading>
            <Text style={cardText}>
              Im Partner-Modus werden beide Ernährungspläne automatisch zu einer gemeinsamen
              Einkaufsliste zusammengeführt. Das spart Zeit, reduziert den Aufwand beim Einkaufen
              und macht die Umsetzung deutlich einfacher.
            </Text>
          </Section>

          <Heading as="h2" style={h2}>💪 Das ist erst der Anfang.</Heading>
          <Text style={text}>
            {siteName} soll nicht einfach nur Ernährungspläne liefern. Mein Ziel ist es, eine
            Plattform aufzubauen, die Ernährung, Training und Alltag sinnvoll miteinander
            verbindet und euch die Umsetzung so leicht wie möglich macht.
          </Text>
          <Text style={text}>
            Vielen Dank für euer Vertrauen und viel Spaß mit den neuen Funktionen!
          </Text>

          <Text style={signature}>
            Sportliche Grüße<br />
            Manu<br />
            BodyFuel Coaching 💚
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: FeatureNewsEmail,
  subject: 'Neue Funktionen in BodyFuel — exklusiv für die FuelCrew 💚',
  displayName: 'Feature News (Juni)',
  previewData: { name: 'Andreas', siteName: 'BodyFuel' },
} satisfies TemplateEntry

export default FeatureNewsEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
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
const h2 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0b0b0b',
  margin: '28px 0 12px',
  lineHeight: '1.3',
}
const h3 = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#0b0b0b',
  margin: '0 0 8px',
  lineHeight: '1.3',
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
  margin: '0 0 14px',
}
const cardText = {
  fontSize: '14px',
  color: '#3a3a40',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const item = {
  fontSize: '14px',
  color: '#3a3a40',
  lineHeight: '1.6',
  margin: '0 0 4px',
}
const signature = {
  fontSize: '15px',
  color: '#0b0b0b',
  lineHeight: '1.6',
  margin: '24px 0 0',
}
