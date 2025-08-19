import { IWorld } from 'bitecs'
import { RenderTransform } from '../components'
import { NetClient } from '../../net/ws'
import { netIdToEid } from './netApply'

export function interpolateSystem(world: IWorld, net: NetClient) {
  return () => {
    const snaps = net.getSnapshots()
    if (snaps.length < 2) return world
    const renderNow = Date.now() - net.renderDelay
    let prev = snaps[0]
    let next = snaps[snaps.length - 1]
    for (let i = 0; i < snaps.length - 1; i++) {
      const a = snaps[i]
      const b = snaps[i + 1]
      if (a.t <= renderNow && renderNow <= b.t) {
        prev = a
        next = b
        break
      }
    }
    const t = (renderNow - prev.t) / (next.t - prev.t || 1)
    const prevMap = new Map(prev.entities.map(e => [String(e.id), e]))
    for (const { id, x, y, z } of next.entities) {
      const eid = netIdToEid.get(String(id))
      if (eid === undefined) continue
      const p = prevMap.get(String(id))
      if (!p) continue
      RenderTransform.x[eid] = p.x + (x - p.x) * t
      RenderTransform.y[eid] = p.y + (y - p.y) * t
      RenderTransform.z[eid] = p.z + (z - p.z) * t
    }
    return world
  }
}
