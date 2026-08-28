#!/bin/bash
# FamilyFinance – NAS Update Script
# Wird vom Synology Aufgabenplaner ausgeführt (ohne SSH)
# Pfad auf der NAS: /volume1/docker/familyfinance/scripts/nas-update.sh

set -e

PROJECT_DIR="/volume1/docker/familyfinance"
BRANCH="main"
LOG_FILE="/volume1/docker/familyfinance/logs/update.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$(dirname "$LOG_FILE")"

echo "============================================" | tee -a "$LOG_FILE"
echo "[$DATE] Update gestartet" | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"

cd "$PROJECT_DIR"

# 1. Aktuelle Version merken
BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo "unbekannt")
echo "[INFO] Aktuelle Version: $BEFORE" | tee -a "$LOG_FILE"

# 2. Von GitHub pullen
echo "[INFO] Lade Updates von GitHub ($BRANCH)..." | tee -a "$LOG_FILE"
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG_FILE"

AFTER=$(git rev-parse --short HEAD)
echo "[INFO] Neue Version: $AFTER" | tee -a "$LOG_FILE"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "[INFO] Keine Änderungen – Container werden nur neu gestartet" | tee -a "$LOG_FILE"
  docker compose restart 2>&1 | tee -a "$LOG_FILE"
else
  echo "[INFO] Änderungen gefunden – Images werden neu gebaut..." | tee -a "$LOG_FILE"
  docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE"
  docker compose up -d 2>&1 | tee -a "$LOG_FILE"
fi

echo "[OK] Update abgeschlossen: $BEFORE → $AFTER" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
