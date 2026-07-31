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

interface CoachFollowUpProps {
  subject?: string
  body?: string
  coachName?: string
}

export const CoachFollowUpEmail = ({
  subject = 'Kurzes Update von deinem Coach',
  body = '',
  coachName = 'Manuel | BodyFuel',
}: CoachFollowUpProps) => {
  const paragraphs = String(body)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  return (
    <Html lang="de" dir="ltr">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Heading style={h1}>{subject}</Heading>
            {paragraphs.length ? (
              paragraphs.map((part, index) => (
                <Text key={index} style={text}>
                  {part.split('\n').map((line, lineIndex) => (
                    <React.Fragment key={lineIndex}>
                      {lineIndex > 0 ? <br /> : null}
                      {line}
                    </React.Fragment>
                  ))}
                </Text>
              ))
            ) : (
              <Text style={text}>{body}</Text>
            )}
            <Text style={signature}>
              Beste Grüße
              <br />
              <strong>{coachName}</strong>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CoachFollowUpEmail,
  subject: (data: Record<string, any>) =>
    typeof data?.subject === 'string' && data.subject.trim()
      ? data.subject.trim()
      : 'Kurzes Update von deinem Coach',
  displayName: 'Coach Follow-up',
  previewData: {
    subject: 'Kurzes Update von deinem Coach',
    body: 'Hi Manuel,\n\nich wollte mich kurz melden, weil dein Fortschritt zuletzt etwas stagniert.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 16px', maxWidth: '600px' }
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '28px 24px',
}
const h1 = { fontSize: '20px', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '1.6', color: '#374151' }
const signature = { fontSize: '15px', lineHeight: '1.6', color: '#111827', marginTop: '28px' }
