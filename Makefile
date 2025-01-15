cmd := node `pwd`/server.js student.schema.json
server: kill; $(cmd) &
kill:; -pkill -f "$(cmd)"
