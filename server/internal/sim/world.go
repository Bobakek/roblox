package sim

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

const defaultVisibilityRadius = float32(10.0)

type EntityID int64

type Entity struct {
	ID      EntityID
	X, Y, Z float32
}

type Input struct {
	T          int64
	AX, AY, AZ float32 // ускорение (для примера)
	EID        EntityID
}

type World struct {
	mu      sync.RWMutex
	ents    map[EntityID]*Entity
	inputs  chan Input
	clients map[EntityID]chan []byte // каждому клиенту шлём снапшоты
	users   map[EntityID]string      // соответствие EntityID -> userID
	nextID  EntityID
	mirrors map[EntityID]float32 // коэффициенты для дублирования инпута игрока

	visRadius float32
	index     spatialIndex
	clientPos map[EntityID][3]float32
}

func NewWorld() *World {
	w := &World{
		ents:      map[EntityID]*Entity{},
		inputs:    make(chan Input, 1024),
		clients:   map[EntityID]chan []byte{},
		users:     map[EntityID]string{},
		nextID:    1,
		mirrors:   map[EntityID]float32{},
		visRadius: defaultVisibilityRadius,
		index:     newSpatialIndex(defaultVisibilityRadius),
		clientPos: map[EntityID][3]float32{},
	}
	// Создаём основного игрока с ID=1
	w.ents[w.nextID] = &Entity{ID: w.nextID, X: 0, Y: 0, Z: 0}
	base := w.nextID
	w.nextID++

	// Добавляем несколько дополнительных сущностей
	coeffs := []float32{0.5, 1.5, -1, 2}
	for _, c := range coeffs {
		w.ents[w.nextID] = &Entity{ID: w.nextID, X: 0, Y: 0, Z: 0}
		w.mirrors[w.nextID] = c
		w.nextID++
	}

	// убеждаемся, что базовый ID не присутствует в mirrors
	delete(w.mirrors, base)

	return w
}

func (w *World) Run(dt time.Duration) {
	last := time.Now()
	var acc time.Duration
	stepDt := float32(dt.Seconds())

	var lastOverrunLog time.Time

	for {
		acc += time.Since(last)
		last = time.Now()

		steps := 0
		for acc >= dt {
			iterStart := time.Now()
			w.step(stepDt)
			elapsed := time.Since(iterStart)
			if elapsed > dt && (lastOverrunLog.IsZero() || time.Since(lastOverrunLog) > time.Second) {
				log.Printf("world.Run iteration overrun: %v", elapsed)
				lastOverrunLog = time.Now()
			}
			acc -= dt
			steps++
		}
		if steps > 1 && (lastOverrunLog.IsZero() || time.Since(lastOverrunLog) > time.Second) {
			log.Printf("world.Run tick overrun: processed %d steps", steps)
			lastOverrunLog = time.Now()
		}

		if acc > 0 {
			time.Sleep(dt - acc)
		}
	}
}

// забираем все инпуты из канала, не блокируясь
func (w *World) drainInputs() []Input {
	var batch []Input
	for {
		select {
		case in := <-w.inputs:
			batch = append(batch, in)
		default:
			return batch
		}
	}
}

func (w *World) step(dt float32) {
	start := time.Now()

	// 1) собрать все инпуты тика
	batch := w.drainInputs()

	// 2) применить их к миру
	w.mu.Lock()
	for _, in := range batch {
		if in.EID == 1 {
			// основной игрок управляет зеркалами
			if e, ok := w.ents[in.EID]; ok {
				e.X += in.AX * dt
				e.Y += in.AY * dt
				e.Z += in.AZ * dt
			}
			for id, k := range w.mirrors {
				if e, ok := w.ents[id]; ok {
					e.X += in.AX * dt * k
					e.Y += in.AY * dt * k
					e.Z += in.AZ * dt * k
				}
			}
		} else if e, ok := w.ents[in.EID]; ok {
			// обычная интеграция для прочих сущностей
			e.X += in.AX * dt
			e.Y += in.AY * dt
			e.Z += in.AZ * dt
		}
	}

	// 3) клампим координаты и детектим простые столкновения с границами мира
	for _, e := range w.ents {
		if e.X < worldMinX {
			e.X = worldMinX
			log.Printf("entity %d collided with min X", e.ID)
		} else if e.X > worldMaxX {
			e.X = worldMaxX
			log.Printf("entity %d collided with max X", e.ID)
		}
		if e.Y < worldMinY {
			e.Y = worldMinY
			log.Printf("entity %d collided with min Y", e.ID)
		} else if e.Y > worldMaxY {
			e.Y = worldMaxY
			log.Printf("entity %d collided with max Y", e.ID)
		}
		if e.Z < worldMinZ {
			e.Z = worldMinZ
			log.Printf("entity %d collided with min Z", e.ID)
		} else if e.Z > worldMaxZ {
			e.Z = worldMaxZ
			log.Printf("entity %d collided with max Z", e.ID)
		}
	}

	w.rebuildIndex()
	w.mu.Unlock()

	processDur := time.Since(start)
	startBroadcast := time.Now()
	// 4) разослать снапшот (заглушка)
	w.broadcast()
	broadcastDur := time.Since(startBroadcast)

	dtDur := time.Duration(float64(dt) * float64(time.Second))
	if processDur > dtDur {
		log.Printf("world.step processing overrun: %v", processDur)
	}
	if broadcastDur > dtDur {
		log.Printf("world.broadcast overrun: %v", broadcastDur)
	}
	if processDur+broadcastDur > dtDur {
		log.Printf("world.step total overrun: %v", processDur+broadcastDur)
	}
}

