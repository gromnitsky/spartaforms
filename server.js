import http from 'http'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import querystring from 'querystring'
import {Validator} from '@cfworker/json-schema'

if (process.argv.length !== 3) {
    console.error('Usage: server form.schema.json')
    process.exit(1)
}

const SECRET = process.env.SECRET || '12345'
const FORM_SCHEMA_FILE = process.argv[2]
const FORM_SCHEMA = JSON.parse(fs.readFileSync(FORM_SCHEMA_FILE))
const EINVAL   = mk_err('Requête incorrecte', 'EINVAL')
const EACCES   = mk_err('Accès interdit', 'EACCES')
const EBADR    = mk_err('Échec de la condition préalable', 'EBADR')
const EMSGSIZE = mk_err('Charge utile trop grande', 'EMSGSIZE')

function error(writable, err) {
    let tbl = { 'EMSGSIZE': 413, 'EBADR': 412,
                'ENOENT': 404, 'EACCES': 403, 'EINVAL': 400 }
    let status = tbl[err?.code] || 500
    if (!writable.headersSent) {
        writable.statusCode = status
        try {
            writable.statusMessage = err.message
            writable.setHeader('Content-Type', 'text/html;charset=UTF-8')
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
    return sha1(SECRET+hash.dir) === hash.sha1
}

function cookie_set(req, res) {
    let cookies = cookie_parse(req.headers.cookie)
    if (cookie_valid(cookies)) return

    let date = new Date().toISOString().split('T')[0].replaceAll('-', '/')
    let uuid = crypto.randomUUID()
    let schema = path.basename(FORM_SCHEMA_FILE, '.schema.json')
    let dir = path.join('db', schema, date, uuid)
    let sec = 60*60*24*365
    res.setHeader('Set-Cookie', [
        `schema=${schema}; Max-Age=${sec}`,
        `sha1=${sha1(SECRET+dir)}; Max-Age=${sec}`,
        `dir=${dir}; Max-Age=${sec}`
    ])
}

function serve_static(req, res) {
    let url = new URL(`http://example.com${req.url}`)
    let name = url.pathname
    if (/^\/+$/.test(name)) name = "index.html"
    let nname = path.normalize(name)
    if (nname.startsWith('/db/')) return error(res, EACCES)
    let file = path.join(process.cwd(), nname)
    file = decodeURI(file)

    fs.stat(file, (err, stats) => {
        if (!err && !stats.isFile()) return error(res, EINVAL)
        if (err) return error(res, err)

        let readable = fs.createReadStream(file)
        readable.once('data', () => {
            res.setHeader('Content-Length', stats.size)
            res.setHeader('Content-Type', {
                '.html': 'text/html',
                '.ico': 'image/x-icon',
                '.js': 'application/javascript'
            }[path.extname(file)] || 'application/octet-stream')
            cookie_set(req, res)
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

    let file = path.join(cookies.dir, 'results.json')
    let sf
    try { sf = JSON.parse(fs.readFileSync(file)) } catch (_) { /**/ }

    if (sf?.edits?.total >= 5 || Date.now() - sf?.edits?.last > 60*5*1000)
        return error(res, EACCES)

    sf = {
        edits: {
            total: (sf?.edits?.total || 0) + 1,
            last: Date.now()
        }
    }

    collect_post_request(req, res, parsed_data => {
        sf.user = parsed_data

        let validator = new Validator(FORM_SCHEMA)
        let r = validator.validate(sf.user)
        if (!r.valid) {
            console.error(r)
            return error(res, EINVAL)
        }

        try {
            fs.mkdirSync(cookies.dir, {recursive: true})
            fs.writeFileSync(path.join(cookies.dir, 'results.json'),
                             JSON.stringify(sf))
            ;['index.html', 'form.js'].forEach( v => {
                let dest = path.join(cookies.dir, v)
                fs.rmSync(dest, {force: true})
                fs.symlinkSync(path.relative(cookies.dir, v), dest)
            })
        } catch(err) {
            return error(res, err)
        }
        res.writeHead(301, { Location: '/api/1/posted' }).end()
    })
}

function save_ok(req, res) {
    res.setHeader('Content-Type', 'text/html')
    res.end(`<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html { height: 100%; align-content: center; }
body { margin: 0 auto; width: 20em; border: 1px solid gray; padding: 1em; }
</style>
<h1>Submitted</h1>
<p><a href="/">Edit</a></p>
<p>(Editing is available within 5 min after the last edit, 5 edits max.)</p>`)
}

let server = http.createServer( (req, res) => {
    console.log(req.url, req.method, cookie_parse(req.headers.cookie))

    if (req.url.startsWith('/api/1/')) {
        let endpoint = req.url.slice(7)
        if (req.method === 'POST' && endpoint === 'post') {
            save(req, res)
        } else if (req.method === 'GET' && endpoint === 'posted') {
            save_ok(req, res)
        } else {
            error(res, EINVAL)
        }

    } else if (req.method === 'GET') {
        serve_static(req, res)
    } else {
        error(res, EINVAL)
    }
})

server.listen(process.env.PORT || 3000)
console.error(process.pid, process.cwd())
