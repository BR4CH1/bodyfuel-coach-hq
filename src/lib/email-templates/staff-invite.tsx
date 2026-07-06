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
import type { TemplateEntry } from './registry'

interface StaffInviteProps {
  organizationName: string
  roleLabel: string
  scopeLabel: string
  inviteUrl: string
  inviterName?: string
}

export const StaffInviteEmail = ({
  organizationName,
  roleLabel,
  scopeLabel,
  inviteUrl,
  inviterName,
}: StaffInviteProps) => {
  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>Einladung: {organizationName} auf BODYFUEL</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Heading style={h1}>Einladung: {organizationName}</Heading>
            <Text style={text}>Hallo,</Text>
            <Text style={text}>
              {inviterName ? `${inviterName} hat dich` : 'Du wurdest'} als{' '}
              <strong>{roleLabel}</strong> zu <strong>{organizationName}</strong> auf
              BODYFUEL eingeladen.
            </Text>
            <Text style={meta}>
              Zuständigkeit: <strong>{scopeLabel}</strong>
            </Text>

            <Section style={buttonWrap}>
              <Button style={button} href={inviteUrl}>
                Einladung annehmen
              </Button>
            </Section>

            <Text style={smallText}>
              Falls der Button nicht funktioniert, öffne diesen Link im Browser:
              <br />
              <span style={link}>{inviteUrl}</span>
            </Text>

            <Hr style={hr} />
            <Text style={smallText}>
              Dieser Einladungslink ist zeitlich begrenzt gültig und nur einmal
              nutzbar. Solltest du keinen BODYFUEL-Zugang haben, kannst du im
              Anschluss direkt ein Passwort vergeben.
            </Text>
          </Section>
          <Text style={footer}>© {new Date().getFullYear()} BODYFUEL Coaching</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: StaffInviteEmail,
  subject: (data: Record<string, any>) =>
    `Einladung: ${data.organizationName ?? 'BODYFUEL'} – ${data.roleLabel ?? 'Staffzugang'}`,
  displayName: 'Staff Invite',
  previewData: {
    organizationName: 'Coesfeld Bulls',
    roleLabel: 'Vereinsleitung / Administrator',
    scopeLabel: 'Gesamter Verein',
    inviteUrl: 'https://bodyfuel-coaching.com/bulls/invite/demo-token',
    inviterName: 'Manu',
  },
}

export default StaffInviteEmail

// Styles
const BG = '#F5F4EF'
const CARD_BG = '#FFFFFF'
const BORDER = '#E2E0D7'
const TEXT = '#1A1A1A'
const MUTED = '#6B6B6B'
const GREEN = '#1F4D2E'

const main = {
  backgroundColor: BG,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
}
const container = { maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }
const card = {
  backgroundColor: CARD_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: '16px',
  padding: '32px 28px',
}
const h1 = { fontSize: '22px', fontWeight: 700, color: GREEN, margin: '0 0 20px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: TEXT, lineHeight: '1.6', margin: '0 0 14px' }
const meta = { fontSize: '14px', color: TEXT, margin: '0 0 20px' }
const buttonWrap = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: GREEN,
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const smallText = { fontSize: '13px', color: MUTED, lineHeight: '1.6', margin: '0 0 12px' }
const link = { wordBreak: 'break-all' as const, color: GREEN }
const hr = { borderColor: BORDER, margin: '24px 0' }
const footer = { fontSize: '11px', color: MUTED, textAlign: 'center' as const, margin: '12px 0' }
