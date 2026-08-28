# FamilyFinance – Installation auf Synology NAS (ohne SSH, nur GUI)

Diese Anleitung zeigt die vollständige Installation über die Synology-Weboberfläche.  
Kein SSH, kein Terminal notwendig.

---

## Voraussetzungen

| Anforderung | Wo prüfen |
|---|---|
| DSM 7.2 oder neuer | Systemsteuerung → Info-Center |
| **Container Manager** installiert | Paket-Zentrum |
| **Text Editor** installiert | Paket-Zentrum (für Konfiguration) |
| Mindestens 2 GB freier RAM | Systemsteuerung → Info-Center |
| Mindestens 5 GB freier Speicher | Speicher-Manager |

---

## Schritt 1 – Pakete installieren

1. **Paket-Zentrum** öffnen
2. Suche nach **Container Manager** → Installieren
3. Suche nach **Text Editor** → Installieren  
   *(Alternative: jeder Editor auf dem NAS, z.B. Synology Office)*

---

## Schritt 2 – Projektordner erstellen

1. **File Station** öffnen
2. Navigiere zu `docker/` (oder erstelle den Ordner falls nicht vorhanden)
3. Neuen Ordner erstellen: `docker` → `familyfinance`
4. Pfad ist jetzt: `/volume1/docker/familyfinance`

---

## Schritt 3 – Dateien herunterladen

### Option A: ZIP von GitHub herunterladen (einfachste Methode)

1. Öffne auf einem PC/Handy:  
   `https://github.com/htckusi-ops/FamilyFinance/archive/refs/heads/main.zip`
2. ZIP herunterladen
3. In **File Station** → `docker/familyfinance` navigieren
4. Oben auf **Hochladen** klicken → ZIP-Datei auswählen
5. Rechtsklick auf die ZIP → **Extrahieren** → „In aktuellen Ordner extrahieren"
6. Den Inhalt des entpackten Unterordners (`FamilyFinance-main/`) in `familyfinance/` verschieben  
   *(Rechtsklick → Ausschneiden, dann in `familyfinance/` einfügen)*

Der Ordner `familyfinance/` sollte jetzt diese Dateien enthalten:
```
familyfinance/
├── docker-compose.yml
├── backend/
├── frontend/
├── nginx/
└── ...
```

### Option B: Git Package (falls installiert)

Falls das **Git Server**-Paket oder **Gitea** auf der NAS läuft:
1. Container Manager → Projekt → Erstellen → Aus Git-URL klonen
2. URL: `https://github.com/htckusi-ops/FamilyFinance.git`

---

## Schritt 4 – Konfiguration anpassen

1. **File Station** → `docker/familyfinance/`
2. Rechtsklick auf `docker-compose.yml` → **Mit Text Editor öffnen**
3. Folgende Werte anpassen:

```yaml
environment:
  - TZ=Europe/Zurich              # Zeitzone anpassen (z.B. Europe/Berlin)
  - JWT_SECRET=HIER-AENDERN       # Langen zufälligen String eingeben (min. 32 Zeichen)
```

> **Tipp JWT_SECRET:** Einfach 3-4 zufällige Wörter aneinanderreihen, z.B.  
> `MeinKatzeHeisst-Mimi-2024-FamilyFinance-Secret`

4. **Speichern** (Ctrl+S oder Datei → Speichern)

---

## Schritt 5 – Projekt in Container Manager erstellen

1. **Container Manager** öffnen
2. Links auf **Projekt** klicken
3. Oben rechts auf **Erstellen** klicken

### Im Erstellungs-Dialog:

**Schritt 1 – Grundeinstellungen:**
- Projektname: `familyfinance`
- Pfad: `/volume1/docker/familyfinance` auswählen *(oder deinen Pfad)*
- Quelle: **docker-compose.yml im Projektpfad verwenden** auswählen

**Schritt 2 – Webportal (optional):**
- Kann übersprungen werden → **Weiter**

**Schritt 3 – Zusammenfassung:**
- Häkchen bei **Projekt nach Erstellen starten** setzen
- **Fertig** klicken

