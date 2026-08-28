# FamilyFinance – Konzept & Funktionsbeschreibung

## Projektübersicht

FamilyFinance ist eine familienfreundliche Web-App zur Verwaltung von Taschengeld, Flohmarktartikeln, einem Punkte- und Belohnungssystem sowie der Badezimmer-Planung für Kinder. Das System läuft als Docker-Stack auf einer Synology NAS und ist über jeden Browser (Desktop und Smartphone) erreichbar.

---

## Benutzerrollen

### Eltern / Admin
- Vollzugriff auf alle Funktionen und Einstellungen
- Verwaltung von Benutzerkonten (Kinder anlegen, Fotos hochladen)
- Taschengeld konfigurieren und auszahlen
- Ausgaben mit Beschreibung und Foto vom Kinderkonto abbuchen
- Punkte vergeben oder abziehen (spontan oder über Mini-Aufgaben)
- Belohnungsanfragen genehmigen oder ablehnen
- Flohmarktverwaltung: Artikel erfassen, Preise festlegen, Etiketten drucken, kassieren
- Finanzübersicht: monatliche und jährliche Kostenübersicht der gesamten Familie
- Einstellungen: Familienwerte, API-Tokens, Backup, Benachrichtigungen
- Login: Benutzername + Passwort (Gross-/Kleinschreibung egal)
- Abmelden: 👋 Abmelden-Button in der Navigation

### Kinder
- Eigenes Dashboard: Guthaben, Punkte, Flohmarkt-Erlöse, Sparziele, Wünsche, Abzeichen
- Punkte-Zeitachse: visueller Weg zu den nächsten Wünschen (flussbasiert, überlappungsfrei)
- Wunsch beantragen (Eltern werden benachrichtigt)
- Login: Klick auf Profilbild (optional mit PIN)
- Keine Administrationsrechte

---

## Module (implementiert)

### 1. Taschengeld-Verwaltung

- Pro Kind: konfigurierbarer Betrag und Intervall (wöchentlich / monatlich)
- Nächstes Auszahlungsdatum konfigurierbar
- Manuelle Einzahlungen und Ausgaben (mit Beschreibung und optionalem Belegfoto)
- Hochgeladene Bilder werden serverseitig auf max. 1600 px verkleinert und als JPEG gespeichert (jimp, keine nativen Abhängigkeiten)
- Transaktionsverlauf mit Typ-Labels und klickbaren Foto-Thumbnails
- Zinssimulation: konfigurierbarer Zinssatz auf Sparkonto-Guthaben (monatlicher Cron)
- Sparbüchse (savings_balance): separat vom Hauptkonto, eigener Saldo

#### Sparziele
- Name, Zielbetrag, optionales Bild
- Fortschrittsbalken (aktueller Betrag / Zielbetrag)
- Mehrere Sparziele parallel
- Erreichtes Ziel: Abzeichen „Sparziel erreicht!" wird automatisch vergeben

#### Belegfoto-OCR
- Foto hochladen → Tesseract.js erkennt Geldbeträge automatisch
- Erkannte Beträge zur Auswahl vorgeschlagen

### 2. Punkte- & Belohnungssystem

#### Mini-Aufgaben
- Eltern definieren Aufgaben mit Name, Punktzahl, Wiederholung (manuell / täglich / wöchentlich)
- Zwei Typen:
  - **Haushaltspflichten** (`duty`): Zur Gemeinschaft beitragen; Punkte optional konfigurierbar (Standard: 0)
  - **Extra-Aufgaben** (`extra`): Freiwillige Zusatzleistungen mit Punkten
- Elternteil bestätigt Erledigung per Klick → Punkte werden gutgeschrieben
- Wochen-Serie: Anzahl aufeinanderfolgender Wochen mit erledigten Aufgaben
- Serie und Abzeichen können pro Familie deaktiviert werden (`family_settings`)

#### Spontane Punktvergabe
- Freie Eingabe: Kind, Beschreibung, Punktzahl (positiv oder negativ)
- Negative Punkte (Abzug) mit Voreinstellungen (z. B. TV-Zeit, Aufforderungen)
- Sicherheitshinweis bei negativem Delta

