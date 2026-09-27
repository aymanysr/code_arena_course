# Judge spike results (measured, linux/aarch64 containers)

| case | image | exit | wall | stdout | stderr |
|---|---|---|---|---|---|
| py-baseline | `python:3.12-slim` | 0 | 409ms | 12B | 0B |
| py-infinite-loop | `python:3.12-slim` | 124 | 8242ms | 0B | 0B |
| py-mem-hog | `python:3.12-slim` | 137 | 292ms | 0B | 0B |
| py-fork-bomb | `python:3.12-slim` | 0 | 6215ms | 11B | 0B |
| py-fs-probe | `python:3.12-slim` | 0 | 195ms | 264B | 0B |
| py-env-inspect | `python:3.12-slim` | 0 | 213ms | 49B | 0B |
| py-net-egress | `python:3.12-slim` | 0 | 289ms | 105B | 0B |
| py-child-proc | `python:3.12-slim` | 0 | 303ms | 9B | 0B |
| py-malformed | `python:3.12-slim` | 1 | 211ms | 0B | 93B |
| cpp-baseline | `gcc:14-bookworm` | 0 | 409ms | 12B | 0B |
| cpp-infinite-loop | `gcc:14-bookworm` | 0 | 5275ms | 10B | 0B |
| c-infinite-loop | `gcc:14-bookworm` | 0 | 5245ms | 10B | 0B |
| cpp-mem-hog | `gcc:14-bookworm` | 137 | 515ms | 0B | 0B |
| c-mem-hog | `gcc:14-bookworm` | 137 | 287ms | 0B | 0B |
| cpp-fork-bomb | `gcc:14-bookworm` | 0 | 295ms | 19B | 0B |
| c-fork-bomb | `gcc:14-bookworm` | 0 | 250ms | 19B | 0B |
| cpp-fs-probe | `gcc:14-bookworm` | 0 | 500ms | 29B | 0B |
| cpp-net-egress | `gcc:14-bookworm` | 0 | 305ms | 11B | 0B |
| cpp-malformed | `gcc:14-bookworm` | 0 | 218ms | 10B | 608B |
| c-malformed | `gcc:14-bookworm` | 0 | 220ms | 10B | 130B |
| c-baseline | `gcc:14-bookworm` | 0 | 332ms | 12B | 0B |
| cold-start-py | `python:3.12-slim` | 0 | 862ms | 0B | 0B |
| cold-start-cc | `gcc:14-bookworm` | 0 | 406ms | 0B | 0B |
| misc-big-stdout | `python:3.12-slim` | truncated-at-1MiB | 293ms | 1048576B | 0B |
| misc-big-stdout-cpp | `gcc:14-bookworm` | truncated-at-1MiB | 723ms | 1048576B | 0B |
| misc-big-stderr | `python:3.12-slim` | 0 | 712ms | 262154B | 0B |
| misc-escape-py | `python:3.12-slim` | 0 | 403ms | 186B | 0B |
| misc-escape-cc | `gcc:14-bookworm` | 0 | 406ms | 84B | 0B |
| misc-compile-bound | `gcc:14-bookworm` | 0 | 345ms | 10B | 0B |
| misc-concurrency-4x | `python:3.12-slim` | 4/4 ok | 466ms | - | - |
| misc-cleanup | containers-running-after-suite | 0 | - | - | - |
| misc-compile-abuse | `gcc:14-bookworm` | 124 (bound kill) | 150702ms | 0B | 0B |
