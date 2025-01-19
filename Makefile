cmd := node `pwd`/server.js student.schema.json
server: student.schema.json kill; $(cmd) &
kill:; -pkill -f "$(cmd)"

student.schema.json: index.html
	./mkschema.js $< form > $@

.DELETE_ON_ERROR:
