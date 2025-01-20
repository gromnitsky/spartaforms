let $$ = document.querySelectorAll.bind(document)
let url = new URL(window.location.href)
if (url.searchParams.get('debug') === '1') {
    $$('form *[required]').forEach( node => node.required = false)
}

class Checkboxes {
    constructor(css_selector) {
        this.div = $$(`${css_selector} div`)[0]
        this.inputs = [...$$(`${css_selector} input`)]
        let click = node => node.onclick = () => {
            return this.invalid_state(this.valid() ? 'remove' : 'add')
        }
        this.inputs.forEach(click)
    }

    invalid_state(operation) { this.div.classList[operation]('invalid') }

    valid() { return this.inputs.some( node => node.checked) }
}

let interests = new Checkboxes('#interests')

function submit() {
    save_user_input(this)

    if (!interests.valid()) {
        alert('"Area of interests" is unset')
        interests.invalid_state('add')
        return false
    }
}

function local_storage_key() {
    let url = new URL(window.location.href)
    let m = url.pathname.match(/([^/]+)\/+$/)
    if (!m) return null
    return `SpartaForms ${m[1]}`
}

function save_user_input(form) {
    let fd = new FormData(form)
    let json = Object.fromEntries(Array.from(fd.keys()).map(key => [
        key, fd.getAll(key).length > 1 ? fd.getAll(key) : fd.get(key)
    ]) )
    let key = local_storage_key()
    if (!key) return console.error('failed to guess the survey name')
    localStorage.setItem(key, JSON.stringify(json))
}

function load_user_input(form, input) {
    if (!input) return

    Object.keys(input).map( k => {
        let nodes = form.querySelectorAll(`*[name=${k}]`)
        return [k, nodes.length > 1 ? [...nodes] : nodes[0]]
    }).forEach( a => {
        let [key, elements] = a
        if (Array.isArray(elements)) { // a set of <input>
            elements.forEach( node => {
                if (Array.isArray(input[key])) { // checkboxes
                    for (let v of input[key]) {
                        if (node.value === v) node.checked = true
                    }
                } else { // radios
                    if (node.value === input[key]) node.checked = true
                }
            })

        } else {
            elements.value = input[key]
        }
    })
}

function load_user_meta(form, input) {
    if (!input) return
    let meta = form.querySelector('.meta')
    if (!meta) return

    Object.keys(input).map( k => [k, meta.querySelector(`*[data-name=${k}]`)])
        .forEach( a => {
            let [key, node] = a
            if (key === 'last') {
                node.innerText = new Date(input[key]).toLocaleString("en-GB")
            } else
                node.innerText = input[key]
        })
    meta.classList.remove('hidden')
}

function local_storage() {
    let key = local_storage_key()
    if (!key) return console.error('failed to guess the survey name')
    return JSON.parse(localStorage.getItem(key))
}

// try to load previous results when running fron db/ directory
let results
try {
    results = await fetch('results.json').then( r => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
    })
} catch (_) { /**/ }

let form = $$('form')[0]

if (results) { // load survey results
    load_user_input(form, results?.user)
    load_user_meta(form, results?.edits)
    form.querySelector('fieldset').disabled = true

} else { // start a new survey
    load_user_input(form, local_storage())
    form.onsubmit = submit
}
