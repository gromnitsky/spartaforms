import http from 'http'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

const SECRET = process.env.SECRET || '12345'
const EINVAL = mk_err('Argument invalide', 'EINVAL')
const EACCES = mk_err('Permission refusée', 'EACCES')

function error(writable, err) {
    if (!writable.headersSent) {
        let codes = { 'ENOENT': 404, 'EACCES': 403, 'EINVAL': 400 }
        writable.statusCode = codes[err?.code] || 500
        try { writable.statusMessage = err } catch {/**/}
    }
    writable.end()
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

function cookie_validate(raw) {
    let hash = cookie_parse(raw)
    return sha1(SECRET+hash.file) === hash.sha1
}

function cookie_set(req, res) {
    if (cookie_validate(req.headers.cookie)) return

    let date = new Date().toISOString().split('T')[0].replaceAll('-', '/')
    let uuid = crypto.randomUUID()
    let file = 'db/' + date + '/' + uuid
    let sec = 60*60*24*365
    res.setHeader('Set-Cookie', [
        `sha1=${sha1(SECRET+file)}; Max-Age=${sec}`,
        `file=${file}; Max-Age=${sec}`
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
                '.ico': 'image/x-icon'
            }[path.extname(file)] || 'application/octet-stream')
            cookie_set(req, res)
        })
        readable.on('error', err => error(res, err))
        readable.pipe(res)
    })
}

let server = http.createServer( (req, res) => {
    console.log(req.url, req.method, cookie_parse(req.headers.cookie))

    if (req.method === 'POST' && /^\/api\/1\/post\/?$/.test(req.url)) {
        save(req, res)
    } else if (req.method === 'GET') {
        serve_static(req, res)
    } else {
        error(res, EINVAL)
    }
})

server.listen(process.env.PORT || 3000)
console.error(process.pid, process.cwd())
