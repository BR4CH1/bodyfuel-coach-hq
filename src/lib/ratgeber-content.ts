export type GuideSection = { id: string; title: string; paragraphs: string[]; bullets?: string[]; sources?: string[] };
export type Guide = { slug: string; title: string; description: string; category: string; answer: string; sections: GuideSection[] };
export const sources: Record<string, { label: string; url: string }> = {
  energy: { label: 'IQWiG: Programme und Medikamente zum Abnehmen', url: 'https://www.gesundheitsinformation.de/programme-und-medikamente-zum-abnehmen.html' },
  weight: { label: 'IQWiG: Starkes Übergewicht (Adipositas)', url: 'https://www.gesundheitsinformation.de/starkes-uebergewicht-adipositas.html' },
  calories: { label: 'Die Techniker: Wie viele Kalorien brauchen wir pro Tag?', url: 'https://www.tk.de/techniker/gesundheit-foerdern/gesunde-ernaehrung/uebergewicht-und-diaet/wie-viele-kalorien-pro-tag-2006758' },
  grains: { label: 'DGE: Getreide, Getreideprodukte und Kartoffeln', url: 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/getreide-getreideprodukte-und-kartoffeln/' },
  drinks: { label: 'DGE: Getränke', url: 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/getraenke/' },
  fiber: { label: 'DGE / BLE: Ballaststoffe', url: 'https://www.dge-medienservice.de/media/productattach/File-1544171062.pdf' },
};
export const guides: Guide[] = [
  {
    slug: 'abnehmen-ohne-hungern', category: 'Sättigung & Alltag',
    title: 'Abnehmen ohne Hungern: satt werden im Kaloriendefizit',
    description: 'Sättigende Mahlzeiten, passende Portionen und ein realistischer Alltag: So gehst du Abnehmen ohne Crash-Diät an.',
    answer: 'Zum Abnehmen brauchst du über die Zeit weniger Energie, als du verbrauchst – aber keine möglichst kleinen Mahlzeiten. Ballaststoffreiche Lebensmittel und passende Portionen können helfen. Ständiger Hunger ist kein Erfolgsmaßstab.',
    sections: [
      { id: 'defizit', title: 'Weniger ist nicht automatisch besser', paragraphs: [
        'Ein Kaloriendefizit ist die Differenz zwischen deinem Energieverbrauch und deiner Energieaufnahme. Es sagt zunächst nichts darüber aus, wie groß eine Mahlzeit aussieht oder wie gut sie dich satt macht. Ein großer Teller mit Gemüse und weiteren Zutaten kann in deinen Plan passen; ein kleiner Snack kann dagegen viel Energie enthalten.',
        'Wenn du den Tag mit sehr wenig Essen beginnst und abends ständig hungrig bist, lohnt sich ein Blick auf die Verteilung und das Gesamtziel. Ein Plan soll sich wiederholen lassen, nicht nur bis zum nächsten Wochenende funktionieren. Sehr einseitige Diäten sind auch aus gesundheitlicher Sicht keine gute Grundlage.',
      ], sources: ['energy'] },
      { id: 'mahlzeiten', title: 'Baue Mahlzeiten statt Verbotslisten', paragraphs: [
        'Vollkornprodukte, Gemüse und Hülsenfrüchte liefern Ballaststoffe. Diese können zur Sättigung beitragen. Die DGE empfiehlt, bei Getreideprodukten bevorzugt die Vollkornvariante zu wählen. Wenn du bisher wenig Ballaststoffe isst, stelle schrittweise um und achte auf deine Verträglichkeit.',
        'Als praktische Planungshilfe kannst du eine Mahlzeit aus Gemüse oder Obst, einer Eiweißquelle, einer passenden Beilage und bewusst portioniertem Fett zusammensetzen. Das ist keine starre Formel: Allergien, Ernährungsform, Geschmack und dein Bedarf entscheiden mit.',
      ], bullets: ['Frühstücksidee: Haferflocken mit Naturjoghurt oder einer passenden pflanzlichen Alternative und Beeren.', 'Mittagsidee: Kartoffeln, Ofengemüse und ein Linsengericht.', 'Abendsidee: Vollkornbrot mit Hüttenkäse oder Bohnenaufstrich und Gemüse.'], sources: ['fiber', 'grains'] },
      { id: 'portionen', title: 'Passe Portionen an, ohne Gerichte zu streichen', paragraphs: [
        'Du musst für einen Ernährungsplan nicht auf alle Lieblingsgerichte verzichten. Plane die tatsächlichen Zutaten und Mengen ein. Auch Öl, Dressing, Getränke und kleine Extras gehören dazu. Sie sind nicht verboten – sie sollten nur nicht unsichtbar bleiben.',
        'Ein Beispiel aus der Wochenplanung: Du möchtest Pasta essen. Dann bleiben Nudeln Teil des Gerichts. Gemüse, Sauce und eine für dich passende Eiweißquelle ergänzen die Mahlzeit; die Portion richtet sich nach deinem Tagesziel. Eine pauschale Kalorienzahl für alle Personen wäre hier nicht sinnvoll.',
        'Wasser und ungesüßte Tees sind praktische Durstlöscher. Flüssigkeit ersetzt jedoch keine Mahlzeit, wenn du Hunger hast. Die DGE weist außerdem darauf hin, dass Fruchtsäfte ebenfalls Energie liefern.',
      ], sources: ['drinks'] },
      { id: 'alltag', title: 'Plane auch den schwierigen Teil des Tages', paragraphs: [
        'Überlege vor der Woche, wann Essen bei dir unorganisiert wird: nach der Arbeit, zwischen Terminen oder unterwegs? Genau für diese Situation lohnt sich eine vorbereitete Mahlzeit oder eine unkomplizierte Alternative. Drei oder vier Mahlzeiten können beide funktionieren; entscheidend ist, was du tatsächlich umsetzen kannst.',
        'Wenn du abends gerne snackst, darf das in der Planung sichtbar sein. Es ist oft praktischer, einen Snack bewusst vorzusehen, als einen unrealistischen Tagesablauf zu planen und jeden Abend davon abzuweichen. Ein ungeplanter Tag ist kein Grund, am nächsten Tag Mahlzeiten auszulassen.',
      ] },
      { id: 'hunger', title: 'Was tun, wenn du trotzdem ständig hungrig bist?', paragraphs: [
        'Prüfe zuerst, ob dein Ziel zu knapp angesetzt ist, Mahlzeiten fehlen oder deine Portionen wenig sättigende Bestandteile enthalten. Notiere einige Tage, wann du hungrig wirst und was du zuvor gegessen hast. Diese Beobachtung ist für eine Anpassung hilfreicher als die Forderung nach noch mehr Disziplin.',
        'Hunger lässt sich nicht für jede Person vollständig vermeiden. Anhaltender starker Hunger, Schwindel, ausgeprägte Müdigkeit oder ein belastendes Verhältnis zum Essen gehören nicht zu einem guten Plan. Hol dir dafür ärztlichen oder qualifizierten ernährungstherapeutischen Rat; Fitness-Coaching ersetzt diese Betreuung nicht.',
      ] },
      { id: 'start', title: 'Dein nächster Schritt: eine machbare Woche', paragraphs: [
        'Wähle zunächst einige Gerichte, die du wirklich gerne isst. Plane dazu die Zutaten, passende Portionen und einen Einkauf. Beginne mit einer wiederholbaren Routine, statt gleichzeitig jede Gewohnheit zu ändern. Wie du diese Woche strukturierst, liest du im Ratgeber zur Ernährungsplanung.',
        'BodyFuel Smart verbindet deine Ziele und Vorlieben mit Ernährungsplanung, Einkaufsliste und Tracking. Wenn du persönliche Rückmeldung und regelmäßige Anpassungen möchtest, ist das Online-Coaching die betreute Alternative. Beide Wege sollen dir Struktur geben – keine garantierte Gewichtsabnahme versprechen.',
      ] },
    ],
  },
  {
    slug: 'kalorien-zum-abnehmen', category: 'Kalorien & Orientierung',
    title: 'Wie viele Kalorien brauche ich zum Abnehmen?',
    description: 'Kalorienbedarf, Kaloriendefizit und Gewichtsverlauf verständlich erklärt – mit einem klar gekennzeichneten Rechenbeispiel.',
    answer: 'Es gibt keine Kalorienzahl, die für alle zum Abnehmen passt. Ausgangspunkt ist dein geschätzter Gesamtbedarf. Ein Defizit bedeutet, darunter zu essen. Ob die Schätzung für dich passt, zeigt sich erst im Verlauf und an deinem Wohlbefinden.',
    sections: [
      { id: 'bedarf', title: 'Grundumsatz und Gesamtbedarf sind nicht dasselbe', paragraphs: [
        'Dein Körper benötigt auch in Ruhe Energie, etwa für Atmung, Kreislauf und Stoffwechsel. Zusätzlich verbrauchst du Energie durch Bewegung, Arbeit und Sport. Für ein Tagesziel zählt deshalb der Gesamtbedarf und nicht nur der Ruhe- oder Grundumsatz.',
        'Der Bedarf hängt unter anderem von Körpergröße, Körpergewicht und Aktivität ab. Ein Bürotag und ein körperlich anstrengender Arbeitstag sind nicht gleich. Rechner liefern eine Orientierung; sie messen deinen persönlichen Verbrauch nicht direkt. Deshalb sind scheinbar genaue Ergebnisse auf einzelne Kalorien nicht automatisch genauer.',
      ], sources: ['calories'] },
      { id: 'rechnung', title: 'So funktioniert ein Kaloriendefizit', paragraphs: [
        'Wenn du über die Zeit weniger Energie aufnimmst, als du verbrauchst, entsteht ein Defizit. Ein möglichst großes Defizit ist aber nicht automatisch der bessere Weg. Dein Essen muss dich weiterhin versorgen und zu deinem Alltag passen. Auch Bewegung und Verhaltensänderungen gehören bei der Gewichtsreduktion dazu.',
        'Reines Rechenbeispiel, keine persönliche Empfehlung: Angenommen, ein Gesamtbedarf wurde mit 2.200 kcal geschätzt. Eine angenommene Differenz von 300 kcal ergibt 1.900 kcal als Beispielziel: 2.200 − 300 = 1.900. Sowohl der Bedarf als auch das Defizit sind hier frei gewählte Beispielwerte, keine für dich festgelegten Zahlen.',
        'Die Rechnung zeigt nur das Prinzip. Sie ist kein Beleg dafür, dass 1.900 kcal oder ein Defizit von 300 kcal für jede Person geeignet sind. Ein passendes Ziel braucht deine Ausgangslage und sollte bei Bedarf fachlich begleitet werden.',
      ], sources: ['energy'] },
      { id: 'verteilung', title: 'Vom Tagesziel zu echten Mahlzeiten', paragraphs: [
        'Eine Zahl allein organisiert noch keinen Einkauf und kein Abendessen. Verteile dein Ziel auf die Mahlzeiten, die du tatsächlich isst. Wer morgens wenig Appetit hat, muss nicht dieselbe Verteilung verwenden wie jemand, der ein großes Frühstück braucht.',
        'Rechne mit den Zutaten und ihren tatsächlichen Mengen. Bei verpackten Lebensmitteln hilft das Etikett. Für andere Lebensmittel sind verlässliche Nährwertdaten nötig. Roh und gekocht sind unterschiedliche Zustände: 100 g trockener Reis sind nicht dasselbe wie 100 g gekochter Reis. Auch Milch im Kaffee, Öl in der Pfanne oder Sauce gehören zum Essen dazu.',
        'Du musst keine perfekte tägliche Punktlandung erzwingen. Entscheidend ist ein konsistenter Plan, den du nachvollziehen und bei Bedarf anpassen kannst. Häufige Hungerphasen oder Leistungsprobleme sind ein Anlass zur Überprüfung und nicht zum weiteren Kürzen.',
      ] },
      { id: 'sport', title: 'Was ist mit Trainings- und Ruhetagen?', paragraphs: [
        'Mehr Bewegung kann den Energiebedarf verändern. Wie viel das ausmacht, hängt von Art, Dauer, Intensität und Person ab. Eine Sportuhr oder eine App liefert dafür Schätzungen, keine exakte Rechnung. Addiere nicht automatisch jede angezeigte Trainingskalorie auf dein Essensziel.',
        'Im Plan können Trainings- und Ruhetage unterschiedliche Ziele bekommen. Du kannst deinen Alltag aber auch mit einem gleichmäßigen Ziel strukturieren. Wichtig ist, dass Bewegung nicht doppelt berücksichtigt wird: einmal im geschätzten Tagesbedarf und noch einmal als zusätzlicher Bonus.',
      ], sources: ['calories'] },
      { id: 'verlauf', title: 'Warum die Waage nicht jeden Tag weniger zeigt', paragraphs: [
        'Das Körpergewicht wird von vielen Faktoren beeinflusst. Ernährung und Lebensumstände spielen ebenso eine Rolle wie bestimmte Krankheiten, Medikamente und die Veranlagung. Eine einzelne Messung beschreibt deshalb nicht die ganze Entwicklung.',
        'Wenn du Gewicht dokumentierst, nutze möglichst vergleichbare Bedingungen und betrachte mehrere Messungen statt eines einzigen Tages. Notiere zusätzlich, wie gut der Plan gelingt und wie du dich fühlst. Bleibt die Entwicklung über längere Zeit unklar, prüfe zunächst die Umsetzung und die Bedarfsschätzung, bevor du dein Ziel vorschnell senkst.',
      ], sources: ['weight'] },
      { id: 'hilfe', title: 'Wann du Unterstützung einholen solltest', paragraphs: [
        'Dieser Ratgeber richtet sich an Erwachsene und ersetzt keine Diagnose oder Ernährungstherapie. In Schwangerschaft und Stillzeit, bei einer Essstörung, bei starkem Übergewicht mit Begleiterkrankungen oder unter gewichtsbeeinflussenden Medikamenten solltest du eine Gewichtsreduktion medizinisch besprechen. Für Minderjährige ist eine pauschale Defizitplanung ebenfalls ungeeignet.',
        'BodyFuel Smart hilft dir, Ziele in einen Ernährungsplan und nachvollziehbares Tracking zu übersetzen. Persönliches Online-Coaching ergänzt Rückmeldung und Anpassungen im Fitnessalltag. Medizinische Fragen gehören weiterhin in ärztliche oder ernährungstherapeutische Betreuung.',
      ] },
    ],
  },
  {
    slug: 'ernaehrungsplan-zum-abnehmen', category: 'Wochenplanung & Einkauf',
    title: 'Ernährungsplan zum Abnehmen: eine Woche, die zu dir passt',
    description: 'Plane eine alltagstaugliche Woche zum Abnehmen: Mahlzeitenideen, Einkaufsliste, Portionen und sinnvolle Gerichtstausch-Optionen.',
    answer: 'Ein sinnvoller Ernährungsplan verbindet ein passendes Energieziel mit Gerichten, die du magst und zubereiten kannst. Plane zuerst deinen Alltag, dann Mahlzeiten und Portionen. Eine gemeinsame Einkaufsliste macht die Umsetzung leichter.',
    sections: [
      { id: 'rahmen', title: 'Beginne mit deinem Alltag, nicht mit einer Verbotsliste', paragraphs: [
        'Wie viele Tage möchtest du vorbereiten? Wann kochst du, was nimmst du mit und an welchen Tagen brauchst du etwas Schnelles? Diese Fragen entscheiden darüber, ob eine Woche nur auf dem Papier gut aussieht oder tatsächlich funktioniert. Plane auch Termine und gemeinsame Mahlzeiten ein.',
        'Fürs Abnehmen ist langfristig die Energiebilanz entscheidend. Du musst dafür nicht automatisch alle Kohlenhydrate streichen. Das IQWiG beschreibt, dass verschiedene Ernährungsformen zur Gewichtsreduktion genutzt werden können und sehr einschränkende Diäten im Alltag schwierig sein können. Wähle einen Aufbau, der zu dir passt.',
      ], sources: ['energy'] },
      { id: 'bausteine', title: 'Lege wiederverwendbare Bausteine fest', paragraphs: [
        'Wähle zwei Frühstücksideen, einige Hauptgerichte und bei Bedarf Snacks. Wiederholungen sind kein Planungsfehler: Ein Gericht zweimal zu kochen oder vorbereitete Zutaten erneut zu verwenden, kann den Alltag vereinfachen. Achte trotzdem auf Abwechslung bei Gemüse, Beilagen und Eiweißquellen.',
        'Die DGE empfiehlt Vollkornprodukte und beschreibt Getreide, Kartoffeln, Gemüse, Obst und Hülsenfrüchte als wichtige Bestandteile der Ernährung. Nutze diese Gruppen für deine Planung, ohne jedes Gericht identisch aufzubauen. Allergien und Unverträglichkeiten haben Vorrang vor einer Vorlage.',
      ], sources: ['grains'] },
      { id: 'woche', title: 'Beispielwoche: Ideen statt pauschalem Kalorienplan', paragraphs: [
        'Die Tabelle unten ist eine selbst zusammengestellte Ideenwoche, kein fertiger individueller Abnehmplan. Bewusst stehen dort keine geschätzten Nährwerte: Dafür müssten die konkreten Produkte, Zutatenzustände und finalen Mengen feststehen. Passe die Portionen an deinen persönlichen Bedarf an.',
        'Die Gerichte sind vegetarische Beispiele. Milchprodukte, Eier, Gluten oder andere Zutaten passen nicht zu jeder Person. Verwende bei Bedarf geeignete Alternativen und prüfe deren Zutaten und Nährwerte neu. Eine pflanzliche Alternative ist nicht automatisch ernährungsphysiologisch identisch.',
      ] },
      { id: 'einkauf', title: 'So wird aus der Woche eine Einkaufsliste', paragraphs: [
        'Schreibe für jedes gewählte Gericht alle Zutaten und die geplanten Mengen auf – auch Öl, Sauce und kleine Extras. Addiere gleiche Lebensmittel erst, wenn Zustand und Einheit übereinstimmen. Trockene Nudeln bleiben als Trockenmenge auf der Liste; gekochter Reis wird nicht automatisch in Rohgewicht umgerechnet.',
        'Für die Ideenwoche kannst du zunächst mit den Lebensmittelgruppen unten arbeiten. Die Liste enthält alle in der Tabelle genannten Grundzutaten, aber noch keine Einkaufsmengen. Entscheide zuerst über Portionen und Rezeptdetails. Prüfe anschließend deinen Vorrat, damit du nicht doppelt einkaufst.',
        'Bei zwei Personen mit unterschiedlichen Zielen können die Gerichte gleich sein, die Portionen aber verschieden. Addiere dann die endgültigen Zutatenmengen beider Personen. Eine pauschale Verdopplung wäre nur richtig, wenn beide tatsächlich dieselbe Portion essen.',
      ], bullets: ['Obst & Gemüse: Beeren, Äpfel, Brokkoli, Möhren, Paprika, Tomaten, Gurke, Zucchini, Spinat, Zwiebeln.', 'Getreide & Beilagen: Haferflocken, Vollkornbrot, Vollkornnudeln (trocken), Reis (trocken), Kartoffeln.', 'Eiweißquellen: Naturjoghurt, Quark, Feta, Eier, Linsen und Kichererbsen.', 'Vorrat & Extras: Olivenöl, passierte Tomaten, Gemüsebrühe, Kräuter und Gewürze.'] },
      { id: 'tausch', title: 'Gerichte tauschen, ohne den Plan zu verlieren', paragraphs: [
        'Ein Austausch sollte deine Ernährungsform, Allergien und No-Gos respektieren. Danach zählen Zutaten und Mengen: Ein anderes Gericht kann trotz ähnlicher Portionsgröße deutlich andere Nährwerte haben. Prüfe deshalb Tageswerte und Einkaufsliste nach dem Tausch erneut.',
        'Praktisch ist ein Tausch mit ähnlichem Aufwand. Wenn ein Abendessen aus Zeitgründen ausfällt, ist ein weiteres aufwendiges Rezept keine gute Alternative. Halte ein schnelles Gericht bereit, dessen Zutaten du ohnehin im Haus hast. Vorlieben erleichtern die Umsetzung, ersetzen aber nicht das Beachten deiner Unverträglichkeiten.',
      ] },
      { id: 'umsetzen', title: 'Vorbereiten und nachjustieren', paragraphs: [
        'Bereite nur so viel vor, wie du sicher lagern und verbrauchen kannst. Achte auf Kühlung, Produkthinweise und passende Aufbewahrung; eine ganze Woche gekochtes Essen einfach im Kühlschrank zu lassen ist keine pauschale Empfehlung. Einzelne Zutaten vorbereiten oder geeignete Portionen einfrieren kann praktischer sein.',
        'Nach der Woche: Welche Gerichte haben geschmeckt, wann fehlte Zeit und welche Mengen waren unpassend? Übernimm die guten Teile in die nächste Woche. BodyFuel Smart organisiert Ernährungsplan, Einkaufsliste und Tracking in einer App. Wenn du dabei persönliche Rückmeldung möchtest, kannst du Online-Coaching nutzen.',
      ] },
    ],
  },
];
export const exampleWeek = [
  ['Montag', 'Haferflocken, Joghurt & Beeren', 'Linsen-Tomaten-Eintopf mit Möhren & Vollkornbrot', 'Kartoffeln, Brokkoli & Kräuterquark'],
  ['Dienstag', 'Vollkornbrot, Ei & Tomaten', 'Linsen-Tomaten-Eintopf vom Vortag', 'Kichererbsensalat mit Gurke, Paprika & Feta'],
  ['Mittwoch', 'Haferflocken, Joghurt & Apfel', 'Vollkornnudeln mit Tomaten-Zucchini-Sauce', 'Spinat-Omelett mit Vollkornbrot'],
  ['Donnerstag', 'Vollkornbrot, Quark & Gurke', 'Reis mit Brokkoli, Möhren & Kichererbsen', 'Ofenkartoffeln mit Paprika & Feta'],
  ['Freitag', 'Haferflocken, Joghurt & Beeren', 'Vollkornnudeln mit Linsen-Tomaten-Sauce', 'Vollkornbrot, Ei & Gurke'],
  ['Samstag', 'Vollkornbrot, Ei & Tomaten', 'Kichererbsen-Spinat-Eintopf mit Reis', 'Ofengemüse mit Kräuterquark & Kartoffeln'],
  ['Sonntag', 'Haferflocken, Joghurt & Apfel', 'Linsen-Tomaten-Eintopf mit Vollkornbrot', 'Kartoffel-Spinat-Pfanne mit Ei'],
];
export function guideHead(guide: Guide) {
  const url = `https://bodyfuel-coaching.com/ratgeber/${guide.slug}`;
  return {
    meta: [{ title: `${guide.title} | BodyFuel` }, { name: 'description', content: guide.description }, { property: 'og:title', content: guide.title }, { property: 'og:description', content: guide.description }, { property: 'og:type', content: 'article' }, { property: 'og:url', content: url }, { name: 'twitter:card', content: 'summary_large_image' }],
    links: [{ rel: 'canonical', href: url }],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Article', headline: guide.title, description: guide.description, mainEntityOfPage: url, inLanguage: 'de-DE', author: { '@type': 'Organization', name: 'BodyFuel', url: 'https://bodyfuel-coaching.com/' }, publisher: { '@type': 'Organization', name: 'BodyFuel', url: 'https://bodyfuel-coaching.com/' }, citation: [...new Set(guide.sections.flatMap(s => s.sources ?? []))].map(id => sources[id]?.url).filter(Boolean) }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'BodyFuel', item: 'https://bodyfuel-coaching.com/' }, { '@type': 'ListItem', position: 2, name: 'Ratgeber', item: 'https://bodyfuel-coaching.com/ratgeber' }, { '@type': 'ListItem', position: 3, name: guide.title, item: url }] }] }) }],
  };
}
