import { IWorld, defineQuery, hasComponent } from 'bitecs'
import { RenderTransform, Renderable, Transform } from '../components'
import { getMesh } from '../../scene/meshFactory'

export function babylonSyncSystem(world: IWorld) {
  const q = defineQuery([Renderable])

  return () => {
    for (const eid of q(world)) {
      const mesh = getMesh(Renderable.meshId[eid].toString())
      if (mesh) {
        if (hasComponent(world, RenderTransform, eid)) {
          mesh.position.set(
            RenderTransform.x[eid],
            RenderTransform.y[eid],
            RenderTransform.z[eid]
          )
        } else if (hasComponent(world, Transform, eid)) {
          mesh.position.set(
            Transform.x[eid],
            Transform.y[eid],
            Transform.z[eid]
          )
        }
      }
    }
    return world
  }
}
