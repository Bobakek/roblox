import { IWorld, addEntity, addComponent, removeEntity } from 'bitecs'
import { Transform, Renderable, RenderTransform } from '../components'

export const netIdToEid = new Map<string, number>()

export function netApplySystem(
  world: IWorld,
  snapshot: { entities: Array<{ id: string; x: number; y: number; z: number }> }
) {
  const seen = new Set<string>()
  for (const { id, x, y, z } of snapshot.entities) {
    let eid = netIdToEid.get(id)
    if (eid === undefined) {
      eid = addEntity(world)
      addComponent(world, Transform, eid)
      addComponent(world, Renderable, eid)
      addComponent(world, RenderTransform, eid)
      netIdToEid.set(id, eid)
    }
    Transform.x[eid] = x
    Transform.y[eid] = y
    Transform.z[eid] = z
    RenderTransform.x[eid] = x
    RenderTransform.y[eid] = y
    RenderTransform.z[eid] = z
    seen.add(id)
  }

  for (const [id, eid] of netIdToEid) {
    if (!seen.has(id)) {
      removeEntity(world, eid)
      netIdToEid.delete(id)
    }
  }
}
