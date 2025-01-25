#!/usr/bin/env bash

. helpers.sh

start

printf .
curl -sf -i $host:$port | head -10 |
    grep_2_patterns '^HTTP/1.1 200' '^Content-Type: text/html' ||
    errx "/ returns junk"

printf .
curl -sf -i $host:$port/js101 | head -1 | grep -q '^HTTP/1.1 301' ||
    errx "no 301 redirect"

printf .
curl -sfL -i $host:$port/foo | head -20 | grep -q '^HTTP/1.1 404' ||
    errx "/foo must 404"


printf .
curl -sfL -i $host:$port/js101/ --data-raw 'name=bob' | head -1 |
    grep -q '^HTTP/1.1 412' || errx "fails to check for cookies"

printf .
curl -sfL -b cookies.txt -c cookies.txt $host:$port/js101/ > /dev/null
curl -sfL -b cookies.txt -c cookies.txt -i $host:$port/js101/ \
     --data-raw 'name=bob' | head -1 | grep -q '^HTTP/1.1 400' ||
    errx "fails to validate payload"

post1() {
    curl -sfL -b cookies.txt -c cookies.txt -i $host:$port/js101/ \
         --data-raw 'name=bob&age=42&years_of_coding=28&knowledge=1&int=backend&int=other&languages=c%2Fc%2B%2B&languages=ruby&languages=bash&lang_other=foo&env=editor&os=linux&comment=yo'
}

post1_check() {
    head -20 | grep_2_patterns '^HTTP/1.1 303' '^HTTP/1.1 200 OK' ||
        errx "unsuccessful post"
}

printf .
post1 | post1_check
post1 | post1_check
[ "`cat $db/js101/*/*/*/*/results.json | jq .edits.total`" = 2 ] ||
    errx "wrong edits counter"

printf .
post1 | post1_check
post1 | post1_check
post1 | post1_check
post1 | head -1 | grep -q '^HTTP/1.1 403' ||
    errx "must not allow more edits"

echo
