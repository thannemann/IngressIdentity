MDs = build/README.md build/LICENSE.md build/NOTICE.md
JSs = build/js/content.js build/js/options.js build/js/background.js build/js/help.js
CSSs = build/css/content.css build/css/options.css build/css/help.css
HTMLs = build/options.html build/background.html build/help.html

default: all

all: init $(HTMLs) $(JSs) $(CSSs) $(MDs) build/img build/vendor build/manifest.json
	@find build -iname '.*' -print0 | xargs -0 rm

dist: all
	@bin/dist

clean:
	rm -rf build

init:
	@mkdir -p build build/js build/css

build/vendor: vendor
	rm -rf $@
	cp -a $< $@
	rm -rf $@/{css/bootstrap{-theme*,.css*},js/bootstrap.js}

build/img: img
	rm -rf $@
	cp -a $< $@
	rm $@/*/README.md $@/logo/ingress.svg

build/manifest.json: manifest.json.dist
	cp $< $@

build/%.md: %.md
	cp $< $@

build/%.html: %.html
	grep -Ev '<script type="text\/javascript" src="js\/(class|log|communication|data|spreadsheets)\.js">' $< > $@

build/css/%.css: css/%.css
	cleancss -o $@ $<

build/js/help.js: js/help.js
	@bin/minify help help

build/js/content.js: js/content.js js/communication.js js/log.js
	@bin/minify content communication log content

build/js/options.js: js/options.js js/communication.js js/log.js
	@bin/minify options communication log options

build/js/background.js: js/_header.js js/log.js js/data/spreadsheets.js js/data/interpreter.js js/data/data.js js/background.js js/class.js
	@bin/minify background class log spreadsheets data background
