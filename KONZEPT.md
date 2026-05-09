# FamilyFinance – Konzept

## Projektübersicht

FamilyFinance ist eine familienfreundliche Web-App zur Verwaltung von Taschengeld, Flohmarktartikeln und einem Belohnungspunktsystem für Kinder. Das System läuft als Docker-Container auf einer Synology NAS und ist über den Browser (Desktop und Smartphone) erreichbar.

---

## Benutzerrollen

### Eltern (Admin)
- Vollzugriff auf alle Funktionen und Einstellungen
- Verwaltung von Benutzerkonten (Kinder anlegen, Fotos hochladen)
- Taschengeld definieren und auszahlen
- Punkte vergeben (spontan oder über Mini-Jobs)
- Belohnungen definieren (was kostet wie viele Punkte)
- Flohmarktverwaltung: Artikel erfassen, Preise festlegen, Etiketten drucken
- Kassierfunktion beim Flohmarktverkauf
- Login: Benutzername + Passwort

### Kinder
- Eigenes Dashboard mit Übersicht (Guthaben, Punkte, Flohmarkt-Erlöse)
- Wunschliste mit Punktefortschritt
- Login: Klick auf Profilbild (optional mit PIN/Passwort, konfigurierbar)
- Keine Administrationsrechte

---

## Module

### 1. Taschengeld-Verwaltung

- Pro Kind: konfigurierbarer Taschengeld-Betrag und Intervall (wöchentlich/monatlich)
- Manuelle Einzahlungen und Abzüge möglich
- Transaktionsverlauf pro Kind
- Guthaben wird im Kinder-Dashboard angezeigt
- Optional: automatische Auszahlung (Cron-basiert)

