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

### 2. Punkte- & Belohnungssystem

#### Mini-Jobs (von Eltern definiert)
- Name des Jobs (z. B. „Geschirrspüler ausräumen")
- Feste Punktzahl
- Elternteil vergibt Punkte per Klick auf dem Handy nach Erledigung

#### Spontane Punktvergabe
- Freie Eingabe: Kind auswählen, Beschreibung, Punktzahl
- Auch negative Punkte möglich (Abzug)

#### Belohnungen (von Eltern definiert)
- Name der Belohnung (z. B. „Indoor-Spielplatz", „Kinobesuch", „1 € Taschengeld extra")
- Benötigte Punktzahl
- Bild/Icon optional
- Kinder sehen Fortschrittsbalken zu jeder Belohnung
- Erreichte Belohnungen werden hervorgehoben

#### Kinder-Dashboard – Punkte-Ansicht
- Aktuelle Punktzahl gut sichtbar
- Belohnungsliste mit Fortschrittsbalken (kindergerecht, bunt)
- Bereits erreichbare Belohnungen: grün / freigeschaltet-Optik
- Noch fehlende Punkte sichtbar

### 3. Flohmarkt-Verwaltung

#### Artikel erfassen
- QR-Code / Strichcode scannen über Smartphone-Kamera (browser-basiert, kein App-Download)
- Manueller Barcodesuche möglich
- Produktinfos automatisch abrufen (OpenFoodFacts / Open Product Data APIs)
- Felder: Name, Beschreibung, Foto (optional), zugewiesenes Kind, Richtpreis
- Kategorien (Spielzeug, Kleidung, Bücher, Sonstiges)

#### Flohmarkt-Tage
- Eltern erstellen einen „Flohmarkttag" mit Datum
- Artikel werden einem Flohmarkttag zugewiesen
- Status pro Artikel: „geplant", „verkauft", „nicht verkauft"

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

---

## Technischer Stack

### Backend
- **Node.js** mit **Express** (REST API)
- **SQLite** (einfach, keine separate DB nötig, ideal für NAS)
- **JWT** für Authentifizierung
- **node-cron** für automatische Taschengeld-Auszahlungen
- **PDFKit** oder **Puppeteer** für Etikettendruck

### Frontend
- **React** (mit Vite)
- **PWA** (Progressive Web App) – installierbar auf Smartphones
- **ZXing / QuaggaJS** für browser-basiertes Barcode-/QR-Scannen
- Responsive Design (Mobile First)
- Kindgerechtes Design: große Schaltflächen, Farben, Illustrationen, Fortschrittsbalken

### Deployment
- **Docker Compose** (Backend + Frontend als separate Container oder kombiniert)
- **Nginx** als Reverse Proxy / Static File Server
- Volume-Mount für SQLite-Datenbank und Uploads (Fotos, PDFs)
- Synology NAS: Installation über Container Manager / Portainer
- HTTPS über Synology's eingebautem Reverse Proxy oder Traefik

---

## Datenbankschema (vereinfacht)

```
users           – id, name, role (parent/child), photo, pin_required, pin_hash, password_hash
accounts        – id, user_id, balance (Taschengeld-Guthaben)
transactions    – id, user_id, amount, type, description, created_at
points          – id, user_id, points_balance
point_events    – id, user_id, delta, description, mini_job_id, created_at
mini_jobs       – id, name, points, active
rewards         – id, name, points_required, image, active
reward_claims   – id, user_id, reward_id, claimed_at, approved_at
allowance_cfg   – id, user_id, amount, interval, next_payout_at

flea_market_days   – id, date, name
flea_items         – id, day_id, user_id, name, description, barcode, photo, suggested_price, sold_price, status
```

---

## UX / Design-Richtlinien

### Allgemein
- Klare, übersichtliche Navigation
- Mobile First (Eltern nutzen Handy für schnelle Aktionen)
- Helles, freundliches Farbschema

### Kinder-Dashboard
- Profilbild gross, Name, Begrüssung
- 3 Kacheln: 💰 Guthaben | ⭐ Punkte | 🏷️ Flohmarkt
- Belohnungsbereich: Karten mit Fortschrittsbalken
  - Grün = erreichbar / erreicht
  - Gelb = fast da (z. B. >75%)
  - Grau = noch weit entfernt
- Einfache, lesbare Schrift (mind. 16px), keine Fachbegriffe

### Eltern-Dashboard
- Schnellzugriff: „Punkte vergeben", „Taschengeld auszahlen", „Artikel scannen"
- Übersicht aller Kinder auf einen Blick
- Navigation zu allen Modulen

---

## Deployment-Anleitung (Ziel)

```
1. Repository klonen oder ZIP herunterladen
2. .env Datei anpassen (Admin-Passwort, Zeitzone)
3. docker-compose up -d
4. Browser öffnen: http://<NAS-IP>:3000
5. Ersteinrichtung: Familie anlegen, Kinder hinzufügen
```

---

## Offene Punkte / Erweiterungen (später)

- Push-Benachrichtigungen (wenn Punkte vergeben werden)
- Export der Flohmarkt-Daten als CSV
- Mehrsprachigkeit (DE/FR/EN)
- Foto-Upload via Smartphone-Kamera für Artikel
- Wunschliste für Kinder (Kinder können eigene Wünsche eintragen, Eltern genehmigen)
- Statistiken / Jahresauswertung
