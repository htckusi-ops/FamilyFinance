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
- Punkte vergeben oder abziehen (spontan oder über Mini-Jobs)
- Belohnungsanfragen genehmigen oder ablehnen
- Flohmarktverwaltung: Artikel erfassen, Preise festlegen, Etiketten drucken, kassieren
- Einstellungen: Familienwerte, API-Tokens, Backup
- Login: Benutzername + Passwort (case-insensitive)
- Abmelden: 👋 Abmelden-Button in der Navigation

### Kinder
- Eigenes Dashboard: Guthaben, Punkte, Flohmarkt-Erlöse, Sparziele, Belohnungen, Badges
- Punkte-Timeline: visueller Weg zu den nächsten Belohnungen
- Belohnung beantragen (Eltern werden benachrichtigt)
- Login: Klick auf Profilbild (optional mit PIN)
- Keine Administrationsrechte

---

## Module (implementiert)

### 1. Taschengeld-Verwaltung

- Pro Kind: konfigurierbarer Betrag und Intervall (wöchentlich / monatlich)
- Nächstes Auszahlungsdatum konfigurierbar
- Manuelle Einzahlungen und Ausgaben (mit Beschreibung und optionalem Belegfoto)
- Belegfoto wird client-seitig auf max. 500 px verkleinert (Canvas API, kein Server-Overhead)
- Transaktionsverlauf mit Typ-Labels und klickbaren Foto-Thumbnails
- Zinssimulation: konfigurierbarer Zinssatz auf Sparkonto-Guthaben (monatlicher Cron)
- Sparbüchse (savings_balance): separat vom Hauptkonto, eigener Saldo

#### Sparziele
- Name, Zielbetrag, optionales Bild
- Fortschrittsbalken (aktueller Betrag / Zielbetrag)
- Mehrere Sparziele parallel
- Erreichtes Ziel: Badge „Sparziel erreicht!" wird automatisch vergeben

### 2. Punkte- & Belohnungssystem

#### Mini-Jobs
- Eltern definieren Jobs mit Name, Punktzahl, Wiederholung (manuell / täglich / wöchentlich)
- Zwei Typen:
  - **Haushaltspflichten** (`duty`): Zur Gemeinschaft beitragen; Punkte optional konfigurierbar
  - **Extra-Jobs** (`extra`): Freiwillige Zusatzleistungen mit Punkten
- Elternteil bestätigt Erledigung per Klick → Punkte werden gutgeschrieben
- Streak-Anzeige: Anzahl aufeinanderfolgender Wochen mit erledigten Jobs
- Streak und Badges können pro Familie deaktiviert werden (`family_settings`)

#### Spontane Punktvergabe
- Freie Eingabe: Kind, Beschreibung, Punktzahl (positiv oder negativ)
- Negative Punkte (Abzug) mit Voreinstellungen (z. B. TV-Zeit, Aufforderungen)
- UI-Warnung bei negativem Delta

#### Punkte ↔ CHF Umtausch
- Konfigurierbarer Wert: 1 Punkt = X CHF (Standard: 0.10)
- Eltern können Punkte in CHF umwandeln (Gutschrift auf Kinderkonto) oder umgekehrt
- Live-Vorschau des Umtauschbetrags

#### Belohnungen
- Eltern definieren Belohnungen mit Name, Punktanforderung, optionalem Bild
- Fortschrittsbalken pro Belohnung im Kinderdashboard
- Kind beantragt Einlösung → Eltern genehmigen oder lehnen ab
- Telegram-Benachrichtigung bei neuem Antrag (optional)
- Badge „Belohnung eingelöst" bei erstem Claim

#### Punkte-Timeline
- Visuelle Zeitachse im Kinderdashboard
- Zeigt aktuellen Punktestand als glühenden ⭐-Marker
- Alle Belohnungen als Meilensteine (nächste hervorgehoben, erreichte als ✓)

