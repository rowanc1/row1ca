PORT=8080
ADMIN_PORT=8008

.PHONY: build symlinks articles

symlinks:
	cd website/lib && python _symlinks.py

build: symlinks

run:
	python /usr/local/bin/dev_appserver.py --host=0.0.0.0 --port=$(PORT) --admin_port=$(ADMIN_PORT) website