#### Punkte ↔ CHF Umtausch
- Konfigurierbarer Wert: 1 Punkt = X CHF (Standard: 0.10)
- Eltern können Punkte in CHF umwandeln (Gutschrift auf Kinderkonto) oder umgekehrt
- Live-Vorschau des Umtauschbetrags

#### Wünsche (Belohnungen)
- Eltern definieren Wünsche mit Name, Punktanforderung, optionalem Bild (oder Emoji)
- **Zielgruppe**: Wunsch kann für alle Kinder, ausgewählte Kinder oder ein einzelnes Kind gelten
- **Gemeinsame Wünsche** (`require_all`): Bei mehreren Kindern müssen *alle* die Punktzahl erreichen, bevor einer einlösen kann → fördert Zusammenarbeit
- Fortschrittsbalken pro Wunsch im Kinderdashboard (bei gemeinsamen Wünschen: pro Kind)
- Kind beantragt Einlösung → Eltern genehmigen oder lehnen ab
- Benachrichtigung bei neuem Antrag (Telegram / Signal / Threema)
- Abzeichen „Wunsch eingelöst" bei erstem Einlösen

#### Punkte-Zeitachse
- Flusslayout: Erreichte Wünsche oben → aktueller Punktestand als eigener Abschnitt → nächste Wünsche unten
- Keine Überlappungen möglich (strukturell ausgeschlossen)
- Nächstes Ziel: Fortschrittsbalken + „noch X Punkte" inline angezeigt

#### Abzeichen
- Automatisch vergeben bei Meilensteinen:
  - `first_save` – Erstes Sparziel gespeichert
  - `goal_reached` – Sparziel erreicht
  - `first_job` – Ersten Mini-Auftrag erledigt
  - `five_jobs` – 5 Aufträge erledigt
  - `twenty_jobs` – 20 Aufträge erledigt
  - `streak_2` – 2 Wochen Serie
  - `streak_4` – 4 Wochen Serie (Monatsheld)
  - `flea_first_item` – Ersten Flohmarkt-Artikel erfasst
  - `flea_first_sale` – Ersten Artikel verkauft
  - `first_reward` – Ersten Wunsch eingelöst
  - `saver_100` – CHF 100 gespart

### 3. Finanzübersicht (Eltern)

- Monat/Jahr-Umschaltung
- Zusammenfassung: laufende monatliche Kosten (Taschengeld, Wünsche, Zinsen)
- Pro-Kind-Zeilen mit Taschengeld-Konfiguration und Zinssatz
- Zinsen farblich hervorgehoben (amber, nur sichtbar wenn konfiguriert)
- 12-Monats-Diagramm (Balkendiagramm mit recharts): Ausgaben nach Typ aufgeteilt, inkl. Zinsspalte

### 4. Flohmarkt-Verwaltung

#### Flohmarkttage
- Eltern erstellen Flohmarkttage mit Datum und Name
- Artikel werden einem Flohmarkttag zugewiesen

#### Artikel erfassen
- Barcode-Scan über Smartphone-Kamera (HTTPS) oder Foto-Upload (HTTP-Fallback)
- **Automatische Produktsuche**: Bei gültigem Barcode wird Open Food Facts (Lebensmittel/Haushalt) und Open Library (ISBN-Bücher) abgefragt → Name und Beschreibung vorausgefüllt
- Barcode wird separat gespeichert und nicht als Artikelname übernommen
- Manuelle Eingabe: Name, Beschreibung, Kategorie, Zustand, Richtpreis, Foto
- Kategorien: Spielzeug, Kleidung, Bücher, Elektronik, Sport, Sonstiges
- Zustände: neu, sehr gut, gut, akzeptabel
- Besitzer: beliebige Nutzer mit prozentualer Erlösaufteilung
- Foto-Thumbnails in der Artikelliste und beim Kassieren

#### Archiv & Wiederverwendung
- Nicht verkaufte Artikel bleiben gespeichert (Status: `unsold`)
- Wiederaktivierung für neuen Flohmarkttag per „Reaktivieren"-Funktion