#### Badges / Abzeichen
- Automatisch vergeben bei Meilensteinen:
  - `first_save` – Erstes Sparziel gespeichert
  - `goal_reached` – Sparziel erreicht
  - `first_job` – Ersten Mini-Job erledigt
  - `five_jobs` – 5 Mini-Jobs erledigt
  - `twenty_jobs` – 20 Mini-Jobs erledigt
  - `streak_2` – 2 Wochen Streak
  - `streak_4` – 4 Wochen Streak
  - `flea_first_item` – Ersten Flohmarkt-Artikel erfasst
  - `flea_first_sale` – Ersten Artikel verkauft
  - `first_reward` – Erste Belohnung eingelöst
  - `saver_100` – CHF 100 gespart

### 3. Flohmarkt-Verwaltung

#### Flohmarkttage
- Eltern erstellen Flohmarkttage mit Datum und Name
- Artikel werden einem Flohmarkttag zugewiesen

#### Artikel erfassen
- Barcode-Scan über Smartphone-Kamera (HTTPS) oder Foto-Upload (HTTP-Fallback)
- Manuelle Eingabe: Name, Beschreibung, Kategorie, Zustand, Richtpreis, Foto
- Kategorien: Spielzeug, Kleidung, Bücher, Elektronik, Sport, Sonstiges
- Zustände: neu, sehr gut, gut, akzeptabel
- Besitzer: beliebige Benutzer (Kinder und Elternteile) mit prozentualer Aufteilung
- Artikel ohne Besitzer: werden im Abschluss als ⚠️ Warnung angezeigt

#### Archiv & Wiederverwendung
- Nicht verkaufte Artikel bleiben gespeichert (Status: `unsold`)
- Wiederaktivierung für neuen Flohmarkttag per „Reaktivieren"-Funktion

#### Etikettendruck
- PDF mit allen verfügbaren Artikeln eines Tages
- Etikett: Name, Richtpreis, Besitzer, Kategorie, Zustand
- Optimiert für A4 (mehrere Etiketten pro Seite)

#### Kassierfunktion
- Artikel aus Liste auswählen → Verkaufspreis eingeben (Richtpreis vorausgefüllt)
- Als „verkauft" markieren → Erlös wird sofort auf Kinderkonto gutgeschrieben
- Anteilige Aufteilung bei Mehrfachbesitz (share_percent)
- Artikel als „nicht verkauft" markieren

#### Tages-Abschluss
- Gesamterlös unabhängig von Besitzer-Zuweisung (separater Query)
- Erlös aufgeteilt pro Kind/Besitzer mit Einzelartikelliste (Name, Kategorie, Preis)
- Warnung bei Artikeln ohne Besitzer
- Artikel mit Status `unsold` werden ausgegraut aufgelistet

### 4. Badespass

- Teilnehmende Kinder pro Familie konfigurierbar
- Wer ist heute dran? – gerechte Reihenfolge: wenigste Züge zuerst, Tiebreak: längstes Warten
- Zählstand pro Kind mit „ausstehend"-Badge
- Badetag aufzeichnen (1 Klick) oder letzten Eintrag rückgängig machen
- Verlauf der letzten 10 Badetage

### 5. Einstellungen

- Familien-Einstellungen: Währung (Standard: CHF), Punkt-Wert in CHF, Labels für Job-Typen
- Pädagogische Einstellungen: Streak-Anzeige, Badge-Anzeige (pro Familie), Altersgruppe pro Kind
- Benutzer verwalten: Anlegen, Foto hochladen, PIN setzen, Löschen (letztes Elternteil geschützt)
- API-Tokens: Langlebige Tokens für Home-Assistant-Integration
- Backup: DB + Uploads als ZIP herunterladen
- Telegram: Bot-Token und Chat-ID konfigurieren

### 6. Benachrichtigungen (Telegram)

- Konfigurierbar: welche Events, welcher Chat
- Events: Belohnungsanfrage, automatische Auszahlung, Punkte vergeben

---

## Technischer Stack

### Backend
- **Node.js** mit **Express**
- **better-sqlite3** (synchron, WAL-Modus, Foreign Keys)
- **JWT** für Authentifizierung (Eltern) + optionaler PIN (Kinder)
- **multer** für Datei-Uploads
- **node-cron** für automatische Auszahlungen, Zinsgutschriften, Backup
- **PDFKit** für Etikettendruck
- **node-telegram-bot-api** für Benachrichtigungen (optional)

