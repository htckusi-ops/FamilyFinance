# FamilyFinance

Familienfreundliche Web-App für Taschengeld, Punkte, Flohmarkt und Badezimmer-Planung – läuft als Docker-Stack auf einer Synology NAS oder jedem anderen Linux-Server.

---

## Features

| Modul | Beschreibung |
|---|---|
| 💰 **Taschengeld** | Guthaben pro Kind, automatische Auszahlung (wöchentlich/monatlich), Zinssimulation auf Sparkonto, Sparziele mit Fortschrittsbalken |
| 🧾 **Ausgaben** | Eltern buchen Ausgaben mit Beschreibung und optionalem Foto; Belege können per OCR (Tesseract) ausgelesen werden |
| ⭐ **Punkte & Aufgaben** | Mini-Aufgaben (Haushaltspflichten + Extra-Aufgaben), Wochen-Serie-Anzeige, spontane Punktevergabe und -abzug, Punkte ↔ CHF Umtausch |
| 🎁 **Wünsche** | Kinder beantragen Wünsche, Eltern genehmigen; Punkte-Zeitachse auf Kinderdashboard; Wünsche können für einzelne oder mehrere Kinder gelten (gemeinsame Wünsche: alle müssen Punkte erreichen) |
| 💹 **Finanzübersicht** | Monatliche und jährliche Kosten für Eltern: Taschengeld, Belohnungen, Zinsen; 12-Monats-Verlauf als Diagramm |
| 🏷️ **Flohmarkt** | Artikel erfassen (Barcode-Scan mit automatischer Produktsuche), Etikettendruck (PDF mit Fotos), Kassierfunktion (QR-Scan), Tausch-Option, Rückgängig, Tages-Abschluss mit Erlös je Kind |
| 🛁 **Badeplan** | Gerechtes Abwechseln bei der Badezimmer-Wahl, konfigurierbarer Teilnehmerkreis, Verlauf und Rückgängig |
| 🔔 **Benachrichtigungen** | Telegram, Signal (signal-cli) und Threema (Gateway) – optional, pro Elternteil konfigurierbar |
| ⚙️ **Einstellungen** | Familien-Einstellungen, Altersgruppen, API-Tokens (Home Assistant), Backup, pädagogische Optionen (Serie, Abzeichen) |

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
| Backend | Node.js 20 · Express · better-sqlite3 · node-cron · PDFKit · jimp |
| Frontend | React 18 · Vite · @zxing/browser (Barcode) · recharts |
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
│   │   ├── services/        # Abzeichen, PDF, Benachrichtigungen
│   │   ├── middleware/       # auth.js, upload.js (jimp-Bildverkleinerung)
│   │   └── db.js            # SQLite-Setup + automatische Migrationen
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Flohmarkt, Punkte, Finanzübersicht …
│   │   ├── components/      # Modal, Avatar, BarcodeScanner, PointsTimeline …
│   │   ├── context/         # AuthContext, ToastContext, ConfirmContext
│   │   ├── hooks/           # useScanner
│   │   └── api/             # axios-Client
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── nas-update.sh
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

Die wichtigsten Einstellungen befinden sich in `docker-compose.yml`:

```yaml
environment:
  - TZ=Europe/Zurich            # Zeitzone
  - JWT_SECRET=HIER-AENDERN     # Langen zufälligen String verwenden!
  - TELEGRAM_BOT_TOKEN=         # Optional: Telegram-Benachrichtigungen
  # Signal (signal-cli-rest-api Docker-Container erforderlich):
  - SIGNAL_CLI_API_URL=         # z.B. http://signal-cli:8080
  - SIGNAL_SENDER=              # Registrierte Telefonnummer, z.B. +41791234567
  # Threema Gateway (kostenpflichtig, gateway.threema.ch):
  - THREEMA_FROM_ID=            # Eigene Threema-Gateway-ID (8 Zeichen)
  - THREEMA_API_SECRET=         # API-Secret aus dem Gateway-Portal
```

> **Sicherheit:** `JWT_SECRET` **muss** vor dem ersten Start auf einen eigenen Wert gesetzt werden.

---

## HTTPS (empfohlen)

Für Barcode-Scanner und Kamerazugriff auf Smartphones ist HTTPS **dringend empfohlen**. Ohne HTTPS steht der Kamerazugriff im Browser nicht zur Verfügung; der Barcode-Scanner fällt automatisch auf Foto-Upload zurück.

Synology Reverse Proxy: Systemsteuerung → Anmeldeportal → Erweitert → Reverse-Proxy  
→ HTTPS:443 auf HTTP:localhost:3000 weiterleiten + Let's Encrypt Zertifikat

---

## Benachrichtigungen einrichten

### Telegram
1. Bot über @BotFather erstellen → Token notieren
2. Token als `TELEGRAM_BOT_TOKEN` in `docker-compose.yml` eintragen
3. Chat-ID über @userinfobot ermitteln
4. In der App (Einstellungen → Benachrichtigungen) Chat-ID pro Elternteil eintragen

### Signal
Erfordert einen laufenden [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api)-Container:
1. Container starten und eine Telefonnummer registrieren
2. `SIGNAL_CLI_API_URL` und `SIGNAL_SENDER` in `docker-compose.yml` setzen
3. In der App Empfänger-Nummer (z.B. `+41791234567`) pro Elternteil eintragen

### Threema
Erfordert ein [Threema Gateway](https://gateway.threema.ch)-Konto (kostenpflichtig, ~0.10 CHF/Nachricht):
1. Gateway-ID und API-Secret aus dem Portal holen
2. `THREEMA_FROM_ID` und `THREEMA_API_SECRET` in `docker-compose.yml` setzen
3. In der App die eigene Threema-ID (8 Zeichen) pro Elternteil eintragen

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
| [docs/PAEDAGOGIK.md](docs/PAEDAGOGIK.md) | Pädagogische Analyse, Forschungsstand, Empfehlungen mit Quellen |

---

## Lizenz

Siehe [LICENSE](LICENSE).