#### Etikettendruck (PDF)
- Layout: 2 Spalten × 5 Zeilen pro A4-Seite
- Inhalt pro Etikett: QR-Code (item:ID), Foto-Thumbnail (oder Platzhalter), Name, Kategorie, Zustand, Preis
- Keine Kindernamen auf Etiketten (Datenschutz)
- QR-Code kann beim Kassieren direkt gescannt werden → Artikel öffnet sich sofort

#### Kassierfunktion
- Artikel aus Liste auswählen oder QR-Code / Produkt-Barcode scannen
- **Verkaufstypen**:
  - *Verkauf*: Preis eingeben → Erlös auf Kinderkonto
  - *Tausch*: Artikel als getauscht markieren; optional Aufpreis (positiv) oder Differenz (negativ) erfassen
- Verkauf rückgängig machen: Erlös wird zurückgebucht, Artikel wieder verfügbar
- Verkaufte Artikel bleiben editierbar

#### Tages-Abschluss
- Gesamterlös (unabhängig von Besitzerzuweisung)
- Erlös aufgeteilt pro Kind mit Einzelartikelliste
- Hinweis bei Artikeln ohne Besitzer

### 5. Badeplan

- Teilnehmende Kinder pro Familie konfigurierbar
- Wer ist heute dran? – gerechte Reihenfolge: wenigste Züge zuerst, Gleichstand: längstes Warten
- Zählstand pro Kind mit „ausstehend"-Markierung
- Badetag aufzeichnen (1 Klick) oder letzten Eintrag rückgängig machen
- Verlauf der letzten 10 Badetage

### 6. Bestätigungsdialog bei Löschvorgängen

- Alle Löschaktionen in der App (Artikel, Aufgaben, Sparziele, Benutzer, Tokens usw.) zeigen einen einheitlichen Bestätigungsdialog
- Technisch: globaler `ConfirmContext` mit Promise-basiertem `confirmDialog()`-Hook
- Verhindert versehentliche Löschungen

### 7. Einstellungen

- Familien-Einstellungen: Währung (Standard: CHF), Punkt-Wert in CHF
- Pädagogische Einstellungen: Wochen-Serie anzeigen, Abzeichen anzeigen, Altersgruppe pro Kind
- Benutzer verwalten: Anlegen, Foto hochladen, PIN setzen, Löschen (letztes Elternteil geschützt)
- API-Tokens: Langlebige Tokens für Home-Assistant-Integration
- Backup: DB + Uploads als ZIP herunterladen
- Benachrichtigungen: Telegram, Signal, Threema – pro Elternteil konfigurierbar

### 8. Benachrichtigungen

- Drei parallele Kanäle pro Elternteil: **Telegram** · **Signal** (signal-cli-rest-api) · **Threema** (Gateway)
- Konfigurierbare Events: Belohnungsanfrage, automatische Auszahlung, Punkte vergeben
- Telegram: Bot-Token als Umgebungsvariable, Chat-ID pro Elternteil in der App
- Signal: Benötigt signal-cli-rest-api-Container; Absender-Nummer und API-URL als Umgebungsvariablen
- Threema: Benötigt Threema-Gateway-Konto; Gateway-ID und Secret als Umgebungsvariablen
- Alle drei Kanäle nutzen den eingebauten `fetch` von Node.js 20 (keine zusätzlichen Abhängigkeiten)

---

## Technischer Stack

### Backend
- **Node.js 20** mit **Express**
- **better-sqlite3** (synchron, WAL-Modus, Foreign Keys)
- **JWT** für Authentifizierung (Eltern) + optionaler PIN (Kinder)
- **multer** (Memory-Storage) + **jimp** für Datei-Uploads mit serverseitiger Bildverkleinerung
  - Alle Bilder werden beim Speichern auf max. konfigurierte Breite/Höhe verkleinert
  - Gespeichert als JPEG – kein Original wird behalten
  - Gelöschte Artikel/Benutzer: zugehörige Dateien werden automatisch entfernt
- **node-cron** für automatische Auszahlungen, Zinsgutschriften, Backup
- **PDFKit** + **qrcode** für Etikettendruck
- **tesseract.js** für Beleg-OCR (optional)
- Node.js 20 `fetch` (eingebaut) für externe Dienste (Signal, Threema, Open Food Facts, Open Library)