#### Spar-Ziele
- Kind (oder Elternteil) definiert ein Sparziel mit Name, Betrag und optionalem Bild (z. B. „LEGO Set – CHF 45.–")
- Fortschrittsbalken zeigt wie viel bereits gespart ist
- Mehrere Sparziele parallel möglich
- Erreichtes Ziel wird visuell gefeiert (Animation)

#### Ausgaben-Tracking (freiwillig)
- Kinder können selbst eintragen, wofür sie Geld ausgegeben haben
- Spielerisch gestaltet, keine Pflicht
- Eltern sehen die Einträge, können kommentieren

#### Zins-Simulation
- Eltern definieren einen „Familien-Zinssatz" (z. B. 5 % pro Monat auf Sparkonto-Guthaben)
- Wird automatisch per Cron gutgeschrieben
- Zeigt Kindern spielerisch den Effekt des Sparens

### 2. Punkte- & Belohnungssystem

#### Mini-Jobs (von Eltern definiert)
- Name des Jobs (z. B. „Geschirrspüler ausräumen")
- Feste Punktzahl
- Wiederkehrende Jobs: täglich, wöchentlich oder manuell aktiviert
- Elternteil vergibt Punkte per Klick auf dem Handy nach Erledigung

#### Spontane Punktvergabe
- Freie Eingabe: Kind auswählen, Beschreibung, Punktzahl
- Auch negative Punkte möglich (Abzug)

#### Belohnungen (von Eltern definiert)
- Name der Belohnung (z. B. „Indoor-Spielplatz", „Kinobesuch", „1 CHF Taschengeld extra")
- Benötigte Punktzahl
- Bild/Icon optional
- Kinder sehen Fortschrittsbalken zu jeder Belohnung
- Erreichte Belohnungen werden hervorgehoben
- Kind kann Einlösen beantragen → Eltern erhalten Benachrichtigung (Telegram/Signal-Bot optional)

#### Abzeichen / Badges
- Automatisch vergeben bei Meilensteinen:
  - „Erstes Taschengeld gespart"
  - „5 Mini-Jobs erledigt"
  - „Flohmarkt-Profi" (ersten Artikel verkauft)
  - „Sparfuchs" (Sparziel erreicht)
  - „Wochenheld" (alle wöchentlichen Jobs erledigt)
  - uvm. (erweiterbar)
- Im Kinder-Dashboard sichtbar, neu erhaltene Badges werden animiert angezeigt

#### Streak-Anzeige
- Zeigt wie viele Wochen in Folge Mini-Jobs erledigt wurden
- Visuelle Flammen-/Stern-Anzeige (wie bei Duolingo)
- Motiviert zur Kontinuität

#### Kinder-Dashboard – Punkte-Ansicht
- Aktuelle Punktzahl gut sichtbar
- Belohnungsliste mit Fortschrittsbalken (kindergerecht, bunt)
- Bereits erreichbare Belohnungen: grün / freigeschaltet-Optik
- Noch fehlende Punkte sichtbar
- Streak und Badges prominent platziert

### 3. Flohmarkt-Verwaltung

#### Artikel erfassen
- QR-Code / Strichcode scannen über Smartphone-Kamera (browser-basiert, kein App-Download)
- Manuelle Eingabe möglich
- Produktinfos automatisch abrufen (OpenFoodFacts / Open Product Data APIs)
- Felder: Name, Beschreibung, Foto (optional, direkt per Kamera), zugewiesenes Kind, Richtpreis, Zustand
- Kategorien (Spielzeug, Kleidung, Bücher, Sonstiges)

#### Flohmarkt-Tage
- Eltern erstellen einen „Flohmarkttag" mit Datum
- Artikel werden einem Flohmarkttag zugewiesen
- Status pro Artikel: „geplant", „verkauft", „nicht verkauft"

#### Artikel-Archiv
- Nicht verkaufte Artikel bleiben gespeichert
- Beim nächsten Flohmarkttag können archivierte Artikel wiederverwendet werden (ein Klick → neu zuweisen)

#### Gemeinsamer Stand
- Mehrere Kinder können Artikel auf demselben Stand verkaufen
- Erlöse werden automatisch pro Kind aufgeteilt
- Tages-Zusammenfassung zeigt Erlöse je Kind

#### Etikettendruck
- Auswahl: alle Artikel eines Flohmarkttags oder individuelle Auswahl
- Etikett enthält: Name, Kind, Richtpreis, QR-Code (für schnelles Identifizieren)
- Ausgabe als PDF (druckoptimiert, mehrere Etiketten pro Seite, z. B. A4 mit 6–12 Etiketten)
- Etikettenformat konfigurierbar

#### Kassierfunktion (beim Flohmarkt)
- Elternteil öffnet App auf Smartphone
- Artikel per QR-Code scannen oder aus Liste auswählen
- Tatsächlichen Verkaufspreis eingeben (Richtpreis vorausgefüllt)
- Als „verkauft" markieren → Erlös wird dem Kind gutgeschrieben
- Tages-Zusammenfassung: Total pro Kind, Total gesamt

#### Flohmarkt-Erlöse
- Werden separat vom Taschengeld ausgewiesen
- Optional: Flohmarkterlöse auf Taschengeldkonto übertragen
- Im Kinder-Dashboard sichtbar

### 4. Quittungs-Scan (für Eltern)
- Foto eines Kassenbons hochladen
- OCR erkennt Betrag automatisch (Tesseract.js, lokal, keine Cloud)
- Betrag kann als Ausgabe oder Transaktion einem Kind zugewiesen werden
- Vereinfacht die manuelle Buchführung

### 5. Telegram / Signal Benachrichtigungen (optional)
- Eltern können einen Bot konfigurieren
- Benachrichtigung wenn:
  - Kind Belohnung einlösen möchte
  - Punkte vergeben wurden (Bestätigung)
  - Taschengeld automatisch ausgezahlt wurde
- Konfigurierbar: welche Events, welcher Chat

### 6. Mini-Finanzbildung (optionale Kachel)
- Kurze, kindgerechte Erklärungen als Kachel im Dashboard
- Themen: Was ist Sparen? Was ist ein Rabatt? Was ist Zins?
- Eltern können Kacheln aktivieren/deaktivieren
- Inhalte sind statisch und lokal (keine externe Abhängigkeit)

### 7. Backup-Funktion
- Ein-Klick-Backup der SQLite-Datenbank und Uploads
- Download als ZIP-Datei
- Optional: automatisches tägliches Backup in ein NAS-Share (per Volume-Mount konfigurierbar)
- Backup-Verlauf mit Datum der letzten Sicherungen

---

## Technischer Stack

### Backend
- **Node.js** mit **Express** (REST API)
- **SQLite** (einfach, keine separate DB nötig, ideal für NAS)
- **JWT** für Authentifizierung
- **node-cron** für automatische Auszahlungen und wiederkehrende Jobs
- **PDFKit** für Etikettendruck
- **Tesseract.js** für Quittungs-OCR (lokal)
- **node-telegram-bot-api** für Telegram-Benachrichtigungen (optional)

### Frontend
- **React** (mit Vite)
- **PWA** (Progressive Web App) – installierbar auf Smartphones, Offline-Fähigkeit
- **ZXing / QuaggaJS** für browser-basiertes Barcode-/QR-Scannen
- Responsive Design (Mobile First)
- Kindgerechtes Design: grosse Schaltflächen, Farben, Illustrationen, Fortschrittsbalken, Animationen

### Deployment
- **Docker Compose** (Backend + Frontend in einem Stack)
- **Nginx** als Reverse Proxy und Static File Server
- Volume-Mounts für SQLite-Datenbank, Uploads und Backups
- Synology NAS: Installation über Container Manager oder Portainer
- HTTPS über Synology Reverse Proxy (empfohlen) oder Traefik

---

## Datenbankschema (vereinfacht)

```
users              – id, name, role (parent/child), photo, pin_required, pin_hash, password_hash
accounts           – id, user_id, balance, savings_balance
transactions       – id, user_id, amount, type, description, receipt_photo, created_at
savings_goals      – id, user_id, name, target_amount, image, created_at
allowance_cfg      – id, user_id, amount, interval, next_payout_at, interest_rate

points             – id, user_id, points_balance, streak_weeks
point_events       – id, user_id, delta, description, mini_job_id, created_at
mini_jobs          – id, name, points, recurrence, active
rewards            – id, name, points_required, image, active
reward_claims      – id, user_id, reward_id, status (pending/approved), claimed_at, approved_at
badges             – id, key, name, description, image
user_badges        – id, user_id, badge_id, earned_at

flea_market_days   – id, date, name
flea_items         – id, day_id, user_id, name, description, barcode, photo, suggested_price, sold_price, status, condition
flea_item_owners   – id, flea_item_id, user_id, share_percent  (für gemeinsame Artikel)

notifications_cfg  – id, user_id, telegram_chat_id, signal_number, events_json
backups            – id, filename, created_at, size_bytes
```

---

## UX / Design-Richtlinien

### Allgemein
- Klare, übersichtliche Navigation
- Mobile First (Eltern nutzen Handy für schnelle Aktionen)
- Helles, freundliches Farbschema mit familiengerechten Illustrationen

### Kinder-Dashboard
- Profilbild gross, Name, Begrüssung (Tageszeit-abhängig)
- 3 Hauptkacheln: 💰 Guthaben | ⭐ Punkte | 🏷️ Flohmarkt
- Fortschrittsbereich: Sparziele + Belohnungen als Karten mit Balken
  - Grün = erreichbar / erreicht
  - Gelb = fast da (>75 %)
  - Grau = noch weit entfernt
- Badges und Streak sichtbar
- Einfache, lesbare Schrift (min. 16 px), keine Fachbegriffe

### Eltern-Dashboard
- Schnellzugriff: „Punkte vergeben", „Taschengeld auszahlen", „Artikel scannen"
- Übersicht aller Kinder auf einen Blick
- Offene Belohnungsanfragen prominent anzeigen
- Navigation zu allen Modulen

---

## Offline-Fähigkeit (PWA)

- Service Worker cacht die App-Shell → App startet auch ohne Internet
- Flohmarktartikel können offline erfasst werden (IndexedDB als lokaler Puffer)
- Beim nächsten Verbindungsaufbau automatischer Sync mit dem Server
- Besonders nützlich beim Flohmarkt (Schulhaus-WLAN etc. unzuverlässig)

---

## Installations- und Betriebsanleitung

### Voraussetzungen

- Synology NAS mit DSM 7.x
- Container Manager (oder Portainer) installiert
- Git auf dem NAS oder lokalem PC verfügbar
- Internetzugang für den initialen Pull

---

### A) Erstinstallation auf der Synology NAS

#### 1. Repository klonen

Entweder direkt auf der NAS (via SSH) oder auf einem PC mit anschliessendem Kopieren:

```bash
# Via SSH auf der NAS
ssh admin@<NAS-IP>
mkdir -p /volume1/docker/familyfinance
cd /volume1/docker/familyfinance
git clone https://github.com/htckusi-ops/FamilyFinance.git .
```

#### 2. Konfiguration anpassen

```bash
cp .env.example .env
nano .env
```

Relevante Einstellungen in `.env`:
```
# Pflicht
ADMIN_USERNAME=eltern
ADMIN_PASSWORD=sicheres-passwort
JWT_SECRET=zufaelliger-langer-string
TZ=Europe/Zurich

# Optional: Telegram-Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Optional: Backup
BACKUP_PATH=/backups
```

#### 3. Container starten

```bash
docker compose up -d
```

#### 4. App aufrufen

```
http://<NAS-IP>:3000
```

Beim ersten Aufruf: Ersteinrichtung (Familie anlegen, Kinder hinzufügen).

#### 5. HTTPS einrichten (empfohlen)

Im Synology Reverse Proxy (Systemsteuerung → Anmeldeportal → Erweitert):
- Quell-Hostname: `familyfinance.deine-domain.ch` (oder lokaler DNS)
- Protokoll: HTTPS, Port 443
- Ziel: HTTP, `localhost`, Port 3000
- Let's Encrypt Zertifikat aktivieren

---

### B) Betrieb

#### Container-Status prüfen

```bash
docker compose ps
docker compose logs -f
```

#### App neu starten

```bash
docker compose restart
```

#### Datenbank-Backup manuell auslösen

Über die Web-Oberfläche: Einstellungen → Backup → „Jetzt sichern"

Oder via Shell:
```bash
docker compose exec backend node scripts/backup.js
```

#### Logs einsehen

```bash
docker compose logs backend --tail=100
docker compose logs nginx --tail=50
```

---

### C) Updates (Produktionsbetrieb)

```bash
cd /volume1/docker/familyfinance

# 1. Neue Version holen
git pull origin main

# 2. Neue Images bauen und Container neu starten
docker compose build --no-cache
docker compose up -d

# 3. Prüfen ob alles läuft
docker compose ps
```

> **Hinweis:** Die SQLite-Datenbank und Uploads liegen in Docker-Volumes und werden beim Update nicht überschrieben. Dennoch empfiehlt sich ein Backup vor jedem Update.

---

### D) Entwicklungsumgebung (lokal)

#### Voraussetzungen
- Node.js 20+
- Git
- (Optional) Docker Desktop

#### Setup

```bash
git clone https://github.com/htckusi-ops/FamilyFinance.git
cd FamilyFinance

# Backend
cd backend
cp .env.example .env
npm install
npm run dev       # Startet auf Port 3001 mit Hot-Reload

# Frontend (neues Terminal)
cd ../frontend
npm install
npm run dev       # Startet auf Port 5173 mit Hot-Reload
```

#### Mit Docker lokal entwickeln

```bash
docker compose -f docker-compose.dev.yml up
```

- Backend: Hot-Reload via nodemon, Source-Code per Volume gemountet
- Frontend: Vite Dev Server mit HMR
- SQLite-Datenbank in `./data/dev.db`

#### Branching-Strategie

```
main                → Produktionsstand (stabil, getestet)
develop             → Integrations-Branch
feature/<name>      → Neue Features
fix/<name>          → Bugfixes
claude/<name>       → Automatisierte Claude-Branches
```

Pull Requests werden von Feature-Branches nach `develop` gestellt, nach Tests nach `main` gemergt.

#### Datenbankmigrationen

```bash
# Neue Migration erstellen
npm run migrate:create -- add_savings_goals

# Alle ausstehenden Migrationen ausführen
npm run migrate:up

# Letzte Migration rückgängig machen
npm run migrate:down
```

---

### E) Updates während der Entwicklungsphase (NAS)

Während aktiver Entwicklung kann die NAS-Instanz jeweils auf den neuesten Stand gebracht werden:

```bash
ssh admin@<NAS-IP>
cd /volume1/docker/familyfinance

git pull origin develop          # oder den aktuellen Feature-Branch
docker compose build backend frontend
docker compose up -d
```

Oder per Makefile-Shortcut (wird im Projekt bereitgestellt):
```bash
make update-dev
```

---

### F) Deinstallation / Reset

```bash
# Container und Netzwerk entfernen (Daten bleiben erhalten)
docker compose down

# Komplett entfernen inkl. Volumes (ACHTUNG: alle Daten werden gelöscht)
docker compose down -v
rm -rf /volume1/docker/familyfinance
```

---

## Projektstruktur (geplant)

```
FamilyFinance/
├── backend/
│   ├── src/
│   │   ├── routes/          – API-Endpunkte
│   │   ├── models/          – Datenbankmodelle
│   │   ├── services/        – Geschäftslogik
│   │   ├── jobs/            – Cron-Jobs
│   │   └── middleware/      – Auth, Fehlerbehandlung
│   ├── migrations/          – DB-Migrationen
│   ├── scripts/             – Backup, Seed-Daten
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           – Seiten (Dashboard, Flohmarkt, ...)
│   │   ├── components/      – Wiederverwendbare UI-Komponenten
│   │   ├── hooks/           – Custom React Hooks
│   │   └── api/             – API-Client
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── data/                    – SQLite DB + Uploads (gitignored)
├── backups/                 – Automatische Backups (gitignored)
├── docker-compose.yml       – Produktion
├── docker-compose.dev.yml   – Entwicklung
├── Makefile                 – Shortcuts
├── .env.example
└── KONZEPT.md
```

---

## Offene Punkte / zukünftige Erweiterungen

- Push-Benachrichtigungen via Web Push API (nativ im Browser)
- Export der Flohmarkt-Daten als CSV / Excel
- Mehrsprachigkeit (DE / FR / EN)
- Statistiken / Jahresauswertung mit Diagrammen
- Wunschliste für Kinder (Kind trägt Wunsch ein, Eltern genehmigen / weisen Punkte zu)
