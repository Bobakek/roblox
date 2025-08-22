# Монорепо: mmo-ugc

Ниже — минимальный рабочий шаблон: клиент (TS + Babylon.js + bitecs + Rapier WASM + WebSocket), бэкенд (Go, авторитетная симуляция), UGC-песочница (Web Worker), инфраструктура (Docker Compose: Postgres, Redis, NATS, Nakama, MinIO как S3, Grafana+Loki по желанию). Всё собрано так, чтобы стартануть локально и пошагово расширять.

---

## Структура репозитория

```
mmo-ugc/
├─ client/                   # браузерный клиент
│  ├─ src/
│  │  ├─ ecs/                # ECS (bitecs)
│  │  │  ├─ components.ts
│  │  │  ├─ systems/
│  │  │  │  ├─ movementSystem.ts
│  │  │  │  └─ renderSystem.ts
│  │  ├─ net/
│  │  │  ├─ ws.ts            # WebSocket клиент, предсказание/ре-консилиация
│  │  │  └─ snapshots.ts
│  │  ├─ physics/
│  │  │  └─ rapier.ts        # загрузка Rapier (WASM)
│  │  ├─ sandbox/
│  │  │  ├─ worker.ts        # UGC-песочница (Web Worker)
│  │  │  └─ api.ts           # белый список API для UGC-скриптов
│  │  ├─ scene/
│  │  │  ├─ engine.ts        # Babylon Engine/Scene bootstrap
│  │  │  └─ player.ts
│  │  ├─ ui/
│  │  │  └─ hud.tsx
│  │  ├─ main.tsx
│  │  └─ types.d.ts
│  ├─ public/
│  │  └─ index.html
│  ├─ vite.config.ts
│  ├─ package.json
│  └─ tsconfig.json
│
├─ server/                   # Go backend
│  ├─ cmd/
│  │  └─ game-server/
│  │     └─ main.go
│  ├─ internal/
│  │  ├─ net/
│  │  │  ├─ hub.go           # управление комнатами и клиентами
│  │  │  └─ ws.go            # WebSocket обработчики
│  │  ├─ sim/
│  │  │  ├─ world.go         # авторитетная симуляция (тики)
│  │  │  └─ components.go
│  │  ├─ repo/
│  │  │  ├─ pg.go            # Postgres
│  │  │  └─ redis.go
│  │  ├─ events/
│  │  │  └─ nats.go          # публикация/подписка на события
│  │  └─ auth/
│  │     └─ nakama.go        # интеграция с Nakama или заглушка
│  ├─ go.mod
│  └─ go.sum
│
├─ services/                 # сторонние сервисы (Docker)
│  ├─ docker-compose.yml
│  ├─ grafana/               # опционально
│  └─ loki/                  # опционально
│
├─ tools/
│  ├─ makefile
│  └─ scripts/
│     └─ dev.sh
│
└─ README.md
```

---

## 1) Клиент (TypeScript + Babylon.js + bitecs + Rapier WASM)

### `client/package.json`

```json
{
  "name": "mmo-ugc-client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@babylonjs/core": "^7.32.0",
    "@babylonjs/loaders": "^7.32.0",
    "bitecs": "^0.3.40",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vite": "^5.4.0"
  }
}
```

### `client/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
```

### `client/src/scene/engine.ts`

```ts
import { Engine, Scene, Vector3, HemisphericLight, ArcRotateCamera, MeshBuilder } from '@babylonjs/core'

export function createScene(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true)
  const scene = new Scene(engine)

  const camera = new ArcRotateCamera('cam', Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene)
  camera.attachControl(canvas, true)

  new HemisphericLight('h', new Vector3(0, 1, 0), scene)
  MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene)

  engine.runRenderLoop(() => scene.render())
  window.addEventListener('resize', () => engine.resize())

  return { engine, scene, camera }
}
```

### `client/src/main.tsx`

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { createScene } from './scene/engine'

function App() {
  const ref = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    if (ref.current) createScene(ref.current)
  }, [])
  return <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />
}

createRoot(document.getElementById('root')!).render(<App />)
```

### `client/public/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MMO UGC</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### ECS (bitecs) — компоненты и базовые системы

`client/src/ecs/components.ts`

```ts
import { defineComponent, Types } from 'bitecs'

export const Transform = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 })
export const Velocity  = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 })
export const PlayerTag = defineComponent()
```

`client/src/ecs/systems/movementSystem.ts`

```ts
import { defineQuery, enterQuery, exitQuery, IWorld } from 'bitecs'
import { Transform, Velocity } from '../components'

export function movementSystem(world: IWorld) {
  const q = defineQuery([Transform, Velocity])
  const enter = enterQuery(q)
  const exit = exitQuery(q)

  return (dt: number) => {
    for (const eid of q(world)) {
      Transform.x[eid] += Velocity.x[eid] * dt
      Transform.y[eid] += Velocity.y[eid] * dt
      Transform.z[eid] += Velocity.z[eid] * dt
    }
    enter(world); exit(world)
    return world
  }
}
```