> Container Manager baut jetzt automatisch die Images (Backend + Frontend).  
> Das dauert beim ersten Mal **5–10 Minuten** (Abhängigkeiten werden heruntergeladen).  
> Der Fortschritt ist im Log sichtbar.

---

## Schritt 6 – App aufrufen

Sobald alle 3 Container grün (✅ Läuft) angezeigt werden:

```
http://<IP-deiner-NAS>:3000
```

Die IP findest du unter: Systemsteuerung → Netzwerk → Netzwerk-Schnittstelle

**Erstanmeldung:**
- Benutzername: `Admin`
- Passwort: `admin`
- ⚠️ Passwort sofort in Einstellungen ändern!

---

## Schritt 7 – HTTPS einrichten (empfohlen)

Damit die App sicher über das Internet erreichbar ist:

1. **Systemsteuerung** → **Anmeldeportal** → Reiter **Erweitert**
2. **Reverse-Proxy** → **Erstellen**
3. Einstellungen:
   - Beschreibung: `FamilyFinance`
   - Protokoll Quelle: `HTTPS`
   - Hostname Quelle: `familyfinance.deine-domain.ch` *(dein DDNS oder Domain)*
   - Port Quelle: `443`
   - Protokoll Ziel: `HTTP`
   - Hostname Ziel: `localhost`
   - Port Ziel: `3000`
4. Speichern
5. Unter **Zertifikat** → Let's Encrypt Zertifikat für die Domain ausstellen

---

## Updates einspielen

### Methode 1: Über Container Manager GUI (empfohlen)

1. Neues ZIP von GitHub herunterladen (wie Schritt 3)
2. Dateien in File Station in den `familyfinance/`-Ordner hochladen + ersetzen
   > ⚠️ **Nicht löschen:** `data/`, `uploads/`, `backups/` – das sind deine Daten!
3. Container Manager → **Projekt** → `familyfinance` auswählen
4. Oben auf **Aktion** → **Erstellen** klicken  
   *(baut neue Images und startet die Container neu)*

### Methode 2: Container neu starten

Für kleine Änderungen genügt:
- Container Manager → Projekt → `familyfinance` → **Neustart**

---

## Container verwalten

Im Container Manager unter **Projekt → familyfinance**:

| Aktion | Beschreibung |
|---|---|
| **Starten** | Alle Container starten |
| **Stoppen** | Alle Container anhalten |
| **Neustart** | Alle Container neu starten |
| **Erstellen** | Images neu bauen (nach Update) |
| **Logs** | Log-Ausgaben der Container anzeigen |

Einzelne Container siehst du unter **Container Manager → Container**:
- `familyfinance-backend`
- `familyfinance-frontend`  
- `familyfinance-nginx`

---

## Häufige Probleme

### Port 3000 ist bereits belegt
→ In `docker-compose.yml` den Port ändern, z.B. `"3100:80"`

### Container startet nicht / bleibt bei „Wird erstellt"
→ Container Manager → Projekt → familyfinance → **Logs** anklicken und Fehlermeldung lesen

### App nicht erreichbar nach Neustart der NAS
→ Container Manager → Projekt → `familyfinance` → prüfen ob Status **Läuft**  
→ Falls nicht: **Starten** klicken  
→ Dauerhaft: Stelle sicher dass Container Manager beim NAS-Start automatisch läuft

### Daten nach Update weg
→ Passiert nicht, solange `data/`, `uploads/` und `backups/` nicht gelöscht wurden

---

## Ordnerstruktur auf der NAS

```
/volume1/docker/familyfinance/
├── docker-compose.yml        ← Konfiguration
├── backend/                  ← Backend-Code
├── frontend/                 ← Frontend-Code
├── nginx/                    ← Nginx-Konfiguration
├── data/                     ← SQLite-Datenbank (NICHT löschen!)
├── uploads/                  ← Fotos und Uploads (NICHT löschen!)
└── backups/                  ← Automatische Backups (NICHT löschen!)
```
