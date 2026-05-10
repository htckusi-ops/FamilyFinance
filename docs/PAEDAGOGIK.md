# Pädagogische Analyse – FamilyFinance

## Grundlagen

FamilyFinance orientiert sich an der **Selbstbestimmungstheorie (SDT)** nach Deci & Ryan (1985).
Kinder handeln aus drei intrinsischen Bedürfnissen heraus:
- **Kompetenzerleben** – etwas bewirken und wachsen
- **Autonomie** – selbst entscheiden dürfen
- **Zugehörigkeit** – Teil der Familie sein

Extrinsische Anreize (Geld, Punkte, Badges) können diese Motivation stärken **oder** untergraben.
Der sogenannte **Overjustification-Effekt** zeigt: Wird eine Aktivität, die ein Kind gerne macht, mit Belohnungen verknüpft, kann die intrinsische Freude langfristig sinken.

---

## Features nach pädagogischem Wert

### ✅ Taschengeld-Verwaltung (pädagogisch wertvoll, alle Altersgruppen)

**Warum gut:**
- Kinder lernen den Umgang mit echtem Geld ohne echtes Risiko
- Automatische Auszahlung simuliert Gehalt → Periodizität verstehen
- Sparbüchse und Sparziele üben Impulskontrolle und Zielplanung
- Einfaches Konzept: Was kommt rein, was geht raus

**Empfehlungen nach Alter:**
| Altersgruppe | Empfehlung |
|---|---|
| 6–8 Jahre | Kleines Taschengeld (2–4 CHF/Woche), wöchentliche Auszahlung, nur Guthaben anzeigen |
| 9–12 Jahre | Monatliches Taschengeld möglich, Sparziele einführen, Zinssimulation erklären |
| 13+ Jahre | Sparrate, Zinseszins als Lernmoment, Budgetplanung |

**Zinssimulation:** Realistische Zinssätze (0,5–2 %) lehren Geduld. Unrealistische Sätze (10 %+) vermitteln falsche Erwartungen. **Empfehlung:** UI-Hinweis ab 3 % Zinssatz.

---

### ✅ Haushaltspflichten (pädagogisch sehr wertvoll)

**Warum gut (in der aktuellen Implementierung):**
- Haushaltspflichten geben **keine Punkte** – korrekt!
- Sie gehören zur Familiengemeinschaft, nicht zum Belohnungssystem
- Vermeidet Overjustification-Effekt für Grundpflichten
- Kinder verstehen: Zur Familie beitragen ist normal und erwartet

**Risiko wenn falsch umgesetzt:**
Werden Haushaltspflichten bezahlt/bewertet, lernen Kinder, nur dann zu helfen, wenn eine Belohnung winkt.

**Empfehlungen:**
- Pflichten klar von Extra-Jobs trennen (bereits implementiert ✓)
- Positives Quittieren ("Danke!") statt Punkte (bereits implementiert ✓)
- Ab 13 Jahren: Pflichten mit Verantwortungsbewusstsein verknüpfen, nicht mit Druck

---

### ✅ Extra-Jobs / Mini-Jobs (pädagogisch wertvoll, ab 8 Jahren)

**Warum gut:**
- Kinder erfahren, dass zusätzlicher Einsatz sich lohnt
- Wahlfreiheit bei der Übernahme von Jobs stärkt Autonomie
- Verbindung zwischen Leistung und Ertrag ist konkret und unmittelbar

**Risiken:**
- Zu viele oder zu hohe Punkte entwerten die Belohnungen
- Kinder optimieren auf "maximale Punkte" statt echten Nutzen

**Empfehlungen:**
- Maximal 5–8 Extra-Jobs gleichzeitig aktiv halten
- Punkte so kalibrieren, dass eine Belohnung 2–4 Wochen Einsatz erfordert
- Unter 8 Jahren: Einfache, sofortige Belohnungen bevorzugen

---

### ⚠️ Streak-System (pädagogisch ambivalent)

**Positiv:**
- Visualisiert Beständigkeit und Ausdauer
- Motiviert zur regelmäßigen Teilnahme

