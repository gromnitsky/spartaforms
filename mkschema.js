#!/usr/bin/env node

import * as cheerio from 'cheerio'
import * as fs from 'fs'

function getters(o) {
    return Object
        .entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(o)))
        .filter(([_key, descriptor]) => typeof descriptor.get === 'function')
        .map(([key]) => key)
}

class E {
    constructor(name, type) {
        this.name = name
        this.type = type
        this.required = false
    }

    toJSON() {
        let r = { type: this.type }
        getters(this).forEach( fn => {
            if (this[fn] != null) r[fn] = this[fn]
        })
        return r
    }
}

class EString extends E {
    constructor(name) {
        super(name, 'string')
    }

    set pattern(v) {
        if (!v) return
        try {
            new RegExp(v)
        } catch(_) {
            throw new Error(`invalid RE for string "${this.name}": $(v)`)
        }
        this._pattern = v
    }

    set minLength(v) {
        v = parseInt(v) || 0
        if (v <= 0) return
        this._minLength = v
    }

    set maxLength(v) {
        v = parseInt(v)
        if (isNaN(v) || v < 0) return
        this._maxLength = v
    }

    get pattern() { return this._pattern }
    get minLength() { return this._minLength }
    get maxLength() { return this._maxLength }
}

class EInteger extends E {
    constructor(name) {
        super(name, 'integer')
    }

    set minimum(v) {
        v = parseInt(v) || 0
        this._minimum = v
    }

    set maximum(v) {
        v = parseInt(v)
        if (isNaN(v)) return
        this._maximim = v
    }

    get minimum() { return this._minimum }
    get maximum() { return this._maximim }
}

// modifies 'schema'
function collect_props(nodes, fn_filter, fn_map, schema) {
    let elements = $(nodes).filter( (idx, v) => fn_filter(idx, v)).toArray()
    elements = elements.map(fn_map)

    elements.forEach( v => schema.properties[v.name] = v.toJSON())
    schema.required = schema.required
        .concat(elements.filter( v => v.required).map( v => v.name))
}

function err(...s) {
    console.error('mkschema.js error:', ...s)
    process.exit(1)
}

if (process.argv.length !== 4) err('Usage: mkschema.js form.html css-selector')

let $ = cheerio.loadBuffer(fs.readFileSync(process.argv[2]))
let form = $(process.argv[3])
if (form.length > 1) err('> 1 forms match')

let nodes = $(form).find('*[name]')
let schema = {
    type: 'object',
    properties: {},
    required: []
}

/* <input type="text"> */
collect_props(nodes, (idx, v) => {
    return /^text|search$/.test($(v).attr('type')) && v.name === 'input'
}, v => {
    let el = new EString($(v).attr("name"))
    el.required = $(v).attr("required") != null
    el.pattern = $(v).attr("pattern")
    el.minLength = $(v).attr("minlength")
    el.maxLength = $(v).attr("maxlength")
    return el
}, schema)

/* <input type="number"> */
collect_props(nodes, (idx, v) => {
    return $(v).attr('type') === 'number' && v.name === 'input'
}, v => {
    let el = new EInteger($(v).attr("name"))
    el.required = $(v).attr("required") != null
    el.minimum= $(v).attr("min")
    el.maximum= $(v).attr("max")
    return el
}, schema)


/* fin */
process.stdout.write(JSON.stringify(schema, null, 2))
