#!/bin/sh
# Create one database + least-privilege role per service (ADR-0002).
# Runs once at first volume init as the superuser from POSTGRES_USER.
set -eu

create_pair() {
  _user="$1"; _pass="$2"; _db="$3"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${_user}') THEN
    CREATE ROLE ${_user} LOGIN PASSWORD '${_pass}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${_db} OWNER ${_user}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${_db}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${_db} TO ${_user};
EOSQL
}

create_pair "$CORE_DB_USER" "$CORE_DB_PASSWORD" "$CORE_DB_NAME"
create_pair "$GAME_DB_USER" "$GAME_DB_PASSWORD" "$GAME_DB_NAME"
create_pair "$CHAT_DB_USER" "$CHAT_DB_PASSWORD" "$CHAT_DB_NAME"
