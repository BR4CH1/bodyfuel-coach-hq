import type { ComponentType } from 'react'
import { template as trialReminderTemplate } from './trial-reminder'
import { template as featureNewsJuneTemplate } from './feature-news-june'
import { template as coachDailySummaryTemplate } from './coach-daily-summary'
import { template as bodyfuelUpdateTemplate } from './bodyfuel-update'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'trial-reminder': trialReminderTemplate,
  'feature-news-june': featureNewsJuneTemplate,
  'coach-daily-summary': coachDailySummaryTemplate,
  'bodyfuel-update': bodyfuelUpdateTemplate,
}
