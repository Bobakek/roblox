package sim

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// world bounds
const (
	worldMinX = -100.0
	worldMaxX = 100.0
	worldMinY = 0.0
	worldMaxY = 100.0
	worldMinZ = -100.0
	worldMaxZ = 100.0
)

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
	nextID  EntityID
	mirrors map[EntityID]float32 // коэффициенты для дублирования инпута игрока
}

func NewWorld() *World {
	w := &World{
		ents:    map[EntityID]*Entity{},
		inputs:  make(chan Input, 1024),
		clients: map[EntityID]chan []byte{},
		nextID:  1,
		mirrors: map[EntityID]float32{},
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
	ticker := time.NewTicker(dt)
	defer ticker.Stop()
	for range ticker.C {
		w.step(float32(dt.Seconds()))
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
	w.mu.Unlock()

	// 4) разослать снапшот (заглушка)
	w.broadcast()
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
	snap := snapshot{T: time.Now().UnixMilli()}
	snap.Entities = make([]entityState, 0, len(w.ents))
	for _, e := range w.ents {
		snap.Entities = append(snap.Entities, entityState{ID: e.ID, X: e.X, Y: e.Y, Z: e.Z})
	}
	chans := make([]chan []byte, 0, len(w.clients))
	for _, ch := range w.clients {
		chans = append(chans, ch)
	}
	w.mu.RUnlock()

	if len(chans) == 0 {
		return
	}

	data, err := json.Marshal(snap)
	if err != nil {
		return
	}

	for _, ch := range chans {
		select {
		case ch <- data:
		default:
			// дропаем если канал переполнен
		}
	}
}
