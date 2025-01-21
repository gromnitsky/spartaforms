customElements.define('spartaforms-slider', class extends HTMLElement {
    static formAssociated = true

    constructor() {
        super()

        this.name     = this.getAttribute('name')
        this.value    = this.getAttribute('value')
        this.min      = this.getAttribute('min')
        this.max      = this.getAttribute('max')
        this.fieldset = this.getAttribute('fieldset')

        let s = this.attachShadow({mode: 'open'})
        s.innerHTML = `
<style>
  #container {
    display: flex;
    height: 8rem;
  }

  #input { width: 2rem; }
  #input input {
    transform: rotate(-90deg);
    transform-origin: 4rem 4rem;
    cursor: pointer;
    margin: 0;
    width: 8rem;
  }

  #desc {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 8rem;
  }
  ::slotted(span) {
    cursor: pointer;
    padding: 0 8px;
  }
  ::slotted(span:hover) { background: gold; }
</style>

<div id="container">
  <div id="input">
    <input type="range" name="${this.name}" list="values"
           min="${this.min}" max="${this.max}" value="${this.value}">
  </div>
  <slot id="desc"></slot>
</div>
`
    }

    connectedCallback() {
        let doc = this.shadowRoot
        let spans = doc.querySelector('#desc').assignedElements()

        let datalist = document.createElement('datalist')
        datalist.id = 'values'
        spans.forEach( span => {
            let option = document.createElement('option')
            option.value = span.dataset.value
            datalist.appendChild(option)
        })
        doc.querySelector('#container').appendChild(datalist)

        let input = doc.querySelector('#input input')
        let fieldset = document.querySelector(this.fieldset)
        let fn = node => node.onclick = span => {
            if (fieldset.disabled) return
            input.value = span.currentTarget.dataset.value
            input.dispatchEvent(new Event('change'))
        }
        spans.forEach(fn)

        this.internals = this.attachInternals()
        this.internals.setFormValue(input.value) // send initial value
        input.addEventListener("change", () => {
            this.internals.setFormValue(input.value)
        })
    }

    static observedAttributes = ['value']
    attributeChangedCallback(name, old_value, new_value) {
        if (name === 'value') {
            let input = this.shadowRoot.querySelector('#input input')
            input.value = new_value
            input.dispatchEvent(new Event('change'))
        }
    }
})
