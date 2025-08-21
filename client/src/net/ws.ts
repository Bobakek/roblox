import { getPhysicsWorld } from '../physics/world'
import type * as RAPIER from '@dimforge/rapier3d-compat'

export type Input = { t: number; ax: number; ay: number; az: number }
export type Snapshot = { t: number; entities: Array<{ id: number; x:number; y:number; z:number }> }


export class NetClient {
private ws?: WebSocket
private connected = false
private pending: Input[] = []
private lastAck = 0
private state = new Map<string, { x: number; y: number; z: number }>()
private selfId?: string
private snapshots: Snapshot[] = []
private readonly maxSnapshots = 32
renderDelay = 100
serverTimeDiff = 0
 private world?: RAPIER.World
 private rapier?: typeof RAPIER
 private body?: RAPIER.RigidBody

 constructor() {
 getPhysicsWorld().then(({ RAPIER, world }) => {
 this.rapier = RAPIER
 this.world = world
 })
 }


connect(url = 'ws://localhost:8080/ws'): Promise<void> {
return new Promise((res, rej) => {
        this.ws = new WebSocket(url)
        this.ws.onopen = () => {
            this.connected = true
            for (const inp of this.pending) {
                this.ws!.send(JSON.stringify({ type: 'input', data: inp }))
            }
            res()
        }
        this.ws.onclose = () => {
            this.connected = false
        }
        this.ws.onerror = (e) => rej(e)
        this.ws.onmessage = (ev) => {
          const snap: Snapshot = JSON.parse(ev.data)
          this.serverTimeDiff = Date.now() - snap.t
          this.snapshots.push(snap)
          if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift()
          }
          this.lastAck = snap.t
            this.state.clear()
            for (const e of snap.entities) {
              this.state.set(String(e.id), { x: e.x, y: e.y, z: e.z })
            }
            if (this.selfId === undefined && snap.entities.length > 0) {
              this.selfId = String(snap.entities[0].id)
            }
            if (this.selfId && this.world && this.rapier && !this.body) {
              const ent = this.state.get(this.selfId)
              if (ent) {
                this.body = this.world.createRigidBody(
                  this.rapier.RigidBodyDesc.dynamic().setTranslation(ent.x, ent.y, ent.z)
                )
                this.world.createCollider(this.rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5), this.body)
              }
            }
            if (this.selfId && this.body) {
              const ent = this.state.get(this.selfId)
              if (ent) {
                this.body.setTranslation({ x: ent.x, y: ent.y, z: ent.z }, true)
                this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
              }
            }
            this.pending = this.pending.filter((p) => p.t > this.lastAck)
            let prevT = this.lastAck
            for (const inp of this.pending) {
              const dt = (inp.t - prevT) / 1000
              this.applyInput(inp, dt)
            prevT = inp.t
          }
        }
})
}


sendInput(inp: Input) {
// применяем инпут локально для предсказания и сохраняем
const prevT = this.pending.length ? this.pending[this.pending.length - 1].t : this.lastAck
const dt = (inp.t - prevT) / 1000
    this.applyInput(inp, dt)
    this.pending.push(inp)
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return
    }
    this.ws.send(JSON.stringify({ type: 'input', data: inp }))
}

  private applyInput(inp: Input, dt: number) {
  if (!this.selfId) return
  const ent = this.state.get(this.selfId)
  if (!ent) return
  if (this.world && this.body) {
    this.body.setTranslation({ x: ent.x, y: ent.y, z: ent.z }, true)
    this.body.setLinvel({ x: inp.ax, y: inp.ay, z: inp.az }, true)
    this.world.timestep = dt
    this.world.step()
    const p = this.body.translation()
    ent.x = p.x
    ent.y = p.y
    ent.z = p.z
  } else {
    ent.x += inp.ax * dt
    ent.y += inp.ay * dt
    ent.z += inp.az * dt
  }
  }

  getSelfState() {
  if (!this.selfId) return
  const ent = this.state.get(this.selfId)
  if (!ent) return
  return { id: this.selfId, x: ent.x, y: ent.y, z: ent.z }
  }

  getSnapshots() {
  return this.snapshots
  }
}
