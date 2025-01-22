class SpartaForms_Slider extends HTMLElement {
    static formAssociated = true

    constructor() {
        super()

        let name      = this.getAttribute('name')
        let value     = this.getAttribute('value')
        let min       = this.getAttribute('min')
        let max       = this.getAttribute('max')

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
  ::slotted(span:hover) { background: var(--spartaforms-slider-list-hover, gold); }
</style>

<div id="container">
  <div id="input">
    <input type="range" name="${name}" list="values"
           min="${min}" max="${max}" value="${value}">
  </div>
  <slot id="desc"></slot>
</div>
`
        this._internals = this.attachInternals()
    }

    get form() { return this._internals.form }
    get name() { return this.getAttribute('name') }
    get type() { return this.localName }

    connectedCallback() {
        let doc = this.shadowRoot
        let spans = doc.querySelector('#desc').assignedElements()

        // make <datalist> for out <input>
        let datalist = document.createElement('datalist')
        datalist.id = 'values'
        spans.forEach( span => {
            let option = document.createElement('option')
            option.value = span.dataset.value
            datalist.appendChild(option)
        })
        doc.querySelector('#container').appendChild(datalist)

        // handle clicks on light dom <span>s
        let input = doc.querySelector('#input input')
        let fieldset = this.form.querySelector('fieldset')
        let fn = node => node.onclick = span => {
            if (fieldset?.disabled) return
            input.value = span.currentTarget.dataset.value
            input.dispatchEvent(new Event('change'))
        }
        spans.forEach(fn)

        // inform <form> of our shadow dom <input>
        this._internals.setFormValue(input.value) // send initial value
        input.addEventListener("change", () => {
            this._internals.setFormValue(input.value)
        })
    }

    static observedAttributes = ['value']
    attributeChangedCallback(name, old_value, new_value) {
        let input = this.shadowRoot.querySelector('#input input')
        input.value = new_value
        input.dispatchEvent(new Event('change'))
    }

    formDisabledCallback(disabled) {
        let input = this.shadowRoot.querySelector('#input input')
        input.disabled = disabled
    }
}

customElements.define('spartaforms-slider', SpartaForms_Slider)
