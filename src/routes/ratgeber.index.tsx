import { createFileRoute } from '@tanstack/react-router';
import { GuideIndexPage } from '@/components/ratgeber/GuidePages';
export const Route = createFileRoute('/ratgeber/')({
  head: () => ({
    meta: [{ title: 'Ratgeber zu Abnehmen & Ernährungsplan | BodyFuel' }, { name: 'description', content: 'Abnehmen ohne Hungern, Kalorienbedarf verstehen und eine alltagstaugliche Woche planen: die BodyFuel Ratgeber mit Quellen und praktischen Beispielen.' }, { property: 'og:title', content: 'BodyFuel Ratgeber: Abnehmen & Ernährungsplanung' }, { property: 'og:description', content: 'Klare Antworten zu Kalorien, sättigenden Mahlzeiten und deiner Wochenplanung.' }, { property: 'og:type', content: 'website' }, { property: 'og:url', content: 'https://bodyfuel-coaching.com/ratgeber' }, { name: 'twitter:card', content: 'summary_large_image' }],
    links: [{ rel: 'canonical', href: 'https://bodyfuel-coaching.com/ratgeber' }],
  }),
  component: GuideIndexPage,
});
