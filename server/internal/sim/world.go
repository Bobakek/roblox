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
mu sync.RWMutex
ents map[EntityID]*Entity
inputs chan Input
clients map[EntityID]chan []byte // каждому игроку будем стримить снапшоты
}


func NewWorld() *World {
return &World{
ents: map[EntityID]*Entity{},
inputs: make(chan Input, 1024),
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