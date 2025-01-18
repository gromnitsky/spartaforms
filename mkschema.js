#!/usr/bin/env node

import * as cheerio from 'cheerio'
import * as fs from 'fs'
import util from 'util'

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
        let r = {}
        if (this.type) r.type = this.type
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

class ECheckboxes {
    constructor(nodes) {
        this.nodes = nodes
        this.name = $(this.nodes[0]).attr('name')
        let values = this.nodes.map( v => $(v).attr('value'))
        this.enums = [...new Set(values)] // make uniq
    }

    get required() {
        return this.nodes.some( v => {
            return $(v).attr('data-required') || $(v).attr('required') != null
        })
    }

    toJSON() {
        return {
            oneOf: [{
                type: "array",
                items: {
                    type: "string",
                    enum: this.enums
                },
                minItems: 1,
                maxItems: this.enums.length,
                uniqueItems: true
            }, {
                enum: this.enums
            }]
        }
    }
}

// modifies 'schema'
function collect_props(nodes, fn_filter, fn_map, schema) {
    let elements = $(nodes).filter( (_, v) => fn_filter(v)).toArray()
    elements = elements.map(fn_map)

    elements.forEach( v => schema.properties[v.name] = v.toJSON())
    schema.required = schema.required
        .concat(elements.filter( v => v.required).map( v => v.name))

    return elements
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
collect_props(nodes, v => {
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
collect_props(nodes, v => {
    return $(v).attr('type') === 'number' && v.name === 'input'
}, v => {
    let el = new EInteger($(v).attr("name"))
    el.required = $(v).attr("required") != null
    el.minimum = $(v).attr("min")
    el.maximum = $(v).attr("max")
    return el
}, schema)

/* <input type="range"> */
collect_props(nodes, v => {
    return $(v).attr('type') === 'range' && v.name === 'input'
}, v => {
    let el = new EInteger($(v).attr("name"))
    el.required = $(v).attr("required") != null
    el.minimum = $(v).attr("min")
    el.maximum = $(v).attr("max")
    return el
}, schema)


/* <input type="checkbox"> */
let checkboxes = $(nodes).toArray()
    .filter( v => $(v).attr('type') === 'checkbox')
checkboxes = Object.groupBy(checkboxes, v => $(v).attr('name'))
Object.keys(checkboxes).forEach( k => {
    let group = new ECheckboxes(checkboxes[k])
    schema.properties[group.name] = group.toJSON()
    if (group.required) schema.required.push(group.name)
})

/* fin */
process.stdout.write(JSON.stringify(schema, null, 2))
