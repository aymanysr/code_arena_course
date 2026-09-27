#!/bin/bash
# Check A measurements: ONE compile -> N isolated executions, ONE container.
# Compile wall is timed separately (flat across N proves a single compilation);
# batch wall covers compile+loop. Trivial doubling programs.
set -u
FLAGS="--rm --network none --cpus 1 --memory 256m --memory-swap 256m --pids-limit 64 --read-only --tmpfs /scratch:rw,exec,mode=1777 --tmpfs /tmp:rw,exec,mode=1777 --workdir /scratch --user nobody -i"
ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
C_PROG='#include <stdio.h>
int main(){int x; if(scanf("%d",&x)==1) printf("%d\n", x*2); return 0;}'
CPP_PROG='#include <cstdio>
int main(){int x; if(std::scanf("%d",&x)==1) std::printf("%d\n", x*2); return 0;}'

for n in 1 10 30 100; do
  : > /tmp/bench-tests.txt
  for ((i = 1; i <= n; i++)); do echo "$i|$((i * 2))" >> /tmp/bench-tests.txt; done
  TESTS_B64=$(base64 < /tmp/bench-tests.txt | tr -d '\n')
  for lang in c cpp; do
    if [ "$lang" = "c" ]; then CC=gcc; SRC="$C_PROG"; EXT=c; else CC=g++; SRC="$CPP_PROG"; EXT=cpp; fi
    T0=$(ms)
    printf '%s' "$SRC" | docker run $FLAGS gcc:14-bookworm bash -c 'cat > main.'$EXT' && T0=$(date +%s%N) && timeout 150 '"$CC"' -O2 -o prog main.'$EXT' && T1=$(date +%s%N) && echo "COMPILE_MS=$(( (T1 - T0) / 1000000 ))"' 2>/dev/null
    T1=$(ms); echo "[$lang N=$n] containers=1 compiles=1 compile_wall=$((T1 - T0))ms"
    T0=$(ms)
    printf '%s' "$SRC" | docker run $FLAGS -e TESTS="$TESTS_B64" gcc:14-bookworm bash -c 'cat > main.'$EXT' && '"$CC"' -O2 -o prog main.'$EXT' && echo "$TESTS" | base64 -d > tests.txt && FAIL=0 && while IFS="|" read -r IN EXP; do [ -z "$IN" ] && continue; printf "%s" "$IN" | timeout 5 ./prog > out.txt 2>/dev/null; [ "$(cat out.txt)" = "$EXP" ] || { echo "MISMATCH $IN"; FAIL=1; }; done < tests.txt && [ "$FAIL" = 0 ] && echo ALL_PASS' 2>/dev/null
    T1=$(ms); echo "[$lang N=$n] exec_batch_wall=$((T1 - T0))ms"
  done
done
docker ps -q | wc -l | xargs echo "leftover-containers:"
