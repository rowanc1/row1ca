PORT=8080
ADMIN_PORT=8008
VERSION=6
PROJECT=rowanc1

.PHONY: build build-ink deploy symlinks articles

symlinks:
	cd website/lib && python _symlinks.py

build: symlinks

build-ink:
	cd ../ink;npm run build;cp dist/app.bundle.js ../row1ca/website/static/js/ink.js

deploy:
	gcloud app deploy --version $(VERSION) --project $(PROJECT)

run:
	python /usr/local/bin/dev_appserver.py --host=0.0.0.0 --port=$(PORT) --admin_port=$(ADMIN_PORT) website
