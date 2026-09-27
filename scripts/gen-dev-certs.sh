#!/bin/bash
# Generate local-only self-signed TLS certs (git-ignored). Production mounts
# real certificates at the same paths; nothing here ships.
set -euo pipefail
DIR="$(dirname "$0")/../infra/nginx/certs"
mkdir -p "$DIR"
DIR="$(cd "$DIR" && pwd)"
openssl req -x509 -newkey rsa:2048 -sha256 -days 30 -nodes \
  -keyout "$DIR/localhost.key" -out "$DIR/localhost.crt" \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
echo "dev certs written to $DIR (30 days, localhost only)"
