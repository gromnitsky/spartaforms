(() => {
  // ../web-components/my-checkboxes/my-checkboxes.js
  var DEBUG = new URL(window.location).searchParams.has("debug");
  var MyCheckboxes = class _MyCheckboxes extends HTMLElement {
    constructor() {
      super();
      let s = this.attachShadow({ mode: "open", delegatesFocus: true });
      s.innerHTML = '<slot id="inputs"></slot>';
      this._internals = this.attachInternals();
      this._change_handler = this.#set_form_state.bind(this);
      this.object_id = ++_MyCheckboxes.#counter;
      this.log = DEBUG ? console.log.bind(console, `<my-checkboxes>🔬${this.object_id}:`) : () => {
      };
    }
    static formAssociated = true;
    static #counter = -1;
    get readonly() {
      return this.hasAttribute("readonly");
    }
    get required() {
      return this.hasAttribute("required");
    }
    get form() {
      return this._internals.form;
    }
    get type() {
      return this.localName;
    }
    checkboxes() {
      return this.shadowRoot.querySelector("#inputs").assignedElements().map((v) => {
        if (v.localName === "input" && v.type === "checkbox") return v;
        return Array.from(v.querySelectorAll("input[type=checkbox]"));
      }).flat().filter((v) => !v.disabled);
    }
    get min() {
      let min = parseInt(this.getAttribute("min"));
      if (isNaN(min) || min < 1) min = 0;
      if (this.required && min < 1) min = 1;
      return min;
    }
    get max() {
      let max = parseInt(this.getAttribute("max"));
      let size = this.checkboxes().length || Infinity;
      if (isNaN(max) || max > size) max = size;
      return max;
    }
    connectedCallback() {
      this.log("connectedCallback");
      let min = this.min;
      if (min > 0 && !this.required)
        throw new EChk("min= attribute is > 0, but 'required' is missing");
      let slot = this.shadowRoot.querySelector("#inputs");
      slot.addEventListener("slotchange", this.#slotchange.bind(this));
      let max = this.max;
      if (min > max) throw new EChk("min > max");
      if (max < min) throw new EChk("max < min");
    }
    disconnectedCallback() {
      this.log("disconnectedCallback");
    }
    #slotchange() {
      this.log("#slotchange");
      this.checkboxes().forEach((v) => {
        v.removeEventListener("change", this._change_handler);
        v.addEventListener("change", this._change_handler);
      });
      this.update_validity({ first_time: true });
    }
    #set_form_state(evt) {
      this.log("set_form_state", evt.target.value);
      this.update_validity();
    }
    update_validity(opt = {}) {
      let checkboxes = this.checkboxes();
      if (!checkboxes.length) return;
      let r = {};
      let validity = this.#check_validity(checkboxes);
      if (validity === -1) r = { rangeUnderflow: true };
      if (validity === 1) r = { rangeOverflow: true };
      let [min, max] = [this.min, this.max];
      let msg = `Select ${this.min} to ${this.max} checkboxes.`;
      if (min === max) msg = `Select ${this.min} checkboxes.`;
      this._internals.setValidity(r, msg, checkboxes[0]);
      if (!opt.first_time) {
        let op = validity === 0 ? "delete" : "add";
        this._internals.states[op]("out-of-range");
      }
    }
    #check_validity(checkboxes) {
      if (this.readonly) return 0;
      let checked = checkboxes.filter((v) => v.checked).length;
      let min = this.min;
      let max = this.max;
      if (checked >= min && checked <= max) return 0;
      return checked < min ? -1 : 1;
    }
    get validity() {
      return this._internals.validity;
    }
    get validationMessage() {
      return this._internals.validationMessage;
    }
    get willValidate() {
      return this._internals.willValidate;
    }
    checkValidity() {
      return this._internals.checkValidity();
    }
    reportValidity() {
      return this._internals.reportValidity();
    }
    formDisabledCallback(state) {
      this.checkboxes().forEach((v) => v.disabled = state);
    }
  };
  var EChk = class extends Error {
    constructor(msg) {
      super();
      this.message = `<my-checkboxes>: ${msg}`;
    }
  };

  // ../web-components/v-slider/v-slider.js
  var VSlider = class extends HTMLElement {
    constructor() {
      super();
      let s = this.attachShadow({ mode: "open" });
      s.innerHTML = `
<style>
  :host {
    --vslider-line-height: 1.5rem;

    --vslider-list-hover-bg: gold;
    --vslider-list-cursor: pointer;
    --vslider-height: 0;
  }
  :host(:state(disabled)) {
    --vslider-list-hover-bg: initial;
    --vslider-list-cursor: auto;
  }

  #container {
    display: flex;
    height: var(--vslider-height);
  }

  #slider { width: 2rem; }
  #slider input {
    transform: rotate(-90deg);
    transform-origin: calc(var(--vslider-height)/2) calc(var(--vslider-height)/2);
    cursor: var(--vslider-list-cursor);
    margin: 0;
    width: var(--vslider-height);
  }

  #ticks {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: var(--vslider-height);
  }
  ::slotted(span) {
    cursor: var(--vslider-list-cursor);
    padding: 0 8px;
  }
  ::slotted(span:hover) { background: var(--vslider-list-hover-bg); }
</style>

<div id="container">
  <div id="slider">
    <input type="range" list="list">
  </div>
  <slot id="ticks"></slot>
</div>
`;
      this._internals = this.attachInternals();
      this._span_click_handle = this.#span_click_handle.bind(this);
      this._value = 0;
      this._list = [0];
    }
    static formAssociated = true;
    get form() {
      return this._internals.form;
    }
    get name() {
      return this.getAttribute("name");
    }
    get type() {
      return this.localName;
    }
    #input() {
      return this.shadowRoot.querySelector("#slider input");
    }
    get value() {
      return this._value;
    }
    set value(V) {
      let min = this._list.at(0);
      let max = this._list.at(-1);
      let v = parseInt(V) || min;
      if (v < min) v = min;
      if (v > max) v = max;
      this._value = v;
      let input = this.#input();
      input.value = this.value;
      this._internals.setFormValue(input.value);
    }
    connectedCallback() {
      let slot = this.shadowRoot.querySelector("#ticks");
      slot.addEventListener("slotchange", this.#slotchange.bind(this));
      this.#input().addEventListener("change", (evt) => {
        this.value = evt.target.value;
      });
    }
    #ticks_values() {
      let r = this.shadowRoot.querySelector("#ticks").assignedElements().map((v) => parseInt(v.dataset.value)).filter((v) => !isNaN(v));
      return r.length ? r.sort() : [0];
    }
    #slotchange() {
      let doc = this.shadowRoot;
      let spans = doc.querySelector("#ticks").assignedElements();
      doc.querySelector("#container datalist")?.remove();
      let datalist = document.createElement("datalist");
      datalist.id = "list";
      spans.forEach((span) => {
        let option = document.createElement("option");
        option.value = span.dataset.value;
        datalist.appendChild(option);
      });
      doc.querySelector("#container").appendChild(datalist);
      spans.forEach((span) => {
        span.removeEventListener("click", this._span_click_handle);
        span.addEventListener("click", this._span_click_handle);
      });
      let input = this.#input();
      this._list = this.#ticks_values();
      input.min = this._list.at(0);
      input.max = this._list.at(-1);
      this.shadowRoot.host.style.setProperty("--vslider-height", `calc(${this._list.length} * var(--vslider-line-height))`);
      this.value = this.getAttribute("value");
    }
    #span_click_handle(evt) {
      let fieldset = this.form.querySelector("fieldset");
      if (fieldset?.disabled) return;
      this.value = evt.currentTarget.dataset.value;
    }
    static observedAttributes = ["value"];
    attributeChangedCallback(_1, _2, new_value) {
      this.value = new_value;
    }
    formDisabledCallback(disabled) {
      let input = this.#input();
      input.disabled = disabled;
      let op = disabled ? "add" : "delete";
      this._internals.states[op]("disabled");
    }
  };

  // public_html/widgets.js.tmp.js
  customElements.define("checkboxes-group", MyCheckboxes);
  customElements.define("v-slider", VSlider);
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vd2ViLWNvbXBvbmVudHMvbXktY2hlY2tib3hlcy9teS1jaGVja2JveGVzLmpzIiwgIi4uLy4uL3dlYi1jb21wb25lbnRzL3Ytc2xpZGVyL3Ytc2xpZGVyLmpzIiwgIndpZGdldHMuanMudG1wLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJsZXQgREVCVUcgPSAobmV3IFVSTCh3aW5kb3cubG9jYXRpb24pKS5zZWFyY2hQYXJhbXMuaGFzKCdkZWJ1ZycpXG5cbi8qIEJVR1M6XG5cbiAgIC0gSWYgdGhlIDFzdCA8aW5wdXQ+IGluIHRoZSBsaWdodCBET00gZ2V0cyBkaXNhYmxlZCBhZnRlclxuICAgICA8bXktY2hlY2tib3hlcz4gcmVuZGVycyBpdHNlbGYsIGZvcm0gdmFsaWRhdGlvbiBmYWlscy5cbiovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNeUNoZWNrYm94ZXMgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKClcbiAgICAgICAgbGV0IHMgPSB0aGlzLmF0dGFjaFNoYWRvdyh7bW9kZTogJ29wZW4nLCBkZWxlZ2F0ZXNGb2N1czogdHJ1ZX0pXG4gICAgICAgIHMuaW5uZXJIVE1MID0gJzxzbG90IGlkPVwiaW5wdXRzXCI+PC9zbG90PidcblxuICAgICAgICB0aGlzLl9pbnRlcm5hbHMgPSB0aGlzLmF0dGFjaEludGVybmFscygpXG4gICAgICAgIHRoaXMuX2NoYW5nZV9oYW5kbGVyID0gdGhpcy4jc2V0X2Zvcm1fc3RhdGUuYmluZCh0aGlzKVxuXG4gICAgICAgIHRoaXMub2JqZWN0X2lkID0gKytNeUNoZWNrYm94ZXMuI2NvdW50ZXJcbiAgICAgICAgdGhpcy5sb2cgPSBERUJVRyA/IGNvbnNvbGUubG9nXG4gICAgICAgICAgICAuYmluZChjb25zb2xlLCBgPG15LWNoZWNrYm94ZXM+8J+UrCR7dGhpcy5vYmplY3RfaWR9OmApIDogKCkgPT4ge31cbiAgICB9XG5cbiAgICBzdGF0aWMgZm9ybUFzc29jaWF0ZWQgPSB0cnVlXG4gICAgc3RhdGljICNjb3VudGVyID0gLTFcblxuICAgIGdldCByZWFkb25seSgpIHsgcmV0dXJuIHRoaXMuaGFzQXR0cmlidXRlKCdyZWFkb25seScpIH1cbiAgICBnZXQgcmVxdWlyZWQoKSB7IHJldHVybiB0aGlzLmhhc0F0dHJpYnV0ZSgncmVxdWlyZWQnKSB9XG4gICAgZ2V0IGZvcm0oKSAgICAgeyByZXR1cm4gdGhpcy5faW50ZXJuYWxzLmZvcm0gfVxuICAgIGdldCB0eXBlKCkgICAgIHsgcmV0dXJuIHRoaXMubG9jYWxOYW1lIH1cblxuICAgIGNoZWNrYm94ZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI2lucHV0cycpLmFzc2lnbmVkRWxlbWVudHMoKVxuICAgICAgICAgICAgLm1hcCggdiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHYubG9jYWxOYW1lID09PSAnaW5wdXQnICYmIHYudHlwZSA9PT0gJ2NoZWNrYm94JykgcmV0dXJuIHZcbiAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkuZnJvbSh2LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W3R5cGU9Y2hlY2tib3hdJykpXG4gICAgICAgICAgICB9KS5mbGF0KCkuZmlsdGVyKHYgPT4gIXYuZGlzYWJsZWQpXG4gICAgfVxuXG4gICAgZ2V0IG1pbigpIHtcbiAgICAgICAgbGV0IG1pbiA9IHBhcnNlSW50KHRoaXMuZ2V0QXR0cmlidXRlKCdtaW4nKSlcbiAgICAgICAgaWYgKGlzTmFOKG1pbikgfHwgbWluIDwgMSkgbWluID0gMFxuICAgICAgICBpZiAodGhpcy5yZXF1aXJlZCAmJiBtaW4gPCAxKSBtaW4gPSAxXG4gICAgICAgIHJldHVybiBtaW5cbiAgICB9XG5cbiAgICBnZXQgbWF4KCkge1xuICAgICAgICBsZXQgbWF4ID0gcGFyc2VJbnQodGhpcy5nZXRBdHRyaWJ1dGUoJ21heCcpKVxuICAgICAgICBsZXQgc2l6ZSA9IHRoaXMuY2hlY2tib3hlcygpLmxlbmd0aCB8fCBJbmZpbml0eVxuICAgICAgICBpZiAoaXNOYU4obWF4KSB8fCBtYXggPiBzaXplKSBtYXggPSBzaXplXG4gICAgICAgIHJldHVybiBtYXhcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5sb2coJ2Nvbm5lY3RlZENhbGxiYWNrJylcbiAgICAgICAgbGV0IG1pbiA9IHRoaXMubWluXG4gICAgICAgIGlmIChtaW4gPiAwICYmICF0aGlzLnJlcXVpcmVkKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVDaGsoXCJtaW49IGF0dHJpYnV0ZSBpcyA+IDAsIGJ1dCAncmVxdWlyZWQnIGlzIG1pc3NpbmdcIilcblxuICAgICAgICBsZXQgc2xvdCA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjaW5wdXRzJylcbiAgICAgICAgc2xvdC5hZGRFdmVudExpc3RlbmVyKCdzbG90Y2hhbmdlJywgdGhpcy4jc2xvdGNoYW5nZS5iaW5kKHRoaXMpKVxuXG4gICAgICAgIGxldCBtYXggPSB0aGlzLm1heFxuICAgICAgICBpZiAobWluID4gbWF4KSB0aHJvdyBuZXcgRUNoaygnbWluID4gbWF4JylcbiAgICAgICAgaWYgKG1heCA8IG1pbikgdGhyb3cgbmV3IEVDaGsoJ21heCA8IG1pbicpXG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMubG9nKCdkaXNjb25uZWN0ZWRDYWxsYmFjaycpXG4gICAgfVxuXG4gICAgI3Nsb3RjaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMubG9nKCcjc2xvdGNoYW5nZScpXG5cbiAgICAgICAgdGhpcy5jaGVja2JveGVzKCkuZm9yRWFjaCggdiA9PiB7XG4gICAgICAgICAgICB2LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuX2NoYW5nZV9oYW5kbGVyKVxuICAgICAgICAgICAgdi5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLl9jaGFuZ2VfaGFuZGxlcilcbiAgICAgICAgfSlcblxuICAgICAgICB0aGlzLnVwZGF0ZV92YWxpZGl0eSh7Zmlyc3RfdGltZTogdHJ1ZX0pXG4gICAgfVxuXG4gICAgI3NldF9mb3JtX3N0YXRlKGV2dCkge1xuICAgICAgICB0aGlzLmxvZygnc2V0X2Zvcm1fc3RhdGUnLCBldnQudGFyZ2V0LnZhbHVlKVxuICAgICAgICB0aGlzLnVwZGF0ZV92YWxpZGl0eSgpXG4gICAgfVxuXG4gICAgdXBkYXRlX3ZhbGlkaXR5KG9wdCA9IHt9KSB7XG4gICAgICAgIGxldCBjaGVja2JveGVzID0gdGhpcy5jaGVja2JveGVzKClcbiAgICAgICAgaWYgKCFjaGVja2JveGVzLmxlbmd0aCkgcmV0dXJuXG5cbiAgICAgICAgbGV0IHIgPSB7fVxuICAgICAgICBsZXQgdmFsaWRpdHkgPSB0aGlzLiNjaGVja192YWxpZGl0eShjaGVja2JveGVzKVxuICAgICAgICBpZiAodmFsaWRpdHkgPT09IC0xKSByID0geyByYW5nZVVuZGVyZmxvdzogdHJ1ZSB9XG4gICAgICAgIGlmICh2YWxpZGl0eSA9PT0gMSkgciA9IHsgcmFuZ2VPdmVyZmxvdzogdHJ1ZSB9XG5cbiAgICAgICAgbGV0IFttaW4sIG1heF0gPSBbdGhpcy5taW4sIHRoaXMubWF4XVxuICAgICAgICBsZXQgbXNnID0gYFNlbGVjdCAke3RoaXMubWlufSB0byAke3RoaXMubWF4fSBjaGVja2JveGVzLmBcbiAgICAgICAgaWYgKG1pbiA9PT0gbWF4KSBtc2cgPSBgU2VsZWN0ICR7dGhpcy5taW59IGNoZWNrYm94ZXMuYFxuICAgICAgICB0aGlzLl9pbnRlcm5hbHMuc2V0VmFsaWRpdHkociwgbXNnLCBjaGVja2JveGVzWzBdKVxuXG4gICAgICAgIGlmICghb3B0LmZpcnN0X3RpbWUpIHtcbiAgICAgICAgICAgIGxldCBvcCA9IHZhbGlkaXR5ID09PSAwID8gJ2RlbGV0ZScgOiAnYWRkJ1xuICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxzLnN0YXRlc1tvcF0oJ291dC1vZi1yYW5nZScpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAjY2hlY2tfdmFsaWRpdHkoY2hlY2tib3hlcykge1xuICAgICAgICBpZiAodGhpcy5yZWFkb25seSkgcmV0dXJuIDAgLy8gbm8gY2hlY2tzIGlmICdyZWFkb25seScgYXR0ciBpcyBwcmVzZW50XG4gICAgICAgIGxldCBjaGVja2VkID0gY2hlY2tib3hlcy5maWx0ZXIoIHYgPT4gdi5jaGVja2VkKS5sZW5ndGhcbiAgICAgICAgbGV0IG1pbiA9IHRoaXMubWluXG4gICAgICAgIGxldCBtYXggPSB0aGlzLm1heFxuICAgICAgICBpZiAoY2hlY2tlZCA+PSBtaW4gJiYgY2hlY2tlZCA8PSBtYXgpIHJldHVybiAwXG4gICAgICAgIHJldHVybiBjaGVja2VkIDwgbWluID8gLTEgOiAxXG4gICAgfVxuXG4gICAgZ2V0IHZhbGlkaXR5KCkgICAgICAgICAgeyByZXR1cm4gdGhpcy5faW50ZXJuYWxzLnZhbGlkaXR5IH1cbiAgICBnZXQgdmFsaWRhdGlvbk1lc3NhZ2UoKSB7IHJldHVybiB0aGlzLl9pbnRlcm5hbHMudmFsaWRhdGlvbk1lc3NhZ2UgfVxuICAgIGdldCB3aWxsVmFsaWRhdGUoKSAgICAgIHsgcmV0dXJuIHRoaXMuX2ludGVybmFscy53aWxsVmFsaWRhdGUgfVxuXG4gICAgY2hlY2tWYWxpZGl0eSgpICAgICAgICAgeyByZXR1cm4gdGhpcy5faW50ZXJuYWxzLmNoZWNrVmFsaWRpdHkoKSB9XG4gICAgcmVwb3J0VmFsaWRpdHkoKSAgICAgICAgeyByZXR1cm4gdGhpcy5faW50ZXJuYWxzLnJlcG9ydFZhbGlkaXR5KCkgfVxuXG4gICAgZm9ybURpc2FibGVkQ2FsbGJhY2soc3RhdGUpIHtcbiAgICAgICAgdGhpcy5jaGVja2JveGVzKCkuZm9yRWFjaCggdiA9PiB2LmRpc2FibGVkID0gc3RhdGUpXG4gICAgfVxufVxuXG5jbGFzcyBFQ2hrIGV4dGVuZHMgRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKG1zZykge1xuICAgICAgICBzdXBlcigpXG4gICAgICAgIHRoaXMubWVzc2FnZSA9IGA8bXktY2hlY2tib3hlcz46ICR7bXNnfWBcbiAgICB9XG59XG4iLCAiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVlNsaWRlciBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKVxuICAgICAgICBsZXQgcyA9IHRoaXMuYXR0YWNoU2hhZG93KHttb2RlOiAnb3Blbid9KVxuICAgICAgICBzLmlubmVySFRNTCA9IGBcbjxzdHlsZT5cbiAgOmhvc3Qge1xuICAgIC0tdnNsaWRlci1saW5lLWhlaWdodDogMS41cmVtO1xuXG4gICAgLS12c2xpZGVyLWxpc3QtaG92ZXItYmc6IGdvbGQ7XG4gICAgLS12c2xpZGVyLWxpc3QtY3Vyc29yOiBwb2ludGVyO1xuICAgIC0tdnNsaWRlci1oZWlnaHQ6IDA7XG4gIH1cbiAgOmhvc3QoOnN0YXRlKGRpc2FibGVkKSkge1xuICAgIC0tdnNsaWRlci1saXN0LWhvdmVyLWJnOiBpbml0aWFsO1xuICAgIC0tdnNsaWRlci1saXN0LWN1cnNvcjogYXV0bztcbiAgfVxuXG4gICNjb250YWluZXIge1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgaGVpZ2h0OiB2YXIoLS12c2xpZGVyLWhlaWdodCk7XG4gIH1cblxuICAjc2xpZGVyIHsgd2lkdGg6IDJyZW07IH1cbiAgI3NsaWRlciBpbnB1dCB7XG4gICAgdHJhbnNmb3JtOiByb3RhdGUoLTkwZGVnKTtcbiAgICB0cmFuc2Zvcm0tb3JpZ2luOiBjYWxjKHZhcigtLXZzbGlkZXItaGVpZ2h0KS8yKSBjYWxjKHZhcigtLXZzbGlkZXItaGVpZ2h0KS8yKTtcbiAgICBjdXJzb3I6IHZhcigtLXZzbGlkZXItbGlzdC1jdXJzb3IpO1xuICAgIG1hcmdpbjogMDtcbiAgICB3aWR0aDogdmFyKC0tdnNsaWRlci1oZWlnaHQpO1xuICB9XG5cbiAgI3RpY2tzIHtcbiAgICBkaXNwbGF5OiBmbGV4O1xuICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgIGhlaWdodDogdmFyKC0tdnNsaWRlci1oZWlnaHQpO1xuICB9XG4gIDo6c2xvdHRlZChzcGFuKSB7XG4gICAgY3Vyc29yOiB2YXIoLS12c2xpZGVyLWxpc3QtY3Vyc29yKTtcbiAgICBwYWRkaW5nOiAwIDhweDtcbiAgfVxuICA6OnNsb3R0ZWQoc3Bhbjpob3ZlcikgeyBiYWNrZ3JvdW5kOiB2YXIoLS12c2xpZGVyLWxpc3QtaG92ZXItYmcpOyB9XG48L3N0eWxlPlxuXG48ZGl2IGlkPVwiY29udGFpbmVyXCI+XG4gIDxkaXYgaWQ9XCJzbGlkZXJcIj5cbiAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgbGlzdD1cImxpc3RcIj5cbiAgPC9kaXY+XG4gIDxzbG90IGlkPVwidGlja3NcIj48L3Nsb3Q+XG48L2Rpdj5cbmBcbiAgICAgICAgdGhpcy5faW50ZXJuYWxzID0gdGhpcy5hdHRhY2hJbnRlcm5hbHMoKVxuICAgICAgICB0aGlzLl9zcGFuX2NsaWNrX2hhbmRsZSA9IHRoaXMuI3NwYW5fY2xpY2tfaGFuZGxlLmJpbmQodGhpcylcbiAgICAgICAgdGhpcy5fdmFsdWUgPSAwXG4gICAgICAgIHRoaXMuX2xpc3QgPSBbMF1cbiAgICB9XG5cbiAgICBzdGF0aWMgZm9ybUFzc29jaWF0ZWQgPSB0cnVlXG5cbiAgICBnZXQgZm9ybSgpIHsgcmV0dXJuIHRoaXMuX2ludGVybmFscy5mb3JtIH1cbiAgICBnZXQgbmFtZSgpIHsgcmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlKCduYW1lJykgfVxuICAgIGdldCB0eXBlKCkgeyByZXR1cm4gdGhpcy5sb2NhbE5hbWUgfVxuXG4gICAgI2lucHV0KCkgeyByZXR1cm4gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyNzbGlkZXIgaW5wdXQnKSB9XG5cbiAgICBnZXQgdmFsdWUoKSB7IHJldHVybiB0aGlzLl92YWx1ZSB9XG5cbiAgICBzZXQgdmFsdWUoVikge1xuICAgICAgICBsZXQgbWluID0gdGhpcy5fbGlzdC5hdCgwKVxuICAgICAgICBsZXQgbWF4ID0gdGhpcy5fbGlzdC5hdCgtMSlcbiAgICAgICAgbGV0IHYgPSBwYXJzZUludChWKSB8fCBtaW5cbiAgICAgICAgaWYgKHYgPCBtaW4pIHYgPSBtaW5cbiAgICAgICAgaWYgKHYgPiBtYXgpIHYgPSBtYXhcbiAgICAgICAgdGhpcy5fdmFsdWUgPSB2XG5cbiAgICAgICAgbGV0IGlucHV0ID0gdGhpcy4jaW5wdXQoKVxuICAgICAgICBpbnB1dC52YWx1ZSA9IHRoaXMudmFsdWVcbiAgICAgICAgdGhpcy5faW50ZXJuYWxzLnNldEZvcm1WYWx1ZShpbnB1dC52YWx1ZSlcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgbGV0IHNsb3QgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI3RpY2tzJylcbiAgICAgICAgc2xvdC5hZGRFdmVudExpc3RlbmVyKCdzbG90Y2hhbmdlJywgdGhpcy4jc2xvdGNoYW5nZS5iaW5kKHRoaXMpKVxuXG4gICAgICAgIHRoaXMuI2lucHV0KCkuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZXZ0ID0+IHtcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSBldnQudGFyZ2V0LnZhbHVlXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgI3RpY2tzX3ZhbHVlcygpIHtcbiAgICAgICAgbGV0IHIgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI3RpY2tzJykuYXNzaWduZWRFbGVtZW50cygpLlxuICAgICAgICAgICAgbWFwKCB2ID0+IHBhcnNlSW50KHYuZGF0YXNldC52YWx1ZSkpLmZpbHRlciggdiA9PiAhaXNOYU4odikpXG4gICAgICAgIHJldHVybiByLmxlbmd0aCA/IHIuc29ydCgpIDogWzBdXG4gICAgfVxuXG4gICAgI3Nsb3RjaGFuZ2UoKSB7XG4gICAgICAgIGxldCBkb2MgPSB0aGlzLnNoYWRvd1Jvb3RcbiAgICAgICAgbGV0IHNwYW5zID0gZG9jLnF1ZXJ5U2VsZWN0b3IoJyN0aWNrcycpLmFzc2lnbmVkRWxlbWVudHMoKVxuXG4gICAgICAgIC8vIG1ha2UgPGRhdGFsaXN0PiBmb3Igb3V0IDxpbnB1dD5cbiAgICAgICAgZG9jLnF1ZXJ5U2VsZWN0b3IoJyNjb250YWluZXIgZGF0YWxpc3QnKT8ucmVtb3ZlKClcbiAgICAgICAgbGV0IGRhdGFsaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGF0YWxpc3QnKVxuICAgICAgICBkYXRhbGlzdC5pZCA9ICdsaXN0J1xuICAgICAgICBzcGFucy5mb3JFYWNoKCBzcGFuID0+IHtcbiAgICAgICAgICAgIGxldCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKVxuICAgICAgICAgICAgb3B0aW9uLnZhbHVlID0gc3Bhbi5kYXRhc2V0LnZhbHVlXG4gICAgICAgICAgICBkYXRhbGlzdC5hcHBlbmRDaGlsZChvcHRpb24pXG4gICAgICAgIH0pXG4gICAgICAgIGRvYy5xdWVyeVNlbGVjdG9yKCcjY29udGFpbmVyJykuYXBwZW5kQ2hpbGQoZGF0YWxpc3QpXG5cbiAgICAgICAgc3BhbnMuZm9yRWFjaCggc3BhbiA9PiB7XG4gICAgICAgICAgICBzcGFuLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fc3Bhbl9jbGlja19oYW5kbGUpXG4gICAgICAgICAgICBzcGFuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fc3Bhbl9jbGlja19oYW5kbGUpXG4gICAgICAgIH0pXG5cbiAgICAgICAgbGV0IGlucHV0ID0gdGhpcy4jaW5wdXQoKVxuICAgICAgICB0aGlzLl9saXN0ID0gdGhpcy4jdGlja3NfdmFsdWVzKClcbiAgICAgICAgaW5wdXQubWluID0gdGhpcy5fbGlzdC5hdCgwKVxuICAgICAgICBpbnB1dC5tYXggPSB0aGlzLl9saXN0LmF0KC0xKVxuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QuaG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2xpZGVyLWhlaWdodCcsIGBjYWxjKCR7dGhpcy5fbGlzdC5sZW5ndGh9ICogdmFyKC0tdnNsaWRlci1saW5lLWhlaWdodCkpYClcblxuICAgICAgICB0aGlzLnZhbHVlID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ3ZhbHVlJylcbiAgICB9XG5cbiAgICAjc3Bhbl9jbGlja19oYW5kbGUoZXZ0KSB7XG4gICAgICAgIGxldCBmaWVsZHNldCA9IHRoaXMuZm9ybS5xdWVyeVNlbGVjdG9yKCdmaWVsZHNldCcpXG4gICAgICAgIGlmIChmaWVsZHNldD8uZGlzYWJsZWQpIHJldHVyblxuICAgICAgICB0aGlzLnZhbHVlID0gZXZ0LmN1cnJlbnRUYXJnZXQuZGF0YXNldC52YWx1ZVxuICAgIH1cblxuICAgIHN0YXRpYyBvYnNlcnZlZEF0dHJpYnV0ZXMgPSBbJ3ZhbHVlJ11cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soXzEsIF8yLCBuZXdfdmFsdWUpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IG5ld192YWx1ZVxuICAgIH1cblxuICAgIGZvcm1EaXNhYmxlZENhbGxiYWNrKGRpc2FibGVkKSB7XG4gICAgICAgIGxldCBpbnB1dCA9IHRoaXMuI2lucHV0KClcbiAgICAgICAgaW5wdXQuZGlzYWJsZWQgPSBkaXNhYmxlZFxuXG4gICAgICAgIGxldCBvcCA9IGRpc2FibGVkID8gJ2FkZCcgOiAnZGVsZXRlJ1xuICAgICAgICB0aGlzLl9pbnRlcm5hbHMuc3RhdGVzW29wXSgnZGlzYWJsZWQnKVxuICAgIH1cbn1cbiIsICJpbXBvcnQgQ2hlY2tib3hlc0dyb3VwIGZyb20gJy4uLy4uL3dlYi1jb21wb25lbnRzL215LWNoZWNrYm94ZXMvbXktY2hlY2tib3hlcy5qcydcbmltcG9ydCBWU2xpZGVyIGZyb20gJy4uLy4uL3dlYi1jb21wb25lbnRzL3Ytc2xpZGVyL3Ytc2xpZGVyLmpzJ1xuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdjaGVja2JveGVzLWdyb3VwJywgQ2hlY2tib3hlc0dyb3VwKVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd2LXNsaWRlcicsIFZTbGlkZXIpXG4iXSwKICAibWFwcGluZ3MiOiAiOztBQUFBLE1BQUksUUFBUyxJQUFJLElBQUksT0FBTyxRQUFRLEVBQUcsYUFBYSxJQUFJLE9BQU87QUFPL0QsTUFBcUIsZUFBckIsTUFBcUIsc0JBQXFCLFlBQVk7QUFBQSxJQUNsRCxjQUFjO0FBQ1YsWUFBTTtBQUNOLFVBQUksSUFBSSxLQUFLLGFBQWEsRUFBQyxNQUFNLFFBQVEsZ0JBQWdCLEtBQUksQ0FBQztBQUM5RCxRQUFFLFlBQVk7QUFFZCxXQUFLLGFBQWEsS0FBSyxnQkFBZ0I7QUFDdkMsV0FBSyxrQkFBa0IsS0FBSyxnQkFBZ0IsS0FBSyxJQUFJO0FBRXJELFdBQUssWUFBWSxFQUFFLGNBQWE7QUFDaEMsV0FBSyxNQUFNLFFBQVEsUUFBUSxJQUN0QixLQUFLLFNBQVMsb0JBQW9CLEtBQUssU0FBUyxHQUFHLElBQUksTUFBTTtBQUFBLE1BQUM7QUFBQSxJQUN2RTtBQUFBLElBRUEsT0FBTyxpQkFBaUI7QUFBQSxJQUN4QixPQUFPLFdBQVc7QUFBQSxJQUVsQixJQUFJLFdBQVc7QUFBRSxhQUFPLEtBQUssYUFBYSxVQUFVO0FBQUEsSUFBRTtBQUFBLElBQ3RELElBQUksV0FBVztBQUFFLGFBQU8sS0FBSyxhQUFhLFVBQVU7QUFBQSxJQUFFO0FBQUEsSUFDdEQsSUFBSSxPQUFXO0FBQUUsYUFBTyxLQUFLLFdBQVc7QUFBQSxJQUFLO0FBQUEsSUFDN0MsSUFBSSxPQUFXO0FBQUUsYUFBTyxLQUFLO0FBQUEsSUFBVTtBQUFBLElBRXZDLGFBQWE7QUFDVCxhQUFPLEtBQUssV0FBVyxjQUFjLFNBQVMsRUFBRSxpQkFBaUIsRUFDNUQsSUFBSyxPQUFLO0FBQ1AsWUFBSSxFQUFFLGNBQWMsV0FBVyxFQUFFLFNBQVMsV0FBWSxRQUFPO0FBQzdELGVBQU8sTUFBTSxLQUFLLEVBQUUsaUJBQWlCLHNCQUFzQixDQUFDO0FBQUEsTUFDaEUsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLE9BQUssQ0FBQyxFQUFFLFFBQVE7QUFBQSxJQUN6QztBQUFBLElBRUEsSUFBSSxNQUFNO0FBQ04sVUFBSSxNQUFNLFNBQVMsS0FBSyxhQUFhLEtBQUssQ0FBQztBQUMzQyxVQUFJLE1BQU0sR0FBRyxLQUFLLE1BQU0sRUFBRyxPQUFNO0FBQ2pDLFVBQUksS0FBSyxZQUFZLE1BQU0sRUFBRyxPQUFNO0FBQ3BDLGFBQU87QUFBQSxJQUNYO0FBQUEsSUFFQSxJQUFJLE1BQU07QUFDTixVQUFJLE1BQU0sU0FBUyxLQUFLLGFBQWEsS0FBSyxDQUFDO0FBQzNDLFVBQUksT0FBTyxLQUFLLFdBQVcsRUFBRSxVQUFVO0FBQ3ZDLFVBQUksTUFBTSxHQUFHLEtBQUssTUFBTSxLQUFNLE9BQU07QUFDcEMsYUFBTztBQUFBLElBQ1g7QUFBQSxJQUVBLG9CQUFvQjtBQUNoQixXQUFLLElBQUksbUJBQW1CO0FBQzVCLFVBQUksTUFBTSxLQUFLO0FBQ2YsVUFBSSxNQUFNLEtBQUssQ0FBQyxLQUFLO0FBQ2pCLGNBQU0sSUFBSSxLQUFLLGtEQUFrRDtBQUVyRSxVQUFJLE9BQU8sS0FBSyxXQUFXLGNBQWMsU0FBUztBQUNsRCxXQUFLLGlCQUFpQixjQUFjLEtBQUssWUFBWSxLQUFLLElBQUksQ0FBQztBQUUvRCxVQUFJLE1BQU0sS0FBSztBQUNmLFVBQUksTUFBTSxJQUFLLE9BQU0sSUFBSSxLQUFLLFdBQVc7QUFDekMsVUFBSSxNQUFNLElBQUssT0FBTSxJQUFJLEtBQUssV0FBVztBQUFBLElBQzdDO0FBQUEsSUFFQSx1QkFBdUI7QUFDbkIsV0FBSyxJQUFJLHNCQUFzQjtBQUFBLElBQ25DO0FBQUEsSUFFQSxjQUFjO0FBQ1YsV0FBSyxJQUFJLGFBQWE7QUFFdEIsV0FBSyxXQUFXLEVBQUUsUUFBUyxPQUFLO0FBQzVCLFVBQUUsb0JBQW9CLFVBQVUsS0FBSyxlQUFlO0FBQ3BELFVBQUUsaUJBQWlCLFVBQVUsS0FBSyxlQUFlO0FBQUEsTUFDckQsQ0FBQztBQUVELFdBQUssZ0JBQWdCLEVBQUMsWUFBWSxLQUFJLENBQUM7QUFBQSxJQUMzQztBQUFBLElBRUEsZ0JBQWdCLEtBQUs7QUFDakIsV0FBSyxJQUFJLGtCQUFrQixJQUFJLE9BQU8sS0FBSztBQUMzQyxXQUFLLGdCQUFnQjtBQUFBLElBQ3pCO0FBQUEsSUFFQSxnQkFBZ0IsTUFBTSxDQUFDLEdBQUc7QUFDdEIsVUFBSSxhQUFhLEtBQUssV0FBVztBQUNqQyxVQUFJLENBQUMsV0FBVyxPQUFRO0FBRXhCLFVBQUksSUFBSSxDQUFDO0FBQ1QsVUFBSSxXQUFXLEtBQUssZ0JBQWdCLFVBQVU7QUFDOUMsVUFBSSxhQUFhLEdBQUksS0FBSSxFQUFFLGdCQUFnQixLQUFLO0FBQ2hELFVBQUksYUFBYSxFQUFHLEtBQUksRUFBRSxlQUFlLEtBQUs7QUFFOUMsVUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxLQUFLLEtBQUssR0FBRztBQUNwQyxVQUFJLE1BQU0sVUFBVSxLQUFLLEdBQUcsT0FBTyxLQUFLLEdBQUc7QUFDM0MsVUFBSSxRQUFRLElBQUssT0FBTSxVQUFVLEtBQUssR0FBRztBQUN6QyxXQUFLLFdBQVcsWUFBWSxHQUFHLEtBQUssV0FBVyxDQUFDLENBQUM7QUFFakQsVUFBSSxDQUFDLElBQUksWUFBWTtBQUNqQixZQUFJLEtBQUssYUFBYSxJQUFJLFdBQVc7QUFDckMsYUFBSyxXQUFXLE9BQU8sRUFBRSxFQUFFLGNBQWM7QUFBQSxNQUM3QztBQUFBLElBQ0o7QUFBQSxJQUVBLGdCQUFnQixZQUFZO0FBQ3hCLFVBQUksS0FBSyxTQUFVLFFBQU87QUFDMUIsVUFBSSxVQUFVLFdBQVcsT0FBUSxPQUFLLEVBQUUsT0FBTyxFQUFFO0FBQ2pELFVBQUksTUFBTSxLQUFLO0FBQ2YsVUFBSSxNQUFNLEtBQUs7QUFDZixVQUFJLFdBQVcsT0FBTyxXQUFXLElBQUssUUFBTztBQUM3QyxhQUFPLFVBQVUsTUFBTSxLQUFLO0FBQUEsSUFDaEM7QUFBQSxJQUVBLElBQUksV0FBb0I7QUFBRSxhQUFPLEtBQUssV0FBVztBQUFBLElBQVM7QUFBQSxJQUMxRCxJQUFJLG9CQUFvQjtBQUFFLGFBQU8sS0FBSyxXQUFXO0FBQUEsSUFBa0I7QUFBQSxJQUNuRSxJQUFJLGVBQW9CO0FBQUUsYUFBTyxLQUFLLFdBQVc7QUFBQSxJQUFhO0FBQUEsSUFFOUQsZ0JBQXdCO0FBQUUsYUFBTyxLQUFLLFdBQVcsY0FBYztBQUFBLElBQUU7QUFBQSxJQUNqRSxpQkFBd0I7QUFBRSxhQUFPLEtBQUssV0FBVyxlQUFlO0FBQUEsSUFBRTtBQUFBLElBRWxFLHFCQUFxQixPQUFPO0FBQ3hCLFdBQUssV0FBVyxFQUFFLFFBQVMsT0FBSyxFQUFFLFdBQVcsS0FBSztBQUFBLElBQ3REO0FBQUEsRUFDSjtBQUVBLE1BQU0sT0FBTixjQUFtQixNQUFNO0FBQUEsSUFDckIsWUFBWSxLQUFLO0FBQ2IsWUFBTTtBQUNOLFdBQUssVUFBVSxvQkFBb0IsR0FBRztBQUFBLElBQzFDO0FBQUEsRUFDSjs7O0FDbklBLE1BQXFCLFVBQXJCLGNBQXFDLFlBQVk7QUFBQSxJQUM3QyxjQUFjO0FBQ1YsWUFBTTtBQUNOLFVBQUksSUFBSSxLQUFLLGFBQWEsRUFBQyxNQUFNLE9BQU0sQ0FBQztBQUN4QyxRQUFFLFlBQVk7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBZ0RkLFdBQUssYUFBYSxLQUFLLGdCQUFnQjtBQUN2QyxXQUFLLHFCQUFxQixLQUFLLG1CQUFtQixLQUFLLElBQUk7QUFDM0QsV0FBSyxTQUFTO0FBQ2QsV0FBSyxRQUFRLENBQUMsQ0FBQztBQUFBLElBQ25CO0FBQUEsSUFFQSxPQUFPLGlCQUFpQjtBQUFBLElBRXhCLElBQUksT0FBTztBQUFFLGFBQU8sS0FBSyxXQUFXO0FBQUEsSUFBSztBQUFBLElBQ3pDLElBQUksT0FBTztBQUFFLGFBQU8sS0FBSyxhQUFhLE1BQU07QUFBQSxJQUFFO0FBQUEsSUFDOUMsSUFBSSxPQUFPO0FBQUUsYUFBTyxLQUFLO0FBQUEsSUFBVTtBQUFBLElBRW5DLFNBQVM7QUFBRSxhQUFPLEtBQUssV0FBVyxjQUFjLGVBQWU7QUFBQSxJQUFFO0FBQUEsSUFFakUsSUFBSSxRQUFRO0FBQUUsYUFBTyxLQUFLO0FBQUEsSUFBTztBQUFBLElBRWpDLElBQUksTUFBTSxHQUFHO0FBQ1QsVUFBSSxNQUFNLEtBQUssTUFBTSxHQUFHLENBQUM7QUFDekIsVUFBSSxNQUFNLEtBQUssTUFBTSxHQUFHLEVBQUU7QUFDMUIsVUFBSSxJQUFJLFNBQVMsQ0FBQyxLQUFLO0FBQ3ZCLFVBQUksSUFBSSxJQUFLLEtBQUk7QUFDakIsVUFBSSxJQUFJLElBQUssS0FBSTtBQUNqQixXQUFLLFNBQVM7QUFFZCxVQUFJLFFBQVEsS0FBSyxPQUFPO0FBQ3hCLFlBQU0sUUFBUSxLQUFLO0FBQ25CLFdBQUssV0FBVyxhQUFhLE1BQU0sS0FBSztBQUFBLElBQzVDO0FBQUEsSUFFQSxvQkFBb0I7QUFDaEIsVUFBSSxPQUFPLEtBQUssV0FBVyxjQUFjLFFBQVE7QUFDakQsV0FBSyxpQkFBaUIsY0FBYyxLQUFLLFlBQVksS0FBSyxJQUFJLENBQUM7QUFFL0QsV0FBSyxPQUFPLEVBQUUsaUJBQWlCLFVBQVUsU0FBTztBQUM1QyxhQUFLLFFBQVEsSUFBSSxPQUFPO0FBQUEsTUFDNUIsQ0FBQztBQUFBLElBQ0w7QUFBQSxJQUVBLGdCQUFnQjtBQUNaLFVBQUksSUFBSSxLQUFLLFdBQVcsY0FBYyxRQUFRLEVBQUUsaUJBQWlCLEVBQzdELElBQUssT0FBSyxTQUFTLEVBQUUsUUFBUSxLQUFLLENBQUMsRUFBRSxPQUFRLE9BQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvRCxhQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUM7QUFBQSxJQUNuQztBQUFBLElBRUEsY0FBYztBQUNWLFVBQUksTUFBTSxLQUFLO0FBQ2YsVUFBSSxRQUFRLElBQUksY0FBYyxRQUFRLEVBQUUsaUJBQWlCO0FBR3pELFVBQUksY0FBYyxxQkFBcUIsR0FBRyxPQUFPO0FBQ2pELFVBQUksV0FBVyxTQUFTLGNBQWMsVUFBVTtBQUNoRCxlQUFTLEtBQUs7QUFDZCxZQUFNLFFBQVMsVUFBUTtBQUNuQixZQUFJLFNBQVMsU0FBUyxjQUFjLFFBQVE7QUFDNUMsZUFBTyxRQUFRLEtBQUssUUFBUTtBQUM1QixpQkFBUyxZQUFZLE1BQU07QUFBQSxNQUMvQixDQUFDO0FBQ0QsVUFBSSxjQUFjLFlBQVksRUFBRSxZQUFZLFFBQVE7QUFFcEQsWUFBTSxRQUFTLFVBQVE7QUFDbkIsYUFBSyxvQkFBb0IsU0FBUyxLQUFLLGtCQUFrQjtBQUN6RCxhQUFLLGlCQUFpQixTQUFTLEtBQUssa0JBQWtCO0FBQUEsTUFDMUQsQ0FBQztBQUVELFVBQUksUUFBUSxLQUFLLE9BQU87QUFDeEIsV0FBSyxRQUFRLEtBQUssY0FBYztBQUNoQyxZQUFNLE1BQU0sS0FBSyxNQUFNLEdBQUcsQ0FBQztBQUMzQixZQUFNLE1BQU0sS0FBSyxNQUFNLEdBQUcsRUFBRTtBQUM1QixXQUFLLFdBQVcsS0FBSyxNQUFNLFlBQVksb0JBQW9CLFFBQVEsS0FBSyxNQUFNLE1BQU0sZ0NBQWdDO0FBRXBILFdBQUssUUFBUSxLQUFLLGFBQWEsT0FBTztBQUFBLElBQzFDO0FBQUEsSUFFQSxtQkFBbUIsS0FBSztBQUNwQixVQUFJLFdBQVcsS0FBSyxLQUFLLGNBQWMsVUFBVTtBQUNqRCxVQUFJLFVBQVUsU0FBVTtBQUN4QixXQUFLLFFBQVEsSUFBSSxjQUFjLFFBQVE7QUFBQSxJQUMzQztBQUFBLElBRUEsT0FBTyxxQkFBcUIsQ0FBQyxPQUFPO0FBQUEsSUFDcEMseUJBQXlCLElBQUksSUFBSSxXQUFXO0FBQ3hDLFdBQUssUUFBUTtBQUFBLElBQ2pCO0FBQUEsSUFFQSxxQkFBcUIsVUFBVTtBQUMzQixVQUFJLFFBQVEsS0FBSyxPQUFPO0FBQ3hCLFlBQU0sV0FBVztBQUVqQixVQUFJLEtBQUssV0FBVyxRQUFRO0FBQzVCLFdBQUssV0FBVyxPQUFPLEVBQUUsRUFBRSxVQUFVO0FBQUEsSUFDekM7QUFBQSxFQUNKOzs7QUM3SUEsaUJBQWUsT0FBTyxvQkFBb0IsWUFBZTtBQUN6RCxpQkFBZSxPQUFPLFlBQVksT0FBTzsiLAogICJuYW1lcyI6IFtdCn0K
