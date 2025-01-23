#!/usr/bin/env node

import http from 'http'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import querystring from 'querystring'
import util from 'util'
import child_process from 'child_process';
import Ajv from 'ajv'
import mime from 'mime'

function errx(...s) { console.error('Error:', ...s); process.exit(1) }

let OPT = util.parseArgs({
    options: {
        'max-edits': { type: 'string', default: '5' },
        'expiration': { type: 'boolean', default: true },
    },
    allowNegative: true,
    allowPositionals: true,
})

OPT.values['max-edits'] = parseInt(OPT.values['max-edits']) || 0
if (OPT.positionals.length !== 2) errx('Usage: server.js public_dir db_dir')

let SECRET     = process.env.SECRET || errx('env SECRET is unset')
let PUBLIC_DIR = path.resolve(OPT.positionals[0])
let DB_DIR     = OPT.positionals[1]

if (PUBLIC_DIR.startsWith(path.resolve(DB_DIR)))
    errx("db_dir can't be equal to or reside in public_dir")

let ajv = new Ajv({ coerceTypes: true })
let SCHEMAS = {}

function js_make(survey, callback) {
    let generator = path.join(import.meta.dirname, 'mkschema.js')
    let src = path.join(PUBLIC_DIR, survey, 'index.html')
    let stat
    try { stat = fs.statSync(src) } catch (err) { return callback(err) }
    if (stat.mtimeMs <= (SCHEMAS[survey]?.mtimeMs || 0))
        return callback()

    child_process.execFile(generator, [src, 'form'], (err, stdout) => {
        if (err) return callback(err)
        SCHEMAS[survey] = {}
        try {
            SCHEMAS[survey].validator = ajv.compile(JSON.parse(stdout))
        } catch (err) {
            err.toJSON = () => ({message: err.message})
            return callback(err)
        }
        SCHEMAS[survey].mtimeMs = stat.mtimeMs
        callback()
    })
}

function js_validate(survey, json, callback) {
    js_make(survey, err => {
        if (err) return callback(err)
        let r = SCHEMAS[survey].validator(json)
        if (!r) return callback(SCHEMAS[survey].validator.errors)
        callback()
    })
}

function error(writable, code, err, text) {
    let sys = { 'ENOENT': 404, 'EACCES': 403, 'EINVAL': 400 }
    let status = sys[err.code] || code
    let msg = err.message || err
    if (!writable.headersSent) {
        writable.statusCode = status
        try {
            writable.setHeader('Content-Type', 'text/plain; charset=utf-8')
            writable.statusMessage = msg
        } catch {/**/}
    }
    let body = `HTTP ${status}: ${msg}`
    if (text) body = [body, "\n\n", text].join``
    writable.end(body)
}

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex') }

function cookie_parse(raw) {
    if (!raw) return {}
    let r = {}
    raw.split(';').forEach( cookie => {
      let [key, value] = cookie.split('=').map( part => part.trim())
        r[key] = decodeURIComponent(value)
    })
    return r
}

function cookie_valid(hash) {
    return sha1(SECRET+hash.sid) === hash.signature
}

function cookie_set(path_obj, req, res) {
    let cookies = cookie_parse(req.headers.cookie)
    if (cookie_valid(cookies)) return

    let date = new Date().toISOString().split('T')[0].replaceAll('-', '/')
    let uuid = crypto.randomUUID()
    let sid = path.join(date, uuid)
    let sec = Math.floor((path_obj.mtimeMs - Date.now()) / 1000)
    if (!OPT.values.expiration) sec = 60*60*24*365
    res.setHeader('Set-Cookie', [
        `sid=${sid}; Max-Age=${sec}; Path=${path_obj.pathname}`,
        `signature=${sha1(SECRET+sid)}; Max-Age=${sec}; Path=${path_obj.pathname}`,
    ])
}

// a survey file MUST have its mtime set in the future
function survey_valid(file, stats) {
    if (!OPT.values.expiration) return true
    if (path.dirname(file) === PUBLIC_DIR) return true
    if (path.basename(file) !== 'index.html') return true
    return stats.mtimeMs > Date.now()
}

