.PHONY: up down client server


up:
cd services && docker compose up -d


down:
cd services && docker compose down -v


client:
cd client && npm i && npm run dev


server:
cd server/cmd/game-server && go run .