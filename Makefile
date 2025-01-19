public := public_html
db := db
html := $(shell find $(public) -type f | grep .html$$)
schema := $(patsubst $(public)/%.html, $(db)/%.schema.json, $(html))

cmd := node `pwd`/server.js public_html db
server: kill $(schema); $(cmd) &
kill:; -pkill -f "$(cmd)"

# dependency will usually have mtime set in the future, hence 'touch' call;
# consult README if you're appalled
$(db)/%.schema.json: $(public)/%.html
	@mkdir -p $(dir $@)
	./mkschema.js $< form > $@
	@touch -r $< $@

.DELETE_ON_ERROR:
