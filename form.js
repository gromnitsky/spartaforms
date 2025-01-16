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

function cookie(name) {
    return document.cookie
        .match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop() || ''
}

function save_user_input(form) {
    let fd = new FormData(form)
    let json = Object.fromEntries(Array.from(fd.keys()).map(key => [
        key, fd.getAll(key).length > 1 ? fd.getAll(key) : fd.get(key)
    ]) )
    let key = cookie('schema')
    if (!key) return console.error('no value for the cookie "schema"')
    localStorage.setItem(key, JSON.stringify(json))
}

function load_user_input(form) {
    let key = cookie('schema')
    if (!key) return console.error('no value for the cookie "schema"')
    let input = JSON.parse(localStorage.getItem(key))
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

let form = $$('form')[0]
load_user_input(form)
form.onsubmit = submit
