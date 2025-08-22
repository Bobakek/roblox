package sim

// spatialIndex implements a simple grid-based spatial index on the XZ plane.
// Entities are assigned to square cells defined by cellSize.

type cellCoord struct {
	X, Z int
}

type spatialIndex struct {
	cellSize float32
	cells    map[cellCoord][]EntityID
}

func newSpatialIndex(cellSize float32) spatialIndex {
	return spatialIndex{
		cellSize: cellSize,
		cells:    map[cellCoord][]EntityID{},
	}
}

// rebuild recreates the index from the provided set of entities.
func (si *spatialIndex) rebuild(ents map[EntityID]*Entity) {
	si.cells = map[cellCoord][]EntityID{}
	for id, e := range ents {
		cell := cellCoord{X: int(e.X / si.cellSize), Z: int(e.Z / si.cellSize)}
		si.cells[cell] = append(si.cells[cell], id)
	}
}

// query returns IDs of entities located within radius r around point (x, z).
// Returned IDs are candidates and may include entities slightly outside the radius.
func (si *spatialIndex) query(x, z, r float32) []EntityID {
	if si.cellSize <= 0 {
		return nil
	}
	minX := int((x - r) / si.cellSize)
	maxX := int((x + r) / si.cellSize)
	minZ := int((z - r) / si.cellSize)
	maxZ := int((z + r) / si.cellSize)
	var result []EntityID
	for cx := minX; cx <= maxX; cx++ {
		for cz := minZ; cz <= maxZ; cz++ {
			result = append(result, si.cells[cellCoord{cx, cz}]...)
		}
	}
	return result
}
