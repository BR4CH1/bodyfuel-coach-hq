import { createFileRoute, notFound } from '@tanstack/react-router';
import { GuideArticlePage } from '@/components/ratgeber/GuidePages';
import { guides, guideHead } from '@/lib/ratgeber-content';
export const Route = createFileRoute('/ratgeber/$slug')({
  loader: ({ params }) => {
    const guide = guides.find(item => item.slug === params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => loaderData ? guideHead(loaderData) : { meta: [{ title: 'Ratgeber nicht verfügbar | BodyFuel' }, { name: 'robots', content: 'noindex' }] },
  component: GuideRoute,
});
function GuideRoute() { return <GuideArticlePage guide={Route.useLoaderData()} />; }
