#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v bun >/dev/null 2>&1; then
  printf '%s\n' "Bun non trovato. Su Replit usa il modulo nodejs-22 oppure installa Bun." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node non trovato. Wrangler richiede Node 22 o successivo." >&2
  exit 1
fi

vars_file="apps/server/.dev.vars"
example_file="apps/server/.dev.vars.example"
model="${MOTS_MODEL:-}"

if [[ -f "$vars_file" && -z "$model" ]]; then
  model="$(sed -n 's/^MOTS_MODEL=//p' "$vars_file" | head -n 1)"
fi

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  {
    printf 'OPENROUTER_API_KEY=%s\n' "$OPENROUTER_API_KEY"
    if [[ -n "$model" ]]; then
      printf 'MOTS_MODEL=%s\n' "$model"
    fi
  } > "$vars_file"
  chmod 600 "$vars_file" 2>/dev/null || true
elif [[ ! -f "$vars_file" ]]; then
  cp "$example_file" "$vars_file"
  printf '%s\n' "OpenRouter non configurato: aggiungi OPENROUTER_API_KEY nei Secrets di Replit." >&2
fi

export NODE_ENV=development

if ! bun install --frozen-lockfile; then
  printf '%s\n' "Installazione con lockfile non riuscita; riprovo senza --frozen-lockfile." >&2
  bun install
fi

export BROWSER=none
export EXPO_NO_TELEMETRY=1

if [[ -n "${REPLIT_DEV_DOMAIN:-}" && -z "${EXPO_PUBLIC_MOTS_API_URL:-}" ]]; then
  export EXPO_PUBLIC_MOTS_API_URL="https://${REPLIT_DEV_DOMAIN}:8080"
fi

(
  cd apps/server
  exec node node_modules/wrangler/bin/wrangler.js dev --ip 0.0.0.0 --port 8787
) &
server_pid=$!

(
  cd apps/mobile
  exec node node_modules/expo/bin/cli start --web --port 8081
) &
web_pid=$!

cleanup() {
  kill "$server_pid" "$web_pid" 2>/dev/null || true
  wait "$server_pid" "$web_pid" 2>/dev/null || true
}

trap cleanup EXIT INT TERM
wait -n "$server_pid" "$web_pid"
