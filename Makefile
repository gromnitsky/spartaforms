public := public_html
db := db
html := $(shell find $(public)/*/ -type f | grep /index.html$$)
schema := $(patsubst $(public)/%.html, $(db)/%.schema.json, $(html))
export SECRET := 12345

cmd := `pwd`/server.js --no-expiration --max-edits ♾️ $(public) $(db)
server: kill $(schema); $(cmd) &
kill:; -pkill -ef "$(cmd)"

# dependency will usually have mtime set in the future, hence 'touch' call;
# consult README if you're appalled
$(db)/%.schema.json: $(public)/%.html
	@mkdir -p $(dir $@)
	./mkschema.js $< form > $@
	@touch -r $< $@

.DELETE_ON_ERROR:
