How it works:

1. `server.js` contains a static web server.

    Usage: `server.js public_dir db_dir`

2. When it gets `/foo/` request from a browser, it expects to find
   `$public_dir/foo/index.html` file which should be a survey page, and
   *foo* is the name of the survey.

3. It sets cookies for `index.html` to differentiate between users
   later on. Nothing is saved on the server yet.

4. A user fills the form & hits Submit button.

5. The POST request also goes to `/foo/index.html`.

6. The server generates a JSON Schema from `index.html` (on the fly)
   to check the validity of the POST request.

7. The results are saved in `$db_dir` directory the JSON format.

8. The user can edit the survey within 5m of the last post.

9. `$db_dir` will contain not only the survey results, but a symlinks
   to all the files from `$public_dir/foo/` directory. If you open
   `index.html` (under any static web server) it'll fill the form with
   the survey results.

## Usage

Node v22+.

1. Clone the repo.
2. `npm i`.
3. Run: `SECRET=12345 ./server.js --no-expiration public_html db`
4. Open http://127.0.0.1:3000/js101 in the browser.

## How to create a survey

1. `cp -a public_html/js101 public_html/my-survey`.
2. Edit `public_html/my-survey/index.html`.

To make the survey expire automatically, set the date of `index.html`
file *in the future* (`touch -d XXXX-XX-XX
public_html/my-survey/index.html`) and remove `--no-expiration` flag
when invoking `server.js`.

## server.js options

* `--no-expiration`: don't check mtime of `index.html` files.
* `--max-edits INT`: max allowed survey edits (default is 5, a
  non-number means ∞).
* `--max-payload BYTES`: max POST size (default is 5120).

Env vars:

* `HOST`
* `PORT`
* `SECRET`: used in making a signature for a cookie.

## &#x2672; Loicense

MIT