**Risiken:**
- Streak-Stress: Angst, eine Woche zu "verlieren" (ähnlich Social-Media-Mechanismen)
- Kinder können unter Druck geraten, auch wenn sie krank oder im Urlaub sind
- Extrinsische Motivation ersetzt intrinsische Freude am Mitmachen

**Empfehlungen:**
- Streak optional anzeigen (bereits via `show_streak` Setting implementiert ✓)
- Für Kinder unter 10 Jahren: Streak standardmäßig ausblenden
- Klare Kommunikation in der Familie: "Kein Streak = kein Problem"
- **Nicht** mit negativen Konsequenzen verknüpfen

---

### ⚠️ Badges / Abzeichen (pädagogisch ambivalent, ab 9 Jahren)

**Positiv:**
- Meilensteine sichtbar machen
- Leistungen anerkennen ohne direkte Geldzahlung
- Sammelmotivation kann kurzfristig motivieren

**Risiken:**
- "Gamification-Treadmill": Kinder sammeln Badges mechanisch ohne echten Wert
- Vergleich unter Geschwistern kann Druck erzeugen
- Unter 9 Jahren oft schwer verständlich (abstrakte Anerkennung)

**Empfehlungen:**
- Badges optional anzeigen (via `show_badges` Setting implementiert ✓)
- Wenige, bedeutungsvolle Badges besser als viele leicht erreichbare
- Badges als Gesprächsanlass nutzen: "Wie hast du das geschafft?"
- Keine negativen Badges ("schlechteste Woche" etc.)

---

### ⚠️ Punkteabzug / Negative Punkte (pädagogisch problematisch)

**Risiken:**
- Punkte als Strafe verwenden schadet der Vertrauensbeziehung
- Kinder erleben Ungerechtigkeit, wenn Punkte ohne Erklärung verschwinden
- Kann zu Rebellion oder Resignation führen
- Verwischt die Grenze zwischen Belohnungs- und Disziplinsystem

**Empfehlungen:**
- Negativpunkte nur in Ausnahmefällen und mit ausführlicher Erklärung
- Nie als automatische Strafe für vergessene Pflichten
- UI-Warnung bei negativem Delta (in Implementierung ✓)
- Alternativen: Gespräch, Zeit-out, Privilegentzug sind pädagogisch sauberer

---

### ✅ Belohnungen / Rewards (pädagogisch wertvoll, ab 8 Jahren)

**Warum gut:**
- Klares Ziel vor Augen: Spargedanke für Punkte
- Elterliche Genehmigung schafft Dialog und Aushandlung
- Genehmigungsprozess lehrt, dass nicht alles sofort verfügbar ist

**Empfehlungen:**
- Belohnungen sollten erreichbar aber nicht trivial sein (2–4 Wochen Einsatz)
- Mischung aus kleinen (schnell) und großen (langfristig) Belohnungen
- Nicht-materielle Belohnungen einbauen (Ausflug, Filmabend, Kochstunde)
- Eltern sollten Genehmigung als Gespräch nutzen, nicht als Machtmittel

---

### ✅ Flohmarkt (pädagogisch sehr wertvoll, ab 9 Jahren)

**Warum gut:**
- Echte wirtschaftliche Erfahrung: Preisfindung, Verhandlung, Einnahmen
- Nachhaltigkeit: Dinge verkaufen statt wegwerfen
- Eigenverantwortung für eigene Gegenstände
- Erlös gehört dem Kind → starkes Motivationsgefühl

**Empfehlungen:**
- Eltern als Coach, nicht als Kontrolleur
- Kinder Preise selbst vorschlagen lassen (auch wenn unrealistisch)
- Einnahmen direkt auf Kinderkonto verbuchen für sofortiges Erleben
- Unter 9 Jahren: Stark vereinfachen, Eltern führen die App

---

### ✅ Sparziele (pädagogisch sehr wertvoll, ab 8 Jahren)

**Warum gut:**
- Konkrete Zielplanung: Was will ich, wie lange muss ich sparen?
- Fortschrittsbalken macht Abstraktes sichtbar
- Impulskontrolle lernen: warten bis genug da ist
- Eigene Entscheidung stärkt Autonomie

