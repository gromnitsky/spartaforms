public := public_html
db := db
export SECRET := 12345

cmd := `pwd`/server.js --no-expiration --max-edits ♾️ $(public) $(db)
server: kill; $(cmd) &
kill:; -pkill -ef "$(cmd)"

public_html/widgets.js:
	echo "$$widgets" > $@.tmp.js
	esbuild --bundle --sourcemap=inline --charset=utf8 $@.tmp.js --outfile=$@
	rm $@.tmp.js

export define widgets :=
import CheckboxesGroup from '../../web-components/my-checkboxes/my-checkboxes.js'
import VSlider from '../../web-components/v-slider/v-slider.js'
customElements.define('checkboxes-group', CheckboxesGroup)
customElements.define('v-slider', VSlider)
endef
