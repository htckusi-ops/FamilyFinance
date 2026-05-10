.PHONY: up down logs update update-dev build shell-backend init pull backup-db

BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
DB      := data/familyfinance.db

init:
	mkdir -p data backups uploads
	@echo "Verzeichnisse erstellt."

backup-db:
	@if [ -f $(DB) ]; then \
	  cp $(DB) $(DB).bak && echo "DB-Backup: $(DB).bak"; \
	else \
	  echo "Keine DB gefunden, kein Backup nötig."; \
	fi

pull:
	@echo "Synchronisiere mit Remote (Branch: $(BRANCH))..."
	@# Berechtigungen korrigieren damit git schreiben kann
	chown -R $(shell id -un):$(shell id -gn) data/ backups/ uploads/ 2>/dev/null || true
	git fetch origin $(BRANCH)
	git checkout $(BRANCH) 2>/dev/null || true
	git reset --hard origin/$(BRANCH)
	@echo "✓ Branch '$(BRANCH)' ist aktuell."

up: init
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build --no-cache

update: backup-db pull init
	docker compose build backend frontend
	docker compose up -d
	docker compose ps
	@echo ""
	@echo "✓ Update abgeschlossen. Rollback: cp $(DB).bak $(DB)"

update-dev: pull
	docker compose -f docker-compose.dev.yml build
	docker compose -f docker-compose.dev.yml up -d

dev:
	docker compose -f docker-compose.dev.yml up

shell-backend:
	docker compose exec backend sh

recover-admin:
	docker exec familyfinance-backend node -e "\
	const db=require('./src/db'),bcrypt=require('bcryptjs');\
	const e=db.prepare(\"SELECT id,name FROM users WHERE role='parent'\").get();\
	if(!e){const h=bcrypt.hashSync('admin',10);const u=db.prepare(\"INSERT INTO users(name,role,password_hash)VALUES('Admin','parent',?)\").run(h);db.prepare('INSERT INTO accounts(user_id)VALUES(?)').run(u.lastInsertRowid);db.prepare('INSERT INTO points(user_id)VALUES(?)').run(u.lastInsertRowid);db.prepare('INSERT INTO allowance_config(user_id)VALUES(?)').run(u.lastInsertRowid);console.log('Admin erstellt: Admin/admin');}\
	else{db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync('admin',10),e.id);console.log('Passwort reset:',e.name+'/admin');}"

reset-dev:
	docker compose -f docker-compose.dev.yml down -v
	rm -f data/dev.db
