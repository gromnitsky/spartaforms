#!/usr/bin/env node

import * as cheerio from 'cheerio'
import * as fs from 'fs'

function getters(o) {
    return Object
        .entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(o)))
        .filter(([_key, descriptor]) => typeof descriptor.get === 'function')
        .map(([key]) => key)
}

class EString {
    constructor(name) {
        this.name = name
        this.required = false
        this._pattern
        this._minLength
        this._manLength
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

    toJSON() {
        let r = { type: "string" }
        getters(this).forEach( fn => {
            if (this[fn] != null) r[fn] = this[fn]
        })
        return r
    }
}

function err(...s) {
    console.error('mkschema.js error:', ...s)
    process.exit(1)
}

if (process.argv.length !== 4) err('Usage: mkschema.js form.html css-selector')

let $ = cheerio.loadBuffer(fs.readFileSync(process.argv[2]))
let form = $(process.argv[3])
if (form.length > 1) err('more > 1 forms match')

let nodes = $(form).find('*[name]')

let text = $(nodes).filter( (idx, v) => {
    return /^text|search$/.test($(v).attr('type')) && v.name === 'input'
}).toArray()

text = text.map( v => {
    let el = new EString($(v).attr("name"))
    el.required = $(v).attr("required") != null
    el.pattern = $(v).attr("pattern")
    el.minLength = $(v).attr("minlength")
    el.maxLength = $(v).attr("maxlength")
    return el
})

let r = {
    type: 'object',
    properties: {},
    required: []
}

text.forEach( v => r.properties[v.name] = v.toJSON())
r.required = r.required.concat(text.filter( v => v.required).map( v => v.name))

process.stdout.write(JSON.stringify(r, null, 2))
