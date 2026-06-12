import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  recipient?: string
  firstName?: string
}

export const InviteEmail = ({
  confirmationUrl,
  recipient,
  firstName,
}: InviteEmailProps) => {
  const name =
    firstName && firstName.trim().length > 0
      ? firstName
      : recipient
      ? recipient.split('@')[0]
      : 'Athlet'

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Willkommen bei BodyFuel – Dein Zugang ist bereit</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={brandName}>BODYFUEL</Text>
            <Text style={brandTag}>Nutrition Coaching</Text>
          </Section>

          {/* Body card */}
          <Section style={card}>
            <Heading style={h1}>Willkommen bei BodyFuel 💪</Heading>

            <Text style={text}>Hallo {name},</Text>
            <Text style={text}>
              schön, dass du Teil von BodyFuel bist! Dein persönlicher Zugang
              wurde soeben erstellt.
            </Text>
            <Text style={text}>
              Ab sofort kannst du dein Coaching bequem über dein eigenes
              BodyFuel Dashboard verwalten und deinen Fortschritt jederzeit
              verfolgen.
            </Text>

            <Text style={listTitle}>Dort findest du unter anderem:</Text>
            <Text style={listItem}>✅ Deinen Ernährungsplan</Text>
            <Text style={listItem}>✅ Dein Punkte- &amp; Level-System</Text>
            <Text style={listItem}>✅ Fortschrittsfotos</Text>
            <Text style={listItem}>✅ Gewichts- und Umfangsverlauf</Text>
            <Text style={listItem}>✅ Check-ins</Text>
            <Text style={listItem}>✅ Deine persönlichen Coaching-Daten</Text>

            <Text style={text}>
              Um deinen Zugang zu aktivieren, klicke einfach auf den Button und
              vergib dein eigenes Passwort:
            </Text>

            <Section style={buttonWrap}>
              <Button style={button} href={confirmationUrl}>
                Passwort festlegen
              </Button>
            </Section>

            <Text style={smallText}>
              Nach der Einrichtung kannst du dich jederzeit mit deiner
              E-Mail-Adresse und deinem neuen Passwort anmelden.
            </Text>

            <Hr style={hr} />

            <Text style={text}>
              Ich freue mich darauf, dich auf deinem Weg zu begleiten und
              gemeinsam deine Ziele zu erreichen.
            </Text>
            <Text style={signature}>Sportliche Grüße</Text>
            <Text style={signatureName}>Manu von BodyFuel</Text>
            <Text style={signatureRole}>BODYFUEL Nutrition Coaching</Text>

            <Text style={smallText}>
              Falls du Fragen hast oder Hilfe benötigst, melde dich jederzeit
              direkt bei mir.
            </Text>
          </Section>

          <Text style={footer}>
            Dieser Einladungslink ist 7 Tage gültig und nur einmal nutzbar.
          </Text>
          <Text style={footer}>
            © {new Date().getFullYear()} BodyFuel Coaching
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default InviteEmail

// === Styles: BodyFuel dark + gold ===
const GOLD = '#D4AF37'
const BG = '#0A0A0A'
const CARD_BG = '#141414'
const BORDER = '#2A2A2A'
const TEXT = '#EDEDED'
const MUTED = '#9A9A9A'

const main = {
  backgroundColor: BG,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '24px 16px',
}

const header = {
  textAlign: 'center' as const,
  padding: '16px 0 24px',
}

const brandName = {
  fontSize: '24px',
  fontWeight: 800,
  letterSpacing: '0.25em',
  color: GOLD,
  margin: 0,
}

const brandTag = {
  fontSize: '10px',
  letterSpacing: '0.3em',
  textTransform: 'uppercase' as const,
  color: MUTED,
  margin: '4px 0 0',
}

const card = {
  backgroundColor: CARD_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: '16px',
  padding: '32px 28px',
}

const h1 = {
  fontSize: '24px',
  fontWeight: 700,
  color: GOLD,
  margin: '0 0 20px',
  lineHeight: '1.3',
}

const text = {
  fontSize: '15px',
  color: TEXT,
  lineHeight: '1.6',
  margin: '0 0 14px',
}

const listTitle = {
  ...text,
  fontWeight: 600,
  margin: '18px 0 8px',
}

const listItem = {
  fontSize: '15px',
  color: TEXT,
  lineHeight: '1.7',
  margin: '0 0 4px',
}

const buttonWrap = {
  textAlign: 'center' as const,
  margin: '28px 0',
}

const button = {
  backgroundColor: GOLD,
  color: '#000000',
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

const smallText = {
  fontSize: '13px',
  color: MUTED,
  lineHeight: '1.6',
  margin: '0 0 12px',
}

const hr = {
  borderColor: BORDER,
  margin: '24px 0',
}

const signature = {
  ...text,
  margin: '16px 0 4px',
}

const signatureName = {
  fontSize: '15px',
  fontWeight: 700,
  color: GOLD,
  margin: '0 0 2px',
}

const signatureRole = {
  fontSize: '12px',
  color: MUTED,
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  margin: '0 0 16px',
}

const footer = {
  fontSize: '11px',
  color: MUTED,
  textAlign: 'center' as const,
  margin: '8px 0',
}
