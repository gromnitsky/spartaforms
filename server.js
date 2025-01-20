#!/usr/bin/env node

import http from 'http'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import querystring from 'querystring'
import Ajv from 'ajv'

function errx(...s) {
    console.error('Error:', ...s)
    process.exit(1)
}

if (process.argv.length !== 2+2) errx('Usage: server.js public_dir db_dir')

const PUBLIC_DIR = process.argv[2+0]
const DB_DIR     = process.argv[2+1]

if (path.resolve(PUBLIC_DIR).startsWith(path.resolve(DB_DIR)))
    errx("db_dir can't be equal to or reside in public_dir")

const SECRET   = process.env.SECRET || errx('env SECRET is unset')
const EINVAL   = mk_err('Requête incorrecte', 'EINVAL')
const EACCES   = mk_err('Accès interdit', 'EACCES')
const EBADR    = mk_err('Échec de la condition préalable', 'EBADR')
const EMSGSIZE = mk_err('Charge utile trop grande', 'EMSGSIZE')
const ENAVAIL  = mk_err('Méthode non autorisée', 'ENAVAIL')

let ajv = new Ajv({ coerceTypes: true })
let SCHEMAS = {}

function js_validate(schema, json) {
    if (SCHEMAS[schema]) return SCHEMAS[schema]

    let s
    try {
        s = fs.readFileSync(path.join(DB_DIR, schema))
        SCHEMAS[schema] = ajv.compile(JSON.parse(s))
    } catch (_) { return false }
    let r = SCHEMAS[schema](json)
    if (!r) console.error(SCHEMAS[schema].errors)
    return r
}

function error(writable, err) {
    let tbl = { 'EMSGSIZE': 413, 'EBADR': 412, 'ENAVAIL': 405,
                'ENOENT': 404, 'EACCES': 403, 'EINVAL': 400 }
    let status = tbl[err?.code] || 500
    if (!writable.headersSent) {
        writable.statusCode = status
        try {
            writable.statusMessage = err.message
            writable.setHeader('Content-Type', 'text/plain; charset=utf-8')
        } catch {/**/}
    }
    writable.end(`HTTP ${status}: ${err.message}`)
}

function mk_err(msg, code) {
    let err = new Error(msg); err.code = code
    return err
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
    return sha1(SECRET+DB_DIR+hash.schema+hash.dir) === hash.sha1
}

function cookie_set(path_obj, req, res) {
    let cookies = cookie_parse(req.headers.cookie)
    if (cookie_valid(cookies)) return

    let date = new Date().toISOString().split('T')[0].replaceAll('-', '/')
    let uuid = crypto.randomUUID()
    let schema = path.join(path_obj.pathname, 'index.schema.json')
    let dir = path.join(path_obj.pathname, date, uuid)
    let sec = Math.floor((path_obj.mtimeMs - Date.now()) / 1000)
    res.setHeader('Set-Cookie', [
        `schema=${schema}; Max-Age=${sec}; Path=${path_obj.pathname}`,
        `dir=${dir}; Max-Age=${sec}; Path=${path_obj.pathname}`,
        `sha1=${sha1(SECRET+DB_DIR+schema+dir)}; Max-Age=${sec}; Path=${path_obj.pathname}`,
    ])
}

// a survey file MUST have its mtime set in the future
function survey_valid(file, stats) {
    if (path.join(PUBLIC_DIR, 'index.html') === file) return true
    if (path.basename(file) !== 'index.html') return true
    return stats.mtimeMs > Date.now()
}

function serve_static(req, res) {
    let url = new URL(`http://example.com${req.url}`)
    let pathname = path.normalize(decodeURI(url.pathname))
    if (!path.extname(pathname) && pathname[pathname.length-1] !== '/') {
        // this means we can't serve files w/o file extension
        return res.writeHead(301, { Location: `${pathname}/` }).end()
    }
    let file = path.join(PUBLIC_DIR, pathname)
    if (/\/+$/.test(file)) file = path.join(file, 'index.html')

    fs.stat(file, (err, stats) => {
        if (!err && !stats.isFile()) return error(res, EINVAL)
        if (err) return error(res, err)
        if (!survey_valid(file, stats)) error(res, EACCES)

        let readable = fs.createReadStream(file)
        readable.once('data', () => {
            let extname = path.extname(file)
            res.setHeader('Content-Length', stats.size)
            res.setHeader('Content-Type', {
                '.html': 'text/html',
                '.ico': 'image/x-icon',
                '.js': 'application/javascript',
                '.svg': 'image/svg+xml',
            }[extname] || 'application/octet-stream')

            if (extname === '.html') cookie_set({
                pathname,
                mtimeMs: stats.mtimeMs
            }, req, res)
        })
        readable.on('error', err => error(res, err))
        readable.pipe(res)
    })
}

function collect_post_request(req, res, callback) {
    let chunks = []
    let size = 0
    req.on('error', err => error(res, err))
    req.on('data', chunk => {
        chunks.push(chunk)
        size += Buffer.byteLength(chunk)
        if (size > 5*1024) {
            error(res, EMSGSIZE)
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
    if (!cookie_valid(cookies)) return error(res, EBADR)

    let dir = path.join(DB_DIR, cookies.dir)
    let file = path.join(dir, 'results.json')
    let sf
    try { sf = JSON.parse(fs.readFileSync(file)) } catch (_) { /**/ }

    if (sf?.edits?.total >= 5 || Date.now() - sf?.edits?.last > 60*5*1000)
        return error(res, EACCES)

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

        if (!js_validate(cookies.schema, sf.user)) return error(res, EINVAL)

        try {
            fs.mkdirSync(dir, {recursive: true})
            fs.writeFileSync(file, JSON.stringify(sf))
            ;['index.html', 'form.js'].forEach( v => {
                let to = path.join(dir, v)
                fs.rmSync(to, {force: true})
                let from = path.resolve(path.join(PUBLIC_DIR, path.dirname(cookies.schema), v))
                fs.symlinkSync(from, to)
            })
        } catch(err) {
            return error(res, err)
        }
        res.writeHead(303, { Location: `/posted.html?from=${req.url}` }).end()
    })
}

let server = http.createServer( (req, res) => {
    console.log(req.method, req.url)

    if (req.method === 'POST') {
        save(req, res)
    } else if (req.method === 'GET') {
        serve_static(req, res)
    } else {
        error(res, ENAVAIL)
    }
})

server.listen({
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
})
console.error(process.pid, process.cwd())
