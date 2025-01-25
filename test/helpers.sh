port=3010
host=127.0.0.1
db=tmp_db
pidfile=server.pid

trap stop 0

stop() {
    ps --forest -o pid= -g "`cat "$pidfile"`" | xargs -r kill
    rm -rf cookies.txt server.pid $db
}

start() {
    rm -f cookies.txt
    daemonize -c "`pwd`" -p "$pidfile" -E PORT=$port -E SECRET=12345 \
              "`readlink -f ../server.js`" ../public_html $db
    timeout 2 sh -c "while ! ncat -z $host $port; do sleep 0.1; done" ||
        errx "failed to connect to $host:$port"
}

errx() { echo "FAILED: $*" 1>&2; exit 1; }

grep_2_patterns() {
    awk -vp1="$1" -vp2="$2" '$0 ~ p1 || $0 ~p2 { m+=1 } END {exit m != 2}'
}
