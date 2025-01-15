#!/usr/bin/env node

import fs from 'fs'
import {Validator} from '@cfworker/json-schema'

if (process.argv.length !== 4) {
    console.error('Usage: schema-validate.js data.schema.json data.json')
    process.exit(1)
}

let json = file => JSON.parse(fs.readFileSync(file))
let validator = new Validator(json(process.argv[2]))
let r = validator.validate(json(process.argv[3]))
if (!r.valid) {
    console.error(r)
    process.exit(1)
}
