import { IWorld, defineQuery } from 'bitecs'
import { Transform, Renderable } from '../components'
import { getMesh } from '../../scene/meshFactory'

export function babylonSyncSystem(world: IWorld) {
  const q = defineQuery([Transform, Renderable])

  return () => {
    for (const eid of q(world)) {
      const mesh = getMesh(Renderable.meshId[eid].toString())
      if (mesh) {
        mesh.position.set(
          Transform.x[eid],
          Transform.y[eid],
          Transform.z[eid]
        )
      }
    }
    return world
  }
}