### Frontend
- **React 18** mit **Vite**
- **@zxing/browser** für browser-basiertes Barcode-Scannen
- **recharts** für Finanzdiagramme
- **ConfirmContext**: Globaler Bestätigungsdialog für alle Löschvorgänge
- Responsive Design, Mobile First
- PWA-fähig (manifest.json vorhanden)

### Deployment
- **Docker Compose**: Backend + Frontend + Nginx in einem Stack
- **nginx:alpine** als Reverse Proxy
- Volume-Mounts: `./data` → `/app/data`, `./uploads` → `/app/uploads`, `./backups` → `/app/backups`
- Synology NAS: Installation über Container Manager GUI (kein SSH nötig)
- HTTPS: Synology Reverse Proxy + Let's Encrypt empfohlen

---

## Datenbankschema

```
users
  id, name, role (parent|child), photo, pin_required, pin_hash,
  password_hash, color, age_group, created_at

accounts
  id, user_id → users, balance, savings_balance

transactions
  id, user_id → users, amount, type, description, receipt_photo, created_at

savings_goals
  id, user_id → users, name, target_amount, current_amount, image,
  achieved_at, created_at

allowance_config
  id, user_id → users, amount, interval (weekly|monthly),
  next_payout_at, interest_rate

points
  id, user_id → users, balance, streak_weeks, last_job_week

point_events
  id, user_id → users, delta, description, mini_job_id → mini_jobs, created_at

mini_jobs
  id, name, points, recurrence (manual|daily|weekly),
  job_type (duty|extra), active, image, created_at

rewards
  id, name, points_required, image, active, require_all, created_at

reward_targets
  reward_id → rewards, user_id → users
  PRIMARY KEY (reward_id, user_id)
  Leer = Wunsch gilt für alle Kinder

reward_claims
  id, user_id → users, reward_id → rewards,
  status (pending|approved|rejected), claimed_at, approved_at

badges
  id, key (unique), name, description, icon

user_badges
  id, user_id → users, badge_id → badges, earned_at

flea_market_days
  id, date, name, created_at

flea_items
  id, day_id → flea_market_days, name, description, barcode, photo,
  category, condition, suggested_price, sold_price, sold_type (cash|tausch),
  status (available|sold|unsold), created_at

flea_item_owners
  id, flea_item_id → flea_items, user_id → users, share_percent
  UNIQUE(flea_item_id, user_id)

bath_participants
  id, user_id → users (UNIQUE)

bath_turns
  id, user_id → users, bath_date, created_at

notification_config
  id, user_id → users (UNIQUE),
  telegram_chat_id, signal_recipient, threema_to_id,
  events (JSON-Array)

api_tokens
  id, name, token (unique), created_by → users, last_used_at, created_at

backups
  id, filename, size_bytes, created_at

family_settings
  key (primary), value
  Standard-Keys: show_streak, show_badges, interest_visible_age,
                 duty_jobs_label, extra_jobs_label, currency,
                 point_value_chf
```

---

## Projektstruktur

