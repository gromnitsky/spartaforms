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
    constructor(node, type) {
        this.node = node
        this.type = type
        this.name = $(this.node).attr('name')
    }

    get required() { return $(this.node).attr('required') != null }

    toJSON() {
        let r = { type: this.type }
        getters(this).forEach( prop => {
            if (this[prop] != null) r[prop] = this[prop]
        })
        return r
    }
}

class EString extends E {
    constructor(node) {
        super(node, 'string')
    }

    get pattern() {
        let v = $(this.node).attr('pattern')
        if (!v) return null
        try {
            new RegExp(v)
        } catch(_) {
            throw new Error(`invalid RE for string "${this.name}": $(v)`)
        }
        return v
    }

    get minLength() {
        let v = parseInt($(this.node).attr('minlength'))
        return (isNaN(v) || v <= 0) ? null : v
    }

    get maxLength() {
        let v = parseInt($(this.node).attr('maxlength'))
        return (isNaN(v) || v < 0) ? null : v
    }
}

class EInteger extends E {
    constructor(node) {
        super(node, 'integer')
    }

    get minimum() {
        let v = parseInt($(this.node).attr('min'))
        return isNaN(v) ? null : v
    }

    get maximum() {
        let v = parseInt($(this.node).attr('max'))
        return isNaN(v) ? null : v
    }
}

class ECheckboxes {
    constructor(nodes) {
        this.nodes = nodes
        this.name = $(this.nodes[0]).attr('name')
        let values = this.nodes.map( v => $(v).attr('value'))
        this.enums = [...new Set(values)] // make uniq

        this.parent = $(this.nodes[0]).parent()
    }

    get required() { return this.parent.attr('required') }

    get minItems() { return parseInt(this.parent.attr('min')) || 1 }

    toJSON() {
        let arr = {
            type: "array",
            items: {
                type: "string",
                enum: this.enums
            },
            minItems: this.minItems,
            maxItems: this.enums.length,
            uniqueItems: true
        }

        if (this.minItems === 1) return { oneOf: [arr, { enum: this.enums }] }
        return arr
    }
}

class ERadios extends ECheckboxes {
    constructor(nodes) { super(nodes) }

    get required() {
        return this.nodes.some( v => $(v).attr('required') != null)
    }

    toJSON() { return { enum: this.enums } }
}

class ESelect extends E {       // TODO: add support for "multiple"
    constructor(node) {
        super(node, 'dummy')
        let options = $(node).find('option').toArray()
        let values = options.map( v => $(v).attr('value')).filter(Boolean)
        this.enums = [...new Set(values)] // make uniq
    }

    toJSON() { return { enum: this.enums } }
}

function err(...s) {
    console.error('mkschema.js error:', ...s)
    process.exit(1)
}

if (process.argv.length !== 4) err('Usage: mkschema.js form.html css-selector')

let $ = cheerio.loadBuffer(fs.readFileSync(process.argv[2]))
let form = $(process.argv[3])
if (form.length > 1) err('> 1 forms match')

let nodes = $(form).find('*[name]').toArray()
let schema = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
}

/* <input type="text"> */
let texts = nodes.filter( v => {
    return /^text|search$/.test($(v).attr('type')) && v.name === 'input'
}).map( v => new EString(v))

/* <input type="number"> */
let numbers = nodes.filter( v => {
    return v.name === 'input' && $(v).attr('type') === 'number'
}).map( v => new EInteger(v))

/* <input type="range"> */
let ranges = nodes.filter( v => {
    return v.name === 'input' && $(v).attr('type') === 'range'
}).map( v => new EInteger(v))

/* <v-slider> */
let v_sliders = nodes.filter( v => {
    return v.name === 'v-slider'
}).map( v => new EInteger(v))

/* <textarea> */
let textareas = nodes.filter( v => v.name === 'textarea')
    .map( v => new EString(v))

/* <select> */
let selects = nodes.filter( v => v.name === 'select')
    .map( v => new ESelect(v))

texts.concat(numbers, ranges, v_sliders, textareas, selects)
    .forEach( v => {
        schema.properties[v.name] = v.toJSON()
        if (v.required) schema.required.push(v.name)
    })

/* <input type="checkbox"> */
let checkboxes = nodes.filter( v => v.name === 'input' && $(v).attr('type') === 'checkbox')
checkboxes = Object.groupBy(checkboxes, v => $(v).attr('name'))
checkboxes = Object.keys(checkboxes).map(k => new ECheckboxes(checkboxes[k]))

/* <input type="radio"> */
let radios = nodes.filter( v => v.name === 'input' && $(v).attr('type') === 'radio')
radios = Object.groupBy(radios, v => $(v).attr('name'))
radios = Object.keys(radios).map( k => new ERadios(radios[k]))

checkboxes.concat(radios).forEach ( group => {
    schema.properties[group.name] = group.toJSON()
    if (group.required) schema.required.push(group.name)
})


/* fin */
process.stdout.write(JSON.stringify(schema, null, 2))