### Frontend
- **React 18** mit **Vite**
- **@zxing/browser** für browser-basiertes Barcode-Scannen
- Canvas API für client-seitige Bildverkleinerung (max. 500 px, JPEG 85 %)
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
  job_type (duty|extra), active, created_at

rewards
  id, name, points_required, image, active, created_at

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
  category, condition, suggested_price, sold_price,
  status (available|sold|unsold), created_at

flea_item_owners
  id, flea_item_id → flea_items, user_id → users, share_percent
  UNIQUE(flea_item_id, user_id)

bath_participants
  id, user_id → users (UNIQUE)

bath_turns
  id, user_id → users, bath_date, created_at

notification_config
  id, user_id → users, telegram_chat_id, events (JSON)

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
│   │   │   ├── allowance.js   # Taschengeld, Ausgaben, Sparziele
│   │   │   ├── auth.js        # Login (case-insensitiv), Token-Refresh
│   │   │   ├── backup.js      # DB + Uploads ZIP-Download
│   │   │   ├── badges.js      # Badge-Abfragen
│   │   │   ├── bath.js        # Badespass-Modul
│   │   │   ├── flea.js        # Flohmarkt-Verwaltung
│   │   │   ├── ha.js          # Home-Assistant-Endpunkte
│   │   │   ├── notify.js      # Telegram-Konfiguration
│   │   │   ├── points.js      # Punkte, Mini-Jobs, Umtausch
│   │   │   ├── rewards.js     # Belohnungen, Claims
│   │   │   ├── settings.js    # Familien-Einstellungen
│   │   │   ├── tokens.js      # API-Token-Verwaltung
│   │   │   └── users.js       # Benutzer-CRUD
│   │   ├── services/
│   │   │   ├── badges.js      # Badge-Vergabe-Logik
│   │   │   ├── pdf.js         # Etiketten-PDF
│   │   │   └── telegram.js    # Benachrichtigungen
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT-Validierung, parentOnly
│   │   │   └── upload.js      # multer-Konfiguration
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
│   │   │   ├── PointsTimeline.jsx
│   │   │   └── ProgressBar.jsx
│   │   ├── hooks/
│   │   │   └── useScanner.js
│   │   ├── api/
│   │   │   └── client.js      # axios mit JWT-Interceptor
│   │   └── context/
│   │       ├── AuthContext.jsx
│   │       └── ToastContext.jsx
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── nas-update.sh
├── data/                      # SQLite-DB (gitignored, Volume-Mount)
├── uploads/                   # Fotos (gitignored, Volume-Mount)
├── backups/                   # Backups (gitignored, Volume-Mount)
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

### Kinder-Dashboard
- Profilbild, zeitabhängige Begrüssung (Guten Morgen / Hallo / Guten Abend)
- 3 Hauptkacheln: 💰 Guthaben | ⭐ Punkte | 🏷️ Flohmarkt-Erlöse
- Punkte-Timeline vor der Belohnungsliste
- Sparbüchsen-Saldo sichtbar wenn > 0
- Streak und Badges per Familien-Einstellung steuerbar

### Eltern-Ansicht
- Alle Kinder auf Übersichtsseite (ParentDashboard)
- Schnellzugriff: Taschengeld, Punkte, Flohmarkt, Badespass, Einstellungen
- 👋 Abmelden-Button in Navigation
- Offene Belohnungsanfragen mit Approve/Reject-Buttons

---

## Sicherheitshinweise

- `JWT_SECRET` in `docker-compose.yml` **muss** vor dem ersten Produktionseinsatz geändert werden
- Admin-Passwort (`admin`) sofort nach Erstinstallation ändern
- HTTPS über Synology Reverse Proxy einrichten – notwendig für Kamerazugriff im Browser
- Das letzte Elternteil-Konto kann nicht gelöscht werden (Systemschutz)
- API-Tokens (für Home Assistant) sind langlebig – nur bei Bedarf ausstellen

---

## Offene Punkte / Geplante Erweiterungen

- Push-Benachrichtigungen via Web Push API
- Flohmarkt-Export als CSV
- OCR für Kassenbons (Tesseract.js)
- Mehrsprachigkeit (DE / FR / EN)
- Jahresauswertung mit Diagrammen
- Wunschliste für Kinder (eigenständig, ohne Punkte)
