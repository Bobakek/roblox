package sim

import "testing"

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