### Rapier WASM загрузка

`client/src/physics/rapier.ts`

```ts
import init, * as RAPIER from '@dimforge/rapier3d-compat'

let ready: Promise<typeof RAPIER> | null = null
export function loadRapier() {
  if (!ready) ready = init().then(() => RAPIER)
  return ready
}
```

### Сеть: WebSocket клиент, снапшоты и предсказание

`client/src/net/ws.ts`

```ts
export type Input = { t: number; ax: number; ay: number; az: number }
export type Snapshot = { t: number; entities: Array<{ id: number; x:number; y:number; z:number }> }

export class NetClient {
  private ws?: WebSocket
  private pending: Input[] = []
  private lastAck = 0

  connect(url = 'ws://localhost:8080/ws'): Promise<void> {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(url)
      this.ws.onopen = () => res()
      this.ws.onerror = (e) => rej(e)
      this.ws.onmessage = (ev) => {
        const snap: Snapshot = JSON.parse(ev.data)
        this.lastAck = snap.t
        // TODO: reconcile локальное состояние
      }
    })
  }

  sendInput(inp: Input) {
    this.pending.push(inp)
    this.ws?.send(JSON.stringify({ type: 'input', data: inp }))
  }
}
```

---

## 2) Бэкенд (Go) — авторитетная симуляция + WebSocket

### `server/go.mod`

```go
module mmo-ugc/server

go 1.22

require (
	github.com/gorilla/websocket v1.5.1
	github.com/jackc/pgx/v5 v5.5.5
	github.com/redis/go-redis/v9 v9.5.1
	github.com/nats-io/nats.go v1.37.0
)
```

### `server/cmd/game-server/main.go`

```go
package main

import (
	"log"
	"net/http"
	"time"

	"mmo-ugc/server/internal/net"
	"mmo-ugc/server/internal/sim"
)

func main() {
	world := sim.NewWorld()
	hub := net.NewHub(world)

	go world.Run(20 * time.Millisecond) // 50 Hz тики
	go hub.Run()

	http.HandleFunc("/ws", hub.HandleWS)
	log.Println("game-server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### `server/internal/sim/world.go`

```go
package sim

import (
	"sync"
	"time"
)

type EntityID int64

type Entity struct { ID EntityID; X, Y, Z float32 }

type Input struct { T int64; AX, AY, AZ float32; EID EntityID }

// World хранит авторитетное состояние
 type World struct {
	mu      sync.RWMutex
	ents    map[EntityID]*Entity
	inputs  chan Input
	clients map[EntityID]chan []byte // каждому игроку будем стримить снапшоты
 }

func NewWorld() *World {
	return &World{
		ents:    map[EntityID]*Entity{},
		inputs:  make(chan Input, 1024),
		clients: map[EntityID]chan []byte{},
	}
}

func (w *World) Run(dt time.Duration) {
	ticker := time.NewTicker(dt)
	defer ticker.Stop()
	for range ticker.C {
		w.step(float32(dt.Seconds()))
	}
}

func (w *World) step(dt float32) {
	w.mu.Lock()
	// примитивная интеграция — только для примера
	for _, e := range w.ents {
		// ... обновление e.X/Y/Z под влиянием предыдущих инпутов
	}
	w.mu.Unlock()
	w.broadcast()
}

func (w *World) ApplyInput(in Input) { w.inputs <- in }

func (w *World) broadcast() {
	w.mu.RLock()
	// сериализуем снапшот минимально
	// TODO: интерес-менеджмент (видимость)
	w.mu.RUnlock()
}
```

### `server/internal/net/ws.go`

```go
package net

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"mmo-ugc/server/internal/sim"
)

var upgrader = websocket.Upgrader{ CheckOrigin: func(r *http.Request) bool { return true } }

type Hub struct {
	world *sim.World
}

func NewHub(w *sim.World) *Hub { return &Hub{world: w} }

func (h *Hub) Run() { /* broadcast routing, auth hooks, etc. */ }

type inbound struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type input struct {
	T  int64   `json:"t"`
	AX float32 `json:"ax"`
	AY float32 `json:"ay"`
	AZ float32 `json:"az"`
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil { log.Println("upgrade:", err); return }
	defer conn.Close()

	// TODO: auth (Nakama), создание EntityID
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil { log.Println("read:", err); return }
		var in inbound
		if err := json.Unmarshal(msg, &in); err != nil { continue }
		if in.Type == "input" {
			var inp input
			if err := json.Unmarshal(in.Data, &inp); err == nil {
				// TODO: маппинг на конкретного EntityID
				// h.world.ApplyInput(sim.Input{T: inp.T, AX: inp.AX, AY: inp.AY, AZ: inp.AZ, EID: ...})
			}
		}
	}
}
```

> Примечание: код серверной симуляции и рассылки снапшотов оставлен минималистичным, чтобы ты расширял по шагам (движемся менторским стилем).

---

## 3) UGC-песочница: Web Worker + белый список API

### `client/src/sandbox/api.ts`

```ts
export type SandboxAPI = {
  on(event: 'tick' | 'enter' | 'leave', cb: (...args:any[]) => void): void
  spawn(name: string, opts: { x:number; y:number; z:number }): number // возвращает entityId
  setPosition(id: number, x:number, y:number, z:number): void
  getTime(): number
}

