.PHONY: up down logs update update-dev build shell-backend init pull

BRANCH := $(shell git rev-parse --abbrev-ref HEAD)

init:
	mkdir -p data backups uploads
	@echo "Verzeichnisse erstellt. Weiter mit: make up"

pull:
	@echo "Synchronisiere mit Remote (verwirft lokale Änderungen)..."
	git fetch origin $(BRANCH)
	git reset --hard origin/$(BRANCH)
	@echo "Branch '$(BRANCH)' ist jetzt aktuell."

up: init
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build --no-cache

update: pull init
	docker compose build backend frontend
	docker compose up -d
	docker compose ps

update-dev: pull
	docker compose -f docker-compose.dev.yml build
	docker compose -f docker-compose.dev.yml up -d

dev:
	docker compose -f docker-compose.dev.yml up

shell-backend:
	docker compose exec backend sh

backup:
	docker compose exec backend node scripts/backup.js

reset-dev:
	docker compose -f docker-compose.dev.yml down -v
	rm -f data/dev.db
