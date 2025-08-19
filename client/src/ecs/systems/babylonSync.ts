import { IWorld, defineQuery } from 'bitecs'
import { RenderTransform, Renderable } from '../components'
import { getMesh } from '../../scene/meshFactory'

export function babylonSyncSystem(world: IWorld) {
  const q = defineQuery([RenderTransform, Renderable])

  return () => {
    for (const eid of q(world)) {
      const mesh = getMesh(Renderable.meshId[eid].toString())
      if (mesh) {
        mesh.position.set(
          RenderTransform.x[eid],
          RenderTransform.y[eid],
          RenderTransform.z[eid]
        )
      }
    }
    return world
  }
}