**Empfehlungen:**
- Erstes Ziel klein halten (max. 4–8 Wochen Sparzeit)
- Eltern helfen beim Kalibrieren, nicht beim Entscheiden
- Erreichtes Ziel feiern!
- Unter 8 Jahren: Physisches Sparbüchsen-Äquivalent parallel führen

---

## Empfehlungen nach Altersgruppe

### 6–8 Jahre (Vorschul-/Frühschulalter)
**Kognitive Entwicklung:** Konkretes Denken, kurze Zeitperspektive, starkes Gerechtigkeitsgefühl

| Feature | Empfehlung |
|---|---|
| Taschengeld | ✅ Wöchentlich, kleiner Betrag |
| Haushaltspflichten | ✅ Einfache Aufgaben, positive Bestätigung |
| Extra-Jobs | ⚠️ Wenige, sofort sichtbare Belohnungen |
| Punkte/Streak | ❌ Nicht empfohlen – zu abstrakt |
| Badges | ❌ Nicht empfohlen |
| Sparziele | ⚠️ Nur sehr kurzfristige Ziele |
| Flohmarkt | ⚠️ Mit starker Elternbegleitung |

### 9–12 Jahre (Mittlere Kindheit)
**Kognitive Entwicklung:** Logisches Denken, längere Zeitperspektive, sozialer Vergleich wichtig

| Feature | Empfehlung |
|---|---|
| Taschengeld | ✅ Monatlich möglich, Kontoübersicht |
| Haushaltspflichten | ✅ Mehr Verantwortung, weniger Kontrolle |
| Extra-Jobs | ✅ Vielfalt, Selbstwahl |
| Punkte/Streak | ⚠️ Optional, kein Druck |
| Badges | ⚠️ Sparsam einsetzen |
| Sparziele | ✅ Mittelfristige Ziele (1–3 Monate) |
| Flohmarkt | ✅ Sehr geeignet |

### 13+ Jahre (Adoleszenz)
**Kognitive Entwicklung:** Abstraktes Denken, Identitätsfindung, Autonomiebedürfnis hoch

| Feature | Empfehlung |
|---|---|
| Taschengeld | ✅ Monatlich, Budgetverantwortung |
| Haushaltspflichten | ✅ Mitverantwortung als Erwachsener |
| Extra-Jobs | ✅ Optional, eigenverantwortlich |
| Punkte/Streak | ❌ Eher weglassen – wirkt kindisch |
| Badges | ❌ Eher weglassen |
| Zinssimulation | ✅ Als Lernmoment |
| Flohmarkt | ✅ Eigenständig führen |

---

## Implementierte Pädagogik-Anpassungen

Die folgenden Anpassungen wurden direkt im Code umgesetzt:

1. **Haushaltspflichten ohne Punkte** – `job_type = 'duty'` gibt 0 Punkte, wird nur positiv quittiert
2. **Klare visuelle Trennung** – Pflichten (grün) vs. Extra-Jobs (blau) in der UI
3. **Streak optional** – `family_settings.show_streak` steuert Sichtbarkeit
4. **Badges optional** – `family_settings.show_badges` steuert Sichtbarkeit
5. **Altersgruppen** – `age_group` Feld auf users-Tabelle für zukünftige altersgerechte Anpassungen
6. **Negativpunkte-Warnung** – UI-Hinweis bei negativem Delta in der Punktevergabe

---

## Literaturhinweise

- Deci, E. L., & Ryan, R. M. (1985). *Intrinsic Motivation and Self-Determination in Human Behavior.* Plenum Press.
- Lepper, M. R., Greene, D., & Nisbett, R. E. (1973). Undermining children's intrinsic interest with extrinsic reward. *Journal of Personality and Social Psychology, 28*(1), 129–137.
- Gneezy, U., & Rustichini, A. (2000). A fine is a price. *Journal of Legal Studies, 29*(1), 1–17.
- Pink, D. H. (2009). *Drive: The Surprising Truth About What Motivates Us.* Riverhead Books.
