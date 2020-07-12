all: lint server

server:
	google-chrome http://0.0.0.0:8000/
	cd content; python3 -m http.server 


lint:
	find content -name "*.json" -print -exec jsonlint -q '{}' ';'

lint-setup:
	npm install -g jsonlint



