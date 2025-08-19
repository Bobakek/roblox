#!/usr/bin/env bash
set -euo pipefail
(
cd services && docker compose up -d
)
(
cd server/cmd/game-server && go run .
) &
(
cd client && npm i && npm run dev
)
wait