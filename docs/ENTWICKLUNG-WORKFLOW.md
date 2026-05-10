# FamilyFinance – Entwicklungs-Workflow

Dieses Dokument beschreibt das empfohlene Vorgehen während der aktiven Entwicklungsphase mit häufigen Updates.

---

## Übersicht: Drei Umgebungen

```
Laptop/PC  ──push──▶  GitHub  ──(manuell/auto)──▶  Synology NAS
(Entwicklung)          (Quelle)                      (Betrieb/Test)
```

| Umgebung | Zweck | Wie starten |
|---|---|---|
| **Lokal** | Entwicklung, schnelle Iteration | `make dev` |
| **NAS (Entwicklung)** | Testen auf echter Hardware | Task Scheduler / GUI |
| **NAS (Produktion)** | Stabiler Betrieb, Familie nutzt die App | Manuell nach Review |

---

## A) Lokale Entwicklungsumgebung (empfohlen)

Die schnellste Methode: Code auf dem eigenen PC bearbeiten, Änderungen sind sofort sichtbar.

### Setup (einmalig)

```bash
git clone https://github.com/htckusi-ops/FamilyFinance.git
cd FamilyFinance

# Entwicklung mit Hot-Reload (Backend + Frontend)
make dev
# oder direkt:
docker compose -f docker-compose.dev.yml up
```

- Frontend: `http://localhost:5173` (Vite, Hot Module Replacement)
- Backend: `http://localhost:3001` (nodemon, auto-restart bei Änderungen)

### Täglicher Workflow

```
1. make dev          → startet alles mit Hot-Reload
2. Code bearbeiten   → Änderungen sofort im Browser sichtbar
3. git add / commit  → Änderungen sichern
4. git push          → auf GitHub hochladen
5. NAS aktualisieren → (siehe Abschnitt B oder C)
```

### Ohne Docker lokal (noch schneller)

```bash
# Terminal 1 – Backend
cd backend && npm install && npm run dev

# Terminal 2 – Frontend
cd frontend && npm install && npm run dev
```

---

## B) NAS aktualisieren – Per GUI, ohne SSH

### Einmalig: Task Scheduler einrichten (Synology GUI)

Der **Aufgabenplaner** in DSM erlaubt es, Shell-Skripte per Klick auszuführen – ohne SSH.

#### 1. Update-Skript auf die NAS laden

Lade die Datei `scripts/nas-update.sh` aus dem Repository via File Station auf die NAS:
- Ziel: `/volume1/docker/familyfinance/scripts/nas-update.sh`

#### 2. Aufgabenplaner konfigurieren

1. DSM → **Systemsteuerung** → **Aufgabenplaner**
2. **Erstellen** → **Geplante Aufgabe** → **Benutzerdefiniertes Skript**
3. Einstellungen:
   - Aufgabenname: `FamilyFinance Update`
   - Benutzer: `root`
   - Zeitplan: **Nicht wiederholen** (manuell auslösen)
4. Reiter **Aufgabeneinstellungen**:
   ```bash
   bash /volume1/docker/familyfinance/scripts/nas-update.sh
   ```
5. **OK** → Speichern

#### 3. Update auslösen

Wann immer du die NAS aktualisieren möchtest:
1. **Systemsteuerung** → **Aufgabenplaner**
2. Aufgabe `FamilyFinance Update` auswählen
3. **Ausführen** klicken
4. Fertig – das Skript pullt von GitHub und baut neu

---

## C) NAS aktualisieren – Manuell über Container Manager GUI

Falls kein Task Scheduler genutzt wird:

### Nur Neustart (ohne Code-Änderungen)
Container Manager → Projekt → `familyfinance` → **Neustart**  
*(Dauer: ~10 Sekunden)*

### Nach Code-Änderungen (neue Dateien hochgeladen)
Container Manager → Projekt → `familyfinance` → **Erstellen**  
*(Dauer: 2–5 Minuten)*