// Прокси к движку, предоставляемый воркеру
export const createSandbox = (): Sandbox => {
  const listeners: Record<string, Function[]> = { tick: [], enter: [], leave: [] }
  const api: SandboxAPI = {
    on(ev, cb) { (listeners[ev] ||= []).push(cb) },
    spawn(name, opts) {
      postMessage({ type: 'spawn', name, opts })
      return Math.floor(Math.random() * 1e9)
    },
    setPosition(id, x, y, z) { postMessage({ type: 'setPosition', id, x, y, z }) },
    getTime() { return performance.now() }
  }
  // ...
  return { api, emit, sandbox, reset }
}
```

### `client/src/sandbox/worker.ts`

```ts
import { createSandbox } from './api'

const { sandbox, emit, reset } = createSandbox()
const api = (sandbox as any).api

self.onmessage = (ev) => {
  const msg = ev.data
  if (msg.type === 'load') {
    // загрузка пользовательского кода
  } else if (msg.type === 'tick') {
    // обработка событий
  }
}
```

> Ограничения: worker не видит DOM и WebSocket напрямую; общение только через `postMessage`. В бою — лимиты по времени (setTimeout watchdog), AbortController, счётчики CPU.

---

## 4) Инфраструктура: Docker Compose — Postgres, Redis, NATS, Nakama, MinIO

### `services/docker-compose.yml`

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: nakama
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: nakama
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  nats:
    image: nats:2
    ports: ["4222:4222", "8222:8222"]

  minio:
    image: minio/minio:RELEASE.2024-12-07T00-00-00Z
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

  nakama:
    image: heroiclabs/nakama:3.23.1
    depends_on: [postgres]
    entrypoint:
      - "/bin/sh"
      - "-ecx"
      - |
        /nakama/nakama migrate up --database.address postgres://nakama:secret@postgres:5432/nakama?sslmode=disable
        exec /nakama/nakama --name nakama1 --database.address postgres://nakama:secret@postgres:5432/nakama?sslmode=disable --logger.level DEBUG --console.port 7351
    ports: ["7350:7350", "7351:7351"]

volumes:
  pgdata: {}
  miniodata: {}
```

> MinIO = локальный S3 для ассетов UGC. Nakama берёт на себя авторизацию/соц. граф. NATS — шина событий (логирование, анти-абьюз, аналитика).

---

## 5) Makefile и dev-скрипт

### `tools/makefile`

```make
.PHONY: up down client server

up:
	cd services && docker compose up -d

down:
	cd services && docker compose down -v

client:
	cd client && npm i && npm run dev

server:
	cd server/cmd/game-server && go run .
```

### `tools/scripts/dev.sh`

```bash
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
```

---

## 6) Быстрый старт

1. Требования: Docker, Go 1.22+, Node 20+.
2. `make up` — запустить Postgres/Redis/NATS/MinIO/Nakama.
3. `make server` — старт авторитетного сервера (порт `:8080`).
4. `make client` — открыть `http://localhost:5173`.
5. В `client/src/net/ws.ts` укажи адрес WS сервера при необходимости.

### Codespaces WebSocket URL

When running in GitHub Codespaces the WebSocket host **must** use the port prefix format:

```
VITE_WS_URL=wss://8080-<codespace>.app.github.dev/ws
```

Open the **Ports** tab in your Codespace and ensure port `8080` is set to **Public** before connecting.

---

## 7) Куда расширять дальше (чек-лист)

* [ ] Интерес-менеджмент: рассылать снапшоты только тем, кто «видит» объект.
* [ ] Клиентское предсказание + reconcile (по `lastAck`).
* [ ] Серверная лаг-компенсация (время из инпута → rewind позиций).
* [ ] UGC: загрузчик пользовательского JS в Worker (валидатор AST, лимиты CPU/памяти).
* [ ] Экономика: Postgres схемы «wallet», «inventory», транзакции.
* [ ] Инвентарь ассетов: MinIO S3 + CDN-префикс.
* [ ] Метрики: Prometheus/Grafana; логи: Loki.

---

### Примечание менторства

Шаблон нарочно «тонкий»: ключевые места помечены `TODO`. Сначала поднимем скелет, убедимся в устойчивой петле "input → sim → snapshot", затем добавим UGC и экономику.