```
FamilyFinance/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── allowance.js   # Taschengeld, Ausgaben, Sparziele, OCR
│   │   │   ├── auth.js        # Login, Token-Refresh
│   │   │   ├── backup.js      # DB + Uploads ZIP-Download
│   │   │   ├── badges.js      # Abzeichen-Abfragen
│   │   │   ├── bath.js        # Badeplan-Modul
│   │   │   ├── finance.js     # Finanzübersicht (Eltern)
│   │   │   ├── flea.js        # Flohmarkt-Verwaltung
│   │   │   ├── ha.js          # Home-Assistant-Endpunkte
│   │   │   ├── notify.js      # Benachrichtigungs-Konfiguration
│   │   │   ├── points.js      # Punkte, Mini-Aufgaben, Umtausch
│   │   │   ├── rewards.js     # Wünsche, Einlösungen, Zielgruppen
│   │   │   ├── settings.js    # Familien-Einstellungen
│   │   │   ├── tokens.js      # API-Token-Verwaltung
│   │   │   └── users.js       # Benutzer-CRUD
│   │   ├── services/
│   │   │   ├── badges.js      # Abzeichen-Vergabe-Logik
│   │   │   ├── notify.js      # Telegram / Signal / Threema
│   │   │   └── pdf.js         # Etiketten-PDF (PDFKit + qrcode)
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT-Validierung, parentOnly
│   │   │   └── upload.js      # multer (Memory) + jimp-Resize
│   │   ├── db.js              # SQLite-Setup, automatische Migrationen
│   │   └── index.js           # Express-App, Route-Registrierung
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AllowancePage.jsx
│   │   │   ├── BathPage.jsx
│   │   │   ├── ChildDashboard.jsx
│   │   │   ├── FinanceOverviewPage.jsx
│   │   │   ├── FleaDayPage.jsx
│   │   │   ├── FleaMarketPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── ParentDashboard.jsx
│   │   │   ├── PointsPage.jsx
│   │   │   ├── RewardsPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── components/
│   │   │   ├── Avatar.jsx
│   │   │   ├── BarcodeScanner.jsx  # Video-Scan + HTTP-Fallback
│   │   │   ├── ChildNav.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── ParentNav.jsx
│   │   │   ├── PointsTimeline.jsx  # Flussbasierte Punkte-Zeitachse
│   │   │   └── ProgressBar.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── ConfirmContext.jsx   # Globaler Bestätigungsdialog
│   │   │   └── ToastContext.jsx
│   │   ├── hooks/
│   │   │   └── useScanner.js
│   │   └── api/
│   │       └── client.js           # axios mit JWT-Interceptor
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── nas-update.sh
├── data/
├── uploads/
├── backups/
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
├── README.md
└── docs/
    ├── SYNOLOGY-GUI-INSTALLATION.md
    ├── ENTWICKLUNG-WORKFLOW.md
    └── PAEDAGOGIK.md
```

---

## UX / Design-Richtlinien

### Allgemein
- Mobile First – Eltern nutzen Handy für schnelle Aktionen
- Helles, freundliches Farbschema (`--primary`, `--accent`, `--success`, `--danger`)
- Grosse Schaltflächen, klare Beschriftungen, minimale Fachbegriffe
- Keine Fremdwörter in der Oberfläche (z.B. „Serie" statt „Streak", „Zeitachse" statt „Timeline")
- Alle Löschvorgänge erfordern eine Bestätigung (roter „Löschen"-Button im Dialog)

### Kinderdashboard
- Profilbild, zeitabhängige Begrüssung (Guten Morgen / Hallo / Guten Abend)
- 3 Hauptkacheln: 💰 Guthaben | ⭐ Punkte | 🏷️ Flohmarkt-Erlöse
- Punkte-Zeitachse vor der Wunschliste
- Sparbüchsen-Saldo sichtbar wenn > 0
- Serie und Abzeichen per Familien-Einstellung steuerbar

### Eltern-Ansicht
- Alle Kinder auf Übersichtsseite (ParentDashboard)
- Schnellzugriff: Taschengeld, Punkte, Flohmarkt, Badeplan, Finanzübersicht, Einstellungen
- Offene Wunschanfragen mit Genehmigen/Ablehnen-Buttons

---

## Sicherheitshinweise

- `JWT_SECRET` in `docker-compose.yml` **muss** vor dem ersten Produktionseinsatz geändert werden
- Admin-Passwort (`admin`) sofort nach Erstinstallation ändern
- HTTPS über Synology Reverse Proxy einrichten – notwendig für Kamerazugriff im Browser
- Das letzte Elternteil-Konto kann nicht gelöscht werden (Systemschutz)
- API-Tokens (für Home Assistant) sind langlebig – nur bei Bedarf ausstellen
- Benachrichtigungs-Zugangsdaten (Telegram-Token, Threema-Secret) nur als Umgebungsvariablen – nie im Code

---

## Offene Punkte / Geplante Erweiterungen

- Push-Benachrichtigungen via Web Push API (ohne App-Installation)
- Flohmarkt-Export als CSV/Excel
- Mehrsprachigkeit (DE / FR / EN)
- Android/iOS-App als natives Frontend (React Native oder PWA-Wrapper)
- Kinderfreundliche Eingabe von Ausgaben (Kind erfasst selbst, Eltern bestätigen)
