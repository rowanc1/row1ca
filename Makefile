PORT=8081
ADMIN_PORT=8008
VERSION=14
PROJECT=rowanc1
CLOUDSDK_PYTHON=py27

.PHONY: clean build build-ink build-ink-dev deploy

clean:
	rm -rf website/lib

build: clean build-ink
	pip install -t website/lib -r requirements.txt

build-ink:
	cd ../../ink-components/ink-components;npm run build;cp dist/ink.min.js ../../rowanc1/row1ca/website/static/js/ink.js

build-ink-dev:
	cd ../../ink-components/ink-components;npm run build-dev;cp dist/ink.min.js ../../rowanc1/row1ca/website/static/js/ink.js

deploy:
	cd website; gcloud app deploy --version $(VERSION) --project $(PROJECT)

run:
	dev_appserver.py --host=0.0.0.0 --port=$(PORT) --admin_port=$(ADMIN_PORT) website