func (w *World) ApplyInput(in Input) { w.inputs <- in }

func (w *World) NewEntity() EntityID {
	w.mu.Lock()
	id := w.nextID
	w.nextID++
	w.ents[id] = &Entity{ID: id, X: 0, Y: 0, Z: 0}
	w.mu.Unlock()
	return id
}

// BindUser связывает EntityID с userID.
func (w *World) BindUser(id EntityID, userID string) {
	w.mu.Lock()
	w.users[id] = userID
	w.mu.Unlock()
}

// UnbindUser удаляет связь EntityID и userID.
func (w *World) UnbindUser(id EntityID) {
	w.mu.Lock()
	delete(w.users, id)
	w.mu.Unlock()
}

func (w *World) HasEntity(id EntityID) bool {
	w.mu.RLock()
	_, ok := w.ents[id]
	w.mu.RUnlock()
	return ok
}

// AddClient регистрирует канал для рассылки снапшотов конкретному игроку.
func (w *World) AddClient(id EntityID, ch chan []byte) {
	w.mu.Lock()
	w.clients[id] = ch
	w.mu.Unlock()
}

// RemoveClient убирает канал клиента из рассылки.
func (w *World) RemoveClient(id EntityID) {
	w.mu.Lock()
	delete(w.clients, id)
	w.mu.Unlock()
}

func (w *World) rebuildIndex() {
	if w.index.cellSize == 0 {
		w.index = newSpatialIndex(w.visRadius)
	}
	w.index.rebuild(w.ents)
	w.clientPos = make(map[EntityID][3]float32, len(w.clients))
	for id := range w.clients {
		if e, ok := w.ents[id]; ok {
			w.clientPos[id] = [3]float32{e.X, e.Y, e.Z}
		}
	}
}

type entityState struct {
	ID EntityID `json:"id"`
	X  float32  `json:"x"`
	Y  float32  `json:"y"`
	Z  float32  `json:"z"`
}

type snapshot struct {
	T        int64         `json:"t"`
	Entities []entityState `json:"entities"`
}

// broadcast собирает состояние всех сущностей, сериализует и
// рассылает по каналам клиентов. Здесь можно внедрить
// интерес-менеджмент, фильтруя Entities на клиента.
func (w *World) broadcast() {
	w.mu.RLock()
	ents := w.ents
	idx := w.index
	radius := w.visRadius
	clients := make(map[EntityID]chan []byte, len(w.clients))
	for id, ch := range w.clients {
		clients[id] = ch
	}
	positions := make(map[EntityID][3]float32, len(w.clientPos))
	for id, p := range w.clientPos {
		positions[id] = p
	}
	w.mu.RUnlock()

	for id, ch := range clients {
		pos, ok := positions[id]
		if !ok {
			continue
		}
		candidates := idx.query(pos[0], pos[2], radius)
		snap := snapshot{T: time.Now().UnixMilli()}
		snap.Entities = make([]entityState, 0, len(candidates))
		for _, eid := range candidates {
			if e, ok := ents[eid]; ok {
				dx := e.X - pos[0]
				dy := e.Y - pos[1]
				dz := e.Z - pos[2]
				if dx*dx+dy*dy+dz*dz <= radius*radius {
					snap.Entities = append(snap.Entities, entityState{ID: e.ID, X: e.X, Y: e.Y, Z: e.Z})
				}
			}
		}
		data, err := json.Marshal(snap)
		if err != nil {
			continue
		}
		select {
		case ch <- data:
		default:
		}
	}
}