### Komplett neu (nach größeren Änderungen)
1. Container Manager → Projekt → `familyfinance` → **Stoppen**
2. Neue Dateien via File Station hochladen (ZIP entpacken, Daten-Ordner nicht überschreiben)
3. Container Manager → Projekt → `familyfinance` → **Erstellen** → **Starten**

---

## D) Empfohlener Workflow bei häufigen Updates

### Während intensiver Entwicklung (täglich mehrere Änderungen)

```
Morgens:
  → make dev auf Laptop starten
  → Feature entwickeln, lokal testen

Zwischendurch:
  → git commit -m "Beschreibung"
  → git push

Abends / zum Testen auf NAS:
  → Task Scheduler "FamilyFinance Update" auslösen
  → Auf NAS testen (http://NAS-IP:3000)
  → Bugs notieren, am nächsten Tag fixen
```

### Wann rebuild vs. nur restart?

| Situation | Aktion |
|---|---|
| Nur Frontend-Texte / CSS geändert | Rebuild (Frontend-Image neu bauen) |
| Backend-Routen / Logik geändert | Rebuild |
| Nur `.env` / Konfiguration geändert | Neustart reicht |
| Datenbankschema geändert (neue Tabelle) | Rebuild + Neustart (Migration läuft automatisch) |
| Abhängigkeiten geändert (`package.json`) | Rebuild (zwingend) |

### Branches sinnvoll nutzen

```
main          → Stabiler Stand, läuft auf der NAS für die Familie
develop       → Aktuelle Entwicklung, wird auf der NAS getestet
feature/xyz   → Einzelne Features, werden nach Fertigstellung in develop gemergt
```

**Für die NAS empfehlen wir den `main`-Branch** – nur getestete Änderungen werden gemergt.

Das Update-Skript zieht standardmässig von `main`. Für den Entwicklungs-Stand kann im Skript auf `develop` gewechselt werden.

---

## E) Datenbank-Migrationen während der Entwicklung

Neue Tabellen oder Spalten werden beim Start automatisch angelegt (`db.js` → `migrate()`).

**Vorgehen bei Schema-Änderungen:**
1. `db.js` anpassen (neue `CREATE TABLE IF NOT EXISTS` oder `ALTER TABLE`)
2. Commit + Push
3. NAS aktualisieren (Rebuild)
4. Backend startet, Migration läuft automatisch

**Achtung bei bestehenden Daten:**  
`ALTER TABLE` muss mit `IF NOT EXISTS` oder durch Prüfung abgesichert werden, da SQLite `IF NOT EXISTS` für Spalten erst ab Version 3.37 unterstützt. Sicherheitshalber:

```javascript
// In db.js migrate():
try {
  db.exec('ALTER TABLE mini_jobs ADD COLUMN job_type TEXT DEFAULT "extra"');
} catch {} // Spalte existiert bereits → ignorieren
```

---

## F) Logs beobachten

### Via Container Manager GUI
Container Manager → Container → `familyfinance-backend` → **Details** → Reiter **Log**

### Nützliche Log-Einträge verstehen

| Log-Zeile | Bedeutung |
|---|---|
| `Backend running on port 3001` | Erfolgreich gestartet |
| `Default admin created` | Erstinstallation, Datenbank leer |
| `Cron jobs registered` | Automatische Auszahlungen aktiv |
| `Auto backup completed` | Nächtliches Backup erfolgreich |
| `SQLite error: no such column` | Schema-Migration fehlt → `db.js` prüfen |

---

## G) Lokale Datenbank zurücksetzen (Entwicklung)

Falls du mit frischen Testdaten neu starten möchtest:

```bash
# Lokal
make reset-dev
# löscht data/dev.db und startet neu

# Oder manuell:
rm data/familyfinance.db
docker compose restart
# → Admin-Account wird neu angelegt
```

**Auf der NAS:** Niemals die Produktions-Datenbank löschen. Nutze stattdessen die Backup-Funktion in den Einstellungen.
