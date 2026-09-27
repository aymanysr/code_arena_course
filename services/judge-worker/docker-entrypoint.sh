#!/bin/sh
set -eu

python_image=${JUDGE_PYTHON_IMAGE:-python:3.12-slim}
gcc_image=${JUDGE_GCC_IMAGE:-gcc:14-bookworm}

# The worker alone receives the host Docker socket. Populate required images
# through the daemon before the readiness endpoint starts accepting Game.
docker info >/dev/null
for image in "$python_image" "$gcc_image"; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker pull "$image"
  fi
done

exec "$@"
