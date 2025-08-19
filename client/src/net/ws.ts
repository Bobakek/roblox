export type Input = { t: number; ax: number; ay: number; az: number }
export type Snapshot = { t: number; entities: Array<{ id: number; x:number; y:number; z:number }> }


export class NetClient {
private ws?: WebSocket
private connected = false
private pending: Input[] = []
private lastAck = 0
private state = new Map<number, { x: number; y: number; z: number }>()
private selfId?: number


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
this.lastAck = snap.t
// заменяем локальное состояние на серверный снапшот
this.state.clear()
for (const e of snap.entities) {
this.state.set(e.id, { x: e.x, y: e.y, z: e.z })
}
if (this.selfId === undefined && snap.entities.length > 0) {
this.selfId = snap.entities[0].id
}
// удаляем подтверждённые инпуты
this.pending = this.pending.filter((p) => p.t > this.lastAck)
// переигрываем оставшиеся инпуты поверх снапшота
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
ent.x += inp.ax * dt
ent.y += inp.ay * dt
ent.z += inp.az * dt
}
}