#!/usr/bin/env node

import fs from 'fs'
import Ajv from 'ajv'

if (process.argv.length !== 4) {
    console.error('Usage: schema-validate.js data.schema.json data.json')
    process.exit(1)
}

let json = file => JSON.parse(fs.readFileSync(file))
let ajv = new Ajv({ coerceTypes: true, allErrors: true })
let js_validate = ajv.compile(json(process.argv[2]))

if (!js_validate(json(process.argv[3]))) {
    console.error(js_validate.errors)
    process.exit(1)
}
