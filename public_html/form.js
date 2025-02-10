function submit() {
    save_user_input(this)
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
        let nodes = form.querySelectorAll(`*[name="${k}"]`)
        return [k, nodes.length > 1 ? [...nodes] : nodes[0]]

    }).filter( ([_, v]) => Boolean(v)).forEach( ([key, elements]) => {
        if (Array.isArray(elements)) { // a set of <input>
            elements.forEach( node => {
                if (Array.isArray(input[key])) {
                    for (let v of input[key]) {
                        if (node.value === v) node.click()
                    }
                } else {
                    if (node.value === input[key]) node.click()
                }
            })

        } else {
            let node = elements
            if (node.tagName === 'TEXTAREA') {
                node.value = input[key]
            } else if (node.tagName === 'SELECT') {
                node.querySelectorAll('option').forEach( v => {
                    if (v.value === input[key]) v.selected = true
                })
            } else {
                // updates custom node as well
                node.value = input[key]
            }
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

let form = document.querySelector('form')

if (results) { // load survey results
    load_user_input(form, results?.user)
    load_user_meta(form, results?.edits)
    form.querySelector('fieldset').disabled = true

} else { // start a new survey
    load_user_input(form, local_storage())
    form.onsubmit = submit
}
