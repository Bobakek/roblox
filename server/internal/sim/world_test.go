package sim

import (
	"encoding/json"
	"testing"
)

func TestWorldClampsEntities(t *testing.T) {
	w := NewWorld()
	// Move entity beyond max bounds
	w.ApplyInput(Input{EID: 1, AX: 1000, AY: 1000, AZ: 1000})
	w.step(1)
	w.mu.RLock()
	e := w.ents[1]
	if e.X > worldMaxX || e.Y > worldMaxY || e.Z > worldMaxZ {
		t.Fatalf("entity exceeded max bounds: %+v", e)
	}
	w.mu.RUnlock()

	// Move entity beyond min bounds
	w.ApplyInput(Input{EID: 1, AX: -1000, AY: -1000, AZ: -1000})
	w.step(1)
	w.mu.RLock()
	e = w.ents[1]
	if e.X < worldMinX || e.Y < worldMinY || e.Z < worldMinZ {
		t.Fatalf("entity exceeded min bounds: %+v", e)
	}
	w.mu.RUnlock()
}

func TestBroadcastFiltersEntitiesByRadius(t *testing.T) {
	w := NewWorld()
	ch := make(chan []byte, 1)
	w.AddClient(1, ch)

	w.mu.Lock()
	idNear := w.nextID
	w.nextID++
	w.ents[idNear] = &Entity{ID: idNear, X: 1, Y: 0, Z: 1}

	idFar := w.nextID
	w.nextID++
	w.ents[idFar] = &Entity{ID: idFar, X: 100, Y: 0, Z: 100}
	w.rebuildIndex()
	w.mu.Unlock()

	w.broadcast()

	data := <-ch
	var snap snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	ids := map[EntityID]bool{}
	for _, e := range snap.Entities {
		ids[e.ID] = true
	}
	if !ids[1] || !ids[idNear] || ids[idFar] {
		t.Fatalf("visibility filtering failed: %+v", snap.Entities)
	}
}
