#!/usr/bin/env bash

. helpers.sh

start

printf .
curl -sf -i $host:$port/js101 | head -1 | grep -q '^HTTP/1.1 301' ||
    errx "no 301 redirect"

printf .
curl -sf -i $host:$port | head -10 |
    grep_2_patterns '^HTTP/1.1 200' \
                    '^Content-Type: text/html' ||
    errx "/ returns junk"

echo
