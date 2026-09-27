#!/bin/bash
# Judge isolation spike (ticket 06): throwaway, realistic, Linux containers only.
# Host toolchains are NEVER used. Every case runs with: no network, capped CPU,
# capped memory+swap, capped pids, read-only rootfs, scratch-only writable
# tmpfs dirs, non-root user, auto-remove. Inner `timeout` bounds each step so a
# case can never hang the suite; production must enforce the same server-side.
# Usage: ./spike.sh [py|cx|misc|all]
set -u
cd "$(dirname "$0")"

IMG_PY="python:3.12-slim"
IMG_CC="gcc:14-bookworm"
RES="results-data"
OUT="results.md"
mkdir -p "$RES"

DFLAGS="--rm --network none --cpus 1 --memory 256m --memory-swap 256m --pids-limit 64 --read-only --tmpfs /scratch:rw,exec,mode=1777 --tmpfs /tmp:rw,exec,mode=1777 --workdir /scratch --user nobody -i"

ms() { python3 -c 'import time;print(int(time.time()*1000))'; }

row() { echo "$1" >> "$OUT"; }

# run_box TAG IMAGE FNAME SRC CMDBOUND_INNER CMD...
# Pipes $SRC to the container stdin (cat > $FNAME), runs CMD with inner timeout.
run_box() {
  local tag="$1" img="$2" fname="$3" src="$4" bound="$5" cmd="$6"
  local t0; t0=$(ms)
  printf '%s' "$src" | docker run $DFLAGS "$img" bash -c "cat > $fname && timeout $bound bash -c $(printf '%q' "$cmd")" \
    >"$RES/$tag.out" 2>"$RES/$tag.err"
  local rc=$?
  local t1; t1=$(ms)
  local ob; ob=$(wc -c <"$RES/$tag.out" | tr -d ' ')
  local eb; eb=$(wc -c <"$RES/$tag.err" | tr -d ' ')
  row "| $tag | \`$(basename "$img")\` | $rc | $((t1-t0))ms | ${ob}B | ${eb}B |"
  echo "[$tag] rc=$rc wall=$((t1-t0))ms out=${ob}B err=${eb}B"
}

init_results() {
  cat > "$OUT" <<'EOF'
# Judge spike results (measured, linux/aarch64 containers)

| case | image | exit | wall | stdout | stderr |
|---|---|---|---|---|---|
EOF
}

part_py() {
  echo "== python =="
  local src=""

  src='print("hello-arena")'
  run_box "py-baseline" "$IMG_PY" main.py "$src" 10 'python3 main.py'

  src='while True:
    pass'
  run_box "py-infinite-loop" "$IMG_PY" main.py "$src" 8 'python3 main.py'

  src='buf = []
while True:
    buf.append(bytearray(10 * 1024 * 1024))'
  run_box "py-mem-hog" "$IMG_PY" main.py "$src" 20 'python3 main.py'

  src='import os, time
deadline = time.time() + 6
spawned = 0
while time.time() < deadline:
    try:
        if os.fork() == 0:
            os._exit(0)
        spawned += 1
    except BlockingIOError:
        pass
print("spawned", spawned)'
  run_box "py-fork-bomb" "$IMG_PY" main.py "$src" 12 'python3 main.py'

  src='import os
print(os.listdir("/"))
for p in ["/etc/passwd", "/proc/self/environ", "../../etc/passwd"]:
    try:
        with open(p, "rb") as f:
            print(p, "readable", len(f.read()), "bytes")
    except OSError as e:
        print(p, "blocked:", e)'
  run_box "py-fs-probe" "$IMG_PY" main.py "$src" 10 'python3 main.py'

  src='import os
print("USER", os.environ.get("USER"), "HOME", os.environ.get("HOME"))
leaked = [k for k in os.environ if "SECRET" in k or "TOKEN" in k or "PASS" in k]
print("secret-like vars:", leaked)'
  run_box "py-env-inspect" "$IMG_PY" main.py "$src" 10 'python3 main.py'

  src='import socket
for host in ["93.184.216.0", "169.254.169.254", "127.0.0.1"]:
    try:
        s = socket.create_connection((host, 80), timeout=2)
        print(host, "CONNECTED (bad)")
        s.close()
    except OSError as e:
        print(host, "blocked:", type(e).__name__)'
  run_box "py-net-egress" "$IMG_PY" main.py "$src" 15 'python3 main.py'

  src='import subprocess
r = subprocess.run(["echo", "child-ok"], capture_output=True, text=True, timeout=5)
print(r.stdout.strip())'
  run_box "py-child-proc" "$IMG_PY" main.py "$src" 10 'python3 main.py'

  src='def broken(:
    pass'
  run_box "py-malformed" "$IMG_PY" main.py "$src" 10 'python3 main.py'
}

