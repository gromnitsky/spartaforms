public := public_html
db := db
export SECRET := 12345

cmd := `pwd`/server.js --no-expiration --max-edits ♾️ $(public) $(db)
server: kill; $(cmd) &
kill:; -pkill -ef "$(cmd)"
