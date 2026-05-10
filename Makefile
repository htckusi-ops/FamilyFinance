.PHONY: up down logs update update-dev build shell-backend init

init:
	mkdir -p data backups uploads
	@echo "Verzeichnisse erstellt. Weiter mit: make up"

up: init
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build --no-cache

update:
	git pull origin main
	docker compose build --no-cache
	docker compose up -d
	docker compose ps

update-dev:
	git pull
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