part_cx() {
  echo "== c++ / c =="
  local src=""

  src='#include <cstdio>
int main(){std::printf("hello-arena\n");return 0;}'
  run_box "cpp-baseline" "$IMG_CC" main.cpp "$src" 30 'g++ -O2 -o prog.bin main.cpp && ./prog.bin'

  src='#include <stdio.h>
int main(){printf("hello-arena\n");return 0;}'
  run_box "c-baseline" "$IMG_CC" main.c "$src" 30 'gcc -O2 -o prog.bin main.c && ./prog.bin'

  src='int main(){while(1){}return 0;}'
  run_box "cpp-infinite-loop" "$IMG_CC" main.cpp "$src" 8 'g++ -O2 -o prog.bin main.cpp && timeout 5 ./prog.bin; echo "inner=$?"'

  src='int main(){while(1){}return 0;}'
  run_box "c-infinite-loop" "$IMG_CC" main.c "$src" 8 'gcc -O2 -o prog.bin main.c && timeout 5 ./prog.bin; echo "inner=$?"'

  src='#include <vector>
int main(){std::vector<char> v; while(true) v.insert(v.end(), 10*1024*1024, 1); return 0;}'
  run_box "cpp-mem-hog" "$IMG_CC" main.cpp "$src" 20 'g++ -O2 -o prog.bin main.cpp && ./prog.bin'

  src='#include <stdlib.h>
#include <string.h>
int main(){volatile char* p; while(1){p=malloc(10*1024*1024); memset((void*)p,1,10*1024*1024);} return 0;}'
  run_box "c-mem-hog" "$IMG_CC" main.c "$src" 20 'gcc -O2 -o prog.bin main.c && ./prog.bin'

  src='#include <unistd.h>
#include <cstdio>
int main(){int n=0; for(int i=0;i<200;i++){pid_t p=fork(); if(p==0) return 0; if(p>0) n++;} std::printf("spawned %d\n", n); return 0;}'
  run_box "cpp-fork-bomb" "$IMG_CC" main.cpp "$src" 15 'g++ -O2 -o prog.bin main.cpp && timeout 8 ./prog.bin; echo "inner=$?"'

  src='#include <unistd.h>
#include <stdio.h>
int main(){int n=0; for(int i=0;i<200;i++){pid_t p=fork(); if(p==0) return 0; if(p>0) n++;} printf("spawned %d\n", n); return 0;}'
  run_box "c-fork-bomb" "$IMG_CC" main.c "$src" 15 'gcc -O2 -o prog.bin main.c && timeout 8 ./prog.bin; echo "inner=$?"'

  src='#include <cstdio>
#include <fstream>
#include <string>
int main(){
  std::ifstream f("/etc/passwd"); std::string s((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
  std::printf("passwd-bytes=%zu\n", s.size());
  FILE* p = popen("id", "r"); char b[256]; size_t n = p ? fread(b,1,sizeof b,p) : 0; if(p) pclose(p);
  std::printf("id-bytes=%zu\n", n);
  return 0;}'
  run_box "cpp-fs-probe" "$IMG_CC" main.cpp "$src" 20 'g++ -O2 -o prog.bin main.cpp && ./prog.bin'

  src='#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstdio>
#include <fcntl.h>
int main(){
  int s = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a{}; a.sin_family = AF_INET; a.sin_port = htons(80);
  inet_pton(AF_INET, "93.184.216.0", &a.sin_addr);
  fcntl(s, F_SETFL, O_NONBLOCK);
  int r = connect(s, (struct sockaddr*)&a, sizeof a);
  std::printf("connect=%d\n", r); close(s); return 0;}'
  run_box "cpp-net-egress" "$IMG_CC" main.cpp "$src" 20 'g++ -O2 -o prog.bin main.cpp && timeout 8 ./prog.bin'

  src='int main( { return 0; }'
  run_box "cpp-malformed" "$IMG_CC" main.cpp "$src" 30 'g++ -O2 -o prog.bin main.cpp; echo "compile=$?"'

  src='int main( { return 0; }'
  run_box "c-malformed" "$IMG_CC" main.c "$src" 30 'gcc -O2 -o prog.bin main.c; echo "compile=$?"'
}

part_misc() {
  echo "== misc: output caps, escape, compile bound, concurrency, cleanup =="
  local src=""

  # Oversized stdout: stream through head -c (production truncates + OLE verdict).
  src='for i in range(200000):
    print("X" * 1000)'
  local t0; t0=$(ms)
  printf '%s' "$src" | docker run $DFLAGS "$IMG_PY" bash -c 'cat > main.py && timeout 20 python3 main.py' 2>"$RES/misc-big-stdout.err" | head -c 1048576 > "$RES/misc-big-stdout.out"
  local ob; ob=$(wc -c <"$RES/misc-big-stdout.out" | tr -d ' ')
  local t1; t1=$(ms)
  row "| misc-big-stdout | \`python:3.12-slim\` | truncated-at-1MiB | $((t1-t0))ms | ${ob}B | 0B |"
  echo "[misc-big-stdout] truncated at ${ob}B in $((t1-t0))ms"

  src='#include <iostream>
#include <string>
int main(){std::string s(1000, 65); for(int i=0;i<200000;i++) std::cout << s << "\n"; return 0;}'
  t0=$(ms)
  printf '%s' "$src" | docker run $DFLAGS "$IMG_CC" bash -c 'cat > main.cpp && g++ -O2 -o prog.bin main.cpp && timeout 20 ./prog.bin' 2>"$RES/misc-big-stdout-cpp.err" | head -c 1048576 > "$RES/misc-big-stdout-cpp.out"
  ob=$(wc -c <"$RES/misc-big-stdout-cpp.out" | tr -d ' ')
  t1=$(ms)
  row "| misc-big-stdout-cpp | \`gcc:14-bookworm\` | truncated-at-1MiB | $((t1-t0))ms | ${ob}B | 0B |"
  echo "[misc-big-stdout-cpp] truncated at ${ob}B in $((t1-t0))ms"

  # Oversized stderr.
  src='import sys
for i in range(50000):
    sys.stderr.write("E" * 1000 + "\n")'
  run_box "misc-big-stderr" "$IMG_PY" main.py "$src" 20 'python3 main.py 2>&1 1>/dev/null | head -c 262144; echo "truncated"'

  # Escape attempts: write outside scratch, remount, caps, identity.
  src='import os
for p in ["/pwned", "/etc/pwned", "/tmp/pwned"]:
    try:
        open(p, "w").write("x")
        print(p, "WRITABLE (bad)")
    except OSError as e:
        print(p, "blocked:", type(e).__name__)
try:
    os.makedirs("/scratch/ok-sub", exist_ok=True)
    print("/scratch/ok-sub writable (good)")
except OSError as e:
    print("/scratch blocked (bad):", e)
print(open("/proc/self/status").read().split("CapEff:")[1].split()[0])
os.system("id")'
  run_box "misc-escape-py" "$IMG_PY" main.py "$src" 10 'python3 main.py'

  src='#include <cstdio>
int main(){
  FILE* f = fopen("/pwned", "w");
  std::printf("root-write=%s\n", f ? "YES(bad)" : "blocked(good)");
  if(f) fclose(f);
  return 0;}'
  run_box "misc-escape-cc" "$IMG_CC" main.cpp "$src" 20 'g++ -O2 -o prog.bin main.cpp && ./prog.bin && id'

  # Compile bound: pathological template, hard inner bound proves kill works.
  src='#include <cstdio>
template<int N> struct Fib { enum { v = Fib<N-1>::v + Fib<N-2>::v }; };
template<> struct Fib<0> { enum { v = 0 }; };
template<> struct Fib<1> { enum { v = 1 }; };
int main(){ std::printf("%d\n", Fib<30>::v); return 0; }'
  run_box "misc-compile-bound" "$IMG_CC" main.cpp "$src" 90 'timeout 60 g++ -O2 -o prog.bin main.cpp; echo "compile=$?"'

  # Compile abuse: generated 150k-function TU defeats template memoization and
  # must exceed the bound (container exit 124 = bound kill, no hang, no binary).
  run_box "misc-compile-abuse" "$IMG_CC" main.c "/* generated inside */" 200 'for i in $(seq 1 150000); do echo "int f$i(){return $i;}"; done > main.c && echo "int main(){return 0;}" >> main.c && timeout 150 gcc -O2 -o prog.bin main.c'

  # Concurrency: 4 parallel baselines.
  src='print("hello-arena")'
  t0=$(ms)
  for i in 1 2 3 4; do
    printf '%s' "$src" | docker run $DFLAGS "$IMG_PY" bash -c 'cat > main.py && python3 main.py' >"$RES/misc-conc-$i.out" 2>&1 &
  done
  wait
  t1=$(ms)
  local ok=0
  for i in 1 2 3 4; do grep -q hello-arena "$RES/misc-conc-$i.out" && ok=$((ok+1)); done
  row "| misc-concurrency-4x | \`python:3.12-slim\` | $ok/4 ok | $((t1-t0))ms | - | - |"
  echo "[misc-concurrency-4x] $ok/4 ok in $((t1-t0))ms"

  # Cleanup proof: no leftovers.
  local left; left=$(docker ps -q | wc -l | tr -d ' ')
  row "| misc-cleanup | containers-running-after-suite | $left | - | - | - |"
  echo "[misc-cleanup] containers still running: $left"
}

cold_start() {
  echo "== cold start =="
  local t0; t0=$(ms)
  docker run --rm --network none "$IMG_PY" true
  local t1; t1=$(ms)
  row "| cold-start-py | \`python:3.12-slim\` | 0 | $((t1-t0))ms | 0B | 0B |"
  t0=$(ms)
  docker run --rm --network none "$IMG_CC" true
  t1=$(ms)
  row "| cold-start-cc | \`gcc:14-bookworm\` | 0 | $((t1-t0))ms | 0B | 0B |"
  echo "[cold-start] py=$((t1-t0))ms (cc measured above)"
}

case "${1:-all}" in
  init) init_results;;
  py) part_py;;
  cx) part_cx;;
  misc) cold_start; part_misc;;
  all) init_results; cold_start; part_py; part_cx; part_misc;;
esac
echo "wrote $OUT"
