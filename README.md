# FamilyFinance

Familienfreundliche Web-App für Taschengeld, Punkte, Flohmarkt und Badezimmer-Planung – läuft als Docker-Stack auf einer Synology NAS oder jedem anderen Linux-Server.

---

## Features

| Modul | Beschreibung |
|---|---|
| 💰 **Taschengeld** | Guthaben pro Kind, automatische Auszahlung (wöchentlich/monatlich), Zinssimulation, Sparziele mit Fortschrittsbalken |
| 🧾 **Ausgaben** | Eltern buchen Ausgaben mit Beschreibung und optionalem Foto (wird client-seitig auf 500 px verkleinert) |
| ⭐ **Punkte & Jobs** | Mini-Jobs (Pflichten + Extra-Jobs), Streak-Anzeige, spontane Punkte-/Abzugsvergabe, Punkte ↔ CHF Umtausch |
| 🎁 **Belohnungen** | Kinder beantragen Belohnungen, Eltern genehmigen; Punkte-Timeline auf Kinderdashboard |
| 🏷️ **Flohmarkt** | Artikel erfassen (Barcode-Scan oder manuell), Etikettendruck (PDF), Kassierfunktion, Tages-Abschluss mit Erlös je Kind |
| 🛁 **Badespass** | Gerechtes Abwechseln bei der Badezimmer-Wahl, konfigurierbare Teilnehmer, Verlauf und Rückgängig-Funktion |
| 🔔 **Benachrichtigungen** | Telegram-Bot (optional): Belohnungsanfragen, automatische Auszahlungen |
| ⚙️ **Einstellungen** | Familien-Einstellungen, Altersgruppen, API-Tokens (Home Assistant), Backup |

---

## Schnellstart

### Voraussetzungen

- Docker + Docker Compose (v2)
- Git

### Installation

```bash
git clone https://github.com/htckusi-ops/FamilyFinance.git
cd FamilyFinance
make up
```

Die App ist danach erreichbar unter: **`http://<Server-IP>:3000`**

**Erstanmeldung:**
- Benutzername: `Admin`
- Passwort: `admin`
- ⚠️ Passwort unter Einstellungen → Benutzer sofort ändern!

---

## Wichtige Befehle

```bash
make up            # Container starten (erstellt data/, uploads/, backups/ automatisch)
make down          # Container stoppen
make logs          # Logs aller Container live verfolgen
make update        # Sicherung der DB + Git-Pull + Rebuild + Neustart
make build         # Images neu bauen (ohne Neustart)
make shell-backend # Shell im Backend-Container
make recover-admin # Admin-Passwort auf 'admin' zurücksetzen
make backup-db     # DB manuell sichern (data/familyfinance.db.bak)
make dev           # Entwicklungsumgebung mit Hot-Reload starten
```

---

## Update einspielen

```bash
make update
```

Das Makefile sichert die Datenbank, holt den aktuellen Stand vom Git-Remote, baut die Images neu und startet die Container. **Bestehende Daten (Datenbank, Uploads, Backups) bleiben erhalten.**

Falls nach dem Update eine `502 Bad Gateway`-Meldung erscheint:

```bash
docker compose restart nginx
```

---

## Admin-Passwort vergessen

```bash
make recover-admin
```

Setzt das Passwort des ersten Elternteils auf `admin` zurück (oder legt einen neuen Admin an, falls keiner existiert).

---

## Architektur

```
Browser
  │
  ▼
nginx:3000  ─── /api/* ───▶  backend (Node.js/Express, Port 3001)
              └── /*    ───▶  frontend (React/Vite, statisch)

backend ──▶ SQLite (data/familyfinance.db)
        ──▶ Uploads (uploads/)
        ──▶ Backups (backups/)
```

### Stack

| Schicht | Technologie |
|---|---|
| Backend | Node.js · Express · better-sqlite3 · node-cron · PDFKit |
| Frontend | React 18 · Vite · @zxing/browser (Barcode) |
| Datenbank | SQLite (WAL-Modus, Foreign Keys aktiv) |
| Auth | JWT (Eltern) + optionaler PIN (Kinder) + API-Tokens |
| Proxy | nginx:alpine |
| Deployment | Docker Compose |

---

## Projektstruktur

```
FamilyFinance/
├── backend/
│   ├── src/
│   │   ├── routes/          # API-Endpunkte
│   │   ├── services/        # Badges, PDF, Telegram
│   │   ├── middleware/       # auth.js, upload.js
│   │   └── db.js            # SQLite-Setup + automatische Migrationen
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Flohmarkt, Punkte, …
│   │   ├── components/      # Modal, Avatar, BarcodeScanner, …
│   │   ├── hooks/           # useScanner
│   │   └── api/             # axios-Client
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── nas-update.sh        # Update-Skript für Synology Task Scheduler
├── data/                    # SQLite-DB (gitignored, Volume-Mount)
├── uploads/                 # Fotos und Uploads (gitignored, Volume-Mount)
├── backups/                 # Backups (gitignored, Volume-Mount)
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
└── docs/
    ├── SYNOLOGY-GUI-INSTALLATION.md
    ├── ENTWICKLUNG-WORKFLOW.md
    └── PAEDAGOGIK.md
```

---

## Konfiguration

Die wichtigsten Einstellungen befinden sich direkt in `docker-compose.yml`:

```yaml
environment:
  - TZ=Europe/Zurich          # Zeitzone
  - JWT_SECRET=HIER-AENDERN   # Langen zufälligen String verwenden!
  - TELEGRAM_BOT_TOKEN=       # Optional: Telegram-Benachrichtigungen
  - TELEGRAM_CHAT_ID=         # Optional: Telegram-Chat-ID
```

> **Sicherheit:** `JWT_SECRET` **muss** vor dem ersten Start auf einen eigenen Wert gesetzt werden.

---

## HTTPS (empfohlen)

Für Barcode-Scanner und Kamerazugriff auf Smartphones ist HTTPS **dringend empfohlen**. Ohne HTTPS steht der Kamerazugriff im Browser nicht zur Verfügung; der Barcode-Scanner fällt automatisch auf Foto-Upload zurück.

Synology Reverse Proxy: Systemsteuerung → Anmeldeportal → Erweitert → Reverse-Proxy  
→ HTTPS:443 auf HTTP:localhost:3000 weiterleiten + Let's Encrypt Zertifikat

---

## Datensicherung

### Manuell (empfohlen vor jedem Update)
```bash
make backup-db
# Erstellt: data/familyfinance.db.bak
```

### Über die Web-Oberfläche
Einstellungen → Backup → „Jetzt sichern" → ZIP-Download (DB + Uploads)

---

## Detaillierte Dokumentation

| Dokument | Inhalt |
|---|---|
| [KONZEPT.md](KONZEPT.md) | Vollständige Funktionsbeschreibung, DB-Schema, UX-Richtlinien |
| [docs/SYNOLOGY-GUI-INSTALLATION.md](docs/SYNOLOGY-GUI-INSTALLATION.md) | Schritt-für-Schritt-Installation ohne SSH |
| [docs/ENTWICKLUNG-WORKFLOW.md](docs/ENTWICKLUNG-WORKFLOW.md) | Lokale Entwicklung, Branching, Migrationen |
| [docs/PAEDAGOGIK.md](docs/PAEDAGOGIK.md) | Pädagogische Analyse der einzelnen Features |

---

## Lizenz

Siehe [LICENSE](LICENSE).
