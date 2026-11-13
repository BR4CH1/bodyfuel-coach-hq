import { Link } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { guides, sources, exampleWeek, type Guide } from '@/lib/ratgeber-content';
import foodPhoto from '@/assets/ratgeber-wochenplanung.jpg';
import logo from '@/assets/bodyfuel-coaching-logo.png.asset.json';

export function GuideShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground [letter-spacing:0] [&_h1]:tracking-normal [&_h2]:tracking-normal [&_h3]:tracking-normal">
    <header className="border-b border-border"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
      <Link to="/" aria-label="BodyFuel Startseite"><img src={logo.url} alt="BodyFuel" className="h-10 w-32 object-contain sm:w-40" /></Link>
      <nav aria-label="Hauptnavigation" className="flex items-center gap-2"><Button asChild variant="ghost"><Link to="/ratgeber">Ratgeber</Link></Button><Button asChild variant="outline"><Link to="/smart">Smart</Link></Button></nav>
    </div></header>
    {children}
    <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-4 px-5 py-8 text-sm text-muted-foreground sm:px-8"><span className="mr-auto">© BodyFuel</span><Link to="/">Startseite</Link><Link to="/ratgeber">Ratgeber</Link><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link></div></footer>
  </div>;
}
function ReadLink({ guide, children }: { guide: Guide; children: ReactNode }) {
  return <Link to="/ratgeber/$slug" params={{ slug: guide.slug }}>{children}</Link>;
}
export function GuideTeasers({ heading = 'Wissen, das in deinen Alltag passt.' }: { heading?: string }) {
  return <section className="border-t border-border py-14 sm:py-20"><div className="mx-auto max-w-6xl px-5 sm:px-8">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">BodyFuel Ratgeber</p><h2 className="mt-3 text-3xl font-bold tracking-normal">{heading}</h2></div><Button asChild variant="ghost"><Link to="/ratgeber">Alle Ratgeber <ArrowRight /></Link></Button></div>
    <div className="grid gap-6 md:grid-cols-3">{guides.map((guide, i) => <article key={guide.slug} className="flex flex-col rounded-lg border border-border bg-card p-6"><span className="text-sm text-primary">0{i + 1} / {guide.category}</span><h3 className="mt-5 text-2xl font-semibold tracking-normal"><ReadLink guide={guide}>{guide.title}</ReadLink></h3><p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{guide.description}</p><div className="mt-6"><Button asChild variant="link" className="h-auto whitespace-normal px-0 text-left"><ReadLink guide={guide}>Ratgeber lesen <ArrowRight /></ReadLink></Button></div></article>)}</div>
  </div></section>;
}
export function GuideIndexPage() {
  return <GuideShell><main>
    <section className="relative isolate overflow-hidden border-b border-border">
      <img src={foodPhoto} alt="Mahlzeitenideen mit Haferflocken, Beeren, Hülsenfrüchten und Ofengemüse" width={1440} height={960} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-background/80" />
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24"><p className="mb-5 flex items-center gap-2 text-sm font-semibold text-primary"><BookOpen className="h-4 w-4" /> Ernährung verstehen. Alltag planen.</p><h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal sm:text-5xl">BodyFuel Ratgeber</h1><p className="mt-6 max-w-xl text-lg leading-8">Abnehmen, Kalorien und Wochenplanung: klare Antworten, nachvollziehbare Beispiele und ein nächster Schritt, der zu dir passt.</p></div>
    </section>
    <GuideTeasers heading="Drei Fragen. Ein guter Anfang." />
    <GuideCta />
  </main></GuideShell>;
}
function GuideCta() {
  return <section className="border-t border-border bg-accent/20 py-14"><div className="mx-auto max-w-6xl px-5 sm:px-8"><p className="text-sm font-semibold text-primary">Vom Wissen zum eigenen Plan</p><h2 className="mt-3 text-3xl font-bold tracking-normal">BodyFuel Smart oder persönliches Coaching</h2><p className="mt-5 max-w-2xl leading-7 text-muted-foreground">Smart organisiert Ernährung, Training, Einkaufsliste und Tracking. Im Online-Coaching bekommst du zusätzlich persönliche Rückmeldung, Check-ins und individuelle Anpassungen.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button asChild className="min-h-11"><Link to="/trial">Smart 7 Tage gratis testen <ArrowRight /></Link></Button><Button asChild variant="outline" className="min-h-11"><Link to="/" hash="kontakt">Online-Coaching anfragen <ArrowUpRight /></Link></Button></div><p className="mt-4 text-xs leading-6 text-muted-foreground">Smart-Test ohne Zahlungsdaten · endet automatisch · danach optional 14,99 € / Monat</p></div></section>;
}
export function GuideArticlePage({ guide }: { guide: Guide }) {
  const usedSources = [...new Set(guide.sections.flatMap(section => section.sources ?? []))];
  const minutes = Math.max(4, Math.ceil((guide.answer + guide.sections.map(s => s.paragraphs.join(' ')).join(' ')).split(/\s+/).length / 180));
  return <GuideShell><main>
    <article className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <nav aria-label="Brotkrumennavigation" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Link to="/">BodyFuel</Link><ChevronRight className="h-3 w-3" /><Link to="/ratgeber">Ratgeber</Link><ChevronRight className="h-3 w-3" /><span>{guide.category}</span></nav>
      <header className="max-w-4xl"><p className="text-sm font-semibold text-primary">{guide.category}</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-normal sm:text-5xl">{guide.title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{guide.description}</p><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>Von BodyFuel · Redaktion</span><span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {minutes} Minuten</span><span>Quellen geprüft: 13.11.2026</span></div></header>
      <figure className="mt-9"><img src={foodPhoto} alt="Beispielhafte Mahlzeiten mit Gemüse, Hülsenfrüchten, Vollkornbrot und Haferflocken" width={1440} height={960} className="aspect-[2/1] w-full rounded-lg object-cover sm:aspect-[3/1]" /><figcaption className="mt-2 text-xs text-muted-foreground">Illustratives, KI-generiertes Bild · keine Darstellung eines berechneten Ernährungsplans</figcaption></figure>
      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <aside><nav aria-label="Inhaltsverzeichnis" className="border-l-2 border-primary pl-5 lg:sticky lg:top-8"><p className="mb-4 text-sm font-semibold">In diesem Ratgeber</p><ol className="space-y-3 text-sm leading-6 text-muted-foreground">{guide.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="hover:text-primary">{section.title}</a></li>)}<li><a href="#quellen" className="hover:text-primary">Quellen & Einordnung</a></li></ol></nav></aside>
        <div className="min-w-0 max-w-3xl"><section className="border-y border-primary/40 py-6"><h2 className="text-xl font-semibold tracking-normal">Die kurze Antwort</h2><p className="mt-3 text-base leading-8">{guide.answer}</p></section>
          {guide.sections.map(section => <section key={section.id} id={section.id} className="scroll-mt-8 pt-10"><h2 className="text-2xl font-semibold leading-snug tracking-normal">{section.title}</h2><div className="mt-5 space-y-4 text-base leading-8 text-muted-foreground">{section.paragraphs.map(p => <p key={p}>{p}</p>)}</div>
            {section.bullets && <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-muted-foreground">{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
            {section.id === 'woche' && <div className="mt-6 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[640px] text-left text-sm leading-6"><caption className="p-4 text-left text-sm font-semibold">Vegetarische Ideenwoche – Portionen individuell festlegen</caption><thead className="bg-muted"><tr>{['Tag', 'Frühstück', 'Mittagessen', 'Abendessen'].map(x => <th scope="col" className="p-4" key={x}>{x}</th>)}</tr></thead><tbody>{exampleWeek.map(row => <tr key={row[0]} className="border-t border-border">{row.map((cell, i) => i === 0 ? <th scope="row" key={i} className="p-4 font-medium text-primary">{cell}</th> : <td key={i} className="p-4 align-top text-muted-foreground">{cell}</td>)}</tr>)}</tbody></table></div>}
            {section.sources && <p className="mt-4 text-xs leading-6 text-muted-foreground">Grundlagen: {section.sources.map((id, i) => { const source = sources[id]; return source ? <span key={id}>{i > 0 && ' · '}<a href={source.url} className="underline underline-offset-4 hover:text-primary">{source.label}</a></span> : null; })}</p>}
          </section>)}
          <section id="quellen" className="mt-12 scroll-mt-8 border-t border-border pt-8"><h2 className="text-2xl font-semibold tracking-normal">Quellen & Einordnung</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Allgemeine Informationen für Erwachsene, keine persönliche Ernährungstherapie und kein Erfolgsversprechen. Beispiele sind redaktionelle Planungshilfen, keine Kundendaten. Bei Erkrankungen, Schwangerschaft, Stillzeit oder Essstörungen bitte medizinischen oder ernährungstherapeutischen Rat einholen.</p><ul className="mt-5 space-y-3 text-sm leading-6">{usedSources.map(id => { const source = sources[id]; return source ? <li key={id}><a href={source.url} className="text-primary underline underline-offset-4">{source.label}</a></li> : null; })}</ul></section>
        </div>
      </div>
    </article>
    <GuideCta />
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><h2 className="text-2xl font-semibold tracking-normal">Passend dazu</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{guides.filter(g => g.slug !== guide.slug).map(g => <div key={g.slug} className="border-t border-border pt-5"><Button asChild variant="link" className="h-auto justify-start whitespace-normal px-0 text-left leading-6"><ReadLink guide={g}>{g.title} <ArrowRight className="shrink-0" /></ReadLink></Button></div>)}</div></section>
  </main></GuideShell>;
}