function url_pathname(raw_http_url) {
    let url = new URL(`http://example.com${raw_http_url}`)
    return path.normalize(decodeURI(url.pathname))
}

function serve_static(req, res) {
    let pathname = url_pathname(req.url)
    if (!path.extname(pathname) && pathname[pathname.length-1] !== '/') {
        // this means we can't serve files w/o file extension
        return res.writeHead(301, { Location: `${pathname}/` }).end()
    }
    let file = path.join(PUBLIC_DIR, pathname)
    if (/\/+$/.test(file)) file = path.join(file, 'index.html')

    fs.stat(file, (err, stats) => {
        if (!err && !stats.isFile()) return error(res, 400, 'Irregular file')
        if (err) return error(res, 404, err)
        if (!survey_valid(file, stats)) return error(res, 403, 'Expired survey')

        let readable = fs.createReadStream(file)
        readable.once('data', () => {
            let extname = path.extname(file)
            res.setHeader('Content-Length', stats.size)
            res.setHeader('Content-Type', mime.getType(extname) || 'application/octet-stream')

            if (path.basename(file) === 'index.html'
                && path.dirname(file) !== PUBLIC_DIR)
                cookie_set({
                    pathname,
                    mtimeMs: stats.mtimeMs
                }, req, res)
        })
        readable.on('error', err => error(res, 500, err))
        readable.pipe(res)
    })
}

function collect_post_request(req, res, callback) {
    let chunks = []
    let size = 0
    req.on('error', err => error(res, 500, err))
    req.on('data', chunk => {
        chunks.push(chunk)
        size += Buffer.byteLength(chunk)
        if (size > 5*1024) {
            error(res, 413, 'Payload is too big')
            req.destroy()
        }
    })
    req.on('end', () => {
        // parse application/x-www-form-urlencoded
        callback(querystring.decode(chunks.join``))
    })
}

function save(req, res) {
    let cookies = cookie_parse(req.headers.cookie)
    if (!cookie_valid(cookies)) return error(res, 412, 'Invalid cookies')

    let survey = path.basename(url_pathname(req.url))
    let dir = path.join(DB_DIR, survey, cookies.sid)
    let file = path.join(dir, 'results.json')
    let sf
    try { sf = JSON.parse(fs.readFileSync(file)) } catch (_) { /**/ }

    if (OPT.values['max-edits'] > 0) {
        if (sf?.edits?.total >= OPT.values['max-edits']
            || Date.now() - sf?.edits?.last > 60*5*1000)
            return error(res, 403, 'Too many edits or expired edit window')
    }

    sf = {
        edits: {
            total: (sf?.edits?.total || 0) + 1,
            last: Date.now(),
            user_agent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        }
    }

    collect_post_request(req, res, parsed_data => {
        sf.user = parsed_data

        js_validate(survey, sf.user, err => {
            if (err) return error(res, 400, 'Failed payload validation',
                                  JSON.stringify(err, null, 2))

            let survey_src_dir = path.join(PUBLIC_DIR, survey)
            try {
                fs.mkdirSync(dir, {recursive: true})
                fs.writeFileSync(file, JSON.stringify(sf))
                fs.readdirSync(survey_src_dir).forEach( v => {
                    let to = path.join(dir, v)
                    fs.rmSync(to, {force: true})
                    let from = path.join(survey_src_dir, v)
                    fs.symlinkSync(from, to)
                })
            } catch(err) {
                return error(res, 500, err)
            }
            let from = req.url.replace(/^\/+/, '')
            res.writeHead(303, { Location: `/posted.html?from=${from}` }).end()
        })
    })
}

let server = http.createServer( (req, res) => {
    console.log(req.method, req.url)

    if (req.method === 'POST') {
        save(req, res)
    } else if (req.method === 'GET') {
        serve_static(req, res)
    } else {
        error(res, 405, 'Method Not Allowed')
    }
})

server.listen({
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
})
console.error(process.pid, process.cwd())
