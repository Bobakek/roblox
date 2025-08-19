package sim

import (
	"sync"
	"time"
)

type EntityID int64

type Entity struct {
	ID     EntityID
	X, Y, Z float32
}

type Input struct {
	T        int64
	AX, AY, AZ float32 // ускорение (для примера)
	EID      EntityID
}

type World struct {
	mu      sync.RWMutex
	ents    map[EntityID]*Entity
	inputs  chan Input
	clients map[EntityID]chan []byte // пока не используем
}

func NewWorld() *World {
	w := &World{
		ents:    map[EntityID]*Entity{},
		inputs:  make(chan Input, 1024),
		clients: map[EntityID]chan []byte{},
	}
	// Для теста создадим одну сущность игрока с ID=1
	w.ents[1] = &Entity{ID: 1, X: 0, Y: 0, Z: 0}
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
		if e, ok := w.ents[in.EID]; ok {
			// примитивная интеграция: pos += a * dt
			e.X += in.AX * dt
			e.Y += in.AY * dt
			e.Z += in.AZ * dt
		}
	}

	// 3) (опционально) можно сделать затухание/клампинг и т.д.
	// используем e в цикле, чтобы избежать предупреждений — но тут он реально нужен
	for _, e := range w.ents {
		_ = e // в этой версии мы позиции уже поменяли выше; цикл остаётся для будущих систем
	}
	w.mu.Unlock()

	// 4) разослать снапшот (заглушка)
	w.broadcast()
}

func (w *World) ApplyInput(in Input) { w.inputs <- in }

// TODO: сериализация снапшота и рассылка по интерес-менеджменту
func (w *World) broadcast() {
	// заглушка — реализуем позже
}
