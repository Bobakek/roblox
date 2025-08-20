import { IWorld, addEntity, addComponent, removeEntity, removeComponent } from 'bitecs'
import { Transform, Renderable, RenderTransform } from '../components'
import { createMeshFor, removeMesh } from '../../scene/meshFactory'

export const netIdToEid = new Map<string, number>()

export function syncEntities(
  world: IWorld,
  snapshot: { entities: Array<{ id: string; x: number; y: number; z: number }> }
) {
  const seen = new Set<string>()
  for (const { id } of snapshot.entities) {
    let eid = netIdToEid.get(id)
    if (eid === undefined) {
      eid = addEntity(world)
      addComponent(world, Transform, eid)
      addComponent(world, Renderable, eid)
      addComponent(world, RenderTransform, eid)
      Renderable.meshId[eid] = Number(id)
      createMeshFor(id)
      netIdToEid.set(id, eid)
    }
    seen.add(id)
  }

  for (const [id, eid] of netIdToEid) {
    if (!seen.has(id)) {
      removeComponent(world, RenderTransform, eid)
      removeComponent(world, Renderable, eid)
      removeMesh(id)
      removeEntity(world, eid)
      netIdToEid.delete(id)
    }
  }
}

export function netApplySystem(
  world: IWorld,
  snapshot: { entities: Array<{ id: string; x: number; y: number; z: number }> }
) {
  for (const { id, x, y, z } of snapshot.entities) {
    const eid = netIdToEid.get(id)
    if (eid === undefined) continue
    Transform.x[eid] = x
    Transform.y[eid] = y
    Transform.z[eid] = z
    RenderTransform.x[eid] = x
    RenderTransform.y[eid] = y
    RenderTransform.z[eid] = z
  }
}
